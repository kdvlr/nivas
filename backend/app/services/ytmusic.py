import hashlib
import json
import logging
import os
import re
import tempfile
import time
from typing import Any, Dict, List, Optional, Tuple
from pathlib import Path

from ..config import get_settings

logger = logging.getLogger(__name__)

CACHE_TTL = {
    "search": 300,        # 5 minutes
    "home": 600,          # 10 minutes
    "charts": 3600,       # 1 hour
    "artist": 1800,       # 30 minutes
    "album": 3600,        # 1 hour
    "playlist": 900,      # 15 minutes
    "lyrics": 86400,      # 24 hours
    "stream": 14400,      # 4 hours
}


def parse_and_build_ytmusic_headers(raw_input: str) -> Dict[str, str]:
    """Parse raw browser headers, JSON cookie array, Netscape cookies, or cookie string into valid ytmusicapi browser headers."""
    if not isinstance(raw_input, str):
        raise ValueError("Input must be a string")

    raw_input = raw_input.strip()
    if not raw_input:
        raise ValueError("Input is empty")

    user_headers: Dict[str, str] = {}
    cookie_str = ""

    # 1. Check if Netscape cookie format (e.g. cookies.txt exported from browser)
    if raw_input.startswith("# Netscape") or "\tTRUE\t" in raw_input or "\tFALSE\t" in raw_input:
        cookie_parts = []
        for line in raw_input.splitlines():
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            parts = line.split("\t")
            if len(parts) >= 7:
                cookie_parts.append(f"{parts[5]}={parts[6]}")
        cookie_str = "; ".join(cookie_parts)

    # 2. Check if JSON array (e.g. EditThisCookie, Cookie-Editor export)
    elif raw_input.startswith("["):
        try:
            arr = json.loads(raw_input)
            if isinstance(arr, list):
                cookie_parts = [
                    f"{c['name']}={c['value']}"
                    for c in arr
                    if isinstance(c, dict) and "name" in c and "value" in c
                ]
                cookie_str = "; ".join(cookie_parts)
        except Exception as e:
            raise ValueError(f"Malformed JSON array: {e}") from e

    # 3. Check if JSON dict (e.g. {"Cookie": "..."} or {"cookie": "...", "authorization": "..."})
    elif raw_input.startswith("{"):
        try:
            d = json.loads(raw_input)
            if isinstance(d, dict):
                lowered = {str(k).lower(): str(v) for k, v in d.items()}
                if "cookie" in lowered:
                    cookie_str = lowered["cookie"]
                user_headers = lowered
        except Exception as e:
            raise ValueError(f"Malformed JSON object: {e}") from e

    # 4. If no cookie extracted yet, check line-by-line headers or raw cookie string
    if not cookie_str:
        has_colon_headers = False
        for line in raw_input.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                user_headers[k.strip().lower()] = v.strip()
                if k.strip().lower() == "cookie":
                    cookie_str = v.strip()
                    has_colon_headers = True

        if not cookie_str and not has_colon_headers and "=" in raw_input:
            cookie_str = raw_input.replace("\n", "; ").strip()

    if cookie_str:
        user_headers["cookie"] = cookie_str

    if "cookie" not in user_headers:
        raise ValueError("No cookie found in the provided credentials. Please paste valid cookies or browser headers.")

    # 5. Extract SAPISID or __Secure-3PAPISID to compute SAPISIDHASH authorization header if not provided
    if "authorization" not in user_headers:
        cookie_val = user_headers["cookie"]
        sapisid_match = re.search(r"(?:__Secure-3PAPISID|SAPISID)=([^;\"'\s]+)", cookie_val)
        if sapisid_match:
            sapisid = sapisid_match.group(1).strip()
            origin = user_headers.get("origin", "https://music.youtube.com")
            now_ts = str(int(time.time()))
            sha1_hash = hashlib.sha1(f"{now_ts} {sapisid} {origin}".encode("utf-8")).hexdigest()
            user_headers["authorization"] = f"SAPISIDHASH {now_ts}_{sha1_hash}"
        else:
            raise ValueError("Cookie does not contain SAPISID or __Secure-3PAPISID token required for YouTube Music authentication.")

    # 6. Fill in standard browser defaults
    default_headers = {
        "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "accept": "*/*",
        "accept-encoding": "gzip, deflate",
        "content-type": "application/json",
        "origin": "https://music.youtube.com",
        "x-goog-authuser": "0",
    }
    for k, v in default_headers.items():
        if k not in user_headers:
            user_headers[k] = v

    return user_headers


class YTMusicService:
    def __init__(self):
        self._ytmusic = None
        self._auth_error: Optional[str] = None
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._init_client()

    def _init_client(self):
        settings = get_settings()
        auth_file = settings.ytmusic_headers_file
        self._auth_error = None
        try:
            from ytmusicapi import YTMusic
            if auth_file.exists():
                logger.info(f"Initializing YTMusic with auth file: {auth_file}")
                try:
                    self._ytmusic = YTMusic(str(auth_file))
                    logger.info("Successfully initialized authenticated YTMusic client")
                    return
                except Exception as e:
                    logger.warning(f"Failed to load authenticated YTMusic credentials ({e}), falling back to guest mode")
                    self._auth_error = str(e)

            logger.info("Initializing YTMusic in guest mode")
            self._ytmusic = YTMusic()
        except Exception as e:
            logger.error(f"Failed to initialize YTMusic client in guest mode: {e}")
            self._ytmusic = None

    def get_auth_status(self) -> Dict[str, Any]:
        settings = get_settings()
        is_authenticated = settings.ytmusic_headers_file.exists() and self._auth_error is None
        return {
            "authenticated": is_authenticated,
            "headers_file_exists": settings.ytmusic_headers_file.exists(),
            "has_client": self._ytmusic is not None,
            "error": self._auth_error,
        }

    def save_auth_headers(self, headers_str: str) -> Tuple[bool, Optional[str]]:
        settings = get_settings()
        auth_file = settings.ytmusic_headers_file
        try:
            headers_dict = parse_and_build_ytmusic_headers(headers_str)

            # Validate with YTMusic in-memory before writing to disk
            from ytmusicapi import YTMusic
            with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False) as tf:
                json.dump(headers_dict, tf, indent=2)
                tf_name = tf.name

            try:
                test_client = YTMusic(tf_name)
                if not test_client:
                    raise ValueError("Client initialization failed")
            finally:
                if os.path.exists(tf_name):
                    os.unlink(tf_name)

            auth_file.parent.mkdir(parents=True, exist_ok=True)
            with open(auth_file, "w", encoding="utf-8") as f:
                json.dump(headers_dict, f, indent=2)

            self._init_client()
            return True, None
        except Exception as e:
            logger.error(f"Failed to save auth headers: {e}")
            return False, str(e)

    def clear_auth(self) -> bool:
        settings = get_settings()
        auth_file = settings.ytmusic_headers_file
        if auth_file.exists():
            try:
                auth_file.unlink()
            except Exception as e:
                logger.error(f"Failed to delete auth file: {e}")
        self._init_client()
        return True

    def _get_cache(self, key: str) -> Optional[Any]:
        if key in self._cache:
            entry = self._cache[key]
            if time.time() < entry["expires"]:
                return entry["data"]
            else:
                del self._cache[key]
        return None

    def _set_cache(self, key: str, data: Any, ttl: int):
        self._cache[key] = {
            "data": data,
            "expires": time.time() + ttl
        }

    def search(self, query: str, filter_type: Optional[str] = None) -> List[Dict[str, Any]]:
        cache_key = f"search:{query}:{filter_type or 'songs'}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return []

        try:
            results = self._ytmusic.search(query, filter=filter_type or "songs", limit=25)
            normalized_results: List[Dict[str, Any]] = []
            for item in results:
                normalized = self.normalize_song(item)
                if normalized:
                    normalized_results.append(normalized)
            # Prioritize pure audio tracks (ATV / song) above video / UGC tracks
            normalized_results.sort(key=lambda x: 0 if x.get("isPureAudio") else 1)
            self._set_cache(cache_key, normalized_results, CACHE_TTL["search"])
            return normalized_results
        except Exception as e:
            logger.error(f"YTMusic search error for query '{query}': {e}")
            return []

    def get_home(self, limit: int = 6) -> List[Dict[str, Any]]:
        cache_key = f"home:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return []

        try:
            home_data = self._ytmusic.get_home(limit=limit)
            self._set_cache(cache_key, home_data, CACHE_TTL["home"])
            return home_data
        except Exception as e:
            logger.error(f"YTMusic get_home error: {e}")
            return []

    def get_explore(self) -> Dict[str, Any]:
        cache_key = "explore"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            explore = self._ytmusic.get_explore()
            self._set_cache(cache_key, explore, CACHE_TTL["home"])
            return explore
        except Exception as e:
            logger.error(f"YTMusic get_explore error: {e}")
            return {}

    def get_charts(self, country: str = "IN") -> Dict[str, Any]:
        cache_key = f"charts:{country}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            charts = self._ytmusic.get_charts(country=country)
            self._set_cache(cache_key, charts, CACHE_TTL["charts"])
            return charts
        except Exception as e:
            logger.error(f"YTMusic get_charts error: {e}")
            return {}

    def get_artist(self, channel_id: str) -> Dict[str, Any]:
        cache_key = f"artist:{channel_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            artist = self._ytmusic.get_artist(channel_id)
            self._set_cache(cache_key, artist, CACHE_TTL["artist"])
            return artist
        except Exception as e:
            logger.error(f"YTMusic get_artist error '{channel_id}': {e}")
            return {}

    def get_album(self, browse_id: str) -> Dict[str, Any]:
        cache_key = f"album:{browse_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            album = self._ytmusic.get_album(browse_id)
            self._set_cache(cache_key, album, CACHE_TTL["album"])
            return album
        except Exception as e:
            logger.error(f"YTMusic get_album error '{browse_id}': {e}")
            return {}

    def get_playlist(self, playlist_id: str, limit: int = 100) -> Dict[str, Any]:
        cache_key = f"playlist:{playlist_id}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            playlist = self._ytmusic.get_playlist(playlist_id, limit=limit)
            self._set_cache(cache_key, playlist, CACHE_TTL["playlist"])
            return playlist
        except Exception as e:
            logger.error(f"YTMusic get_playlist error '{playlist_id}': {e}")
            return {}

    def get_playlist_songs(self, playlist_id: str, limit: int = 12) -> Dict[str, Any]:
        """Return playable songs, preferring pure audio tracks while accepting music videos."""
        cache_key = f"playlist-songs:{playlist_id}:{limit}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        playlist = self.get_playlist(playlist_id, limit=max(limit, 25))
        if not playlist:
            return {}

        songs: List[Dict[str, Any]] = []
        seen = set()
        for item in playlist.get("tracks", []):
            song = self.normalize_song(item)
            if not song:
                continue
            # If the track is a video/OMV, try to resolve to a pure audio song if available
            if not song.get("isPureAudio") and item.get("videoId"):
                artists = self._artist_text(item)
                query = " ".join(value for value in (item.get("title"), artists) if value)
                candidates = self.search(query, filter_type="songs")
                for candidate in candidates:
                    cand_norm = self.normalize_song(candidate) if "isPureAudio" not in candidate else candidate
                    if cand_norm and cand_norm.get("isPureAudio", False):
                        song = cand_norm
                        break
            if not song or song["videoId"] in seen:
                continue
            seen.add(song["videoId"])
            songs.append(song)
            if len(songs) >= limit:
                break

        result = {
            "id": playlist.get("id") or playlist_id,
            "title": playlist.get("title") or "Playlist",
            "description": playlist.get("description") or "",
            "thumbnail": self._thumbnail_url(playlist),
            "tracks": songs,
        }
        self._set_cache(cache_key, result, CACHE_TTL["playlist"])
        return result

    def get_watch_playlist(self, video_id: Optional[str] = None, playlist_id: Optional[str] = None) -> Dict[str, Any]:
        cache_key = f"watch:{video_id}:{playlist_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            watch_data = self._ytmusic.get_watch_playlist(videoId=video_id, playlistId=playlist_id, limit=25)
            self._set_cache(cache_key, watch_data, CACHE_TTL["playlist"])
            return watch_data
        except Exception as e:
            logger.error(f"YTMusic get_watch_playlist error: {e}")
            return {}

    @staticmethod
    def is_pure_audio(item: Dict[str, Any]) -> bool:
        if not item or not isinstance(item, dict) or not item.get("videoId"):
            return False
        result_type = str(item.get("resultType", "")).lower()
        if result_type == "song":
            return True
        if result_type == "video":
            return False
        video_type = str(item.get("videoType", "")).upper()
        if "ATV" in video_type:
            return True
        if any(marker in video_type for marker in ("_OMV", "_UGC")):
            return False
        return True

    @staticmethod
    def is_song(item: Dict[str, Any]) -> bool:
        return bool(item and isinstance(item, dict) and item.get("videoId"))

    @staticmethod
    def _artist_text(item: Dict[str, Any]) -> str:
        artists = item.get("artists")
        if isinstance(artists, list):
            return ", ".join(
                str(value.get("name"))
                for value in artists
                if isinstance(value, dict) and value.get("name")
            )
        raw_artist = item.get("artist")
        return str(raw_artist.get("name", "")) if isinstance(raw_artist, dict) else str(raw_artist or "")

    @staticmethod
    def _thumbnail_url(item: Dict[str, Any]) -> Optional[str]:
        raw = item.get("thumbnails") or item.get("thumbnail")
        if isinstance(raw, str):
            return raw
        if isinstance(raw, dict):
            return raw.get("url")
        if isinstance(raw, list):
            for image in reversed(raw):
                if isinstance(image, dict) and image.get("url"):
                    return image["url"]
                if isinstance(image, str):
                    return image
        return None

    @staticmethod
    def _parse_duration_seconds(duration: Any) -> int:
        if not duration:
            return 0
        if isinstance(duration, (int, float)):
            return int(duration)
        if isinstance(duration, str):
            if duration.isdigit():
                return int(duration)
            parts = duration.split(":")
            try:
                return sum(int(value) * (60 ** index) for index, value in enumerate(reversed(parts)))
            except (ValueError, TypeError):
                return 0
        return 0

    @staticmethod
    def normalize_song(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not YTMusicService.is_song(item):
            return None
        artist = YTMusicService._artist_text(item)
        thumbnail = YTMusicService._thumbnail_url(item)
        album = item.get("album")
        if isinstance(album, dict):
            album = album.get("name")
        duration = item.get("duration_seconds") or item.get("durationSeconds") or item.get("duration") or item.get("length") or 0
        return {
            "videoId": item["videoId"],
            "title": item.get("title") or "Unknown Title",
            "artist": artist or "Unknown Artist",
            "thumbnail": thumbnail,
            "album": album or "",
            "duration": YTMusicService._parse_duration_seconds(duration),
            "isPureAudio": YTMusicService.is_pure_audio(item),
        }

    def get_autoplay_tracks(self, video_id: str, limit: int = 12) -> List[Dict[str, Any]]:
        watch = self.get_watch_playlist(video_id=video_id)
        tracks = watch.get("tracks", []) if isinstance(watch, dict) else []
        normalized: List[Dict[str, Any]] = []
        seen = {video_id}
        for item in tracks:
            track = self.normalize_song(item)
            if not track and isinstance(item, dict) and item.get("videoId"):
                artist = YTMusicService._artist_text(item)
                thumbnail = YTMusicService._thumbnail_url(item)
                album = item.get("album")
                if isinstance(album, dict):
                    album = album.get("name")
                duration = item.get("duration_seconds") or item.get("durationSeconds") or item.get("duration") or item.get("length") or 0
                track = {
                    "videoId": item["videoId"],
                    "title": item.get("title") or "Unknown Title",
                    "artist": artist or "Unknown Artist",
                    "thumbnail": thumbnail,
                    "album": album or "",
                    "duration": YTMusicService._parse_duration_seconds(duration),
                }
            if not track or track["videoId"] in seen:
                continue
            seen.add(track["videoId"])
            normalized.append(track)
            if len(normalized) >= limit:
                break
        return normalized

    def get_lyrics(self, video_id: str) -> Dict[str, Any]:
        cache_key = f"lyrics:{video_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return {}

        try:
            watch_playlist = self._ytmusic.get_watch_playlist(videoId=video_id)
            lyrics_id = watch_playlist.get("lyrics")
            if lyrics_id:
                lyrics_data = self._ytmusic.get_lyrics(lyrics_id)
                self._set_cache(cache_key, lyrics_data, CACHE_TTL["lyrics"])
                return lyrics_data
            return {}
        except Exception as e:
            logger.error(f"YTMusic get_lyrics error for video '{video_id}': {e}")
            return {}

    def get_stream_url_and_headers(self, video_id: str) -> tuple[Optional[str], Dict[str, str]]:
        cache_key = f"stream_info:{video_id}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        url = f"https://www.youtube.com/watch?v={video_id}"
        try:
            import yt_dlp
            ydl_opts = {
                # Prefer the highest-bitrate audio-only representation. The
                # fallback still requires an audio codec so a video-only URL
                # can never be selected accidentally.
                'format': 'bestaudio[acodec!=none]/best[acodec!=none]',
                'format_sort': ['abr', 'asr', 'acodec', 'filesize'],
                'quiet': True,
                'no_warnings': True,
                'skip_download': True,
            }
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=False)
                stream_url = info.get('url')
                headers = info.get('http_headers', {})
                if stream_url:
                    self._set_cache(cache_key, (stream_url, headers), CACHE_TTL["stream"])
                    return stream_url, headers
        except Exception as e:
            logger.error(f"yt-dlp extract error for video '{video_id}': {e}")

        return None, {}

    def get_stream_url(self, video_id: str) -> Optional[str]:
        stream_url, _ = self.get_stream_url_and_headers(video_id)
        return stream_url

ytmusic_service = YTMusicService()
