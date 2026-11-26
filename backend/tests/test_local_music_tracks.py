import pytest
import sqlite3
from pathlib import Path
from fastapi.testclient import TestClient

from app.main import app
from app.services.local_music import LocalMusicService

@pytest.fixture
def temp_local_service(tmp_path):
    music_dir = str(tmp_path / "music")
    data_dir = str(tmp_path / "data")
    Path(music_dir).mkdir(parents=True, exist_ok=True)
    Path(data_dir).mkdir(parents=True, exist_ok=True)

    service = LocalMusicService(music_dir=music_dir, data_dir=data_dir)

    # Insert sample tracks into SQLite
    with service._get_conn() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO albums (id, title, artist, year, track_count, has_artwork, folder_path)
            VALUES 
                ('alb1', 'Discovery', 'Daft Punk', '2001', 2, 0, '/tmp/discovery'),
                ('alb2', 'Random Access Memories', 'Daft Punk', '2013', 1, 0, '/tmp/ram'),
                ('alb3', 'Substance', 'New Order', '1987', 1, 0, '/tmp/substance')
        """)
        cursor.execute("""
            INSERT INTO tracks (id, file_path, title, artist, album_artist, album, album_id, track_number, disc_number, duration, year, genre, file_format)
            VALUES
                ('trk1', '/tmp/discovery/01.mp3', 'One More Time', 'Daft Punk', 'Daft Punk', 'Discovery', 'alb1', 1, 1, 320, '2001', 'Electronic', 'MP3'),
                ('trk2', '/tmp/discovery/02.mp3', 'Aerodynamic', 'Daft Punk', 'Daft Punk', 'Discovery', 'alb1', 2, 1, 212, '2001', 'Electronic', 'MP3'),
                ('trk3', '/tmp/ram/01.flac', 'Get Lucky', 'Daft Punk', 'Daft Punk', 'Random Access Memories', 'alb2', 1, 1, 248, '2013', 'Disco', 'FLAC'),
                ('trk4', '/tmp/substance/01.m4a', 'Blue Monday', 'New Order', 'New Order', 'Substance', 'alb3', 1, 1, 450, '1987', 'Synthpop', 'AAC')
        """)
        conn.commit()

    return service

def test_get_artist_tracks(temp_local_service):
    tracks = temp_local_service.get_artist_tracks("Daft Punk")
    assert len(tracks) == 3
    titles = [t["title"] for t in tracks]
    assert "One More Time" in titles
    assert "Aerodynamic" in titles
    assert "Get Lucky" in titles
    for t in tracks:
        assert t["artist"] == "Daft Punk"
        assert t["source"] == "local"
        assert t["isPureAudio"] is True
        assert t["videoId"].startswith("local:")

def test_get_genre_tracks(temp_local_service):
    electronic_tracks = temp_local_service.get_genre_tracks("Electronic")
    assert len(electronic_tracks) == 2
    assert electronic_tracks[0]["genre"] == "Electronic"

    disco_tracks = temp_local_service.get_genre_tracks("Disco")
    assert len(disco_tracks) == 1
    assert disco_tracks[0]["title"] == "Get Lucky"

def test_get_artist_tracks_case_insensitive(temp_local_service):
    tracks = temp_local_service.get_artist_tracks("daft punk")
    assert len(tracks) == 3

def test_get_genre_tracks_case_insensitive(temp_local_service):
    tracks = temp_local_service.get_genre_tracks("electronic")
    assert len(tracks) == 2

def test_api_local_artist_and_genre_tracks(temp_local_service, monkeypatch):
    from app.routers import ytmusic
    monkeypatch.setattr(ytmusic, "local_music_service", temp_local_service)

    client = TestClient(app)

    # Test /api/ytmusic/local/artist/tracks
    res = client.get("/api/ytmusic/local/artist/tracks?artist=Daft+Punk")
    assert res.status_code == 200
    data = res.json()
    assert data["artist"] == "Daft Punk"
    assert data["trackCount"] == 3
    assert len(data["tracks"]) == 3

    # Test /api/ytmusic/local/genre/tracks
    res = client.get("/api/ytmusic/local/genre/tracks?genre=Synthpop")
    assert res.status_code == 200
    data = res.json()
    assert data["genre"] == "Synthpop"
    assert data["trackCount"] == 1
    assert data["tracks"][0]["title"] == "Blue Monday"

    # Test /api/ytmusic/local/tracks with artist query
    res = client.get("/api/ytmusic/local/tracks?artist=Daft+Punk")
    assert res.status_code == 200
    assert res.json()["trackCount"] == 3

    # Test /api/ytmusic/local/tracks with genre query
    res = client.get("/api/ytmusic/local/tracks?genre=Disco")
    assert res.status_code == 200
    assert res.json()["trackCount"] == 1


def test_split_artists_preserves_band_names_and_splits_collaborators():
    from app.services.local_music import _split_artists

    assert _split_artists("A.R. Rahman, S.P. Balasubrahmanyam & K.S. Chithra") == [
        "A.R. Rahman",
        "S.P. Balasubrahmanyam",
        "K.S. Chithra",
    ]
    assert _split_artists("AC/DC, Simon & Garfunkel feat. Earth, Wind & Fire") == [
        "AC/DC",
        "Simon & Garfunkel",
        "Earth, Wind & Fire",
    ]
    assert _split_artists("Hariharan (feat. Sadhana Sargam)") == [
        "Hariharan",
        "Sadhana Sargam",
    ]


def test_multi_artist_indexing_and_queries(tmp_path):
    music_dir = str(tmp_path / "music")
    data_dir = str(tmp_path / "data")
    Path(music_dir).mkdir(parents=True, exist_ok=True)
    Path(data_dir).mkdir(parents=True, exist_ok=True)

    service = LocalMusicService(music_dir=music_dir, data_dir=data_dir)
    service._commit_track_batch([
        {
            "id": "t_roja",
            "file_path": "/tmp/roja/01.flac",
            "title": "Chinna Chinna Aasai",
            "artist": "Minmini, A.R. Rahman",
            "album_artist": "A.R. Rahman",
            "composer": "A.R. Rahman",
            "album": "Roja",
            "album_id": "alb_roja",
            "track_number": 1,
            "disc_number": 1,
            "duration": 290,
            "year": "1992",
            "genre": "Soundtrack",
            "file_format": "FLAC",
            "file_size": 1000,
            "mtime": 1.0,
            "has_artwork": 1,
        }
    ])
    with service._get_conn() as conn:
        conn.execute(
            "INSERT INTO albums (id, title, artist, year, track_count, has_artwork, folder_path) VALUES (?, ?, ?, ?, ?, ?, ?)",
            ("alb_roja", "Roja", "A.R. Rahman", "1992", 1, 1, "/tmp/roja"),
        )
        conn.commit()

    artists = {a["artist"]: a for a in service.get_artists()}
    assert "A.R. Rahman" in artists
    assert "Minmini" in artists
    assert artists["Minmini"]["trackCount"] == 1
    assert artists["Minmini"]["albumCount"] == 1

    minmini_tracks = service.get_artist_tracks("Minmini")
    assert len(minmini_tracks) == 1
    assert minmini_tracks[0]["title"] == "Chinna Chinna Aasai"
    assert minmini_tracks[0]["artists"] == ["Minmini", "A.R. Rahman"]
    assert minmini_tracks[0]["composer"] == "A.R. Rahman"

    minmini_albums = service.get_albums(artist="Minmini")
    assert len(minmini_albums) == 1
    assert minmini_albums[0]["title"] == "Roja"
