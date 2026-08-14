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


def test_search_prioritizes_pure_audio_and_allows_videos():
    class FakeClient:
        def __init__(self):
            self.filter = None

        def search(self, query, filter=None, limit=None):
            self.filter = filter
            return [
                {"videoId": "video", "resultType": "video", "title": "Video"},
                {"videoId": "song", "resultType": "song", "title": "Song"},
                {"videoId": "ugc", "videoType": "MUSIC_VIDEO_TYPE_UGC", "title": "UGC"},
            ]

    service = YTMusicService()
    service._ytmusic = FakeClient()

    results = service.search("test")

    assert service._ytmusic.filter == "songs"
    # Pure audio song is sorted first, then video items
    assert results[0]["videoId"] == "song"
    assert results[0]["isPureAudio"] is True
    assert len(results) == 3


def test_normalize_song_accepts_videos_and_maps_metadata():
    video_track = YTMusicService.normalize_song({"videoId": "v", "resultType": "video", "title": "Video Track"})
    assert video_track is not None
    assert video_track["videoId"] == "v"
    assert video_track["isPureAudio"] is False

    track = YTMusicService.normalize_song(
        {
            "videoId": "s",
            "title": "Title",
            "artists": [{"name": "Artist"}],
            "album": {"name": "Album"},
            "thumbnails": [{"url": "small"}, {"url": "large"}],
            "duration": "3:05",
            "resultType": "song",
        }
    )
    assert track == {
        "videoId": "s",
        "title": "Title",
        "artist": "Artist",
        "album": "Album",
        "thumbnail": "large",
        "duration": 185,
        "isPureAudio": True,
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
        "isPureAudio": True,
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


def test_parse_and_build_ytmusic_headers_json_array():
    from app.services.ytmusic import parse_and_build_ytmusic_headers
    json_array = """[
        {"name": "SAPISID", "value": "test_sapisid_value_123"},
        {"name": "__Secure-3PSID", "value": "psid_value_456"}
    ]"""
    headers = parse_and_build_ytmusic_headers(json_array)
    assert "cookie" in headers
    assert "SAPISID=test_sapisid_value_123" in headers["cookie"]
    assert "authorization" in headers
    assert headers["authorization"].startswith("SAPISIDHASH ")
    assert headers["origin"] == "https://music.youtube.com"


def test_parse_and_build_ytmusic_headers_raw_cookie():
    from app.services.ytmusic import parse_and_build_ytmusic_headers
    raw = "SID=123; __Secure-3PAPISID=my_sapisid_tok; HSID=456"
    headers = parse_and_build_ytmusic_headers(raw)
    assert "cookie" in headers
    assert headers["cookie"] == raw
    assert "authorization" in headers
    assert headers["authorization"].startswith("SAPISIDHASH ")


def test_parse_and_build_ytmusic_headers_netscape():
    from app.services.ytmusic import parse_and_build_ytmusic_headers
    netscape = "# Netscape HTTP Cookie File\n.youtube.com\tTRUE\t/\tTRUE\t1750000000\tSAPISID\ttest_netscape_sapisid"
    headers = parse_and_build_ytmusic_headers(netscape)
    assert "cookie" in headers
    assert "SAPISID=test_netscape_sapisid" in headers["cookie"]
    assert "authorization" in headers
    assert headers["authorization"].startswith("SAPISIDHASH ")


def test_init_client_falls_back_to_guest_mode_on_invalid_file(tmp_path, monkeypatch):
    from app.config import get_settings
    settings = get_settings()
    corrupt_file = tmp_path / "corrupt_ytmusic.json"
    corrupt_file.write_text('{"invalid": "data"}')
    monkeypatch.setattr(settings, "data_dir", tmp_path)
    (tmp_path / "credentials").mkdir()
    auth_file = tmp_path / "credentials" / "ytmusic_headers.json"
    auth_file.write_text('{"invalid": "data"}')

    service = YTMusicService()
    # Should fall back to guest mode without crashing
    assert service._ytmusic is not None
    status = service.get_auth_status()
    assert status["authenticated"] is False
    assert status["has_client"] is True

