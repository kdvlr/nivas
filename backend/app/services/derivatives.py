"""Web-friendly derivatives for video files.

Family libraries synced from iCloud are full of 20-90MB clips, many of them
HEVC in a QuickTime container. Those are fine to keep as originals but hostile
to a kiosk browser: huge to stream and not reliably hardware-decodable on
Android. For each video we cache two derivatives beside the library:

  poster   - a single JPEG frame, so a "video still" costs a few KB and needs
             no media pipeline at all
  playback - 1080p-capped H.264/AAC with +faststart, a few MB, decodable
             everywhere and quick to start

Originals are never modified. Derivatives are keyed on path + mtime + size, so
the work is incremental: each file is converted once and re-converted only if
it changes on disk.
"""

import hashlib
import logging
import os
import shutil
import subprocess
import threading
from dataclasses import dataclass, field
from pathlib import Path

from ..config import get_settings

log = logging.getLogger(__name__)

POSTERS_DIR = Path(get_settings().data_dir) / "posters"
PLAYBACK_DIR = Path(get_settings().data_dir) / "playback"
POSTERS_DIR.mkdir(parents=True, exist_ok=True)
PLAYBACK_DIR.mkdir(parents=True, exist_ok=True)

# Cap on the long edge: the kiosk is 1920x1080, so anything larger is wasted.
MAX_W = 1920
MAX_H = 1080


@dataclass
class BackfillState:
    running: bool = False
    total: int = 0
    done: int = 0
    failed: int = 0
    current: str | None = None
    ffmpeg: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)

    def snapshot(self) -> dict:
        with self.lock:
            return {
                "running": self.running,
                "total": self.total,
                "done": self.done,
                "failed": self.failed,
                "current": self.current,
                "ffmpeg_available": self.ffmpeg,
            }


STATE = BackfillState()
_worker: threading.Thread | None = None
_worker_lock = threading.Lock()


def ffmpeg_path() -> str | None:
    """Locate ffmpeg: an explicit override, PATH, or a pip-provided binary."""
    override = os.environ.get("FFMPEG_BINARY")
    if override and Path(override).is_file():
        return override
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:  # optional dependency, handy for local dev without a system ffmpeg
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


def _key(src: Path, kind: str) -> str:
    # resolve() so the background walker (which sees paths relative to the
    # configured photos dir) and the request handlers (which resolve to an
    # absolute path) agree on the same cache entry.
    st = src.stat()
    raw = f"{src.resolve().as_posix()}_{st.st_mtime}_{st.st_size}_{kind}_{MAX_W}x{MAX_H}"
    return hashlib.md5(raw.encode()).hexdigest()


def poster_path(src: Path) -> Path:
    return POSTERS_DIR / f"{_key(src, 'poster')}.jpg"


def playback_path(src: Path) -> Path:
    return PLAYBACK_DIR / f"{_key(src, 'playback')}.mp4"


def _run(cmd: list[str], timeout: int) -> bool:
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=timeout,
            check=False,
        )
        if proc.returncode != 0:
            log.warning("ffmpeg failed (%s): %s", proc.returncode, proc.stderr[-400:].decode(errors="replace"))
            return False
        return True
    except subprocess.TimeoutExpired:
        log.warning("ffmpeg timed out: %s", cmd[-1])
        return False
    except Exception as e:
        log.warning("ffmpeg error: %s", e)
        return False


def make_poster(src: Path) -> Path | None:
    """Extract a single representative frame as JPEG."""
    ff = ffmpeg_path()
    if ff is None:
        return None
    out = poster_path(src)
    if out.exists():
        return out
    tmp = out.with_suffix(".tmp.jpg")
    ok = _run(
        [
            ff, "-y", "-loglevel", "error",
            # a little way in, so we skip black opening frames
            "-ss", "0.5", "-i", str(src),
            "-frames:v", "1",
            "-vf", f"scale='min({MAX_W},iw)':'min({MAX_H},ih)':force_original_aspect_ratio=decrease",
            "-q:v", "4",
            str(tmp),
        ],
        timeout=60,
    )
    if not ok or not tmp.exists():
        # Very short clips may have nothing at 0.5s — retry from the first frame.
        ok = _run(
            [
                ff, "-y", "-loglevel", "error", "-i", str(src),
                "-frames:v", "1",
                "-vf", f"scale='min({MAX_W},iw)':'min({MAX_H},ih)':force_original_aspect_ratio=decrease",
                "-q:v", "4",
                str(tmp),
            ],
            timeout=60,
        )
    if ok and tmp.exists():
        tmp.replace(out)
        return out
    tmp.unlink(missing_ok=True)
    return None


def make_playback(src: Path) -> Path | None:
    """Transcode to 1080p-capped H.264/AAC, streamable from the first byte."""
    ff = ffmpeg_path()
    if ff is None:
        return None
    out = playback_path(src)
    if out.exists():
        return out
    tmp = out.with_suffix(".tmp.mp4")
    ok = _run(
        [
            ff, "-y", "-loglevel", "error",
            "-i", str(src),
            "-vf", f"scale='min({MAX_W},iw)':'min({MAX_H},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23",
            "-maxrate", "3M", "-bufsize", "6M",
            "-pix_fmt", "yuv420p",
            "-profile:v", "high", "-level", "4.0",
            # audio may be absent; -c:a is ignored gracefully when there's no track
            "-c:a", "aac", "-b:a", "128k", "-ac", "2",
            "-movflags", "+faststart",
            str(tmp),
        ],
        timeout=45 * 60,
    )
    if ok and tmp.exists() and tmp.stat().st_size > 0:
        tmp.replace(out)
        return out
    tmp.unlink(missing_ok=True)
    return None


def ensure(src: Path) -> None:
    """Build both derivatives for one video if they are missing."""
    make_poster(src)
    make_playback(src)


def _iter_videos(photos_dir: Path, exts: set[str]):
    for p in sorted(photos_dir.rglob("*")):
        if p.is_file() and p.suffix.lower() in exts:
            yield p


def _backfill(photos_dir: Path, exts: set[str]) -> None:
    ff = ffmpeg_path()
    with STATE.lock:
        STATE.ffmpeg = ff is not None
    if ff is None:
        log.warning("ffmpeg not found — serving original videos; set FFMPEG_BINARY or install ffmpeg")
        with STATE.lock:
            STATE.running = False
        return

    try:
        videos = list(_iter_videos(photos_dir, exts))
        valid_poster_keys = {_key(src, "poster") for src in videos}
        valid_playback_keys = {_key(src, "playback") for src in videos}

        # Cleanup orphaned posters and playback files from deleted/replaced videos
        for p in POSTERS_DIR.glob("*.jpg"):
            if p.stem not in valid_poster_keys:
                p.unlink(missing_ok=True)
        for p in PLAYBACK_DIR.glob("*.mp4"):
            if p.stem not in valid_playback_keys:
                p.unlink(missing_ok=True)

        with STATE.lock:
            STATE.total = len(videos)
            STATE.done = 0
            STATE.failed = 0
        log.info("derivative backfill: %d videos", len(videos))
        for src in videos:
            with STATE.lock:
                STATE.current = src.name
            try:
                pos = make_poster(src)
                play = make_playback(src)
                with STATE.lock:
                    if pos is None and play is None:
                        STATE.failed += 1
                    STATE.done += 1
            except Exception as e:
                log.warning("derivative failed for %s: %s", src, e)
                with STATE.lock:
                    STATE.failed += 1
                    STATE.done += 1
    finally:
        with STATE.lock:
            STATE.running = False
            STATE.current = None
        log.info("derivative backfill finished: %s", STATE.snapshot())


def start_backfill(photos_dir: Path, exts: set[str]) -> bool:
    """Kick off a one-at-a-time background pass. Safe to call repeatedly."""
    global _worker
    with _worker_lock:
        if _worker is not None and _worker.is_alive():
            return False
        with STATE.lock:
            STATE.running = True
        _worker = threading.Thread(
            target=_backfill, args=(photos_dir, exts), name="derivatives", daemon=True
        )
        _worker.start()
        return True
