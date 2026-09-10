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


def test_admin_session_accepts_pin_sequence_and_signed_cookie(monkeypatch):
    monkeypatch.setattr(admin_auth, "get_settings", lambda: SimpleNamespace(setup_pin="2468"))
    request = _request()

    assert admin_auth.verify_pin_attempt(request, "2468") is True
    assert admin_auth.verify_pin_attempt(request, "x2468y") is True
    assert admin_auth.verify_pin_attempt(request, "2648") is False

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


def test_calendar_endpoints_admin_requirements():
    from app.routers import calendar

    route_admin_map = {}
    for route in calendar.router.routes:
        deps = [d.call for d in route.dependant.dependencies]
        for method in route.methods:
            route_admin_map[(method, route.path)] = admin_auth.require_admin in deps

    # Daily calendar events should NOT require admin PIN
    assert route_admin_map[("GET", "/api/calendar/events")] is False
    assert route_admin_map[("POST", "/api/calendar/events")] is False
    assert route_admin_map[("PATCH", "/api/calendar/events/{event_id}")] is False
    assert route_admin_map[("DELETE", "/api/calendar/events/{event_id}")] is False

    # Administrative and account setup calendar routes DO require admin PIN
    assert route_admin_map[("GET", "/api/calendar/auth/start")] is True
    assert route_admin_map[("GET", "/api/calendar/auth/callback")] is True
    assert route_admin_map[("DELETE", "/api/calendar/accounts/{account_id}")] is True
    assert route_admin_map[("PUT", "/api/calendar/selections")] is True
    assert route_admin_map[("POST", "/api/calendar/sync")] is True

