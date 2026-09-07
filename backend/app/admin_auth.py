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
import threading
import time

from fastapi import HTTPException, Request, Response, status

from .config import get_settings


SESSION_COOKIE = "nivas_setup_session"
SESSION_TTL_SECONDS = 12 * 60 * 60
PIN_WINDOW_SECONDS = 5 * 60
PIN_MAX_FAILURES = 5

_attempts: dict[str, tuple[int, float]] = {}
_attempts_lock = threading.Lock()


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


def _client_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def verify_pin_attempt(request: Request, pin: str) -> bool:
    """Check an exact PIN with a small in-memory brute-force limit."""
    expected = get_settings().setup_pin
    if not expected:
        return True

    now = time.monotonic()
    client = _client_key(request)
    with _attempts_lock:
        failures, reset_at = _attempts.get(client, (0, now + PIN_WINDOW_SECONDS))
        if now >= reset_at:
            failures, reset_at = 0, now + PIN_WINDOW_SECONDS
        if failures >= PIN_MAX_FAILURES:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many PIN attempts. Try again in a few minutes.",
            )

        valid = hmac.compare_digest(expected, pin)
        if valid:
            _attempts.pop(client, None)
        else:
            _attempts[client] = (failures + 1, reset_at)
        return valid


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
