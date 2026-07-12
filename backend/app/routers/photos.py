import random
import urllib.parse
import struct
from pathlib import Path
from fastapi import APIRouter

router = APIRouter(prefix="/api/photos", tags=["photos"])

PHOTOS_DIR = Path("/photos")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".ogg"}

def get_image_size(file_path):
    try:
        with open(file_path, 'rb') as f:
            head = f.read(32)
            if len(head) < 24:
                return None

            # PNG
            if head.startswith(b'\x89PNG\r\n\x1a\n'):
                w, h = struct.unpack('>ii', head[16:24])
                return int(w), int(h)

            # GIF
            elif head.startswith(b'GIF87a') or head.startswith(b'GIF89a'):
                w, h = struct.unpack('<HH', head[6:10])
                return int(w), int(h)

            # WEBP
            elif head.startswith(b'RIFF') and head[8:12] == b'WEBP':
                f.seek(12)
                vp8 = f.read(4)
                if vp8 == b'VP8 ':
                    f.seek(26)
                    width_height = f.read(4)
                    w, h = struct.unpack('<HH', width_height)
                    return int(w & 0x3fff), int(h & 0x3fff)
                elif vp8 == b'VP8L':
                    f.seek(21)
                    b = f.read(5)
                    w = 1 + (((b[1] & 0x3F) << 8) | b[0])
                    h = 1 + (((b[4] & 0x0F) << 10) | (b[3] << 2) | ((b[2] & 0xC0) >> 6))
                    return int(w), int(h)
                elif vp8 == b'VP8X':
                    f.seek(24)
                    b = f.read(6)
                    w = 1 + (b[0] | (b[1] << 8) | (b[2] << 16))
                    h = 1 + (b[3] | (b[4] << 8) | (b[5] << 16))
                    return int(w), int(h)

            # JPEG
            elif head.startswith(b'\xff\xd8'):
                f.seek(2)
                while True:
                    marker = f.read(2)
                    if len(marker) < 2:
                        break
                    if marker[0] != 0xFF:
                        break
                    marker_type = marker[1]
                    if marker_type in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
                        f.read(3)  # length + precision
                        h, w = struct.unpack('>HH', f.read(4))
                        return int(w), int(h)
                    else:
                        length_bytes = f.read(2)
                        if len(length_bytes) < 2:
                            break
                        length = struct.unpack('>H', length_bytes)[0]
                        f.seek(length - 2, 1)
    except Exception:
        pass
    return None

@router.get("")
def get_photos():
    if not PHOTOS_DIR.exists() or not PHOTOS_DIR.is_dir():
        return []
        
    all_files = list(PHOTOS_DIR.rglob("*"))
    
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
                size = get_image_size(file_path)
                width, height = size if size else (1920, 1080)
                orientation = "portrait" if height > width else "landscape"
                
                image_map[rel_str.lower()] = {
                    "rel_path": rel_path,
                    "name": file_path.name,
                    "width": width,
                    "height": height,
                    "orientation": orientation
                }
            elif ext in VIDEO_EXTENSIONS:
                video_map[rel_str.lower()] = rel_path

    media_items = []
    paired_images = set()
    
    # 1. Pair Live Photos
    for vid_rel_str, vid_rel_path in video_map.items():
        vid_path_obj = Path(vid_rel_str)
        vid_base = vid_path_obj.stem
        vid_dir = vid_path_obj.parent
        
        if vid_base.endswith("_hevc"):
            base_name = vid_base[:-5]
        else:
            base_name = vid_base
            
        found_pair = False
        for img_ext in IMAGE_EXTENSIONS:
            img_rel_str = (vid_dir / f"{base_name}{img_ext}").as_posix().lower()
            if img_rel_str in image_map:
                img_data = image_map[img_rel_str]
                
                media_items.append({
                    "url": f"/api/photos/media/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
                    "videoUrl": f"/api/photos/media/{urllib.parse.quote(vid_rel_path.as_posix())}",
                    "type": "live_photo",
                    "name": img_data["name"],
                    "width": img_data["width"],
                    "height": img_data["height"],
                    "orientation": img_data["orientation"]
                })
                paired_images.add(img_rel_str)
                found_pair = True
                break
                
        if not found_pair:
            # Standalone video
            media_items.append({
                "url": f"/api/photos/media/{urllib.parse.quote(vid_rel_path.as_posix())}",
                "type": "video",
                "name": vid_rel_path.name,
                "width": 1920,
                "height": 1080,
                "orientation": "landscape"
            })
            
    # 2. Add remaining standalone images
    for img_rel_str, img_data in image_map.items():
        if img_rel_str not in paired_images:
            media_items.append({
                "url": f"/api/photos/media/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
                "type": "image",
                "name": img_data["name"],
                "width": img_data["width"],
                "height": img_data["height"],
                "orientation": img_data["orientation"]
            })
            
    random.shuffle(media_items)
    return media_items
