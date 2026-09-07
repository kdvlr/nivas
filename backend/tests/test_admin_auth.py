from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from starlette.requests import Request
from starlette.responses import Response

from app import admin_auth


def _request(cookie: str | None = None) -> Request:
    headers = [] if cookie is None else [(b"cookie", cookie.encode("ascii"))]
    return Request(
        {
            "type": "http",
            "method": "POST",
            "scheme": "http",
            "path": "/api/setup/pin/verify",
            "headers": headers,
            "client": ("127.0.0.1", 12345),
            "server": ("testserver", 80),
        }
    )


def test_admin_session_requires_an_exact_pin_and_signed_cookie(monkeypatch):
    monkeypatch.setattr(admin_auth, "get_settings", lambda: SimpleNamespace(setup_pin="2468"))
    admin_auth._attempts.clear()
    request = _request()

    assert admin_auth.verify_pin_attempt(request, "2468") is True
    assert admin_auth.verify_pin_attempt(request, "x2468") is False

    response = Response()
    admin_auth.grant_admin_session(response, request)
    cookie = response.headers["set-cookie"].split(";", 1)[0]

    assert admin_auth.require_admin(_request(cookie)) is None
    with pytest.raises(HTTPException, match="Setup PIN required"):
        admin_auth.require_admin(_request())


def test_invalid_session_token_is_rejected(monkeypatch):
    monkeypatch.setattr(admin_auth, "get_settings", lambda: SimpleNamespace(setup_pin="2468"))

    with pytest.raises(HTTPException, match="Setup PIN required"):
        admin_auth.require_admin(_request("nivas_setup_session=not-a-valid-token"))
