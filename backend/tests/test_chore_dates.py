import pytest
from datetime import date, datetime, timezone
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_db
from app.models import Base, Chore
from app.utils import next_due_date


def test_next_due_date_daily():
    today = date(2026, 9, 17)  # Thursday
    assert next_due_date(today, "daily") == today
    assert next_due_date(today, "daily", ref_date=date(2026, 8, 1)) == today


def test_next_due_date_weekly():
    today = date(2026, 9, 17)  # Thursday (weekday 3)
    # Weekly on Thursday (3) -> returns today
    assert next_due_date(today, "weekly:3") == today
    # Weekly on Friday (4) -> returns tomorrow (2026-09-18)
    assert next_due_date(today, "weekly:4") == date(2026, 9, 18)
    # Weekly on Saturday (5) -> returns Saturday (2026-09-19)
    assert next_due_date(today, "weekly:5") == date(2026, 9, 19)
    # Weekly on Monday, Wednesday, Friday (0,2,4) -> returns Friday (2026-09-18)
    assert next_due_date(today, "weekly:0,2,4") == date(2026, 9, 18)
    # Weekly on Sunday (6) -> returns Sunday (2026-09-20)
    assert next_due_date(today, "weekly:6") == date(2026, 9, 20)


def test_next_due_date_monthly():
    today = date(2026, 9, 17)
    # Monthly on 15th -> already passed in Sept, so Oct 15th
    assert next_due_date(today, "monthly:day", ref_date=date(2026, 8, 15)) == date(2026, 10, 15)
    # Monthly on 20th -> still upcoming in Sept, so Sept 20th
    assert next_due_date(today, "monthly:day", ref_date=date(2026, 8, 20)) == date(2026, 9, 20)


def test_next_due_date_one_off():
    today = date(2026, 9, 17)
    # Past one-off chore returns today
    assert next_due_date(today, "", ref_date=date(2026, 8, 15)) == today
    # Future one-off chore preserves future date
    assert next_due_date(today, "", ref_date=date(2026, 9, 25)) == date(2026, 9, 25)


from sqlalchemy.pool import StaticPool

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
    yield client, db
    app.dependency_overrides.clear()
    db.close()


def test_reset_chore_dates_endpoint(client_and_db):
    client, db = client_and_db

    # Create chores with past due dates (Aug 2026)
    c1 = Chore(
        title="Weekend Cleanup",
        assigned_to="Dhruv",
        due_date="2026-08-15",
        recurrence="weekly:5",  # Saturday
        completed=True,
    )
    c2 = Chore(
        title="Daily Chore Check",
        assigned_to="Swara",
        due_date="2026-08-15",
        recurrence="daily",
        completed=False,
    )
    c3 = Chore(
        title="Dishes one-off",
        assigned_to="Swara",
        due_date="2026-08-15",
        recurrence="",
        completed=False,
    )
    db.add_all([c1, c2, c3])
    db.commit()

    resp = client.post("/api/chores/reset-dates", json={"reset_completed": True, "include_one_off": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["updated_count"] == 3

    # Check updated chores
    db.refresh(c1)
    db.refresh(c2)
    db.refresh(c3)

    today = date.today()
    # Daily chore due date is today
    assert c2.due_date == today.isoformat()
    # One off past chore due date is today
    assert c3.due_date == today.isoformat()
    # Weekly Saturday chore is >= today and on Saturday
    d1 = date.fromisoformat(c1.due_date)
    assert d1 >= today
    assert d1.weekday() == 5
    # Completed status for recurring chore was reset
    assert c1.completed is False
