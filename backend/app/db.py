from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings

engine = create_engine(
    get_settings().db_url,
    connect_args={"check_same_thread": False, "timeout": 30},
)

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    cursor.close()

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    from sqlalchemy import text

    from . import models  # noqa: F401

    models.Base.metadata.create_all(engine)
    # lightweight migrations for columns added after a table already exists
    with engine.begin() as conn:
        try:
            conn.execute(
                text("ALTER TABLE calendar_accounts ADD COLUMN picture VARCHAR DEFAULT ''")
            )
        except Exception:
            pass  # column already exists
        try:
            conn.execute(
                text("ALTER TABLE calendar_events ADD COLUMN description VARCHAR DEFAULT ''")
            )
        except Exception:
            pass
        try:
            conn.execute(
                text("ALTER TABLE calendar_events ADD COLUMN location VARCHAR DEFAULT ''")
            )
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE people ADD COLUMN avatar_emoji VARCHAR DEFAULT ''"))
        except Exception:
            pass
        try:
            conn.execute(text("ALTER TABLE people ADD COLUMN chores_enabled BOOLEAN DEFAULT 1"))
        except Exception:
            pass
        try:
            conn.execute(
                text("ALTER TABLE photo_metadata ADD COLUMN file_type VARCHAR DEFAULT 'image'")
            )
        except Exception:
            pass
        try:
            conn.execute(
                text("ALTER TABLE tasks ADD COLUMN recurrence VARCHAR DEFAULT ''")
            )
        except Exception:
            pass
        try:
            conn.execute(
                text("ALTER TABLE coin_transactions ADD COLUMN occurrence_date VARCHAR DEFAULT ''")
            )
        except Exception:
            pass
        # Preserve historical rows while giving old chore entries a stable
        # occurrence key. New recurring completions are keyed by their local
        # scheduled day instead of by chore ID alone.
        conn.execute(
            text(
                "UPDATE coin_transactions SET occurrence_date = substr(created_at, 1, 10) "
                "WHERE occurrence_date = '' AND reason IN ('chore_completed', 'chore_missed') "
                "AND reference_id IS NOT NULL"
            )
        )
        try:
            conn.execute(text("ALTER TABLE photo_metadata ADD COLUMN metadata_version VARCHAR DEFAULT ''"))
        except Exception:
            pass
        conn.execute(
            text(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_coin_chore_occurrence "
                "ON coin_transactions (reason, reference_id, occurrence_date) "
                "WHERE occurrence_date != '' AND reference_id IS NOT NULL"
            )
        )
        try:
            conn.execute(text("ALTER TABLE recipes ADD COLUMN nutrition JSON DEFAULT NULL"))
        except Exception:
            pass
        # Performance indexes for hot dashboard queries
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_calendar_events_sel_range "
                "ON calendar_events (selection_id, start, end)"
            )
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_coin_transactions_person_created "
                "ON coin_transactions (person_name, created_at)"
            )
        )
        conn.execute(
            text("CREATE INDEX IF NOT EXISTS ix_tasks_completed ON tasks (completed)")
        )
        conn.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_chores_assigned_completed "
                "ON chores (assigned_to, completed)"
            )
        )


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
