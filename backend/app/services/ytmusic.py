import json
import logging
import time
from typing import Any, Dict, List, Optional
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

class YTMusicService:
    def __init__(self):
        self._ytmusic = None
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._init_client()

    def _init_client(self):
        settings = get_settings()
        auth_file = settings.ytmusic_headers_file
        try:
            from ytmusicapi import YTMusic
            if auth_file.exists():
                logger.info(f"Initializing YTMusic with auth file: {auth_file}")
                self._ytmusic = YTMusic(str(auth_file))
            else:
                logger.info("Initializing YTMusic in guest mode")
                self._ytmusic = YTMusic()
        except Exception as e:
            logger.error(f"Failed to initialize YTMusic client: {e}")
            self._ytmusic = None

    def get_auth_status(self) -> Dict[str, Any]:
        settings = get_settings()
        is_authenticated = settings.ytmusic_headers_file.exists()
        return {
            "authenticated": is_authenticated,
            "headers_file_exists": is_authenticated,
            "has_client": self._ytmusic is not None
        }

    def save_auth_headers(self, headers_str: str) -> bool:
        settings = get_settings()
        auth_file = settings.ytmusic_headers_file
        try:
            if isinstance(headers_str, str):
                headers_str = headers_str.strip()
                if headers_str.startswith("{"):
                    headers_dict = json.loads(headers_str)
                else:
                    headers_dict = {}
                    for line in headers_str.splitlines():
                        if ":" in line:
                            k, v = line.split(":", 1)
                            headers_dict[k.strip()] = v.strip()
                
                auth_file.parent.mkdir(parents=True, exist_ok=True)
                with open(auth_file, "w", encoding="utf-8") as f:
                    json.dump(headers_dict, f, indent=2)

            self._init_client()
            return True
        except Exception as e:
            logger.error(f"Failed to save auth headers: {e}")
            return False

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
        # Nivas is an audio player. Always ask InnerTube for songs and enforce
        # the same rule locally so video/UGC results can never leak into play.
        cache_key = f"search:{query}:songs"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return []

        try:
            results = self._ytmusic.search(query, filter="songs", limit=25)
            results = [item for item in results if self.is_song(item)]
            self._set_cache(cache_key, results, CACHE_TTL["search"])
            return results
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
    def is_song(item: Dict[str, Any]) -> bool:
        if not item or not item.get("videoId"):
            return False
        if str(item.get("resultType", "")).lower() == "video":
            return False
        video_type = str(item.get("videoType", "")).upper()
        return not any(marker in video_type for marker in ("_OMV", "_UGC"))

    @staticmethod
    def normalize_song(item: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if not YTMusicService.is_song(item):
            return None
        artists = item.get("artists")
        if isinstance(artists, list):
            artist = ", ".join(
                str(value.get("name"))
                for value in artists
                if isinstance(value, dict) and value.get("name")
            )
        else:
            raw_artist = item.get("artist")
            artist = raw_artist.get("name", "") if isinstance(raw_artist, dict) else raw_artist
        thumbnails = item.get("thumbnails") or []
        thumbnail = thumbnails[-1].get("url") if thumbnails and isinstance(thumbnails[-1], dict) else item.get("thumbnail")
        album = item.get("album")
        if isinstance(album, dict):
            album = album.get("name")
        duration = item.get("duration_seconds") or item.get("durationSeconds") or item.get("duration") or 0
        if isinstance(duration, str):
            parts = duration.split(":")
            try:
                duration = sum(int(value) * (60 ** index) for index, value in enumerate(reversed(parts)))
            except ValueError:
                duration = 0
        return {
            "videoId": item["videoId"],
            "title": item.get("title") or "Unknown Title",
            "artist": artist or "Unknown Artist",
            "thumbnail": thumbnail,
            "album": album or "",
            "duration": int(duration or 0),
        }

    def get_autoplay_tracks(self, video_id: str, limit: int = 12) -> List[Dict[str, Any]]:
        watch = self.get_watch_playlist(video_id=video_id)
        tracks = watch.get("tracks", []) if isinstance(watch, dict) else []
        normalized: List[Dict[str, Any]] = []
        seen = {video_id}
        for item in tracks:
            track = self.normalize_song(item)
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

    def get_stream_url(self, video_id: str) -> Optional[str]:
        cache_key = f"stream:{video_id}"
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
                if stream_url:
                    self._set_cache(cache_key, stream_url, CACHE_TTL["stream"])
                    return stream_url
        except Exception as e:
            logger.error(f"yt-dlp extract error for video '{video_id}': {e}")

        return None

ytmusic_service = YTMusicService()
