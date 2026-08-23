import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.services.kids_daily_service import (
    FALLBACK_CATALOG,
    KIDS_DAILY_DISPLAY_LIMITS,
    KIDS_DAILY_SCHEMA,
    content_fits_display_limits,
    kids_daily_service,
)

@pytest.fixture
def client():
    return TestClient(app)

def test_kids_daily_time_window():
    # Weekday 7:00 AM -> Active
    weekday_morning = datetime(2026, 8, 14, 7, 0) # Friday
    assert kids_daily_service.is_active_morning_window(weekday_morning) is True

    # Weekday 8:30 AM -> Inactive
    weekday_late = datetime(2026, 8, 14, 8, 30)
    assert kids_daily_service.is_active_morning_window(weekday_late) is False

    # Weekend 10:00 AM -> Active
    weekend_morning = datetime(2026, 8, 15, 10, 0) # Saturday
    assert kids_daily_service.is_active_morning_window(weekend_morning) is True

    # Weekend 7:00 AM -> Inactive
    weekend_early = datetime(2026, 8, 15, 7, 0)
    assert kids_daily_service.is_active_morning_window(weekend_early) is False

def test_kids_daily_public_endpoint(client):
    res = client.get("/api/kids-daily/today")
    assert res.status_code == 200
    data = res.json()
    assert "word_of_the_day" in data
    assert "fun_fact" in data
    assert "stem_5yo" in data
    assert "stem_9yo" in data
    # The kiosk's Answers board is driven by the same daily payload.
    assert "answer" in data["stem_5yo"]
    assert "parent_explanation" in data["stem_5yo"]
    assert "answer" in data["stem_9yo"]
    assert "parent_explanation" in data["stem_9yo"]

def test_kids_daily_admin_endpoint(client):
    res = client.get("/api/kids-daily/admin")
    assert res.status_code == 200
    data = res.json()
    content = data.get("content", {})
    assert "answer" in content["stem_5yo"]
    assert "parent_explanation" in content["stem_5yo"]
    assert "answer" in content["stem_9yo"]
    assert "parent_explanation" in content["stem_9yo"]

def test_kids_daily_settings_toggle(client):
    # Set force_banner_active to True
    res = client.post("/api/kids-daily/settings", json={"force_banner_active": True})
    assert res.status_code == 200
    assert res.json().get("force_banner_active") is True

    # Now verify is_active_morning_window returns True regardless of time
    midnight = datetime(2026, 8, 14, 1, 0)
    assert kids_daily_service.is_active_morning_window(midnight) is True

    # Reset back to False
    res2 = client.post("/api/kids-daily/settings", json={"force_banner_active": False})
    assert res2.status_code == 200
    assert res2.json().get("force_banner_active") is False

def test_kids_daily_fallback_catalog_length_and_rotation(client):
    assert len(FALLBACK_CATALOG) >= 30

    # Ensure consecutive days produce different content
    p1 = kids_daily_service.get_today_payload("2026-08-01", force_regenerate=True)
    p2 = kids_daily_service.get_today_payload("2026-08-02", force_regenerate=True)
    p3 = kids_daily_service.get_today_payload("2026-08-03", force_regenerate=True)

    w1 = p1["content"]["word_of_the_day"]["word"]
    w2 = p2["content"]["word_of_the_day"]["word"]
    w3 = p3["content"]["word_of_the_day"]["word"]
    assert w1 != w2
    assert w2 != w3
    assert w1 != w3


def test_kids_daily_catalog_fits_wall_display_limits():
    assert all(content_fits_display_limits(content) for content in FALLBACK_CATALOG)


def test_kids_daily_schema_enforces_wall_display_limits():
    for section_name, fields in KIDS_DAILY_DISPLAY_LIMITS.items():
        schema_fields = KIDS_DAILY_SCHEMA["properties"][section_name]["properties"]
        for field_name, expected_limit in fields.items():
            assert schema_fields[field_name]["maxLength"] == expected_limit


def test_kids_daily_display_limits_reject_overlong_copy():
    content = {
        section_name: {field_name: "ok" for field_name in fields}
        for section_name, fields in KIDS_DAILY_DISPLAY_LIMITS.items()
    }
    content["stem_9yo"]["question"] = "x" * (
        KIDS_DAILY_DISPLAY_LIMITS["stem_9yo"]["question"] + 1
    )
    assert content_fits_display_limits(content) is False

def test_kids_daily_regenerate_endpoint(client):
    res = client.post("/api/kids-daily/regenerate")
    assert res.status_code == 200
    data = res.json()
    assert "content" in data
    assert "word_of_the_day" in data["content"]
    assert "fun_fact" in data["content"]
    assert "stem_5yo" in data["content"]
    assert "stem_9yo" in data["content"]
