import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models import Base, ShoppingItem, Task
from app.services.merge import (
    SourceListItem,
    SourceTask,
    normalize_title,
    sync_shopping,
    sync_tasks,
)


@pytest.fixture
def db():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine, expire_on_commit=False)()
    yield session
    session.close()


def test_normalize_title():
    assert normalize_title("  Milk ") == "milk"
    assert normalize_title("2x Eggs") == "eggs"
    assert normalize_title("Bread!!") == "bread"
    assert normalize_title("Peanut   Butter") == "peanut butter"


def test_sync_tasks_creates_updates_and_removes(db):
    snap = [
        SourceTask("icloud", "g1", "Take out trash", list_name="Chores"),
        SourceTask("icloud", "g2", "Feed the dog", list_name="Chores"),
    ]
    assert sync_tasks(db, "icloud", snap) is True
    assert db.query(Task).count() == 2

    # rename one, complete the other, drop nothing
    snap = [
        SourceTask("icloud", "g1", "Take out the trash", list_name="Chores"),
        SourceTask("icloud", "g2", "Feed the dog", completed=True, list_name="Chores"),
    ]
    assert sync_tasks(db, "icloud", snap) is True
    t1 = db.query(Task).filter_by(external_id="g1").one()
    t2 = db.query(Task).filter_by(external_id="g2").one()
    assert t1.title == "Take out the trash"
    assert t2.completed and t2.completed_at is not None

    # source deleted g2
    assert sync_tasks(db, "icloud", snap[:1]) is True
    assert db.query(Task).count() == 1

    # no changes -> False
    assert sync_tasks(db, "icloud", snap[:1]) is False


def test_sync_tasks_sources_are_independent(db):
    sync_tasks(db, "icloud", [SourceTask("icloud", "a", "From iCloud")])
    sync_tasks(db, "alexa", [SourceTask("alexa", "b", "From Alexa")])
    assert db.query(Task).count() == 2
    # an empty alexa snapshot must not touch icloud tasks
    sync_tasks(db, "alexa", [])
    assert db.query(Task).count() == 1
    assert db.query(Task).one().source == "icloud"


def test_shopping_dedupes_across_sources(db):
    sync_shopping(db, "icloud", [SourceListItem("icloud", "i1", "Milk")])
    sync_shopping(db, "alexa", [SourceListItem("alexa", "a1", "milk")])
    items = db.query(ShoppingItem).all()
    assert len(items) == 1
    assert {r["source"] for r in items[0].sources} == {"icloud", "alexa"}


def test_shopping_removed_from_all_sources_is_deleted(db):
    sync_shopping(db, "icloud", [SourceListItem("icloud", "i1", "Milk")])
    sync_shopping(db, "alexa", [SourceListItem("alexa", "a1", "Milk")])
    sync_shopping(db, "icloud", [])
    assert db.query(ShoppingItem).count() == 1  # still on alexa
    sync_shopping(db, "alexa", [])
    assert db.query(ShoppingItem).count() == 0


def test_shopping_local_item_survives_source_syncs(db):
    db.add(ShoppingItem(title="Cake", norm_title="cake", sources=[{"source": "local", "external_id": "x"}]))
    db.commit()
    sync_shopping(db, "icloud", [])
    sync_shopping(db, "alexa", [])
    assert db.query(ShoppingItem).count() == 1


def test_shopping_readd_reactivates_completed(db):
    sync_shopping(db, "icloud", [SourceListItem("icloud", "i1", "Milk")])
    item = db.query(ShoppingItem).one()
    item.completed = True
    db.commit()
    sync_shopping(db, "icloud", [SourceListItem("icloud", "i2", "Milk", completed=False)])
    assert db.query(ShoppingItem).one().completed is False


def test_shopping_duplicate_titles_in_one_snapshot(db):
    """iCloud keeps completed purchase history: many 'Milk' rows, maybe one open."""
    snap = [
        SourceListItem("icloud", "old1", "Milk", completed=True),
        SourceListItem("icloud", "old2", "Milk", completed=True),
        SourceListItem("icloud", "cur", "Milk", completed=False),
        SourceListItem("icloud", "hist", "Phulkas", completed=True),
        SourceListItem("icloud", "hist2", "Phulkas", completed=True),
    ]
    sync_shopping(db, "icloud", snap)  # must not raise UNIQUE violations
    items = db.query(ShoppingItem).all()
    # only the title with an open occurrence is imported, once
    assert [(i.title, i.completed) for i in items] == [("Milk", False)]
    assert items[0].sources == [{"source": "icloud", "external_id": "cur"}]


def test_shopping_source_completion_propagates_to_linked_item(db):
    sync_shopping(db, "icloud", [SourceListItem("icloud", "i1", "Eggs", completed=False)])
    assert db.query(ShoppingItem).one().completed is False
    # checked off on the phone -> only completed occurrences remain in the source
    sync_shopping(db, "icloud", [SourceListItem("icloud", "i1", "Eggs", completed=True)])
    assert db.query(ShoppingItem).one().completed is True


def test_shopping_history_does_not_complete_unlinked_local_item(db):
    db.add(ShoppingItem(title="Milk", norm_title="milk", sources=[{"source": "local", "external_id": "x"}]))
    db.commit()
    # ancient completed Milk in iCloud must not check off the fresh local item
    sync_shopping(db, "icloud", [SourceListItem("icloud", "old", "Milk", completed=True)])
    row = db.query(ShoppingItem).one()
    assert row.completed is False
    assert row.sources == [{"source": "local", "external_id": "x"}]
