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


def test_gratitude_defaults_empty(client):
    res = client.get("/api/setup/gratitude")
    assert res.status_code == 200
    assert res.json() == {"notes": []}


def test_gratitude_put_cleans_and_persists(client):
    payload = {
        "notes": [
            {"text": "  Grandma's visit  ", "author": "Swara"},
            {"text": "   ", "author": "skip me"},
            {"text": "x" * 500, "author": ""},
        ]
    }
    res = client.put("/api/setup/gratitude", json=payload)
    assert res.status_code == 200
    notes = res.json()["notes"]
    assert notes[0] == {"text": "Grandma's visit", "author": "Swara"}
    assert len(notes) == 2
    assert len(notes[1]["text"]) == 120

    again = client.get("/api/setup/gratitude").json()["notes"]
    assert again == notes


def test_gratitude_caps_note_count(client):
    payload = {"notes": [{"text": f"note {i}"} for i in range(60)]}
    notes = client.put("/api/setup/gratitude", json=payload).json()["notes"]
    assert len(notes) == 40
