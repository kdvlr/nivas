import pytest
from unittest.mock import MagicMock
from pathlib import Path
from app.routers.photos import get_photos, PhotoMetadata

def test_live_photo_pairing_uppercase_hevc():
    """Verify that IMG_9671_HEVC.MOV pairs with IMG_9671.JPG into a single live_photo item."""
    db = MagicMock()
    
    records = [
        PhotoMetadata(
            file_path="IMG_9671_HEVC.MOV",
            file_type="video",
            width=1920,
            height=1080,
            orientation="landscape",
            date_taken="2026-08-12T07:46:56",
            file_size=1378484,
            last_modified=1723448816.0
        ),
        PhotoMetadata(
            file_path="IMG_9671.JPG",
            file_type="image",
            width=4032,
            height=3024,
            orientation="landscape",
            date_taken="2026-08-12T07:46:56",
            file_size=1049359,
            last_modified=1723448816.0
        ),
    ]
    db.query.return_value.all.return_value = records
    
    items = get_photos(db=db)
    assert len(items) == 1, f"Expected 1 paired item, got {len(items)}: {items}"
    item = items[0]
    assert item["type"] == "live_photo"
    assert item["name"] == "IMG_9671.JPG"
    assert "IMG_9671_HEVC.MOV" in item["videoUrl"]
    assert "IMG_9671.JPG" in item["url"]

def test_live_photo_pairing_exact_stem():
    """Verify that IMG_0104.MOV pairs with IMG_0104.JPG into a single live_photo item."""
    db = MagicMock()
    
    records = [
        PhotoMetadata(
            file_path="IMG_0104.MOV",
            file_type="video",
            width=1920,
            height=1080,
            orientation="landscape",
            date_taken="2018-05-01T12:00:00",
            file_size=1812437,
            last_modified=1525176000.0
        ),
        PhotoMetadata(
            file_path="IMG_0104.JPG",
            file_type="image",
            width=4032,
            height=3024,
            orientation="landscape",
            date_taken="2018-05-01T12:00:00",
            file_size=2000000,
            last_modified=1525176000.0
        ),
    ]
    db.query.return_value.all.return_value = records
    
    items = get_photos(db=db)
    assert len(items) == 1
    assert items[0]["type"] == "live_photo"
    assert items[0]["name"] == "IMG_0104.JPG"

def test_collision_disambiguation_by_date():
    """
    Verify that colliding roll numbers (e.g. IMG_0209 taken years apart)
    pair with their correct counterpart based on date_taken.
    """
    db = MagicMock()
    
    records = [
        # Pair 1: 2018
        PhotoMetadata(
            file_path="IMG_0209.MOV",
            file_type="video",
            width=1920,
            height=1080,
            orientation="landscape",
            date_taken="2018-07-28T23:45:08",
            file_size=1698933,
            last_modified=1532821508.0
        ),
        PhotoMetadata(
            file_path="IMG_0209.JPG",
            file_type="image",
            width=4032,
            height=3024,
            orientation="landscape",
            date_taken="2018-07-29T10:15:08",
            file_size=112820,
            last_modified=1532821508.0
        ),
        # Pair 2: 2024
        PhotoMetadata(
            file_path="IMG_0209_HEVC.MOV",
            file_type="video",
            width=1920,
            height=1080,
            orientation="landscape",
            date_taken="2024-11-02T07:28:34",
            file_size=1912387,
            last_modified=1730532514.0
        ),
        PhotoMetadata(
            file_path="IMG_0209-1137641.JPG",
            file_type="image",
            width=4032,
            height=3024,
            orientation="landscape",
            date_taken="2024-11-02T08:28:34",
            file_size=1137641,
            last_modified=1730532514.0
        ),
        # Unrelated standalone video: 2018-11
        PhotoMetadata(
            file_path="IMG_0209.MP4",
            file_type="video",
            width=1920,
            height=1080,
            orientation="landscape",
            date_taken="2018-11-23T06:53:19",
            file_size=21153023,
            last_modified=1542955999.0
        ),
    ]
    db.query.return_value.all.return_value = records
    
    items = get_photos(db=db)
    # Expect 2 live photos and 1 standalone video = 3 total items
    assert len(items) == 3
    
    live_photos = [it for it in items if it["type"] == "live_photo"]
    videos = [it for it in items if it["type"] == "video"]
    
    assert len(live_photos) == 2
    assert len(videos) == 1
    assert videos[0]["name"] == "IMG_0209.MP4"
    
    # Check pairings
    p1 = next(it for it in live_photos if it["name"] == "IMG_0209.JPG")
    assert "IMG_0209.MOV" in p1["videoUrl"]
    
    p2 = next(it for it in live_photos if it["name"] == "IMG_0209-1137641.JPG")
    assert "IMG_0209_HEVC.MOV" in p2["videoUrl"]
