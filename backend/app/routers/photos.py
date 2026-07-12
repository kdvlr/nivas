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
    
    if not PHOTOS_DIR.exists() or not PHOTOS_DIR.is_dir():
        return []
        
    all_files = list(PHOTOS_DIR.rglob("*"))
    
    # Maps of lowercase relative path strings for fast lookup
    image_map = {}
    video_map = {}
    
    for file_path in all_files:
        if file_path.is_file():
            ext = file_path.suffix.lower()
            try:
                rel_path = file_path.relative_to(PHOTOS_DIR)
            except ValueError:
                continue
            
            rel_str = rel_path.as_posix()
            
            if ext in IMAGE_EXTENSIONS:
                image_map[rel_str.lower()] = (rel_path, file_path.name)
            elif ext in VIDEO_EXTENSIONS:
                video_map[rel_str.lower()] = rel_path

    media_items = []
    paired_images = set()
    
    # 1. Detect and pair Live Photos (matching video component with its static image)
    for vid_rel_str, vid_rel_path in video_map.items():
        vid_path_obj = Path(vid_rel_str)
        vid_base = vid_path_obj.stem
        vid_dir = vid_path_obj.parent
        
        # Remove "_hevc" or similar suffixes common in Apple Live Photo exports
        if vid_base.endswith("_hevc"):
            base_name = vid_base[:-5]
        else:
            base_name = vid_base
            
        found_pair = False
        # Search for a companion image in the same subfolder
        for img_ext in IMAGE_EXTENSIONS:
            img_rel_str = (vid_dir / f"{base_name}{img_ext}").as_posix().lower()
            if img_rel_str in image_map:
                img_rel_path, img_name = image_map[img_rel_str]
                
                # Pair found: add as a single "live_photo"
                media_items.append({
                    "url": f"/api/photos/media/{urllib.parse.quote(img_rel_path.as_posix())}",
                    "videoUrl": f"/api/photos/media/{urllib.parse.quote(vid_rel_path.as_posix())}",
                    "type": "live_photo",
                    "name": img_name
                })
                paired_images.add(img_rel_str)
                found_pair = True
                break
                
        if not found_pair:
            # Standalone video
            media_items.append({
                "url": f"/api/photos/media/{urllib.parse.quote(vid_rel_path.as_posix())}",
                "type": "video",
                "name": vid_rel_path.name
            })
            
    # 2. Add remaining standalone images that were not paired
    for img_rel_str, (img_rel_path, img_name) in image_map.items():
        if img_rel_str not in paired_images:
            media_items.append({
                "url": f"/api/photos/media/{urllib.parse.quote(img_rel_path.as_posix())}",
                "type": "image",
                "name": img_name
            })
            
    # Randomly shuffle
    random.shuffle(media_items)
    return media_items
