"""In-memory health of each integration, shown on the Setup screen."""

from datetime import datetime, timezone
from typing import Any

_status: dict[str, dict[str, Any]] = {}


def report(integration: str, ok: bool, detail: str = "") -> None:
    _status[integration] = {
        "ok": ok,
        "detail": detail,
        "at": datetime.now(timezone.utc).isoformat(),
    }


def snapshot() -> dict[str, dict[str, Any]]:
    return dict(_status)
