from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import get_settings

engine = create_engine(
    get_settings().db_url,
    connect_args={"check_same_thread": False},
)
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


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
