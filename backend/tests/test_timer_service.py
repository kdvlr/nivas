import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.timer_service import timer_service


@pytest.fixture
def client():
    # Clear any active timer before each test
    timer_service.cancel_timer()
    with TestClient(app) as c:
        yield c
    timer_service.cancel_timer()


def test_timer_service_lifecycle():
    # Start 30 min timer
    t = timer_service.start_timer(1800, label="School Morning Timer", source="school_schedule")
    assert t["status"] == "running"
    assert t["totalSeconds"] == 1800
    assert t["label"] == "School Morning Timer"
    assert t["source"] == "school_schedule"
    assert t["stage"] == "green"

    # Get state
    state = timer_service.get_state()
    assert state is not None
    assert state["status"] == "running"

    # Pause
    paused = timer_service.pause_timer()
    assert paused["status"] == "paused"

    # Resume
    resumed = timer_service.resume_timer()
    assert resumed["status"] == "running"

    # Cancel
    timer_service.cancel_timer()
    assert timer_service.get_state() is None


def test_timer_api_endpoints(client):
    # Initial state should be inactive
    res = client.get("/api/timer/state")
    assert res.status_code == 200
    assert res.json()["active"] is False

    # Start timer via API
    res = client.post("/api/timer/start", json={"total_seconds": 300, "label": "Quick 5m"})
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["timer"]["totalSeconds"] == 300
    assert body["timer"]["label"] == "Quick 5m"

    # Verify active state
    res = client.get("/api/timer/state")
    assert res.status_code == 200
    assert res.json()["active"] is True
    assert res.json()["timer"]["label"] == "Quick 5m"

    # Pause via API
    res = client.post("/api/timer/pause")
    assert res.status_code == 200
    assert res.json()["timer"]["status"] == "paused"

    # Resume via API
    res = client.post("/api/timer/resume")
    assert res.status_code == 200
    assert res.json()["timer"]["status"] == "running"

    # Cancel via API
    res = client.post("/api/timer/cancel")
    assert res.status_code == 200
    assert res.json()["ok"] is True

    # State now inactive
    res = client.get("/api/timer/state")
    assert res.status_code == 200
    assert res.json()["active"] is False


def test_timer_ringing_auto_dismiss():
    import time

    # Start 1 second timer
    timer_service.start_timer(1, label="Short Timer")
    # Simulate completion
    now_ms = int(time.time() * 1000)
    timer_service._state["endTimestamp"] = now_ms - 1000

    # Getting state should mark it as ringing (within 15m)
    state = timer_service.get_state()
    assert state is not None
    assert state["status"] == "ringing"
    assert state["remainingSeconds"] == 0

    # Simulate 16 minutes having elapsed
    timer_service._state["endTimestamp"] = now_ms - (16 * 60 * 1000)
    state_expired = timer_service.get_state()
    assert state_expired is None

