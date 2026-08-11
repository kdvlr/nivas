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
        cache_key = f"search:{query}:{filter_type or 'all'}"
        cached = self._get_cache(cache_key)
        if cached is not None:
            return cached

        if not self._ytmusic:
            return []

        try:
            filter_param = filter_type if filter_type in ["songs", "videos", "albums", "artists", "playlists"] else None
            results = self._ytmusic.search(query, filter=filter_param, limit=25)
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
                'format': 'bestaudio/best',
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
