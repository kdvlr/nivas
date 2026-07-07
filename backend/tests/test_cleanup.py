from datetime import datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import app.services.sync as sync_mod
from app.models import Base, Chore, ShoppingItem, Task
from app.services.merge import SourceTask, sync_tasks
from app.services.sync import cleanup_old_completed


@pytest.fixture
def db(monkeypatch):
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(sync_mod, "SessionLocal", factory)
    session = factory()
    yield session
    session.close()


def test_pre_completed_source_items_are_not_imported(db):
    snap = [
        SourceTask("icloud", "old", "Ancient chore from 2019", completed=True),
        SourceTask("icloud", "new", "Fresh task", completed=False),
    ]
    sync_tasks(db, "icloud", snap)
    titles = [t.title for t in db.query(Task).all()]
    assert titles == ["Fresh task"]

    # completing an item we already track still works
    sync_tasks(db, "icloud", [SourceTask("icloud", "new", "Fresh task", completed=True)])
    assert db.query(Task).one().completed is True


def test_cleanup_removes_only_old_completed(db):
    old = datetime.utcnow() - timedelta(days=91)
    recent = datetime.utcnow() - timedelta(days=5)
    db.add_all(
        [
            Task(source="local", external_id="a", title="old done", completed=True, completed_at=old),
            Task(source="local", external_id="b", title="recent done", completed=True, completed_at=recent),
            Task(source="local", external_id="c", title="open", completed=False),
            Chore(title="old one-off", completed=True, completed_at=old, recurrence=""),
            Chore(title="old recurring", completed=True, completed_at=old, recurrence="daily"),
            ShoppingItem(title="old bought", norm_title="old bought", completed=True, updated_at=old),
        ]
    )
    db.commit()

    removed = cleanup_old_completed()
    assert removed == 3
    assert {t.title for t in db.query(Task).all()} == {"recent done", "open"}
    assert {c.title for c in db.query(Chore).all()} == {"old recurring"}
    assert db.query(ShoppingItem).count() == 0
