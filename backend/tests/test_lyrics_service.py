import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.main import app
from app.services.lyrics_service import LyricsService, parse_lrc


def test_parse_lrc_standard_and_multi_timestamp():
    lrc = """[ti:Test Song]
[00:10.50]First line
[00:20.00][01:05.25]Chorus line
[00:15.125]Second line
"""
    lines = parse_lrc(lrc)
    assert lines == [
        {"time": 10.5, "text": "First line"},
        {"time": 15.125, "text": "Second line"},
        {"time": 20.0, "text": "Chorus line"},
        {"time": 65.25, "text": "Chorus line"},
    ]


def test_lyrics_local_lrc_and_cache(tmp_path):
    svc = LyricsService(data_dir=str(tmp_path / "data"))
    audio_file = tmp_path / "01 - Roja.flac"
    audio_file.write_bytes(b"fake")
    lrc_file = tmp_path / "01 - Roja.lrc"
    lrc_file.write_text("[00:05.00]Chinna chinna aasai\n[00:10.00]Siragadikkum aasai\n", encoding="utf-8")

    fake_track = {
        "id": "trk1",
        "filePath": str(audio_file),
        "title": "Chinna Chinna Aasai",
        "artist": "Minmini",
        "album": "Roja",
        "duration": 290,
    }
    with patch("app.services.lyrics_service.local_music_service.get_track", return_value=fake_track):
        res = svc.get_lyrics("local:trk1")
        assert res["synced"] is True
        assert res["source"] == "local_lrc"
        assert len(res["lines"]) == 2
        assert res["lines"][0]["text"] == "Chinna chinna aasai"

    # Remove .lrc file and verify SQLite cache still serves it
    lrc_file.unlink()
    res_cached = svc.get_lyrics("local:trk1")
    assert res_cached["synced"] is True
    assert res_cached["source"] == "local_lrc"


def test_lyrics_lrclib_search_fallback(tmp_path):
    svc = LyricsService(data_dir=str(tmp_path / "data"))

    def fake_get_json(url):
        if "/api/get?" in url:
            raise RuntimeError("404 Not Found")
        return [
            {
                "trackName": "Tum Hi Ho",
                "artistName": "Arijit Singh",
                "duration": 262,
                "syncedLyrics": "[00:11.20] Hum tere bin ab reh nahi sakte\n[00:15.55] Tere bina kya wajood mera",
                "plainLyrics": "Hum tere bin ab reh nahi sakte\nTere bina kya wajood mera",
            }
        ]

    svc._http_get_json = fake_get_json
    res = svc.get_lyrics("yt123", title="Tum Hi Ho", artist="Arijit Singh", duration=262)
    assert res["synced"] is True
    assert res["source"] == "lrclib"
    assert len(res["lines"]) == 2
    assert res["lines"][0]["time"] == 11.2


def test_lyrics_settings_persist_across_restarts(tmp_path):
    data_dir = str(tmp_path / "data")
    svc = LyricsService(data_dir=data_dir)
    assert svc.get_settings_dict() == {
        "syncOffset": 0.0,
        "visualMode": "ambient",
        "bouncingStar": True,
    }

    updated = svc.update_settings(sync_offset=-1.5, visual_mode="starlight", bouncing_star=False)
    assert updated == {
        "syncOffset": -1.5,
        "visualMode": "starlight",
        "bouncingStar": False,
    }

    # Re-instantiate service to verify SQLite persistence across restarts
    svc2 = LyricsService(data_dir=data_dir)
    assert svc2.get_settings_dict() == updated


def test_lyrics_settings_and_fetch_endpoints(tmp_path, monkeypatch):
    from app.routers import ytmusic as ytmusic_router

    svc = LyricsService(data_dir=str(tmp_path / "data"))
    svc._http_get_json = lambda url: {
        "syncedLyrics": "[00:01.00]Hello world",
        "plainLyrics": "Hello world",
    }
    monkeypatch.setattr(ytmusic_router, "lyrics_service", svc)

    client = TestClient(app)

    res = client.put(
        "/api/ytmusic/lyrics/settings",
        json={"syncOffset": -2.0, "visualMode": "party", "bouncingStar": True},
    )
    assert res.status_code == 200
    assert res.json() == {"syncOffset": -2.0, "visualMode": "party", "bouncingStar": True}

    res2 = client.get("/api/ytmusic/lyrics/settings")
    assert res2.status_code == 200
    assert res2.json()["visualMode"] == "party"

    res3 = client.get("/api/ytmusic/lyrics/abc123?title=Hello&artist=World&duration=180")
    assert res3.status_code == 200
    body = res3.json()
    assert body["synced"] is True
    assert body["source"] == "lrclib"
    assert body["lines"] == [{"time": 1.0, "text": "Hello world"}]


def test_lyrics_spectrum_extraction_and_cache(tmp_path, monkeypatch):
    import base64
    from app.routers import ytmusic as ytmusic_router

    svc = LyricsService(data_dir=str(tmp_path / "data"))
    audio_file = tmp_path / "song.flac"
    audio_file.write_bytes(b"fake")

    call_count = {"n": 0}

    def fake_compute(path, fps=12):
        call_count["n"] += 1
        return bytes([10, 20, 30, 40] * 4 * 5)  # 5 frames * 16 bands

    svc._resolve_audio_file = lambda vid: str(audio_file)
    svc._compute_spectrum_bytes = fake_compute
    monkeypatch.setattr(ytmusic_router, "lyrics_service", svc)

    client = TestClient(app)
    r1 = client.get("/api/ytmusic/lyrics/spectrum/local:trk1")
    assert r1.status_code == 200
    d1 = r1.json()
    assert d1["available"] is True
    assert d1["bands"] == 16
    assert len(base64.b64decode(d1["data"])) == 16 * 5
    assert call_count["n"] == 1

    # Second request should hit SQLite cache without recomputing
    r2 = client.get("/api/ytmusic/lyrics/spectrum/local:trk1")
    assert r2.status_code == 200
    assert r2.json()["data"] == d1["data"]
    assert call_count["n"] == 1


def test_tamil_and_hindi_lyrics_transliterated_to_english_letters(tmp_path):
    from app.services.transliterate import transliterate_to_latin

    tamil_out = transliterate_to_latin("சின்ன சின்ன ஆசை")
    assert tamil_out.isascii()
    assert "chinna" in tamil_out.lower()
    assert "aasai" in tamil_out.lower()

    hindi_out = transliterate_to_latin("हम तेरे बिन")
    assert hindi_out.isascii()
    assert "ham" in hindi_out.lower()

    # Verify LRCLIB search prefers Latin/Romanized syncedLyrics over Tamil script
    svc = LyricsService(data_dir=str(tmp_path / "data"))

    def fake_get_json(url):
        if "/api/get?" in url:
            return {"syncedLyrics": "[00:05.00] சின்ன சின்ன ஆசை", "plainLyrics": "சின்ன சின்ன ஆசை"}
        return [
            {"trackName": "Chinna Chinna Aasai", "duration": 290, "syncedLyrics": "[00:05.00] சின்ன சின்ன ஆசை", "plainLyrics": "சின்ன சின்ன ஆசை"},
            {"trackName": "Chinna Chinna Aasai", "duration": 290, "syncedLyrics": "[00:05.00] Chinna chinna aasai", "plainLyrics": "Chinna chinna aasai"},
        ]

    svc._http_get_json = fake_get_json
    res = svc.get_lyrics("yt_roja", title="Chinna Chinna Aasai", artist="A.R. Rahman", duration=290)
    assert res["lines"][0]["text"] == "Chinna chinna aasai"


def test_lrclib_search_rejects_wrong_title_with_closer_duration(tmp_path):
    svc = LyricsService(data_dir=str(tmp_path / "data"))

    def fake_get_json(url):
        if "/api/get?" in url:
            raise RuntimeError("404")
        return [
            {"trackName": "Ennuyire", "albumName": "Uyire", "duration": 437, "syncedLyrics": "[00:03.00] Ennuyire ennuyire"},
            {"trackName": "Uyire Uyire", "albumName": "Bombay", "duration": 438, "syncedLyrics": "[00:05.00] Uyire uyire vandhu ennodu"},
        ]

    svc._http_get_json = fake_get_json
    res = svc.get_lyrics("local:uyire", title="Uyire uyire", artist="Hariharan", album="Bombay", duration=436)
    assert res["lines"][0]["text"] == "Uyire uyire vandhu ennodu"


