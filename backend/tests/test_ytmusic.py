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


def test_watch_playlist_returns_client_recommendations():
    class FakeClient:
        def get_watch_playlist(self, **kwargs):
            return {"tracks": [{"videoId": "related", "title": "Related"}]}

    service = YTMusicService()
    service._ytmusic = FakeClient()

    watch = service.get_watch_playlist(video_id="current")

    assert watch["tracks"][0]["videoId"] == "related"


def test_normalize_song_accepts_watch_thumbnail_array():
    track = YTMusicService.normalize_song({
        "videoId": "related",
        "title": "Related",
        "artist": "Artist",
        "thumbnail": [{"url": "small"}, {"url": "large"}],
    })

    assert track is not None
    assert track["thumbnail"] == "large"


def test_playlist_songs_resolves_music_videos_to_audio():
    service = YTMusicService()
    service.get_playlist = lambda *args, **kwargs: {
        "title": "Top videos",
        "tracks": [{
            "videoId": "video",
            "title": "Song",
            "artists": [{"name": "Artist"}],
            "videoType": "MUSIC_VIDEO_TYPE_OMV",
        }],
    }
    service.search = lambda *args, **kwargs: [{
        "videoId": "audio",
        "title": "Song",
        "artists": [{"name": "Artist"}],
        "videoType": "MUSIC_VIDEO_TYPE_ATV",
        "thumbnails": [{"url": "art"}],
    }]

    playlist = service.get_playlist_songs("top", limit=1)

    assert playlist["tracks"] == [{
        "videoId": "audio",
        "title": "Song",
        "artist": "Artist",
        "thumbnail": "art",
        "album": "",
        "duration": 0,
    }]


def test_parse_duration_seconds_handles_strings_and_numbers():
    assert YTMusicService._parse_duration_seconds("2:18") == 138
    assert YTMusicService._parse_duration_seconds("1:02:18") == 3738
    assert YTMusicService._parse_duration_seconds("138") == 138
    assert YTMusicService._parse_duration_seconds(138) == 138
    assert YTMusicService._parse_duration_seconds(None) == 0


def test_autoplay_tracks_handles_fallback_string_duration():
    class FakeClient:
        def get_watch_playlist(self, videoId=None, playlistId=None, limit=25):
            return {
                "tracks": [
                    {
                        "videoId": "current",
                        "title": "Current Track",
                    },
                    {
                        "videoId": "next_track",
                        "title": "Next Track",
                        "length": "2:18",  # String duration in fallback
                        "videoType": "MUSIC_VIDEO_TYPE_UGC",
                    }
                ]
            }

    service = YTMusicService()
    service._ytmusic = FakeClient()
    recs = service.get_autoplay_tracks("current")
    assert len(recs) == 1
    assert recs[0]["videoId"] == "next_track"
    assert recs[0]["duration"] == 138
