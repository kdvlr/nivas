import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.main import app
from app.services.kids_daily_service import kids_daily_service

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
    # Ensure answer is not leaked in public endpoint
    assert "answer" not in data["stem_5yo"]
    assert "answer" not in data["stem_9yo"]

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
