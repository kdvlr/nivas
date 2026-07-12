import random
import urllib.parse
import struct
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from PIL import Image
import httpx

from ..db import get_db
from ..models import PhotoMetadata

router = APIRouter(prefix="/api/photos", tags=["photos"])

PHOTOS_DIR = Path("/photos")

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".ogg"}

def to_decimal(value):
    if not value or len(value) < 3:
        return 0.0
    try:
        d = float(value[0])
        m = float(value[1])
        s = float(value[2])
        return d + (m / 60.0) + (s / 3600.0)
    except Exception:
        return 0.0

def get_exif_metadata(file_path):
    width, height = 1920, 1080
    date_taken = None
    lat = None
    lon = None

    try:
        with Image.open(file_path) as img:
            width, height = img.width, img.height
            exif = img.getexif()
            if exif:
                # 36867 = DateTimeOriginal, 306 = DateTime
                date_str = exif.get(36867) or exif.get(306)
                if date_str:
                    try:
                        dt = datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                        date_taken = dt.isoformat()
                    except ValueError:
                        pass
                
                # GPS Info Sub-IFD marker
                gps_info = exif.get_ifd(34853)
                if gps_info:
                    lat_ref = gps_info.get(1)  # N or S
                    latitude = gps_info.get(2)
                    lon_ref = gps_info.get(3)  # E or W
                    longitude = gps_info.get(4)
                    
                    if latitude and lat_ref and longitude and lon_ref:
                        lat_val = to_decimal(latitude)
                        if lat_ref == 'S':
                            lat_val = -lat_val
                        lon_val = to_decimal(longitude)
                        if lon_ref == 'W':
                            lon_val = -lon_val
                        lat = lat_val
                        lon = lon_val
    except Exception as e:
        print(f"Error parsing EXIF for {file_path}: {e}")

    return width, height, date_taken, lat, lon

def fetch_location_name(lat: float, lon: float) -> str | None:
    if lat is None or lon is None:
        return None
    url = f"https://nominatim.openstreetmap.org/reverse?format=json&lat={lat}&lon={lon}&zoom=10&addressdetails=1"
    headers = {"User-Agent": "NivasFamilyDashboard/1.0 (d.kiran@yahoo.com)"}
    try:
        with httpx.Client(timeout=3.0) as client:
            r = client.get(url, headers=headers)
            if r.status_code == 200:
                data = r.json()
                address = data.get("address", {})
                
                # Format a user-friendly city/state/country string
                city = address.get("city") or address.get("town") or address.get("village") or address.get("suburb") or address.get("county")
                state = address.get("state")
                country = address.get("country")
                
                if city and state:
                    return f"{city}, {state}"
                elif city and country:
                    return f"{city}, {country}"
                elif state and country:
                    return f"{state}, {country}"
                elif country:
                    return country
    except Exception as e:
        print(f"Nominatim reverse geocoding failed: {e}")
    return None

@router.get("")
def get_photos(db: Session = Depends(get_db)):
    if not PHOTOS_DIR.exists() or not PHOTOS_DIR.is_dir():
        return []
        
    all_files = list(PHOTOS_DIR.rglob("*"))
    
    image_files = []
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
                image_files.append((file_path, rel_str))
            elif ext in VIDEO_EXTENSIONS:
                video_map[rel_str.lower()] = rel_path

    # Synchronize database cache for image files
    image_map = {}
    cached_records = db.query(PhotoMetadata).all()
    cache_dict = {rec.file_path: rec for rec in cached_records}
    
    for file_path, rel_str in image_files:
        stat = file_path.stat()
        file_size = stat.st_size
        last_modified = stat.st_mtime
        
        cached = cache_dict.get(rel_str)
        
        if cached and cached.file_size == file_size and cached.last_modified == last_modified:
            image_map[rel_str.lower()] = {
                "rel_path": Path(rel_str),
                "name": file_path.name,
                "width": cached.width,
                "height": cached.height,
                "orientation": cached.orientation,
                "date_taken": cached.date_taken,
                "location_name": cached.location_name
            }
        else:
            # Parse photo dimensions and EXIF metadata
            width, height, date_taken, lat, lon = get_exif_metadata(file_path)
            orientation = "portrait" if height > width else "landscape"
            
            # Lookup human readable location name if coordinates are embedded
            location_name = None
            if lat is not None and lon is not None:
                location_name = fetch_location_name(lat, lon)
                
            if not cached:
                cached = PhotoMetadata(file_path=rel_str)
                db.add(cached)
                
            cached.width = width
            cached.height = height
            cached.orientation = orientation
            cached.date_taken = date_taken
            cached.latitude = lat
            cached.longitude = lon
            cached.location_name = location_name
            cached.file_size = file_size
            cached.last_modified = last_modified
            
            db.flush()
            
            image_map[rel_str.lower()] = {
                "rel_path": Path(rel_str),
                "name": file_path.name,
                "width": width,
                "height": height,
                "orientation": orientation,
                "date_taken": date_taken,
                "location_name": location_name
            }
            
    if db.new or db.dirty:
        db.commit()

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
                    "orientation": img_data["orientation"],
                    "date_taken": img_data["date_taken"],
                    "location_name": img_data["location_name"]
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
                "orientation": "landscape",
                "date_taken": None,
                "location_name": None
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
                "orientation": img_data["orientation"],
                "date_taken": img_data["date_taken"],
                "location_name": img_data["location_name"]
            })
            
    random.shuffle(media_items)
    return media_items
