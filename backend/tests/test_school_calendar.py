import pytest
from datetime import date
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models import Base, CalendarAccount, CalendarSelection, CalendarEvent
from app.services.school_calendar import is_school_day


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()

    # Create account
    account = CalendarAccount(email="test@family.com", token_json="{}")
    session.add(account)
    session.flush()

    # Create selections for Swara and Dhruv
    sel_swara = CalendarSelection(
        account_id=account.id,
        calendar_id="swara@gmail.com",
        name="Swara",
        person_name="Swara",
        enabled=True,
    )
    sel_dhruv = CalendarSelection(
        account_id=account.id,
        calendar_id="dhruv@gmail.com",
        name="Dhruv",
        person_name="Dhruv",
        enabled=True,
    )
    session.add_all([sel_swara, sel_dhruv])
    session.flush()

    # Add FISD Events
    events = [
        CalendarEvent(
            selection_id=sel_swara.id,
            external_id="ev_first_day",
            title="First Day of School (FISD)",
            start="2026-08-12",
            end="2026-08-13",
            all_day=True,
        ),
        CalendarEvent(
            selection_id=sel_swara.id,
            external_id="ev_labor_day",
            title="No School – Labor Day (FISD)",
            start="2026-09-07",
            end="2026-09-08",
            all_day=True,
        ),
        CalendarEvent(
            selection_id=sel_dhruv.id,
            external_id="ev_no_school_fisd",
            title="No School (FISD)",
            start="2026-09-08",
            end="2026-09-09",
            all_day=True,
        ),
        CalendarEvent(
            selection_id=sel_swara.id,
            external_id="ev_thanksgiving",
            title="Thanksgiving Break – No School (FISD)",
            start="2026-11-23",
            end="2026-11-28",
            all_day=True,
        ),
        CalendarEvent(
            selection_id=sel_dhruv.id,
            external_id="ev_winter_break",
            title="Winter Break – No School (FISD)",
            start="2026-12-21",
            end="2027-01-05",
            all_day=True,
        ),
        CalendarEvent(
            selection_id=sel_swara.id,
            external_id="ev_last_day",
            title="Last Day of School (FISD)",
            start="2027-05-14",
            end="2027-05-15",
            all_day=True,
        ),
    ]
    session.add_all(events)
    session.commit()

    yield session
    session.close()


def test_weekends_are_not_school_days(db_session):
    sat = date(2026, 9, 19)
    sun = date(2026, 9, 20)
    is_school, reason = is_school_day(db_session, sat)
    assert not is_school
    assert "Weekend" in reason

    is_school, reason = is_school_day(db_session, sun)
    assert not is_school
    assert "Weekend" in reason


def test_regular_school_day(db_session):
    wed = date(2026, 9, 9)
    mon = date(2026, 9, 21)
    is_school, reason = is_school_day(db_session, wed)
    assert is_school
    assert reason == "School day"

    is_school, reason = is_school_day(db_session, mon)
    assert is_school
    assert reason == "School day"


def test_holidays_and_breaks(db_session):
    # Single day holiday
    labor_day = date(2026, 9, 7)
    is_school, reason = is_school_day(db_session, labor_day)
    assert not is_school
    assert "Labor Day" in reason

    fisd_off = date(2026, 9, 8)
    is_school, reason = is_school_day(db_session, fisd_off)
    assert not is_school
    assert "No School" in reason

    # Multi-day break: Thanksgiving
    tg_wed = date(2026, 11, 25)
    is_school, reason = is_school_day(db_session, tg_wed)
    assert not is_school
    assert "Thanksgiving Break" in reason

    # Multi-day break: Winter Break
    christmas = date(2026, 12, 25)
    is_school, reason = is_school_day(db_session, christmas)
    assert not is_school
    assert "Winter Break" in reason


def test_school_year_bounds(db_session):
    # Before school starts
    before_start = date(2026, 8, 10)
    is_school, reason = is_school_day(db_session, before_start)
    assert not is_school
    assert "Before first day of school" in reason

    # First day of school
    first_day = date(2026, 8, 12)
    is_school, reason = is_school_day(db_session, first_day)
    assert is_school

    # Last day of school
    last_day = date(2027, 5, 14)
    is_school, reason = is_school_day(db_session, last_day)
    assert is_school

    # After school ends (Summer)
    summer = date(2027, 5, 17)
    is_school, reason = is_school_day(db_session, summer)
    assert not is_school
    assert "After last day of school" in reason


def test_check_and_trigger_school_timer(monkeypatch, db_session):
    from unittest.mock import MagicMock
    from app.scheduler import check_and_trigger_school_timer
    from app.services.timer_service import timer_service

    # Mock SessionLocal to return our test db_session
    monkeypatch.setattr("app.db.SessionLocal", lambda: db_session)
    # Ensure db_session.__enter__ returns itself
    db_session.close = MagicMock()

    # Case 1: School day -> should start 45m (2700s) timer
    monkeypatch.setattr("app.services.school_calendar.is_school_day", lambda db, d: (True, "School day"))
    start_mock = MagicMock()
    monkeypatch.setattr(timer_service, "start_timer", start_mock)

    check_and_trigger_school_timer()
    start_mock.assert_called_once_with(
        total_seconds=2700,
        label="School Morning Timer",
        source="school_schedule",
    )

    # Case 2: Weekend / Holiday -> should NOT start timer
    monkeypatch.setattr("app.services.school_calendar.is_school_day", lambda db, d: (False, "Weekend (Saturday)"))
    start_mock.reset_mock()

    check_and_trigger_school_timer()
    start_mock.assert_not_called()

