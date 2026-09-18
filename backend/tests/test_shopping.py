from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db import get_db
from app.models import Base, ShoppingItem
from app.services import sync


@pytest.fixture
def client_and_db():
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
    client = TestClient(app)
    yield client, db, TestingSessionLocal
    app.dependency_overrides.clear()
    db.close()


def test_add_and_complete_shopping_item(client_and_db):
    client, db, _ = client_and_db
    # Add an item
    res = client.post("/api/shopping", json={"title": "Almond Milk"})
    assert res.status_code == 200
    data = res.json()
    assert data["title"] == "Almond Milk"
    assert not data["completed"]
    item_id = data["id"]

    # Mark as completed
    patch_res = client.patch(f"/api/shopping/{item_id}", json={"completed": True})
    assert patch_res.status_code == 200
    assert patch_res.json()["completed"] is True


def test_shopping_cleanup_older_than_3_days_on_get(client_and_db):
    client, db, _ = client_and_db
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Item 1: Active item (should stay)
    active = ShoppingItem(
        title="Apples",
        norm_title="apples",
        completed=False,
        sources=[{"source": "local", "external_id": "1"}],
        updated_at=now - timedelta(days=10),
    )

    # Item 2: Recently completed (1 day ago - should stay)
    recent_done = ShoppingItem(
        title="Bananas",
        norm_title="bananas",
        completed=True,
        sources=[{"source": "local", "external_id": "2"}],
        updated_at=now - timedelta(days=1),
    )

    # Item 3: Completed 4 days ago (older than 3 days - should be cleared)
    old_done = ShoppingItem(
        title="Carrots",
        norm_title="carrots",
        completed=True,
        sources=[{"source": "local", "external_id": "3"}],
        updated_at=now - timedelta(days=4),
    )

    db.add_all([active, recent_done, old_done])
    db.commit()

    # GET /api/shopping should trigger auto-cleanup of old_done
    res = client.get("/api/shopping")
    assert res.status_code == 200
    titles = [i["title"] for i in res.json()]

    assert "Apples" in titles
    assert "Bananas" in titles
    assert "Carrots" not in titles


def test_cleanup_old_completed_housekeeping(client_and_db, monkeypatch):
    client, db, TestingSessionLocal = client_and_db
    monkeypatch.setattr(sync, "SessionLocal", TestingSessionLocal)

    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Item completed 5 days ago
    old_item = ShoppingItem(
        title="Dates",
        norm_title="dates",
        completed=True,
        sources=[{"source": "local", "external_id": "4"}],
        updated_at=now - timedelta(days=5),
    )
    # Item completed 1 day ago
    recent_item = ShoppingItem(
        title="Eggs",
        norm_title="eggs",
        completed=True,
        sources=[{"source": "local", "external_id": "5"}],
        updated_at=now - timedelta(days=1),
    )

    db.add_all([old_item, recent_item])
    db.commit()

    sync.cleanup_old_completed()

    # Verify old_item is deleted and recent_item remains in db
    remaining = db.query(ShoppingItem).all()
    remaining_titles = [i.title for i in remaining]
    assert "Dates" not in remaining_titles
    assert "Eggs" in remaining_titles
