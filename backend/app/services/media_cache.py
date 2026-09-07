"""Bounded on-disk cache for decoded AirPlay media and artwork."""

from __future__ import annotations

import hashlib
import os
import threading
import time
from pathlib import Path

from ..config import get_settings


class MediaCache:
    MAX_TRACKS = 25
    MAX_BYTES = 2 * 1024 * 1024 * 1024
    MAX_AGE_SECONDS = 24 * 60 * 60

    def __init__(self) -> None:
        self.root = Path(get_settings().data_dir) / "media_cache"
        self.root.mkdir(parents=True, exist_ok=True)
        self._pinned: set[Path] = set()
        self._lock = threading.RLock()

    def _key(self, source: str) -> str:
        return hashlib.sha256(source.encode("utf-8")).hexdigest()

    def wav_path(self, source: str) -> Path:
        return self.root / f"{self._key(source)}.wav"

    def artwork_path(self, source: str) -> Path:
        return self.root / f"{self._key(source)}.jpg"

    def pin(self, sources: list[str]) -> None:
        with self._lock:
            self._pinned = {path for source in sources for path in (self.wav_path(source), self.artwork_path(source))}

    def touch(self, path: Path) -> None:
        try:
            path.touch(exist_ok=True)
        except OSError:
            pass

    def cleanup(self) -> None:
        with self._lock:
            now = time.time()
            files = [p for p in self.root.iterdir() if p.is_file() and not p.name.endswith(".tmp")]
            for p in files:
                if p not in self._pinned and now - p.stat().st_atime > self.MAX_AGE_SECONDS:
                    p.unlink(missing_ok=True)
            files = [p for p in self.root.iterdir() if p.is_file() and not p.name.endswith(".tmp")]
            tracks = sorted({p.stem for p in files})
            total = sum(p.stat().st_size for p in files)
            for p in sorted(files, key=lambda item: item.stat().st_atime):
                if len(tracks) <= self.MAX_TRACKS and total <= self.MAX_BYTES:
                    break
                if p in self._pinned:
                    continue
                size = p.stat().st_size
                p.unlink(missing_ok=True)
                total -= size
                tracks = sorted({item.stem for item in self.root.iterdir() if item.is_file() and not item.name.endswith(".tmp")})


media_cache = MediaCache()
