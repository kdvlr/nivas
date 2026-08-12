import pytest
from app.services.ytmusic import YTMusicService

def test_ytmusic_auth_status():
    service = YTMusicService()
    status = service.get_auth_status()
    assert "authenticated" in status
    assert "has_client" in status

def test_ytmusic_caching():
    service = YTMusicService()
    service._set_cache("test_key", {"title": "Test Song"}, ttl=60)
    cached = service._get_cache("test_key")
    assert cached == {"title": "Test Song"}

def test_ytmusic_search_fallback():
    service = YTMusicService()
    # Testing search function format and returned list
    results = service.search("Daft Punk", filter_type="artists")
    assert isinstance(results, list)


def test_search_forces_songs_and_filters_video_results():
    class FakeClient:
        def __init__(self):
            self.filter = None

        def search(self, query, filter=None, limit=None):
            self.filter = filter
            return [
                {"videoId": "song", "resultType": "song", "title": "Song"},
                {"videoId": "video", "resultType": "video", "title": "Video"},
                {"videoId": "ugc", "videoType": "MUSIC_VIDEO_TYPE_UGC", "title": "UGC"},
            ]

    service = YTMusicService()
    service._ytmusic = FakeClient()

    results = service.search("test", filter_type="videos")

    assert service._ytmusic.filter == "songs"
    assert [item["videoId"] for item in results] == ["song"]


def test_normalize_song_rejects_music_video_and_maps_metadata():
    assert YTMusicService.normalize_song({"videoId": "v", "resultType": "video"}) is None
    track = YTMusicService.normalize_song(
        {
            "videoId": "s",
            "title": "Title",
            "artists": [{"name": "Artist"}],
            "album": {"name": "Album"},
            "thumbnails": [{"url": "small"}, {"url": "large"}],
            "duration": "3:05",
        }
    )
    assert track == {
        "videoId": "s",
        "title": "Title",
        "artist": "Artist",
        "album": "Album",
        "thumbnail": "large",
        "duration": 185,
    }
