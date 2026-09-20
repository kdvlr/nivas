import logging
from datetime import date, datetime, timedelta
from typing import Tuple
from zoneinfo import ZoneInfo
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import CalendarEvent, CalendarSelection

log = logging.getLogger(__name__)

# Keywords indicating that school is not in session
NO_SCHOOL_KEYWORDS = (
    "no school",
    "break",
    "student holiday",
    "teacher in-service",
    "staff development",
    "bad weather make-up day",
    "holiday",
)


def is_school_day(db: Session, target_date: date | None = None) -> Tuple[bool, str]:
    """
    Evaluates whether target_date is a scheduled school day using Swara and Dhruv's
    synced Google Calendar events (Frisco ISD schedule).

    Returns:
        (is_school_day: bool, reason: str)
    """
    if target_date is None:
        tz = ZoneInfo(get_settings().tz)
        target_date = datetime.now(tz).date()

    # 1. Weekends are never school days (Monday is 0, Sunday is 6)
    if target_date.weekday() >= 5:
        day_name = target_date.strftime("%A")
        return False, f"Weekend ({day_name})"

    # 2. Look up calendar selections for Swara and Dhruv
    selections = (
        db.query(CalendarSelection)
        .filter(
            CalendarSelection.enabled == True,
            (
                CalendarSelection.person_name.ilike("%Swara%")
                | CalendarSelection.person_name.ilike("%Dhruv%")
                | CalendarSelection.name.ilike("%Swara%")
                | CalendarSelection.name.ilike("%Dhruv%")
            ),
        )
        .all()
    )

    if not selections:
        # Fallback: if no specific selections found, query all enabled selections
        selections = db.query(CalendarSelection).filter(CalendarSelection.enabled == True).all()

    sel_ids = [s.id for s in selections]
    if not sel_ids:
        # If no calendars at all, default to regular weekday assumption
        return True, "No school calendar configured; default weekday"

    events = db.query(CalendarEvent).filter(CalendarEvent.selection_id.in_(sel_ids)).all()

    first_day: date | None = None
    last_day: date | None = None
    no_school_intervals: list[Tuple[date, date, str]] = []

    target_year = target_date.year

    for e in events:
        title = e.title or ""
        title_lower = title.lower()

        # Parse start and end date (Google calendar all-day format: "YYYY-MM-DD")
        try:
            start_str = e.start[:10]
            start_d = date.fromisoformat(start_str)
        except Exception:
            continue

        try:
            end_str = e.end[:10] if e.end else start_str
            end_d = date.fromisoformat(end_str)
        except Exception:
            end_d = start_d + timedelta(days=1)

        # In iCal / Google Calendar, all-day event end dates are exclusive:
        # A single-day event on 2026-09-07 has start="2026-09-07", end="2026-09-08".
        if end_d <= start_d:
            end_d = start_d + timedelta(days=1)

        # We look for school year markers matching the target date's academic year.
        # An academic year spanning 2026-08 to 2027-05 matches target dates in 2026 or 2027.
        is_relevant_year = abs(start_d.year - target_year) <= 1

        if "first day of school" in title_lower and is_relevant_year:
            # Check if this marker is relevant for target_date
            # (If target is Sep 2026, first day in Aug 2026 applies)
            if start_d <= target_date + timedelta(days=300):
                if first_day is None or start_d < first_day:
                    first_day = start_d

        elif "last day of school" in title_lower and is_relevant_year:
            if start_d >= target_date - timedelta(days=300):
                if last_day is None or start_d > last_day:
                    last_day = start_d

        elif any(k in title_lower for k in NO_SCHOOL_KEYWORDS):
            no_school_intervals.append((start_d, end_d, title))

    # 3. If academic year markers exist, enforce boundaries
    if first_day and target_date < first_day:
        return False, f"Before first day of school ({first_day})"

    if last_day and target_date > last_day:
        return False, f"After last day of school ({last_day})"

    # 4. Check if target_date falls into any No-School / Break interval
    for s_date, e_date, title in no_school_intervals:
        if s_date <= target_date < e_date:
            return False, f"Holiday/Break: {title}"

    return True, "School day"
