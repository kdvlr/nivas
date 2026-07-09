"""Alexa to-do & shopping lists via alexapy (unofficial).

Uses Amazon's internal namedLists endpoints through an authenticated alexapy
session:

  GET  /api/namedLists                    -> lists (SHOPPING_LIST / TO_DO)
  GET  /api/namedLists/{id}/items         -> items
  POST /api/namedLists/{id}/item          -> add item
  PUT  /api/namedLists/{id}/item/{itemId} -> update (complete) item

Amazon changes these without notice; every failure is reported as "source
unavailable" on the Setup screen rather than crashing the dashboard.
"""

import json
import logging
import re

from alexapy import AlexaLogin

# Monkey-patch AlexaLogin to work around Amazon displaying the registration form first
original_process_page = AlexaLogin._process_page

async def patched_process_page(self, html: str, site: str) -> str | None:
    if "ap_register_form" in html and "ap_login_form" in html:
        html = re.sub(r'<form\s+[^>]*id=["\']ap_register_form["\']', '<div id="ap_register_form"', html)
    return await original_process_page(self, html, site)

AlexaLogin._process_page = patched_process_page

from ..config import get_settings

log = logging.getLogger(__name__)


class AlexaLists:
    def __init__(self) -> None:
        self._login: AlexaLogin | None = None

    # ---- auth -------------------------------------------------------------

    async def connect(self, email: str | None = None, password: str | None = None, otp_secret: str | None = None) -> dict:
        s = get_settings()
        user = (email or s.amazon_email).strip('"\'')
        pw = (password or s.amazon_password).strip('"\'')
        otp = (otp_secret or s.amazon_otp_secret).strip('"\'') if (otp_secret or s.amazon_otp_secret) else ""

        if not user or not pw:
            return {"connected": False, "error": "no credentials configured"}
        session_dir = s.data_dir / "alexa_session"
        session_dir.mkdir(exist_ok=True)
        (session_dir / ".storage").mkdir(exist_ok=True)
        try:
            self._login = AlexaLogin(
                url=s.amazon_url,
                email=user,
                password=pw,
                outputpath=lambda name: str(session_dir / name),
                otp_secret=otp,
            )
            await self._login.login()
            if not self._login.status.get("login_successful"):
                err = "login not successful (2FA/captcha challenge?)"
                if self._login.status.get("captcha_required"):
                    err = "captcha required — set AMAZON_OTP_SECRET or log in from the same network"
                return {"connected": False, "error": err}
        except Exception as e:
            log.warning("Alexa login failed: %s", e)
            self._login = None
            return {"connected": False, "error": str(e)}
        return {"connected": True, "error": ""}

    async def status(self) -> dict:
        if self._login is None:
            return {"connected": False, "error": "not connected"}
        return {"connected": bool(self._login.status.get("login_successful")), "error": ""}

    async def _ensure(self) -> AlexaLogin:
        if self._login is None or not self._login.status.get("login_successful"):
            result = await self.connect()
            if not result["connected"]:
                raise RuntimeError(f"Alexa not connected: {result['error']}")
        return self._login  # type: ignore[return-value]

    # ---- HTTP helpers (single choke point for the private API) -------------

    async def _request(self, method: str, path: str, data: dict | None = None) -> dict | list:
        login = await self._ensure()
        url = f"https://www.{login.url}{path}"
        headers = {"csrf": login.session.cookie_jar.filter_cookies(url).get("csrf").value
                   if login.session.cookie_jar.filter_cookies(url).get("csrf") else "",
                   "Content-Type": "application/json"}
        resp = await login.session.request(
            method, url, data=json.dumps(data) if data is not None else None, headers=headers
        )
        resp.raise_for_status()
        text = await resp.text()
        return json.loads(text) if text else {}

    # ---- public surface ---------------------------------------------------

    async def get_lists(self) -> dict[str, dict]:
        """{'shopping': {'id':..., 'items':[...]}, 'todo': {...}} — active/completed items."""
        data = await self._request("post", "/alexashoppinglists/api/v2/lists/fetch", {})
        result: dict[str, dict] = {}
        for lst in data.get("listInfoList", []) if isinstance(data, dict) else []:
            kind = {"SHOPPING_LIST": "shopping", "TODO": "todo"}.get(lst.get("listType", ""))
            if kind is None or lst.get("listStatus") != "ACTIVE":
                continue
            items_data = await self._request(
                "post", f"/alexashoppinglists/api/v2/lists/{lst['listId']}/items/fetch?limit=100", {}
            )
            items = [
                {
                    "id": it["itemId"],
                    "title": it.get("itemName", ""),
                    "completed": it.get("itemStatus") == "COMPLETE",
                }
                for it in (items_data.get("itemInfoList", []) if isinstance(items_data, dict) else [])
            ]
            result[kind] = {"id": lst["listId"], "items": items}
        return result

    async def add(self, kind: str, title: str) -> bool:
        lists = await self.get_lists()
        lst = lists.get(kind)
        if lst is None:
            return False
        await self._request(
            "post",
            f"/alexashoppinglists/api/v2/lists/{lst['id']}/items",
            {
                "items": [
                    {
                        "itemType": "KEYWORD",
                        "itemName": title,
                    }
                ]
            }
        )
        return True

    async def set_completed(self, list_id: str, item_id: str, completed: bool = True) -> bool:
        items_data = await self._request(
            "post", f"/alexashoppinglists/api/v2/lists/{list_id}/items/fetch?limit=100", {}
        )
        raw = next(
            (it for it in (items_data.get("itemInfoList", []) if isinstance(items_data, dict) else [])
             if it["itemId"] == item_id),
            None,
        )
        if raw is None:
            return False
        version = raw.get("version", 1)
        await self._request(
            "put",
            f"/alexashoppinglists/api/v2/lists/{list_id}/items/{item_id}?version={version}",
            {
                "itemAttributesToUpdate": [
                    {
                        "type": "itemStatus",
                        "value": "COMPLETE" if completed else "ACTIVE",
                    }
                ],
                "itemAttributesToRemove": [],
            }
        )
        return True


alexa = AlexaLists()
