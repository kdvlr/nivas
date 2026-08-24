import os
import re
import glob
import time
import sqlite3
import hashlib
import logging
import threading
from typing import Dict, Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

SUPPORTED_EXTENSIONS = {".m4a", ".flac", ".mp3", ".aac", ".wav", ".alac", ".ogg", ".aiff", ".aif"}
ARTWORK_NAMES = {"cover.jpg", "cover.png", "cover.jpeg", "folder.jpg", "folder.png", "folder.jpeg", "albumart.jpg", "front.jpg", "front.png"}

class LocalMusicService:
    def __init__(self, music_dir: Optional[str] = None, data_dir: Optional[str] = None):
        self.music_dir = music_dir or os.getenv("MUSIC_DIR", "/media/music")
        self.data_dir = data_dir or os.getenv("DATA_DIR", "/data")
        self.db_path = os.path.join(self.data_dir, "local_music.db")
        self.artwork_cache_dir = os.path.join(self.data_dir, "local_artwork_cache")
        os.makedirs(self.artwork_cache_dir, exist_ok=True)
        
        self._is_scanning = False
        self._last_scan_time = 0.0
        self._total_tracks = 0
        self._total_albums = 0
        self._total_artists = 0
        
        self._init_db()
        self._update_counts()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, timeout=30.0)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self):
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS tracks (
                        id TEXT PRIMARY KEY,
                        file_path TEXT UNIQUE,
                        title TEXT,
                        artist TEXT,
                        album_artist TEXT,
                        album TEXT,
                        album_id TEXT,
                        track_number INTEGER,
                        disc_number INTEGER,
                        duration REAL,
                        year TEXT,
                        genre TEXT,
                        file_format TEXT,
                        file_size INTEGER,
                        mtime REAL,
                        has_artwork INTEGER
                    )
                """)
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS albums (
                        id TEXT PRIMARY KEY,
                        title TEXT,
                        artist TEXT,
                        year TEXT,
                        track_count INTEGER,
                        has_artwork INTEGER,
                        folder_path TEXT,
                        is_compilation INTEGER DEFAULT 0
                    )
                """)
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_artist ON tracks(artist)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist)")
                cursor.execute("CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title)")
                
                # Migrations for existing databases
                try:
                    cursor.execute("ALTER TABLE tracks ADD COLUMN album_artist TEXT")
                except Exception:
                    pass
                try:
                    cursor.execute("ALTER TABLE albums ADD COLUMN is_compilation INTEGER DEFAULT 0")
                except Exception:
                    pass
                conn.commit()
        except Exception as e:
            logger.error(f"Error initializing local music db: {e}")

    def _update_counts(self):
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT COUNT(*) FROM tracks")
                self._total_tracks = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(*) FROM albums")
                self._total_albums = cursor.fetchone()[0]
                cursor.execute("SELECT COUNT(DISTINCT artist) FROM tracks WHERE artist IS NOT NULL AND artist != ''")
                self._total_artists = cursor.fetchone()[0]
        except Exception as e:
            logger.error(f"Error updating local music counts: {e}")

    def start_background_scan(self, only_if_empty: bool = False):
        """Spawns an asynchronous background scan if not already scanning."""
        if self._is_scanning:
            return
        if only_if_empty and self._total_tracks > 0:
            logger.info(f"Local music database already indexed ({self._total_tracks} tracks, {self._total_albums} albums). Reusing scan index.")
            return
        threading.Thread(target=self.scan_library, daemon=True, name="local-music-scanner").start()

    def scan_library(self) -> Dict[str, Any]:
        """Scans the music directory and populates SQLite index."""
        if self._is_scanning:
            return {"status": "already_scanning", "total_tracks": self._total_tracks}

        if not os.path.exists(self.music_dir):
            logger.info(f"Local music directory {self.music_dir} does not exist. Skipping scan.")
            return {"status": "directory_not_found", "path": self.music_dir}

        self._is_scanning = True
        start_time = time.time()
        logger.info(f"Starting local music scan in {self.music_dir}...")

        # Import mutagen dynamically
        try:
            import mutagen
            from mutagen.easyid3 import EasyID3
            from mutagen.mp4 import MP4
            from mutagen.flac import FLAC
            from mutagen.id3 import ID3, APIC
        except ImportError:
            logger.warning("Mutagen is not installed. Scanning metadata via basic path heuristic.")
            mutagen = None

        discovered_tracks = []
        scanned_track_ids = set()
        album_map = {}  # album_id -> dict
        batch_size = 100
        uncommitted_tracks = []

        try:
            for root, _, files in os.walk(self.music_dir):
                folder_has_art = any(f.lower() in ARTWORK_NAMES for f in files)
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    if ext not in SUPPORTED_EXTENSIONS:
                        continue

                    full_path = os.path.join(root, file)
                    try:
                        stat = os.stat(full_path)
                        mtime = stat.st_mtime
                        file_size = stat.st_size
                    except OSError:
                        continue

                    try:
                        track_info = self._extract_metadata(full_path, file, root, ext, mutagen, folder_has_art)
                        track_info["file_size"] = file_size
                        track_info["mtime"] = mtime
                        discovered_tracks.append(track_info)
                        scanned_track_ids.add(track_info["id"])
                        uncommitted_tracks.append(track_info)

                        # Group into albums using resolved album_artist
                        alb_id = track_info["album_id"]
                        if alb_id not in album_map:
                            album_map[alb_id] = {
                                "id": alb_id,
                                "title": track_info["album"],
                                "artist": track_info["album_artist"],
                                "year": track_info["year"],
                                "track_count": 0,
                                "has_artwork": track_info["has_artwork"],
                                "folder_path": root,
                                "is_compilation": track_info.get("is_compilation", 0),
                            }
                        album_map[alb_id]["track_count"] += 1
                        if track_info["has_artwork"]:
                            album_map[alb_id]["has_artwork"] = 1

                        if len(uncommitted_tracks) >= batch_size:
                            self._commit_track_batch(uncommitted_tracks)
                            uncommitted_tracks = []
                            self._total_tracks = len(discovered_tracks)
                            self._total_albums = len(album_map)
                    except Exception as e:
                        logger.debug(f"Error parsing track {full_path}: {e}")

            # Commit remaining tracks
            if uncommitted_tracks:
                self._commit_track_batch(uncommitted_tracks)
                uncommitted_tracks = []

            # Save all albums and clean up deleted files
            with self._get_conn() as conn:
                cursor = conn.cursor()
                album_rows = [
                    (
                        a["id"], a["title"], a["artist"], a["year"],
                        a["track_count"], a["has_artwork"], a["folder_path"],
                        a.get("is_compilation", 0)
                    )
                    for a in album_map.values()
                ]
                cursor.executemany("""
                    INSERT OR REPLACE INTO albums (
                        id, title, artist, year, track_count, has_artwork, folder_path, is_compilation
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """, album_rows)

                # Clean up tracks no longer on disk if scan discovered tracks
                if scanned_track_ids:
                    cursor.execute("SELECT id FROM tracks")
                    existing_ids = {row[0] for row in cursor.fetchall()}
                    deleted_ids = existing_ids - scanned_track_ids
                    if deleted_ids:
                        logger.info(f"Pruning {len(deleted_ids)} deleted tracks from database.")
                        for chunk_start in range(0, len(deleted_ids), 500):
                            chunk = list(deleted_ids)[chunk_start:chunk_start + 500]
                            cursor.execute(f"DELETE FROM tracks WHERE id IN ({','.join('?' for _ in chunk)})", chunk)
                    cursor.execute("DELETE FROM albums WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks)")

                conn.commit()

            self._last_scan_time = time.time()
            self._update_counts()
            elapsed = time.time() - start_time
            logger.info(f"Local music scan complete in {elapsed:.2f}s: {self._total_tracks} tracks, {self._total_albums} albums, {self._total_artists} artists.")
            return {
                "status": "success",
                "tracks_scanned": len(discovered_tracks),
                "albums_scanned": len(album_map),
                "duration_seconds": elapsed,
            }
        except Exception as e:
            logger.error(f"Error during local music scan: {e}", exc_info=True)
            return {"status": "error", "message": str(e)}
        finally:
            self._is_scanning = False

    def _commit_track_batch(self, tracks: List[Dict[str, Any]]):
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                track_rows = [
                    (
                        t["id"], t["file_path"], t["title"], t["artist"],
                        t.get("album_artist", t["artist"]), t["album"],
                        t["album_id"], t["track_number"], t["disc_number"], t["duration"],
                        t["year"], t["genre"], t["file_format"], t["file_size"], t["mtime"],
                        t["has_artwork"]
                    )
                    for t in tracks
                ]
                cursor.executemany("""
                    INSERT OR REPLACE INTO tracks (
                        id, file_path, title, artist, album_artist, album, album_id,
                        track_number, disc_number, duration, year, genre,
                        file_format, file_size, mtime, has_artwork
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, track_rows)
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to commit track batch: {e}")

    def _extract_metadata(self, full_path: str, filename: str, folder_path: str, ext: str, mutagen_mod, folder_has_artwork: bool = False) -> Dict[str, Any]:
        """Extracts audio tags using Mutagen with safe heuristic fallbacks."""
        # Clean defaults from directory & filename structure
        base_name = os.path.splitext(filename)[0]
        # remove track number prefix like "01 - " or "01 " or "1-01 "
        clean_title = re.sub(r"^\d+[\s\-_]+", "", base_name)
        clean_title = re.sub(r"^\d+\-\d+[\s\-_]+", "", clean_title)

        folder_name = os.path.basename(folder_path)
        parent_folder_name = os.path.basename(os.path.dirname(folder_path))

        title = clean_title or base_name
        artist = parent_folder_name if parent_folder_name and parent_folder_name != os.path.basename(self.music_dir) else "Unknown Artist"
        album_artist = ""
        is_compilation = False
        album = folder_name or "Unknown Album"
        track_number = 1
        disc_number = 1
        duration = 0.0
        year = ""
        genre = ""
        has_artwork = 1 if folder_has_artwork else 0

        if mutagen_mod:
            try:
                if ext in (".m4a", ".alac"):
                    from mutagen.mp4 import MP4
                    audio = MP4(full_path)
                    if audio and audio.info and hasattr(audio.info, "length"):
                        duration = float(audio.info.length)
                    tags = audio.tags if audio else {}
                    if tags:
                        if "\xa9nam" in tags:
                            title = str(tags["\xa9nam"][0])
                        elif "title" in tags:
                            title = str(tags["title"][0])

                        if "\xa9ART" in tags:
                            artist = str(tags["\xa9ART"][0])
                        elif "artist" in tags:
                            artist = str(tags["artist"][0])

                        # iTunes Album Artist (aART)
                        if "aART" in tags:
                            album_artist = str(tags["aART"][0])
                        elif "albumartist" in tags:
                            album_artist = str(tags["albumartist"][0])

                        # iTunes Compilation Flag (cpil)
                        if "cpil" in tags:
                            val = tags["cpil"]
                            if isinstance(val, (list, tuple)) and val:
                                is_compilation = bool(val[0])
                            elif isinstance(val, bool):
                                is_compilation = val
                            elif isinstance(val, (int, str)):
                                is_compilation = str(val).strip() in ("1", "True", "true")

                        if "\xa9alb" in tags:
                            album = str(tags["\xa9alb"][0])
                        elif "album" in tags:
                            album = str(tags["album"][0])

                        if "\xa9day" in tags:
                            year = str(tags["\xa9day"][0])[:4]
                        elif "date" in tags:
                            year = str(tags["date"][0])[:4]

                        if "trkn" in tags and tags["trkn"] and isinstance(tags["trkn"], (list, tuple)):
                            try:
                                track_number = int(tags["trkn"][0][0])
                            except Exception:
                                pass

                        if "disk" in tags and tags["disk"] and isinstance(tags["disk"], (list, tuple)):
                            try:
                                disc_number = int(tags["disk"][0][0])
                            except Exception:
                                pass

                        if "covr" in tags and tags["covr"]:
                            has_artwork = 1
                elif ext == ".flac":
                    from mutagen.flac import FLAC
                    audio = FLAC(full_path)
                    if audio and audio.info and hasattr(audio.info, "length"):
                        duration = float(audio.info.length)
                    tags = audio.tags if audio else {}
                    if tags:
                        if "title" in tags:
                            title = str(tags["title"][0])
                        if "artist" in tags:
                            artist = str(tags["artist"][0])

                        # FLAC Album Artist & Compilation
                        for aak in ("albumartist", "album artist", "ALBUMARTIST", "ALBUM ARTIST", "album_artist"):
                            if aak in tags:
                                album_artist = str(tags[aak][0])
                                break
                        for ck in ("compilation", "COMPILATION"):
                            if ck in tags:
                                is_compilation = str(tags[ck][0]).strip() in ("1", "True", "true")
                                break

                        if "album" in tags:
                            album = str(tags["album"][0])
                        if "date" in tags:
                            year = str(tags["date"][0])[:4]
                        elif "year" in tags:
                            year = str(tags["year"][0])[:4]
                        if "tracknumber" in tags:
                            try:
                                track_number = int(str(tags["tracknumber"][0]).split("/")[0])
                            except Exception:
                                pass
                    if audio and audio.pictures:
                        has_artwork = 1
                else:
                    audio = mutagen_mod.File(full_path)
                    if audio is not None:
                        if hasattr(audio, "info") and hasattr(audio.info, "length"):
                            duration = float(audio.info.length)
                        tags = audio.tags
                        if tags and hasattr(tags, "get"):
                            for t_k in ("TIT2", "title"):
                                if t_k in tags:
                                    title = str(tags[t_k])
                                    break
                            for a_k in ("TPE1", "artist"):
                                if a_k in tags:
                                    artist = str(tags[a_k])
                                    break
                            for aa_k in ("TPE2", "albumartist", "ALBUMARTIST", "ALBUM ARTIST"):
                                if aa_k in tags:
                                    album_artist = str(tags[aa_k])
                                    break
                            for c_k in ("TCMP", "compilation", "COMPILATION"):
                                if c_k in tags:
                                    is_compilation = str(tags[c_k]).strip() in ("1", "True", "true")
                                    break
                            for alb_k in ("TALB", "album"):
                                if alb_k in tags:
                                    album = str(tags[alb_k])
                                    break
                            for y_k in ("TDRC", "TYER", "date", "year"):
                                if y_k in tags:
                                    year = str(tags[y_k])[:4]
                                    break
                            trk_tag = tags.get("TRCK")
                            if trk_tag:
                                try:
                                    track_number = int(str(trk_tag).split("/")[0])
                                except ValueError:
                                    pass
                            for k in tags.keys():
                                if k.startswith("APIC"):
                                    has_artwork = 1
                                    break
            except Exception as e:
                logger.debug(f"Error parsing mutagen tags for {full_path}: {e}")

        # Resolve album artist and compilation
        resolved_album_artist = album_artist.strip()
        if not resolved_album_artist:
            if is_compilation:
                resolved_album_artist = "Various Artists"
            else:
                resolved_album_artist = artist.strip()

        # Generate stable IDs
        if is_compilation or resolved_album_artist.lower() in ("various artists", "compilation", "soundtrack"):
            # Group compilation tracks by album title and folder
            album_norm = f"compilation_{folder_path.lower().strip()}_{album.lower().strip()}"
        else:
            album_norm = f"{resolved_album_artist.lower().strip()}_{album.lower().strip()}"
        album_id = "local_alb_" + hashlib.md5(album_norm.encode("utf-8")).hexdigest()[:12]

        track_norm = f"{full_path.lower()}"
        track_id = "local_trk_" + hashlib.md5(track_norm.encode("utf-8")).hexdigest()[:12]

        return {
            "id": track_id,
            "file_path": full_path,
            "title": title.strip(),
            "artist": artist.strip(),
            "album_artist": resolved_album_artist,
            "album": album.strip(),
            "album_id": album_id,
            "track_number": track_number,
            "disc_number": disc_number,
            "duration": round(duration),
            "year": year.strip(),
            "genre": genre.strip(),
            "file_format": ext.lstrip(".").upper(),
            "has_artwork": 1 if has_artwork else 0,
            "is_compilation": 1 if is_compilation else 0,
        }

    def get_status(self) -> Dict[str, Any]:
        return {
            "isScanning": self._is_scanning,
            "lastScanTime": self._last_scan_time,
            "totalTracks": self._total_tracks,
            "totalAlbums": self._total_albums,
            "totalArtists": self._total_artists,
            "musicDir": self.music_dir,
            "isAvailable": os.path.exists(self.music_dir),
        }

    def search(self, query: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Searches local library tracks, albums, and artists."""
        query = query.strip()
        if not query:
            return []

        pattern = f"%{query}%"
        results = []
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM tracks
                    WHERE title LIKE ? OR artist LIKE ? OR album LIKE ?
                    ORDER BY 
                        CASE 
                            WHEN title LIKE ? THEN 1
                            WHEN artist LIKE ? THEN 2
                            ELSE 3
                        END,
                        artist, album, disc_number, track_number
                    LIMIT ?
                """, (pattern, pattern, pattern, f"{query}%", f"{query}%", limit))
                
                for row in cursor.fetchall():
                    results.append(self._format_track_dict(row))
        except Exception as e:
            logger.error(f"Error searching local music: {e}")
        return results

    def search_albums(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Searches local albums."""
        query = query.strip()
        if not query:
            return []

        pattern = f"%{query}%"
        results = []
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT * FROM albums
                    WHERE title LIKE ? OR artist LIKE ?
                    ORDER BY 
                        CASE WHEN title LIKE ? THEN 1 ELSE 2 END,
                        title
                    LIMIT ?
                """, (pattern, pattern, f"{query}%", limit))
                for row in cursor.fetchall():
                    results.append(self._format_album_dict(row))
        except Exception as e:
            logger.error(f"Error searching local albums: {e}")
        return results

    def get_artists(self) -> List[Dict[str, Any]]:
        """Returns list of artists with album and track counts."""
        artists = []
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT COALESCE(NULLIF(album_artist, ''), artist) as artist_name, COUNT(DISTINCT album_id) as album_count, COUNT(*) as track_count
                    FROM tracks
                    WHERE (album_artist IS NOT NULL AND album_artist != '') OR (artist IS NOT NULL AND artist != '')
                    GROUP BY artist_name
                    ORDER BY artist_name COLLATE NOCASE ASC
                """)
                for row in cursor.fetchall():
                    artists.append({
                        "artist": row["artist_name"],
                        "albumCount": row["album_count"],
                        "trackCount": row["track_count"],
                        "source": "local"
                    })
        except Exception as e:
            logger.error(f"Error fetching local artists: {e}")
        return artists

    def get_albums(self, artist: Optional[str] = None, genre: Optional[str] = None) -> List[Dict[str, Any]]:
        """Returns list of albums, optionally filtered by artist or genre."""
        albums = []
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                if artist:
                    cursor.execute("""
                        SELECT * FROM albums
                        WHERE artist = ? OR id IN (SELECT DISTINCT album_id FROM tracks WHERE artist = ? OR album_artist = ?)
                        ORDER BY year DESC, title COLLATE NOCASE ASC
                    """, (artist, artist, artist))
                elif genre:
                    cursor.execute("""
                        SELECT * FROM albums
                        WHERE id IN (SELECT DISTINCT album_id FROM tracks WHERE genre = ? COLLATE NOCASE)
                        ORDER BY year DESC, title COLLATE NOCASE ASC
                    """, (genre,))
                else:
                    cursor.execute("""
                        SELECT * FROM albums
                        ORDER BY title COLLATE NOCASE ASC
                    """)
                for row in cursor.fetchall():
                    albums.append(self._format_album_dict(row))

                # If albums table is empty, synthesize from tracks table
                if not albums:
                    if artist:
                        cursor.execute("""
                            SELECT album_id as id, album as title, COALESCE(NULLIF(album_artist, ''), artist) as artist, MAX(year) as year, COUNT(*) as track_count, MAX(has_artwork) as has_artwork
                            FROM tracks
                            WHERE (artist = ? OR album_artist = ?) AND album IS NOT NULL AND album != ''
                            GROUP BY album_id, album, COALESCE(NULLIF(album_artist, ''), artist)
                            ORDER BY year DESC, title COLLATE NOCASE ASC
                        """, (artist, artist))
                    elif genre:
                        cursor.execute("""
                            SELECT album_id as id, album as title, COALESCE(NULLIF(album_artist, ''), artist) as artist, MAX(year) as year, COUNT(*) as track_count, MAX(has_artwork) as has_artwork
                            FROM tracks
                            WHERE genre = ? COLLATE NOCASE AND album IS NOT NULL AND album != ''
                            GROUP BY album_id, album, COALESCE(NULLIF(album_artist, ''), artist)
                            ORDER BY year DESC, title COLLATE NOCASE ASC
                        """, (genre,))
                    else:
                        cursor.execute("""
                            SELECT album_id as id, album as title, COALESCE(NULLIF(album_artist, ''), artist) as artist, MAX(year) as year, COUNT(*) as track_count, MAX(has_artwork) as has_artwork
                            FROM tracks
                            WHERE album IS NOT NULL AND album != ''
                            GROUP BY album_id, album, COALESCE(NULLIF(album_artist, ''), artist)
                            ORDER BY title COLLATE NOCASE ASC
                        """)
                    for row in cursor.fetchall():
                        albums.append(self._format_album_dict(row))
        except Exception as e:
            logger.error(f"Error fetching local albums: {e}")
        return albums

    def get_genres(self) -> List[Dict[str, Any]]:
        """Returns list of genres with album and track counts."""
        genres = []
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    SELECT genre, COUNT(DISTINCT album_id) as album_count, COUNT(*) as track_count
                    FROM tracks
                    WHERE genre IS NOT NULL AND TRIM(genre) != ''
                    GROUP BY genre
                    ORDER BY genre COLLATE NOCASE ASC
                """)
                for row in cursor.fetchall():
                    genres.append({
                        "genre": row["genre"].strip(),
                        "albumCount": row["album_count"],
                        "trackCount": row["track_count"],
                        "source": "local"
                    })
        except Exception as e:
            logger.error(f"Error fetching local genres: {e}")
        return genres

    def get_album_tracks(self, album_id: str) -> Dict[str, Any]:
        """Returns album info and its ordered tracks."""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM albums WHERE id = ?", (album_id,))
                alb_row = cursor.fetchone()

                cursor.execute("""
                    SELECT * FROM tracks
                    WHERE album_id = ?
                    ORDER BY disc_number ASC, track_number ASC, title ASC
                """, (album_id,))
                track_rows = cursor.fetchall()
                if not track_rows and not alb_row:
                    return {}

                tracks = [self._format_track_dict(row) for row in track_rows]

                if alb_row:
                    album_dict = self._format_album_dict(alb_row)
                else:
                    first_trk = tracks[0] if tracks else {}
                    album_dict = {
                        "browseId": f"local:{album_id}",
                        "id": album_id,
                        "title": first_trk.get("album", "Unknown Album"),
                        "artist": first_trk.get("artist", "Unknown Artist"),
                        "year": first_trk.get("year", ""),
                        "trackCount": len(tracks),
                        "thumbnail": first_trk.get("thumbnail", ""),
                        "source": "local",
                        "isPureAudio": True,
                    }

                album_dict["tracks"] = tracks
                return album_dict
        except Exception as e:
            logger.error(f"Error fetching album tracks for {album_id}: {e}")
            return {}

    def get_track(self, track_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single track by its ID."""
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT * FROM tracks WHERE id = ?", (track_id,))
                row = cursor.fetchone()
                if row:
                    return self._format_track_dict(row)
        except Exception as e:
            logger.error(f"Error fetching track {track_id}: {e}")
        return None

    def find_matching_track(self, title: str, artist: Optional[str] = None, duration: Optional[float] = None) -> Optional[Dict[str, Any]]:
        """Finds a local track matching a title and artist with duration tolerance."""
        if not title:
            return None

        # Clean title for comparison (e.g. remove "From ..." suffixes)
        clean_t = re.sub(r"\s*[\(\[].*?[\)\]]", "", title).strip()
        if not clean_t:
            clean_t = title.strip()

        pattern = f"%{clean_t}%"
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                if artist:
                    clean_a = artist.split(",")[0].split("&")[0].split("feat")[0].strip()
                    cursor.execute("""
                        SELECT * FROM tracks
                        WHERE title LIKE ? AND artist LIKE ?
                        LIMIT 5
                    """, (pattern, f"%{clean_a}%"))
                else:
                    cursor.execute("""
                        SELECT * FROM tracks
                        WHERE title LIKE ?
                        LIMIT 5
                    """, (pattern,))

                candidates = cursor.fetchall()
                if not candidates and artist:
                    # Retry without artist filter
                    cursor.execute("SELECT * FROM tracks WHERE title LIKE ? LIMIT 5", (pattern,))
                    candidates = cursor.fetchall()

                for row in candidates:
                    row_dur = float(row["duration"] or 0)
                    if duration and row_dur > 0:
                        if abs(row_dur - float(duration)) <= 15:
                            return self._format_track_dict(row)
                    else:
                        return self._format_track_dict(row)
        except Exception as e:
            logger.error(f"Error finding matching local track for '{title}': {e}")
        return None

    def get_artwork_path(self, album_id: str) -> Optional[str]:
        """Extracts and returns the cached JPEG/PNG artwork path for an album."""
        cached_art = os.path.join(self.artwork_cache_dir, f"{album_id}.jpg")
        if os.path.exists(cached_art):
            return cached_art

        # Find album folder and track
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("SELECT folder_path FROM albums WHERE id = ?", (album_id,))
                alb_row = cursor.fetchone()
                if not alb_row:
                    return None
                folder_path = alb_row["folder_path"]

                # 1. Check folder for artwork files
                for art_name in ARTWORK_NAMES:
                    art_file = os.path.join(folder_path, art_name)
                    if os.path.exists(art_file):
                        return art_file

                # 2. Extract embedded artwork from first track
                cursor.execute("SELECT file_path, file_format FROM tracks WHERE album_id = ? LIMIT 1", (album_id,))
                trk_row = cursor.fetchone()
                if trk_row:
                    track_file = trk_row["file_path"]
                    art_bytes = self._extract_embedded_artwork_bytes(track_file)
                    if art_bytes:
                        with open(cached_art, "wb") as f:
                            f.write(art_bytes)
                        return cached_art
        except Exception as e:
            logger.debug(f"Error retrieving artwork path for {album_id}: {e}")
        return None

    def _extract_embedded_artwork_bytes(self, file_path: str) -> Optional[bytes]:
        """Extracts embedded image bytes from audio file."""
        try:
            import mutagen
            from mutagen.mp4 import MP4
            from mutagen.flac import FLAC
            from mutagen.id3 import ID3, APIC

            audio = mutagen.File(file_path)
            if not audio or not audio.tags:
                return None

            # MP4 / ALAC
            if hasattr(audio.tags, "get"):
                covr = audio.tags.get("covr")
                if covr and len(covr) > 0:
                    return bytes(covr[0])

            # FLAC
            if hasattr(audio, "pictures") and audio.pictures:
                return audio.pictures[0].data

            # ID3 (MP3)
            for tag in audio.tags.values():
                if isinstance(tag, APIC):
                    return tag.data
        except Exception as e:
            logger.debug(f"Error extracting embedded artwork bytes from {file_path}: {e}")
        return None

    def _format_track_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        album_id = row["album_id"]
        thumbnail = f"/api/ytmusic/local/artwork/{album_id}" if row["has_artwork"] else ""
        row_keys = row.keys() if hasattr(row, "keys") else []
        album_artist = row["album_artist"] if "album_artist" in row_keys and row["album_artist"] else row["artist"]
        return {
            "videoId": f"local:{row['id']}",
            "id": row["id"],
            "title": row["title"],
            "artist": row["artist"],
            "albumArtist": album_artist,
            "album": row["album"],
            "albumId": album_id,
            "trackNumber": row["track_number"],
            "discNumber": row["disc_number"],
            "duration": int(row["duration"] or 0),
            "thumbnail": thumbnail,
            "year": row["year"],
            "genre": row["genre"],
            "fileFormat": row["file_format"],
            "filePath": row["file_path"],
            "source": "local",
            "isPureAudio": True,
        }

    def _format_album_dict(self, row: sqlite3.Row) -> Dict[str, Any]:
        album_id = row["id"]
        thumbnail = f"/api/ytmusic/local/artwork/{album_id}" if row["has_artwork"] else ""
        row_keys = row.keys() if hasattr(row, "keys") else []
        is_comp = bool(row["is_compilation"]) if "is_compilation" in row_keys else False
        return {
            "browseId": f"local:{album_id}",
            "id": album_id,
            "title": row["title"],
            "artist": row["artist"],
            "year": row["year"],
            "trackCount": row["track_count"],
            "thumbnail": thumbnail,
            "isCompilation": is_comp,
            "source": "local",
            "isPureAudio": True,
        }

local_music_service = LocalMusicService()
