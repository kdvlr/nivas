import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..services.school_calendar import is_school_day
from ..services.timer_service import timer_service

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/timer", tags=["timer"])


class StartTimerRequest(BaseModel):
    total_seconds: int = 1800  # Default 30 minutes
    label: str = "Timer"
    source: str = "manual"


@router.get("/state")
def get_timer_state():
    """Returns the current active timer (running, paused, ringing) or None if idle."""
    state = timer_service.get_state()
    return {"active": state is not None, "timer": state}


@router.post("/start")
def start_timer(body: StartTimerRequest):
    """Starts or overrides a timer session."""
    timer = timer_service.start_timer(
        total_seconds=body.total_seconds,
        label=body.label,
        source=body.source,
    )
    return {"ok": True, "timer": timer}


@router.post("/pause")
def pause_timer():
    """Pauses the currently running timer."""
    timer = timer_service.pause_timer()
    return {"ok": True, "timer": timer}


@router.post("/resume")
def resume_timer():
    """Resumes the currently paused timer."""
    timer = timer_service.resume_timer()
    return {"ok": True, "timer": timer}


@router.post("/cancel")
def cancel_timer():
    """Cancels and clears the current timer."""
    timer_service.cancel_timer()
    return {"ok": True}


@router.post("/dismiss")
def dismiss_timer():
    """Dismisses the completed alarm state."""
    timer_service.dismiss_alarm()
    return {"ok": True}


@router.get("/school-day")
def check_school_day(
    target_date: Optional[str] = Query(None, alias="date"),
    db: Session = Depends(get_db),
):
    """
    Evaluates whether a given date (or today if omitted) is a scheduled school day
    based on Swara and Dhruv's calendar events.
    """
    d: Optional[date] = None
    if target_date:
        try:
            d = date.fromisoformat(target_date)
        except ValueError:
            return {"error": "Invalid date format, expected YYYY-MM-DD", "date": target_date}

    school_day, reason = is_school_day(db, d)
    return {
        "date": (d or date.today()).isoformat(),
        "is_school_day": school_day,
        "reason": reason,
    }
