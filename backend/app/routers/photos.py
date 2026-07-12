import random
import urllib.parse
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/photos", tags=["photos"])

PHOTOS_DIR = Path("/photos")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".ogg"}

@router.get("")
def get_photos():
    media_files = []
    
    if PHOTOS_DIR.exists() and PHOTOS_DIR.is_dir():
        # Scan for all files under /photos recursively
        for file_path in PHOTOS_DIR.rglob("*"):
            if file_path.is_file():
                ext = file_path.suffix.lower()
                
                try:
                    rel_path = file_path.relative_to(PHOTOS_DIR)
                except ValueError:
                    continue
                
                if ext in IMAGE_EXTENSIONS:
                    media_type = "image"
                elif ext in VIDEO_EXTENSIONS:
                    media_type = "video"
                else:
                    continue
                
                # URL encode the POSIX-style relative path to support subdirectories and special characters
                encoded_path = urllib.parse.quote(rel_path.as_posix())
                media_files.append({
                    "url": f"/api/photos/media/{encoded_path}",
                    "type": media_type,
                    "name": file_path.name
                })
                
    # Randomly shuffle the list
    random.shuffle(media_files)
    return media_files
