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

    def audio_path(self, source: str) -> Path:
        key = self._key(source)
        m4a = self.root / f"{key}.m4a"
        if m4a.exists() and m4a.stat().st_size > 44:
            return m4a
        wav = self.root / f"{key}.wav"
        if wav.exists() and wav.stat().st_size > 44:
            return wav
        return m4a

    def wav_path(self, source: str) -> Path:
        return self.audio_path(source)

    def artwork_path(self, source: str) -> Path:
        return self.root / f"{self._key(source)}.jpg"

    def pin(self, sources: list[str]) -> None:
        with self._lock:
            pinned = set()
            for source in sources:
                key = self._key(source)
                pinned.add(self.root / f"{key}.m4a")
                pinned.add(self.root / f"{key}.wav")
                pinned.add(self.artwork_path(source))
            self._pinned = pinned

    def touch(self, path: Path) -> None:
        try:
            path.touch(exist_ok=True)
        except OSError:
            pass

    def cleanup(self) -> None:
        with self._lock:
            now = time.time()
            entries = []
            for path in self.root.iterdir():
                if not path.is_file() or path.name.endswith(".tmp"):
                    continue
                try:
                    stat = path.stat()
                except OSError:
                    continue
                if path not in self._pinned and now - stat.st_mtime > self.MAX_AGE_SECONDS:
                    path.unlink(missing_ok=True)
                    continue
                entries.append((path, stat.st_size, stat.st_mtime, path.stem))

            grouped: dict[str, list[tuple[Path, int, float, str]]] = {}
            for entry in entries:
                grouped.setdefault(entry[3], []).append(entry)
            total = sum(entry[1] for entry in entries)
            for stem, group in sorted(
                grouped.items(), key=lambda item: min(entry[2] for entry in item[1])
            ):
                if len(grouped) <= self.MAX_TRACKS and total <= self.MAX_BYTES:
                    break
                if any(entry[0] in self._pinned for entry in group):
                    continue
                for path, size, _, _ in group:
                    path.unlink(missing_ok=True)
                    total -= size
                grouped.pop(stem, None)


media_cache = MediaCache()
