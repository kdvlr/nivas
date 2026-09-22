import pytest
from datetime import datetime, timezone
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, Chore, CoinTransaction


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


def test_chore_completion_earns_coins_and_reversal_deducts_them(db):
    # 1. Setup: Create a chore assigned to Kiran
    chore = Chore(
        title="Sweep the kitchen",
        assigned_to="Kiran",
        coins=5,
        completed=False,
    )
    db.add(chore)
    db.commit()

    assert db.query(CoinTransaction).count() == 0

    # 2. Simulate complete: add transaction
    chore.completed = True
    chore.completed_at = datetime.now(timezone.utc)
    txn = CoinTransaction(
        person_name=chore.assigned_to,
        amount=chore.coins,
        reason="chore_completed",
        reference_id=chore.id,
    )
    db.add(txn)
    db.commit()

    # Verify a transaction was created
    assert db.query(CoinTransaction).count() == 1
    t = db.query(CoinTransaction).one()
    assert t.person_name == "Kiran"
    assert t.amount == 5

    # 3. Simulate uncomplete: delete transaction
    chore.completed = False
    chore.completed_at = None
    db.query(CoinTransaction).filter(
        CoinTransaction.person_name == chore.assigned_to,
        CoinTransaction.reason == "chore_completed",
        CoinTransaction.reference_id == chore.id,
    ).delete()
    db.commit()

    # Verify the transaction was deleted (reverted)
    assert db.query(CoinTransaction).count() == 0


def test_recurring_chore_transactions_keep_prior_occurrences(db):
    chore = Chore(title="Feed the fish", assigned_to="Kiran", coins=2, recurrence="daily")
    db.add(chore)
    db.commit()

    db.add_all(
        [
            CoinTransaction(
                person_name="Kiran", amount=2, reason="chore_completed",
                reference_id=chore.id, occurrence_date="2026-09-05",
            ),
            CoinTransaction(
                person_name="Kiran", amount=2, reason="chore_completed",
                reference_id=chore.id, occurrence_date="2026-09-06",
            ),
        ]
    )
    db.commit()

    # Undoing today's completion removes only today's ledger entry.
    db.query(CoinTransaction).filter(
        CoinTransaction.reference_id == chore.id,
        CoinTransaction.reason == "chore_completed",
        CoinTransaction.occurrence_date == "2026-09-06",
    ).delete()
    db.commit()

    remaining = db.query(CoinTransaction).all()
    assert len(remaining) == 1
    assert remaining[0].occurrence_date == "2026-09-05"


def test_check_missed_chores_does_not_dock_points(db, monkeypatch):
    from datetime import date
    from app.routers.rewards import check_missed_chores

    today = date.today().isoformat()
    chore = Chore(
        title="Brush Teeth",
        assigned_to="Swara",
        coins=5,
        recurrence="daily",
        due_date=today,
        completed=False,
    )
    db.add(chore)
    db.commit()

    # Patch SessionLocal so check_missed_chores creates a session on the test db
    test_session_maker = sessionmaker(bind=db.bind, expire_on_commit=False)
    monkeypatch.setattr("app.routers.rewards.SessionLocal", test_session_maker)
    # Patch manager to no-op
    monkeypatch.setattr("app.routers.rewards.manager.broadcast_threadsafe", lambda *args, **kwargs: None)

    check_missed_chores()

    # Verify NO penalty transactions were created
    txns = db.query(CoinTransaction).all()
    assert len(txns) == 0

    # Verify the chore was reset and its due date advanced
    db.expire_all()
    updated_chore = db.get(Chore, chore.id)
    assert updated_chore.completed is False
    assert updated_chore.last_reset_date == today
    assert updated_chore.due_date > today


def test_list_chores_auto_advances_past_due_recurring_chores(db, monkeypatch):
    from datetime import timedelta
    from zoneinfo import ZoneInfo
    from app.config import get_settings
    from app.routers.chores import list_chores

    # Mock broadcast
    monkeypatch.setattr("app.routers.chores.manager.broadcast_threadsafe", lambda *args, **kwargs: None)

    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date()
    past_due = (today - timedelta(days=2)).isoformat()
    chore = Chore(
        title="Homework",
        assigned_to="Dhruv",
        coins=5,
        recurrence="weekly:0,1,2,3,6",
        due_date=past_due,
        completed=True,
        completed_at=datetime.now(tz) - timedelta(days=2),
    )
    db.add(chore)
    db.commit()

    results = list_chores(db=db)
    assert len(results) == 1
    item = results[0]
    # Completed should be reset to False, due date advanced to on or after today
    assert item["completed"] is False
    assert item["due_date"] >= today.isoformat()

    # DB state verified
    db.expire_all()
    c = db.get(Chore, chore.id)
    assert c.completed is False
    assert c.completed_at is None
    assert c.due_date >= today.isoformat()


def test_list_chores_preserves_today_completed_chore(db, monkeypatch):
    from zoneinfo import ZoneInfo
    from app.config import get_settings
    from app.routers.chores import list_chores

    monkeypatch.setattr("app.routers.chores.manager.broadcast_threadsafe", lambda *args, **kwargs: None)

    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date().isoformat()
    chore = Chore(
        title="Make Bed",
        assigned_to="Swara",
        coins=2,
        recurrence="daily",
        due_date=today,
        completed=True,
        completed_at=datetime.now(tz),
    )
    db.add(chore)
    db.commit()

    results = list_chores(db=db)
    assert len(results) == 1
    item = results[0]
    # Chore completed today should remain completed today
    assert item["completed"] is True
    assert item["due_date"] == today

