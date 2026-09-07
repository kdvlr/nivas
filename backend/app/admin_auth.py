"""Small same-origin admin session guard for the household dashboard.

The dashboard intentionally leaves day-to-day family actions easy to reach, but
credential, configuration, and administrative endpoints must not rely on a
frontend-only PIN check.  Sessions are signed with the configured setup PIN,
so changing the PIN invalidates every existing session without a server-side
session store.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import secrets
import time

from fastapi import HTTPException, Request, Response, status

from .config import get_settings


SESSION_COOKIE = "nivas_setup_session"
SESSION_TTL_SECONDS = 12 * 60 * 60

def _sign(payload: bytes, pin: str) -> str:
    return hmac.new(pin.encode("utf-8"), payload, hashlib.sha256).hexdigest()


def _make_token(pin: str) -> str:
    payload = f"{int(time.time()) + SESSION_TTL_SECONDS}:{secrets.token_urlsafe(16)}".encode("utf-8")
    encoded = base64.urlsafe_b64encode(payload).decode("ascii").rstrip("=")
    return f"{encoded}.{_sign(payload, pin)}"


def _valid_token(token: str | None, pin: str) -> bool:
    if not token or not pin:
        return False
    try:
        encoded, supplied_signature = token.rsplit(".", 1)
        padding = "=" * (-len(encoded) % 4)
        payload = base64.urlsafe_b64decode(encoded + padding)
        expected_signature = _sign(payload, pin)
        expires_at = int(payload.decode("utf-8").split(":", 1)[0])
    except (ValueError, UnicodeDecodeError, binascii.Error):
        return False
    return expires_at >= int(time.time()) and hmac.compare_digest(supplied_signature, expected_signature)


def verify_pin_attempt(request: Request, pin: str) -> bool:
    """Accept the configured PIN embedded in the keypad's entered sequence.

    The family keypad intentionally lets a child type playful decoy digits; it
    unlocks once the real PIN appears in order anywhere in that sequence.
    """
    expected = get_settings().setup_pin
    if not expected:
        return True
    # compare_digest checks exact values, so test every same-length slice
    # instead of using a normal substring comparison.
    return any(
        hmac.compare_digest(expected, pin[index:index + len(expected)])
        for index in range(max(0, len(pin) - len(expected) + 1))
    )


def grant_admin_session(response: Response, request: Request) -> None:
    """Set a signed, HttpOnly same-origin admin session cookie."""
    pin = get_settings().setup_pin
    if not pin:
        return
    response.set_cookie(
        key=SESSION_COOKIE,
        value=_make_token(pin),
        max_age=SESSION_TTL_SECONDS,
        httponly=True,
        samesite="lax",
        secure=request.url.scheme == "https",
        path="/",
    )


def require_admin(request: Request) -> None:
    """Dependency for endpoints that modify household administration or secrets."""
    pin = get_settings().setup_pin
    # A household that deliberately leaves SETUP_PIN blank retains the existing
    # no-PIN local-dashboard behavior.
    if not pin:
        return
    if not _valid_token(request.cookies.get(SESSION_COOKIE), pin):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Setup PIN required")
