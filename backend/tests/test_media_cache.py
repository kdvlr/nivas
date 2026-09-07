import time

from app.services.media_cache import MediaCache


def test_cache_cleanup_keeps_pinned_media_and_removes_expired(tmp_path):
    cache = MediaCache()
    cache.root = tmp_path
    old = cache.wav_path("old")
    pinned = cache.wav_path("current")
    old.write_bytes(b"old")
    pinned.write_bytes(b"current")
    old_time = time.time() - cache.MAX_AGE_SECONDS - 1
    old.touch()
    import os
    os.utime(old, (old_time, old_time))
    cache.pin(["current"])

    cache.cleanup()

    assert not old.exists()
    assert pinned.exists()
