import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import get_db
from app.main import app
from app.models import Base


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(bind=engine, expire_on_commit=False)
    db = TestingSessionLocal()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    yield TestClient(app)
    app.dependency_overrides.clear()
    db.close()


def test_kiosk_schedule_get_default_and_update(client):
    # 1. Get default configuration
    res = client.get("/api/setup/config")
    assert res.status_code == 200
    data = res.json()
    assert data["kiosk_sleep_enabled"] is True
    assert data["kiosk_sleep_start"] == "22:00"
    assert data["kiosk_sleep_end"] == "06:00"
    assert data["kiosk_daytime_screen_off_mins"] == 15
    assert data["kiosk_suppress_night_motion"] is True

    # 2. Update kiosk schedule
    update_payload = {
        "kiosk_sleep_enabled": True,
        "kiosk_sleep_start": "23:00",
        "kiosk_sleep_end": "06:30",
        "kiosk_daytime_screen_off_mins": 10,
        "kiosk_suppress_night_motion": False,
    }
    post_res = client.post("/api/setup/kiosk-schedule", json=update_payload)
    assert post_res.status_code == 200
    assert post_res.json() == {"ok": True}

    # 3. Verify updated configuration persists
    get_res = client.get("/api/setup/config")
    assert get_res.status_code == 200
    new_data = get_res.json()
    assert new_data["kiosk_sleep_start"] == "23:00"
    assert new_data["kiosk_sleep_end"] == "06:30"
    assert new_data["kiosk_daytime_screen_off_mins"] == 10
    assert new_data["kiosk_suppress_night_motion"] is False

    # Restore default
    client.post("/api/setup/kiosk-schedule", json={
        "kiosk_sleep_enabled": True,
        "kiosk_sleep_start": "22:00",
        "kiosk_sleep_end": "06:00",
        "kiosk_daytime_screen_off_mins": 15,
        "kiosk_suppress_night_motion": True,
    })
