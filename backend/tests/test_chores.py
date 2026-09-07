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
