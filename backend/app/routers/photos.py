import random
import urllib.parse
import struct
import threading
import time
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, Depends, BackgroundTasks, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from PIL import Image, ImageOps
import httpx
import hashlib

from ..config import get_settings
from ..db import get_db, SessionLocal
from ..models import PhotoMetadata

router = APIRouter(prefix="/api/photos", tags=["photos"])

PHOTOS_DIR = get_settings().photos_dir

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov", ".ogg"}

# Thread-safe geocode processing tracker
GEOCODE_LOCK = threading.Lock()
GEOCODE_THREAD_LOCK = threading.Lock()
PENDING_GEOCODES = set()

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
                # 274 = Orientation. Rotated photos (common from phones) store
                # sensor dimensions; swap so metadata matches how browsers
                # render them (and how the display/thumbnail variants are cut).
                if exif.get(274) in (5, 6, 7, 8):
                    width, height = height, width
                # 36867 = DateTimeOriginal, 306 = DateTime
                date_str = exif.get(36867) or exif.get(306)
                if date_str:
                    try:
                        dt = datetime.strptime(date_str, "%Y:%m:%d %H:%M:%S")
                        date_taken = dt.isoformat()
                    except ValueError:
                        pass
                
                # GPS Info
                gps_info = exif.get_ifd(34853)
                if gps_info:
                    lat_ref = gps_info.get(1)
                    latitude = gps_info.get(2)
                    lon_ref = gps_info.get(3)
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

def get_video_dimensions(file_path):
    """
    Parses MP4/MOV track headers to extract width, height and check for rotation matrix.
    Returns (width, height) or (None, None) on failure.
    """
    try:
        with open(file_path, "rb") as f:
            data = f.read(5 * 1024 * 1024)  # Read first 5MB for headers
            idx = 0
            while True:
                idx = data.find(b"tkhd", idx)
                if idx == -1:
                    break
                
                atom_start = idx - 4
                if atom_start < 0:
                    idx += 4
                    continue
                    
                version = data[idx + 4]
                if version == 0:
                    offset = idx + 8 + 4 + 4 + 4 + 4 + 4 + 8 + 2 + 2 + 2 + 2
                elif version == 1:
                    offset = idx + 8 + 8 + 8 + 4 + 4 + 8 + 8 + 2 + 2 + 2 + 2
                else:
                    idx += 4
                    continue
                    
                matrix_offset = offset
                width_offset = offset + 36
                
                if width_offset + 8 > len(data):
                    break
                    
                matrix_data = data[matrix_offset:matrix_offset+36]
                matrix = struct.unpack(">9i", matrix_data)
                
                # Check for 90 or 270 degrees rotation (matrix[1] or matrix[3] is non-zero)
                is_rotated = (matrix[1] != 0 or matrix[3] != 0)
                
                w_int, w_frac = struct.unpack(">HH", data[width_offset:width_offset+4])
                h_int, h_frac = struct.unpack(">HH", data[width_offset+4:width_offset+8])
                
                if w_int > 0 and h_int > 0:
                    return (h_int, w_int) if is_rotated else (w_int, h_int)
                
                idx += 4
    except Exception as e:
        print(f"Error parsing video dimensions for {file_path}: {e}")
    return None, None

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
        print(f"Nominatim geocoding failed: {e}")
    return None

def geocode_worker(db_session_factory, file_paths):
    """
    Background worker thread resolving geocodes sequentially with a delay to comply with TOS.
    """
    with GEOCODE_THREAD_LOCK:
        for rel_str in file_paths:
            time.sleep(1.2)
            
            db = db_session_factory()
            try:
                cached = db.query(PhotoMetadata).filter(PhotoMetadata.file_path == rel_str).first()
                if cached and cached.latitude is not None and cached.longitude is not None:
                    location = fetch_location_name(cached.latitude, cached.longitude)
                    cached.location_name = location
                    db.commit()
            except Exception as e:
                print(f"Background geocoding failed for {rel_str}: {e}")
                try:
                    db.rollback()
                    cached = db.query(PhotoMetadata).filter(PhotoMetadata.file_path == rel_str).first()
                    if cached:
                        cached.location_name = None
                        db.commit()
                except Exception:
                    pass
            finally:
                db.close()
                with GEOCODE_LOCK:
                    PENDING_GEOCODES.discard(rel_str)

# Bump when metadata extraction changes in a way that requires re-reading
# every file (e.g. the EXIF orientation fix) — wipes the cache table once.
PHOTO_META_VERSION = "2"


def sync_photos_dir(db: Session):
    """
    Delta-syncs filesystem changes with the SQLite database.
    """
    if not PHOTOS_DIR.exists() or not PHOTOS_DIR.is_dir():
        return

    from ..services.sync import get_setting, set_setting

    if get_setting(db, "photo_meta_version") != PHOTO_META_VERSION:
        db.query(PhotoMetadata).delete()
        db.commit()
        set_setting(db, "photo_meta_version", PHOTO_META_VERSION)

    # 1. Scan filesystem for images and videos
    all_files_on_disk = {}
    for p in PHOTOS_DIR.rglob("*"):
        if p.is_file():
            ext = p.suffix.lower()
            if ext in IMAGE_EXTENSIONS:
                try:
                    rel_str = p.relative_to(PHOTOS_DIR).as_posix()
                    stat = p.stat()
                    all_files_on_disk[rel_str] = (p, "image", stat.st_size, stat.st_mtime)
                except ValueError:
                    continue
            elif ext in VIDEO_EXTENSIONS:
                try:
                    rel_str = p.relative_to(PHOTOS_DIR).as_posix()
                    stat = p.stat()
                    all_files_on_disk[rel_str] = (p, "video", stat.st_size, stat.st_mtime)
                except ValueError:
                    continue

    # 2. Get database cache records
    cached_records = db.query(PhotoMetadata).all()
    cache_dict = {rec.file_path: rec for rec in cached_records}
    
    # 3. Find delta changes
    disk_paths = set(all_files_on_disk.keys())
    db_paths = set(cache_dict.keys())
    
    deleted_paths = db_paths - disk_paths
    changed_or_new_paths = []
    
    for path in disk_paths:
        p_obj, file_type, size, mtime = all_files_on_disk[path]
        cached = cache_dict.get(path)
        if not cached or cached.file_size != size or cached.last_modified != mtime:
            changed_or_new_paths.append((path, p_obj, file_type, size, mtime))

    # 4. Delete removed records from database
    if deleted_paths:
        db.query(PhotoMetadata).filter(PhotoMetadata.file_path.in_(list(deleted_paths))).delete(synchronize_session=False)
        db.commit()

    # 5. Insert or update new/changed records (delta-processing)
    pending_geocodes = []
    for path, p_obj, file_type, size, mtime in changed_or_new_paths:
        cached = cache_dict.get(path)
        if not cached:
            cached = PhotoMetadata(file_path=path)
            db.add(cached)
            
        cached.file_type = file_type
        cached.file_size = size
        cached.last_modified = mtime
        
        if file_type == "image":
            # Extract dimensions & EXIF (fast - only reads headers)
            width, height, date_taken, lat, lon = get_exif_metadata(p_obj)
            cached.width = width
            cached.height = height
            cached.orientation = "portrait" if height > width else "landscape"
            cached.date_taken = date_taken
            cached.latitude = lat
            cached.longitude = lon
            
            # Queue geocoding if GPS found
            if lat is not None and lon is not None:
                cached.location_name = "Resolving..."
                pending_geocodes.append(path)
            else:
                cached.location_name = None
        else:
            # Parse video track dimensions
            v_width, v_height = get_video_dimensions(p_obj)
            if v_width and v_height:
                cached.width = v_width
                cached.height = v_height
                cached.orientation = "portrait" if v_height > v_width else "landscape"
            else:
                cached.width = 1920
                cached.height = 1080
                cached.orientation = "landscape"
                
            cached.date_taken = None
            cached.latitude = None
            cached.longitude = None
            cached.location_name = None
            
        db.flush()
        
    # Commit session to persist flushed records in SQLite cache
    db.commit()
        
    # Launch background geocode threads if requested
    if pending_geocodes:
        with GEOCODE_LOCK:
            new_pending = []
            for path in pending_geocodes:
                if path not in PENDING_GEOCODES:
                    PENDING_GEOCODES.add(path)
                    new_pending.append(path)
            if new_pending:
                t = threading.Thread(target=geocode_worker, args=(SessionLocal, new_pending), daemon=True)
                t.start()

def sync_photos_dir_background(db_session_factory):
    """
    Fast thread entrypoint to perform a delta scan.
    """
    db = db_session_factory()
    try:
        sync_photos_dir(db)
    except Exception as e:
        print(f"Background photos synchronization failed: {e}")
    finally:
        db.close()

THUMBNAILS_DIR = Path(get_settings().data_dir) / "thumbnails"
THUMBNAILS_DIR.mkdir(parents=True, exist_ok=True)
DISPLAY_DIR = Path(get_settings().data_dir) / "display"
DISPLAY_DIR.mkdir(parents=True, exist_ok=True)


def _resolve_photo_path(file_path: str):
    try:
        decoded_path = urllib.parse.unquote(file_path)
        orig_path = (PHOTOS_DIR / decoded_path).resolve()
        if not orig_path.is_relative_to(PHOTOS_DIR.resolve()) or not orig_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")
        return decoded_path, orig_path
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=404, detail="Invalid path")


def _resized_variant(decoded_path: str, orig_path: Path, cache_dir: Path, max_px: int, quality: int):
    """Serve a disk-cached, EXIF-rotated, downscaled JPEG of the original."""
    ext = orig_path.suffix.lower()
    # Videos can't be resized here; animated GIFs would lose animation.
    if ext in VIDEO_EXTENSIONS or ext == ".gif":
        return FileResponse(orig_path)

    stat = orig_path.stat()
    cache_key = f"{decoded_path}_{stat.st_mtime}_{stat.st_size}_{max_px}"
    h = hashlib.md5(cache_key.encode()).hexdigest()
    out_path = cache_dir / f"{h}.jpg"

    if not out_path.exists():
        try:
            with Image.open(orig_path) as img:
                try:
                    img = ImageOps.exif_transpose(img)
                except Exception:
                    pass
                img.thumbnail((max_px, max_px))
                if img.mode != "RGB":
                    img = img.convert("RGB")
                img.save(out_path, "JPEG", quality=quality)
        except Exception as e:
            print(f"Failed to generate {max_px}px variant for {decoded_path}: {e}")
            return FileResponse(orig_path)

    return FileResponse(out_path)


@router.get("/thumbnail/{file_path:path}")
def get_thumbnail(file_path: str):
    decoded_path, orig_path = _resolve_photo_path(file_path)
    return _resized_variant(decoded_path, orig_path, THUMBNAILS_DIR, 400, 80)


@router.get("/display/{file_path:path}")
def get_display(file_path: str):
    # Screen-sized variant for the slideshow/lightbox: decoding a 2048px JPEG
    # is ~10x cheaper than a 12-48MP phone original and looks identical on a
    # 1080p kiosk.
    decoded_path, orig_path = _resolve_photo_path(file_path)
    return _resized_variant(decoded_path, orig_path, DISPLAY_DIR, 2048, 85)

@router.get("")
def get_photos(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Check if the database has any records
    db_count = db.query(PhotoMetadata).count()
    if db_count == 0:
        # First-time scan: run synchronously so the user doesn't see a blank screen
        sync_photos_dir(db)
    else:
        # Subsequent scans: run delta check in background, return cached records instantly
        background_tasks.add_task(sync_photos_dir_background, SessionLocal)
    
    # Query all cached photo metadata directly from the SQLite database
    cached_records = db.query(PhotoMetadata).all()
    
    image_map = {}
    video_map = {}
    
    for rec in cached_records:
        if rec.file_type == "video":
            video_map[rec.file_path.lower()] = rec
        else:
            location_display = None
            if rec.location_name and rec.location_name != "Resolving...":
                location_display = rec.location_name
                
            image_map[rec.file_path.lower()] = {
                "rel_path": Path(rec.file_path),
                "name": Path(rec.file_path).name,
                "width": rec.width,
                "height": rec.height,
                "orientation": rec.orientation,
                "date_taken": rec.date_taken,
                "location_name": location_display
            }

    media_items = []
    paired_images = set()
    
    # 1. Pair Live Photos
    for vid_rel_str, vid_rec in video_map.items():
        vid_rel_path = Path(vid_rec.file_path)
        vid_base = vid_rel_path.stem
        vid_dir = vid_rel_path.parent
        
        if vid_base.endswith("_hevc"):
            base_name = vid_base[:-5]
        else:
            base_name = vid_base
            
        found_pair = False
        for img_ext in IMAGE_EXTENSIONS:
            img_rel_path = vid_dir / f"{base_name}{img_ext}"
            img_rel_str = img_rel_path.as_posix().lower()
            if img_rel_str in image_map:
                img_data = image_map[img_rel_str]
                
                media_items.append({
                    "url": f"/api/photos/media/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
                    "displayUrl": f"/api/photos/display/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
                    "thumbnailUrl": f"/api/photos/thumbnail/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
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
            # Standalone video (use actual parsed metadata width/height/orientation)
            media_items.append({
                "url": f"/api/photos/media/{urllib.parse.quote(vid_rel_path.as_posix())}",
                "thumbnailUrl": f"/api/photos/thumbnail/{urllib.parse.quote(vid_rel_path.as_posix())}",
                "type": "video",
                "name": vid_rel_path.name,
                "width": vid_rec.width,
                "height": vid_rec.height,
                "orientation": vid_rec.orientation,
                "date_taken": None,
                "location_name": None
            })
            
    # 2. Add remaining standalone images
    for img_rel_str, img_data in image_map.items():
        if img_rel_str not in paired_images:
            media_items.append({
                "url": f"/api/photos/media/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
                "displayUrl": f"/api/photos/display/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
                "thumbnailUrl": f"/api/photos/thumbnail/{urllib.parse.quote(img_data['rel_path'].as_posix())}",
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
