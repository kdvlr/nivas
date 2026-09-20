import json
import logging
import math
import time
from pathlib import Path
from typing import Any, Dict, Optional

from ..config import get_settings
from ..ws import manager

log = logging.getLogger(__name__)


def _get_stage(remaining_seconds: int) -> str:
    if remaining_seconds > 900:  # > 15m
        return "green"
    if remaining_seconds > 600:  # > 10m
        return "greenish-yellow"
    if remaining_seconds > 300:  # > 5m
        return "yellow"
    if remaining_seconds > 60:   # > 1m
        return "red"
    return "flashing-red"


class TimerService:
    def __init__(self) -> None:
        self._state: Optional[Dict[str, Any]] = None
        self._load_persisted()

    def _state_file(self) -> Path:
        return get_settings().data_dir / "active_timer.json"

    def _load_persisted(self) -> None:
        try:
            path = self._state_file()
            if path.exists():
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                now_ms = int(time.time() * 1000)
                end_ms = data.get("endTimestamp", 0)
                status = data.get("status")

                if status == "running":
                    if end_ms > now_ms:
                        self._state = data
                    elif now_ms - end_ms < 15 * 60 * 1000:  # ended < 15 mins ago
                        data["status"] = "ringing"
                        data["remainingSeconds"] = 0
                        data["stage"] = "flashing-red"
                        self._state = data
                    else:
                        self._clear_persisted()
                elif status == "ringing":
                    if now_ms - end_ms < 15 * 60 * 1000:
                        self._state = data
                    else:
                        self._clear_persisted()
                elif status == "paused":
                    self._state = data
        except Exception as e:
            log.warning("Could not load persisted timer: %s", e)

    def _persist(self) -> None:
        try:
            path = self._state_file()
            path.parent.mkdir(parents=True, exist_ok=True)
            if self._state:
                with open(path, "w", encoding="utf-8") as f:
                    json.dump(self._state, f)
            else:
                self._clear_persisted()
        except Exception as e:
            log.warning("Could not persist timer state: %s", e)

    def _clear_persisted(self) -> None:
        try:
            path = self._state_file()
            if path.exists():
                path.unlink(missing_ok=True)
        except Exception as e:
            log.warning("Could not remove persisted timer: %s", e)

    def _broadcast(self) -> None:
        state = self.get_state()
        manager.broadcast_json({"type": "timer_sync", "timer": state})

    def get_state(self) -> Optional[Dict[str, Any]]:
        if not self._state:
            return None

        now_ms = int(time.time() * 1000)
        status = self._state.get("status")

        if status == "running":
            end_ms = self._state.get("endTimestamp", 0)
            remaining = max(0, math.ceil((end_ms - now_ms) / 1000))
            if remaining <= 0:
                self._state["status"] = "ringing"
                self._state["remainingSeconds"] = 0
                self._state["stage"] = "flashing-red"
                self._persist()
            else:
                self._state["remainingSeconds"] = remaining
                self._state["stage"] = _get_stage(remaining)

        if self._state.get("status") == "ringing":
            end_ms = self._state.get("endTimestamp", 0)
            if now_ms - end_ms >= 15 * 60 * 1000:
                self._state = None
                self._clear_persisted()
                return None

        return dict(self._state)

    def start_timer(
        self,
        total_seconds: int,
        label: str = "School Morning Timer",
        source: str = "school_schedule",
    ) -> Dict[str, Any]:
        safe_total = max(1, int(total_seconds))
        now_ms = int(time.time() * 1000)
        end_ms = now_ms + safe_total * 1000

        self._state = {
            "id": f"timer_{now_ms}",
            "label": label,
            "totalSeconds": safe_total,
            "remainingSeconds": safe_total,
            "status": "running",
            "startTimestamp": now_ms,
            "endTimestamp": end_ms,
            "stage": _get_stage(safe_total),
            "source": source,
        }
        self._persist()
        log.info("Started timer: %s (%ss)", label, safe_total)
        self._broadcast()
        return dict(self._state)

    def pause_timer(self) -> Optional[Dict[str, Any]]:
        if not self._state or self._state.get("status") != "running":
            return self.get_state()

        now_ms = int(time.time() * 1000)
        end_ms = self._state.get("endTimestamp", 0)
        remaining = max(0, math.ceil((end_ms - now_ms) / 1000))

        self._state["status"] = "paused"
        self._state["remainingSeconds"] = remaining
        self._state["stage"] = _get_stage(remaining)
        self._persist()
        log.info("Paused timer: %s", self._state.get("label"))
        self._broadcast()
        return dict(self._state)

    def resume_timer(self) -> Optional[Dict[str, Any]]:
        if not self._state or self._state.get("status") != "paused":
            return self.get_state()

        remaining = self._state.get("remainingSeconds", 0)
        now_ms = int(time.time() * 1000)
        end_ms = now_ms + remaining * 1000

        self._state["status"] = "running"
        self._state["endTimestamp"] = end_ms
        self._state["stage"] = _get_stage(remaining)
        self._persist()
        log.info("Resumed timer: %s (%ss remaining)", self._state.get("label"), remaining)
        self._broadcast()
        return dict(self._state)

    def cancel_timer(self) -> Dict[str, Any]:
        label = self._state.get("label") if self._state else "Timer"
        self._state = None
        self._clear_persisted()
        log.info("Canceled timer: %s", label)
        self._broadcast()
        return {"ok": True}

    def dismiss_alarm(self) -> Dict[str, Any]:
        self._state = None
        self._clear_persisted()
        log.info("Dismissed timer alarm")
        self._broadcast()
        return {"ok": True}


timer_service = TimerService()
