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


def test_check_missed_chores_docks_points(db, monkeypatch):
    from zoneinfo import ZoneInfo
    from app.config import get_settings
    from app.routers.rewards import check_missed_chores, _get_balance_breakdown

    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date().isoformat()
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

    # Verify penalty transaction WAS created with negative coin value
    txns = db.query(CoinTransaction).all()
    assert len(txns) == 1
    txn = txns[0]
    assert txn.person_name == "Swara"
    assert txn.amount == -5
    assert txn.reason == "chore_missed"
    assert txn.reference_id == chore.id
    assert txn.occurrence_date == today

    # Verify balance breakdown reflects points lost
    breakdown = _get_balance_breakdown(db, "Swara")
    assert breakdown["balance"] == -5
    assert breakdown["lost"] == -5
    assert breakdown["earned"] == 0

    # Verify the chore was reset and its due date advanced
    db.expire_all()
    updated_chore = db.get(Chore, chore.id)
    assert updated_chore.completed is False
    assert updated_chore.last_reset_date == today
    assert updated_chore.due_date > today

    # Running check_missed_chores again today should be idempotent (no duplicate penalty)
    check_missed_chores()
    txns2 = db.query(CoinTransaction).all()
    assert len(txns2) == 1


def test_check_missed_chores_skips_completed_and_negative_chores(db, monkeypatch):
    from zoneinfo import ZoneInfo
    from app.config import get_settings
    from app.routers.rewards import check_missed_chores

    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date().isoformat()

    # Completed chore
    c1 = Chore(
        title="Clean Room",
        assigned_to="Dhruv",
        coins=10,
        recurrence="daily",
        due_date=today,
        completed=True,
        completed_at=datetime.now(tz),
    )
    # Negative points penalty chore (should NOT dock points if not checked)
    c2 = Chore(
        title="Fight with Sibling",
        assigned_to="Dhruv",
        coins=-10,
        recurrence="daily",
        due_date=today,
        completed=False,
    )
    # Unassigned chore
    c3 = Chore(
        title="Feed Cat",
        assigned_to="",
        coins=5,
        recurrence="daily",
        due_date=today,
        completed=False,
    )
    db.add_all([c1, c2, c3])
    db.commit()

    test_session_maker = sessionmaker(bind=db.bind, expire_on_commit=False)
    monkeypatch.setattr("app.routers.rewards.SessionLocal", test_session_maker)
    monkeypatch.setattr("app.routers.rewards.manager.broadcast_threadsafe", lambda *args, **kwargs: None)

    check_missed_chores()

    # None of these should result in a chore_missed transaction
    txns = db.query(CoinTransaction).filter(CoinTransaction.reason == "chore_missed").all()
    assert len(txns) == 0


def test_list_chores_docks_points_for_past_due_uncompleted_chore(db, monkeypatch):
    from datetime import timedelta
    from zoneinfo import ZoneInfo
    from app.config import get_settings
    from app.routers.chores import list_chores
    from app.routers.rewards import _get_balance_breakdown

    monkeypatch.setattr("app.routers.chores.manager.broadcast_threadsafe", lambda *args, **kwargs: None)

    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date()
    yesterday = (today - timedelta(days=1)).isoformat()

    chore = Chore(
        title="Read Book",
        assigned_to="Swara",
        coins=3,
        recurrence="daily",
        due_date=yesterday,
        completed=False,
    )
    db.add(chore)
    db.commit()

    results = list_chores(db=db)
    assert len(results) == 1
    assert results[0]["completed"] is False
    assert results[0]["due_date"] == today.isoformat()

    # Verify points were docked for yesterday
    txns = db.query(CoinTransaction).filter(CoinTransaction.reason == "chore_missed").all()
    assert len(txns) == 1
    assert txns[0].person_name == "Swara"
    assert txns[0].amount == -3
    assert txns[0].occurrence_date == yesterday

    breakdown = _get_balance_breakdown(db, "Swara")
    assert breakdown["lost"] == -3
    assert breakdown["balance"] == -3


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


def test_negative_points_chore_deducts_coins_and_updates_breakdown(db, monkeypatch):
    from app.routers.rewards import _get_balance_breakdown

    # Create a negative-points chore ("Room Not Clean" -> -10 coins)
    chore = Chore(
        title="Room Not Clean",
        assigned_to="Dhruv",
        coins=-10,
        completed=False,
    )
    db.add(chore)
    db.commit()

    assert chore.coins == -10
    breakdown_before = _get_balance_breakdown(db, "Dhruv")
    assert breakdown_before["balance"] == 0
    assert breakdown_before["lost"] == 0

    # Simulate completion of the negative chore
    chore.completed = True
    chore.completed_at = datetime.now(timezone.utc)
    txn = CoinTransaction(
        person_name=chore.assigned_to,
        amount=chore.coins,
        reason="chore_completed",
        reference_id=chore.id,
        occurrence_date="one-off",
    )
    db.add(txn)
    db.commit()

    # Balance breakdown should reflect negative 10 balance and 10 lost
    breakdown_after = _get_balance_breakdown(db, "Dhruv")
    assert breakdown_after["balance"] == -10
    assert breakdown_after["lost"] == -10
    assert breakdown_after["earned"] == 0

    # Undoing the negative chore removes transaction and restores balance
    chore.completed = False
    chore.completed_at = None
    db.query(CoinTransaction).filter(
        CoinTransaction.person_name == chore.assigned_to,
        CoinTransaction.reference_id == chore.id,
        CoinTransaction.reason == "chore_completed",
    ).delete()
    db.commit()

    breakdown_undone = _get_balance_breakdown(db, "Dhruv")
    assert breakdown_undone["balance"] == 0
    assert breakdown_undone["lost"] == 0


async def test_completing_missed_chore_removes_penalty(db, monkeypatch):
    from zoneinfo import ZoneInfo
    from app.config import get_settings
    from app.routers.chores import patch_chore, ChorePatch
    from app.routers.rewards import _get_balance_breakdown

    async def mock_broadcast(*args, **kwargs):
        pass

    monkeypatch.setattr("app.routers.chores.manager.broadcast", mock_broadcast)

    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date().isoformat()

    chore = Chore(
        title="Walk Dog",
        assigned_to="Dhruv",
        coins=4,
        recurrence="daily",
        due_date=today,
        completed=False,
    )
    db.add(chore)
    db.commit()

    # Suppose it was marked as missed
    penalty = CoinTransaction(
        person_name="Dhruv",
        amount=-4,
        reason="chore_missed",
        reference_id=chore.id,
        occurrence_date=today,
    )
    db.add(penalty)
    db.commit()

    b_before = _get_balance_breakdown(db, "Dhruv")
    assert b_before["lost"] == -4
    assert b_before["earned"] == 0
    assert b_before["balance"] == -4

    # Now the chore is checked as completed
    await patch_chore(chore.id, ChorePatch(completed=True), db=db)

    b_after = _get_balance_breakdown(db, "Dhruv")
    assert b_after["lost"] == 0
    assert b_after["earned"] == 4
    assert b_after["balance"] == 4

    # Missed transaction is gone, completed transaction exists
    missed_txns = db.query(CoinTransaction).filter(CoinTransaction.reason == "chore_missed").all()
    assert len(missed_txns) == 0
    completed_txns = db.query(CoinTransaction).filter(CoinTransaction.reason == "chore_completed").all()
    assert len(completed_txns) == 1
    assert completed_txns[0].amount == 4



