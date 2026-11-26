import json
import logging
import os
import re
import sqlite3
import time
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from ..config import get_settings
from .local_music import local_music_service
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

        # 1. Exact /api/get
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
                    if synced or plain:
                        return synced, plain
            except Exception:
                pass

        # 2. Fuzzy /api/search fallback
        q = f"{clean_title} {primary_artist}".strip()
        search_url = f"https://lrclib.net/api/search?{urllib.parse.urlencode({'q': q})}"
        try:
            results = self._http_get_json(search_url)
            if isinstance(results, list) and results:
                best_synced = None
                best_synced_diff = 9999.0
                best_plain = None
                best_plain_diff = 9999.0
                for item in results:
                    if not isinstance(item, dict) or item.get("instrumental"):
                        continue
                    item_dur = float(item.get("duration") or 0)
                    diff = abs(item_dur - duration) if (duration > 0 and item_dur > 0) else 0.0
                    synced = (item.get("syncedLyrics") or "").strip()
                    plain = (item.get("plainLyrics") or "").strip()
                    if synced and (duration <= 0 or diff <= 12.0) and diff < best_synced_diff:
                        best_synced = (synced, plain)
                        best_synced_diff = diff
                    if plain and diff < best_plain_diff:
                        best_plain = ("", plain)
                        best_plain_diff = diff
                if best_synced:
                    return best_synced
                if best_plain:
                    return best_plain
        except Exception as e:
            logger.debug("LRCLIB search error for '%s': %s", q, e)

        return "", ""

    def _format_response(self, video_id: str, synced_lrc: str, plain_lyrics: str, source: str) -> Dict[str, Any]:
        lines = parse_lrc(synced_lrc) if synced_lrc else []
        synced = len(lines) > 0
        plain = plain_lyrics or ("\n".join(line["text"] for line in lines if line["text"]) if lines else "")
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


lyrics_service = LyricsService()
