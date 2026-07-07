"""Apple Reminders via pyicloud's CloudKit-based RemindersService.

Uses pyicloud's typed Reminders API (CloudKit) for reliable list/reminder
fetching, creation, and completion. Every caller treats failures as "source
temporarily unavailable", never fatal.
"""

import logging
import threading
from typing import Any

from pyicloud import PyiCloudService

from ..config import get_settings

log = logging.getLogger(__name__)


class ICloudReminders:
    def __init__(self) -> None:
        self._api: PyiCloudService | None = None
        self._lock = threading.Lock()
        self._cached_list_names: list[str] = []

    # ---- auth -------------------------------------------------------------

    def connect(self, username: str = "", password: str = "") -> dict:
        """(Re)connect. Returns {connected, needs_2fa, error}."""
        s = get_settings()
        username = username or s.icloud_username
        password = password or s.icloud_password
        cookie_dir = s.data_dir / "icloud_session"
        cookie_dir.mkdir(exist_ok=True)
        # If no credentials at all, try to resume from a saved session cookie
        if not username:
            # Check if any session files exist to identify the username
            session_files = list(cookie_dir.glob("*.session"))
            if not session_files:
                return {"connected": False, "needs_2fa": False, "error": "no credentials configured"}
            # Extract username from session filename (e.g. "dkiranyahoocom.session")
            username = session_files[0].stem  # best-effort
        try:
            self._api = PyiCloudService(
                username, password or None, cookie_directory=str(cookie_dir)
            )
        except Exception as e:
            log.warning("iCloud login failed: %s", e)
            self._api = None
            return {"connected": False, "needs_2fa": False, "error": str(e)}
        return self.status()

    def status(self) -> dict:
        if self._api is None:
            return {"connected": False, "needs_2fa": False, "error": "not connected"}
        try:
            if self._api.requires_2fa:
                return {"connected": False, "needs_2fa": True, "error": ""}
        except Exception as e:
            return {"connected": False, "needs_2fa": False, "error": str(e)}
        return {"connected": True, "needs_2fa": False, "error": ""}

    def submit_2fa(self, code: str) -> dict:
        if self._api is None:
            return {"connected": False, "needs_2fa": False, "error": "not connected"}
        try:
            if not self._api.validate_2fa_code(code):
                return {"connected": False, "needs_2fa": True, "error": "invalid code"}
            if not self._api.is_trusted_session:
                self._api.trust_session()
        except Exception as e:
            return {"connected": False, "needs_2fa": True, "error": str(e)}
        return self.status()

    def _ensure(self) -> PyiCloudService:
        if self._api is None:
            result = self.connect()
            if not result["connected"]:
                raise RuntimeError(f"iCloud not connected: {result['error'] or '2FA required'}")
        return self._api  # type: ignore[return-value]

    # ---- public surface ---------------------------------------------------

    def list_names(self) -> list[str]:
        """Return list titles — uses cache if available, otherwise tries a non-blocking fetch."""
        if self._cached_list_names:
            return list(self._cached_list_names)
        # No cache yet — try a non-blocking fetch (don't wait behind the sync job)
        if not self._lock.acquire(blocking=False):
            return []  # sync job is running; frontend will retry via polling
        try:
            api = self._ensure()
            names = sorted(lst.title for lst in api.reminders.lists())
            self._cached_list_names = names
            return names
        except Exception as e:
            log.warning("Failed to fetch iCloud list names: %s", e)
            return []
        finally:
            self._lock.release()

    def get_lists(self) -> dict[str, list[dict[str, Any]]]:
        """{list_title: [{guid, title, due, notes, completed}]} — all reminders."""
        with self._lock:
            api = self._ensure()
            # Fetch all lists to build a map of ID -> Title
            try:
                collections = {lst.id: lst.title for lst in api.reminders.lists()}
            except Exception as e:
                log.warning("Failed to fetch iCloud lists: %s", e)
                return {}

            # Update the cached list names as a side effect
            self._cached_list_names = sorted(collections.values())

            out: dict[str, list[dict]] = {title: [] for title in collections.values()}

            # Fetch all reminders (pyicloud's .reminders() handles the batching/CloudKit calls)
            try:
                for r in api.reminders.reminders():
                    list_title = collections.get(r.list_id)
                    if list_title is None:
                        continue

                    out[list_title].append(
                        {
                            "guid": r.id,
                            "title": r.title,
                            "due": r.due_date.isoformat() if r.due_date else "",
                            "notes": r.desc or "",
                            "completed": r.completed,
                            "_raw": r,
                        }
                    )
            except Exception as e:
                log.warning("Failed to fetch iCloud reminders: %s", e)
                # Return what we have so far if partial failure

            return out

    def add(self, title: str, list_name: str) -> bool:
        with self._lock:
            api = self._ensure()
            try:
                # Find the list ID by name
                target_list = next((l for l in api.reminders.lists() if l.title == list_name), None)
                if not target_list:
                    log.warning("iCloud list not found for add: %s", list_name)
                    return False

                api.reminders.create(list_id=target_list.id, title=title)
                return True
            except Exception as e:
                log.warning("Failed to add iCloud reminder: %s", e)
                return False

    def set_completed(self, guid: str, completed: bool = True) -> bool:
        """Mark a reminder complete by updating its model."""
        with self._lock:
            api = self._ensure()
            try:
                # Note: guid here is the CloudKit record name/id
                reminder = api.reminders.get(guid)
                if not reminder:
                    return False

                reminder.completed = completed
                api.reminders.update(reminder)
                return True
            except Exception as e:
                log.warning("Failed to update iCloud reminder completion: %s", e)
                return False


icloud = ICloudReminders()
