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
