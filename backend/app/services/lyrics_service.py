import base64
from difflib import SequenceMatcher
import json
import logging
import math
import os
import re
import sqlite3
import struct
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import get_settings
from .local_music import local_music_service
from .media_cache import media_cache
from .transliterate import is_mostly_latin, transliterate_to_latin
from .ytmusic import ytmusic_service

logger = logging.getLogger(__name__)

_LRC_TS_RE = re.compile(r"\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]")
_CLEAN_TITLE_RE = re.compile(r"\s*[\(\[](?:from\s+.*?|official.*?|lyric.*?|audio.*?|video.*?|remaster.*?|deluxe.*?|feat\.?.*?|ft\.?.*?)[\)\]]", re.IGNORECASE)
_NEG_CACHE_TTL = 7 * 86400  # Re-check missing lyrics after 7 days
_USER_AGENT = "NivasMusic/1.0 (https://github.com/kdvlr/nivas)"


def parse_lrc(lrc_text: str) -> List[Dict[str, Any]]:
    """Parse LRC formatted text into sorted [{time: float, text: str}] lines."""
    if not lrc_text:
        return []
    entries: List[Tuple[float, str]] = []
    for raw_line in lrc_text.splitlines():
        matches = list(_LRC_TS_RE.finditer(raw_line))
        if not matches:
            continue
        text = _LRC_TS_RE.sub("", raw_line).strip()
        for m in matches:
            mins = int(m.group(1))
            secs = int(m.group(2))
            frac_str = m.group(3) or "0"
            if len(frac_str) == 1:
                frac = int(frac_str) / 10.0
            elif len(frac_str) == 2:
                frac = int(frac_str) / 100.0
            else:
                frac = int(frac_str[:3]) / 1000.0
            ts = round(mins * 60 + secs + frac, 3)
            entries.append((ts, text))
    entries.sort(key=lambda item: item[0])
    # Drop leading empty lines, keep internal empty lines as instrumental breaks
    while entries and not entries[0][1]:
        entries.pop(0)
    return [{"time": ts, "text": txt} for ts, txt in entries]


def _clean_query_title(title: str) -> str:
    cleaned = _CLEAN_TITLE_RE.sub("", title or "").strip()
    return cleaned or (title or "").strip()


def _norm_match(text: str) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (text or "").lower()).split())


def _title_similarity(a: str, b: str) -> float:
    na, nb = _norm_match(a), _norm_match(b)
    if not na or not nb:
        return 0.0
    if na == nb:
        return 1.0
    # Strip spaces too so "arabickadaloram" matches "arabi kadaloram"
    sa, sb = na.replace(" ", ""), nb.replace(" ", "")
    if sa == sb:
        return 0.98
    return max(SequenceMatcher(None, na, nb).ratio(), SequenceMatcher(None, sa, sb).ratio())


class LyricsService:
    def __init__(self, data_dir: Optional[str] = None):
        self.data_dir = Path(data_dir) if data_dir else Path(get_settings().data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self.db_path = self.data_dir / "lyrics.db"
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(str(self.db_path), timeout=10.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS lyrics_cache (
                    video_id TEXT PRIMARY KEY,
                    synced_lrc TEXT,
                    plain_lyrics TEXT,
                    source TEXT NOT NULL,
                    fetched_at REAL NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS lyrics_settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE TABLE IF NOT EXISTS spectrum_cache (
                    video_id TEXT PRIMARY KEY,
                    fps INTEGER NOT NULL,
                    bands INTEGER NOT NULL,
                    data BLOB NOT NULL,
                    created_at REAL NOT NULL
                )
            """)
            conn.commit()

    def get_settings_dict(self) -> Dict[str, Any]:
        defaults: Dict[str, Any] = {
            "syncOffset": 0.0,
            "visualMode": "ambient",
            "bouncingStar": True,
        }
        try:
            with self._get_conn() as conn:
                rows = conn.execute("SELECT key, value FROM lyrics_settings").fetchall()
                for row in rows:
                    k, v = row["key"], row["value"]
                    if k == "syncOffset":
                        defaults[k] = float(v)
                    elif k == "bouncingStar":
                        defaults[k] = v.lower() in ("1", "true", "yes")
                    elif k == "visualMode" and v in ("ambient", "party", "starlight"):
                        defaults[k] = v
        except Exception as e:
            logger.error("Error reading lyrics settings: %s", e)
        return defaults

    def update_settings(
        self,
        sync_offset: Optional[float] = None,
        visual_mode: Optional[str] = None,
        bouncing_star: Optional[bool] = None,
    ) -> Dict[str, Any]:
        updates: List[Tuple[str, str]] = []
        if sync_offset is not None:
            clamped = round(max(-10.0, min(10.0, float(sync_offset))), 2)
            updates.append(("syncOffset", str(clamped)))
        if visual_mode is not None and visual_mode in ("ambient", "party", "starlight"):
            updates.append(("visualMode", visual_mode))
        if bouncing_star is not None:
            updates.append(("bouncingStar", "true" if bouncing_star else "false"))

        if updates:
            try:
                with self._get_conn() as conn:
                    conn.executemany(
                        "INSERT OR REPLACE INTO lyrics_settings (key, value) VALUES (?, ?)",
                        updates,
                    )
                    conn.commit()
            except Exception as e:
                logger.error("Error saving lyrics settings: %s", e)
        return self.get_settings_dict()

    def _read_cache(self, video_id: str) -> Optional[Dict[str, Any]]:
        try:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT synced_lrc, plain_lyrics, source, fetched_at FROM lyrics_cache WHERE video_id = ?",
                    (video_id,),
                ).fetchone()
                if not row:
                    return None
                if row["source"] == "none" and (time.time() - float(row["fetched_at"])) > _NEG_CACHE_TTL:
                    return None
                return {
                    "synced_lrc": row["synced_lrc"] or "",
                    "plain_lyrics": row["plain_lyrics"] or "",
                    "source": row["source"],
                }
        except Exception as e:
            logger.error("Error reading lyrics cache for %s: %s", video_id, e)
            return None

    def _write_cache(self, video_id: str, synced_lrc: str, plain_lyrics: str, source: str) -> None:
        try:
            with self._get_conn() as conn:
                conn.execute(
                    """
                    INSERT OR REPLACE INTO lyrics_cache (video_id, synced_lrc, plain_lyrics, source, fetched_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (video_id, synced_lrc or "", plain_lyrics or "", source, time.time()),
                )
                conn.commit()
        except Exception as e:
            logger.error("Error writing lyrics cache for %s: %s", video_id, e)

    def _read_local_file_lyrics(self, file_path: str) -> Tuple[str, str, str]:
        """Check sidecar .lrc file first, then embedded audio tags."""
        if not file_path or not os.path.exists(file_path):
            return "", "", ""

        # 1. Sidecar .lrc
        lrc_path = os.path.splitext(file_path)[0] + ".lrc"
        if os.path.isfile(lrc_path):
            try:
                content = Path(lrc_path).read_text(encoding="utf-8", errors="replace").strip()
                if content:
                    if _LRC_TS_RE.search(content):
                        plain = "\n".join(line["text"] for line in parse_lrc(content) if line["text"])
                        return content, plain, "local_lrc"
                    return "", content, "local_lrc"
            except Exception as e:
                logger.debug("Failed reading sidecar .lrc %s: %s", lrc_path, e)

        # 2. Embedded tags via mutagen
        try:
            import mutagen
            mf = mutagen.File(file_path)
            tags = mf.tags if mf else None
            if not tags:
                return "", "", ""
            raw_text = ""
            ext = os.path.splitext(file_path)[1].lower()
            if ext == ".flac":
                for k in ("lyrics", "LYRICS", "unsyncedlyrics", "UNSYNCEDLYRICS"):
                    if k in tags and tags[k]:
                        raw_text = str(tags[k][0]).strip()
                        break
            elif ext in (".m4a", ".m4b", ".alac", ".mp4"):
                if "\xa9lyr" in tags and tags["\xa9lyr"]:
                    raw_text = str(tags["\xa9lyr"][0]).strip()
            else:
                for k in list(tags.keys()):
                    if k.startswith("USLT"):
                        raw_text = str(tags[k].text).strip()
                        break
            if raw_text:
                if _LRC_TS_RE.search(raw_text):
                    plain = "\n".join(line["text"] for line in parse_lrc(raw_text) if line["text"])
                    return raw_text, plain, "embedded"
                return "", raw_text, "embedded"
        except Exception as e:
            logger.debug("Failed reading embedded lyrics from %s: %s", file_path, e)

        return "", "", ""

    def _http_get_json(self, url: str) -> Any:
        req = urllib.request.Request(url, headers={"User-Agent": _USER_AGENT, "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def _fetch_lrclib(self, title: str, artist: str, album: str, duration: float) -> Tuple[str, str]:
        clean_title = _clean_query_title(title)
        if not clean_title:
            return "", ""

        primary_artist = (artist or "").split(",")[0].split("&")[0].strip()

        # 1. Exact /api/get (if result is non-Latin, still check /api/search for a Romanized synced version)
        exact_fallback: Optional[Tuple[str, str]] = None
        if primary_artist:
            params: Dict[str, Any] = {
                "track_name": clean_title,
                "artist_name": primary_artist,
            }
            if album:
                params["album_name"] = album
            if duration and duration > 0:
                params["duration"] = int(round(duration))
            url = f"https://lrclib.net/api/get?{urllib.parse.urlencode(params)}"
            try:
                data = self._http_get_json(url)
                if isinstance(data, dict) and not data.get("instrumental"):
                    synced = (data.get("syncedLyrics") or "").strip()
                    plain = (data.get("plainLyrics") or "").strip()
                    if synced and is_mostly_latin(synced):
                        return synced, plain
                    if synced or plain:
                        exact_fallback = (synced, plain)
            except Exception:
                pass

        # 2. Multi-step /api/search fallback (strongly prefer Latin/Romanized synced lyrics)
        search_queries: List[Tuple[str, float]] = []
        if primary_artist:
            search_queries.append((f"{clean_title} {primary_artist}".strip(), 18.0))
        if album:
            search_queries.append((f"{clean_title} {album}".strip(), 18.0))
        search_queries.append((clean_title, 15.0))
        words = clean_title.split()
        if album and words and len(words[0]) >= 3:
            search_queries.append((f"{words[0]} {album}".strip(), 10.0))

        seen_q = set()
        norm_album = _norm_match(album)
        best_synced = None
        best_synced_key = (2, 2, 1, 9999.0)
        best_plain = None
        best_plain_key = (2, 2, 1, 9999.0)

        for q, max_dur_diff in search_queries:
            q_norm = q.lower()
            if not q or q_norm in seen_q:
                continue
            seen_q.add(q_norm)
            search_url = f"https://lrclib.net/api/search?{urllib.parse.urlencode({'q': q})}"
            try:
                results = self._http_get_json(search_url)
                if not isinstance(results, list) or not results:
                    continue
                for item in results:
                    if not isinstance(item, dict) or item.get("instrumental"):
                        continue
                    item_title = _clean_query_title(item.get("trackName") or "")
                    tsim = _title_similarity(clean_title, item_title)
                    if tsim < 0.65:
                        continue
                    item_dur = float(item.get("duration") or 0)
                    diff = abs(item_dur - duration) if (duration > 0 and item_dur > 0) else 0.0
                    if duration > 0 and item_dur > 0 and diff > max_dur_diff:
                        continue
                    item_album = _norm_match(item.get("albumName") or "")
                    album_mismatch = 0 if (norm_album and norm_album in item_album) else 1
                    title_bucket = 0 if tsim >= 0.88 else 1
                    synced = (item.get("syncedLyrics") or "").strip()
                    plain = (item.get("plainLyrics") or "").strip()
                    if synced:
                        key = (title_bucket, 0 if is_mostly_latin(synced) else 1, album_mismatch, diff)
                        if key < best_synced_key:
                            best_synced = (synced, plain)
                            best_synced_key = key
                    if plain:
                        key = (title_bucket, 0 if is_mostly_latin(plain) else 1, album_mismatch, diff)
                        if key < best_plain_key:
                            best_plain = ("", plain)
                            best_plain_key = key
                # Stop early once we have an exact-title Latin synced match
                if best_synced and best_synced_key[0] == 0 and best_synced_key[1] == 0 and best_synced_key[3] <= 8.0:
                    return best_synced
            except Exception as e:
                logger.debug("LRCLIB search error for '%s': %s", q, e)

        if best_synced:
            return best_synced
        if exact_fallback:
            return exact_fallback
        if best_plain:
            return best_plain
        return "", ""

    def _format_response(self, video_id: str, synced_lrc: str, plain_lyrics: str, source: str) -> Dict[str, Any]:
        raw_lines = parse_lrc(synced_lrc) if synced_lrc else []
        lines = [
            {"time": line["time"], "text": transliterate_to_latin(line["text"])}
            for line in raw_lines
        ]
        synced = len(lines) > 0
        raw_plain = plain_lyrics or ("\n".join(line["text"] for line in lines if line["text"]) if lines else "")
        plain = transliterate_to_latin(raw_plain)
        return {
            "videoId": video_id,
            "synced": synced,
            "lines": lines,
            "plain": plain,
            "lyrics": plain,
            "source": source,
        }

    def get_lyrics(
        self,
        video_id: str,
        title: str = "",
        artist: str = "",
        album: str = "",
        duration: float = 0.0,
        refresh: bool = False,
    ) -> Dict[str, Any]:
        if not refresh:
            cached = self._read_cache(video_id)
            if cached is not None:
                return self._format_response(
                    video_id, cached["synced_lrc"], cached["plain_lyrics"], cached["source"]
                )

        file_path = ""
        is_local = video_id.startswith("local:")
        if is_local:
            local_id = video_id[len("local:"):]
            track = local_music_service.get_track(local_id)
            if track:
                file_path = track.get("filePath") or ""
                title = title or track.get("title") or ""
                artist = artist or track.get("artist") or track.get("albumArtist") or ""
                album = album or track.get("album") or ""
                duration = duration or float(track.get("duration") or 0)

        # 1. Local sidecar .lrc or embedded tags
        if file_path:
            synced_lrc, plain_lyrics, src = self._read_local_file_lyrics(file_path)
            if synced_lrc or plain_lyrics:
                self._write_cache(video_id, synced_lrc, plain_lyrics, src)
                return self._format_response(video_id, synced_lrc, plain_lyrics, src)

        # 2. LRCLIB on-demand lookup
        if title:
            synced_lrc, plain_lyrics = self._fetch_lrclib(title, artist, album, duration)
            if synced_lrc or plain_lyrics:
                self._write_cache(video_id, synced_lrc, plain_lyrics, "lrclib")
                return self._format_response(video_id, synced_lrc, plain_lyrics, "lrclib")

        # 3. YouTube Music plain-text fallback
        if not is_local:
            try:
                yt_data = ytmusic_service.get_lyrics(video_id)
                yt_text = (yt_data.get("lyrics") or yt_data.get("text") or "").strip() if isinstance(yt_data, dict) else ""
                if yt_text:
                    self._write_cache(video_id, "", yt_text, "ytmusic")
                    return self._format_response(video_id, "", yt_text, "ytmusic")
            except Exception as e:
                logger.debug("YTMusic fallback lyrics error for %s: %s", video_id, e)

        self._write_cache(video_id, "", "", "none")
        return self._format_response(video_id, "", "", "none")

    def _resolve_audio_file(self, video_id: str) -> str:
        if video_id.startswith("local:"):
            track = local_music_service.get_track(video_id[len("local:"):])
            fp = (track or {}).get("filePath") or ""
            return fp if fp and os.path.isfile(fp) else ""
        cached = media_cache.audio_path(video_id)
        if cached.exists() and cached.stat().st_size > 44:
            return str(cached)
        return ""

    @staticmethod
    def _compute_spectrum_bytes(audio_path: str, fps: int = 12) -> bytes:
        """Decode audio to 8kHz mono PCM via ffmpeg and extract 16 log-spaced Goertzel bands (uint8)."""
        proc = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", audio_path, "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "pipe:1"],
            capture_output=True,
            check=True,
            timeout=25,
        )
        raw = proc.stdout
        n_samples = len(raw) // 2
        win = 128
        hop = max(1, 8000 // fps)
        if n_samples < win:
            return b""
        # 16 log-spaced bins from 62.5Hz (bin 1) to 3875Hz (bin 62)
        bins = (1, 2, 3, 4, 5, 6, 8, 10, 13, 16, 20, 25, 32, 40, 50, 62)
        cos_t = tuple(2.0 * math.cos(2.0 * math.pi * k / win) for k in bins)
        # Gentle perceptual weighting: boost highs slightly so treble bands stay lively
        gains = (1.0, 1.0, 1.05, 1.1, 1.15, 1.2, 1.25, 1.35, 1.45, 1.6, 1.75, 1.9, 2.1, 2.3, 2.5, 2.7)
        inv_norm = 1.0 / (win * 16384.0)
        log_denom = math.log1p(45.0)

        out = bytearray()
        for start in range(0, n_samples - win, hop):
            chunk = struct.unpack_from(f"<{win}h", raw, start * 2)
            for idx, c in enumerate(cos_t):
                s1 = 0.0
                s2 = 0.0
                for x in chunk:
                    s0 = x + c * s1 - s2
                    s2 = s1
                    s1 = s0
                mag = math.sqrt(max(0.0, s1 * s1 + s2 * s2 - c * s1 * s2)) * inv_norm * gains[idx]
                v = int(min(255, max(0, (math.log1p(mag * 45.0) / log_denom) * 255.0)))
                out.append(v)
        return bytes(out)

    def get_spectrum(self, video_id: str) -> Dict[str, Any]:
        fps = 12
        bands = 16
        try:
            with self._get_conn() as conn:
                row = conn.execute(
                    "SELECT fps, bands, data FROM spectrum_cache WHERE video_id = ?",
                    (video_id,),
                ).fetchone()
                if row and row["data"]:
                    return {
                        "videoId": video_id,
                        "fps": int(row["fps"]),
                        "bands": int(row["bands"]),
                        "available": True,
                        "data": base64.b64encode(row["data"]).decode("ascii"),
                    }
        except Exception as e:
            logger.error("Error reading spectrum cache for %s: %s", video_id, e)

        audio_path = self._resolve_audio_file(video_id)
        if not audio_path:
            return {"videoId": video_id, "fps": fps, "bands": bands, "available": False, "data": ""}

        try:
            raw_bytes = self._compute_spectrum_bytes(audio_path, fps=fps)
            if not raw_bytes:
                return {"videoId": video_id, "fps": fps, "bands": bands, "available": False, "data": ""}
            with self._get_conn() as conn:
                conn.execute(
                    "INSERT OR REPLACE INTO spectrum_cache (video_id, fps, bands, data, created_at) VALUES (?, ?, ?, ?, ?)",
                    (video_id, fps, bands, raw_bytes, time.time()),
                )
                conn.commit()
            return {
                "videoId": video_id,
                "fps": fps,
                "bands": bands,
                "available": True,
                "data": base64.b64encode(raw_bytes).decode("ascii"),
            }
        except Exception as e:
            logger.warning("Spectrum extraction failed for %s: %s", video_id, e)
            return {"videoId": video_id, "fps": fps, "bands": bands, "available": False, "data": ""}


lyrics_service = LyricsService()
