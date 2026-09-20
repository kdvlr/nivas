from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..config import get_settings
from ..models import Chore, CoinTransaction
from ..utils import next_due_date
from ..ws import manager

router = APIRouter(prefix="/api/chores", tags=["chores"])


class ChoreResetDatesRequest(BaseModel):
    reset_completed: bool = True
    include_one_off: bool = True


class ChoreCreate(BaseModel):
    title: str
    assigned_to: str = ""
    coins: int = 1
    due_date: str = ""
    notes: str = ""
    recurrence: str = ""  # "" = one-off, "daily", "weekly:0,2,4"


class ChorePatch(BaseModel):
    title: str | None = None
    assigned_to: str | None = None
    coins: int | None = None
    due_date: str | None = None
    notes: str | None = None
    completed: bool | None = None
    recurrence: str | None = None


def _chore_dict(c: Chore) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "assigned_to": c.assigned_to,
        "coins": c.coins,
        "due_date": c.due_date,
        "notes": c.notes,
        "completed": c.completed,
        "completed_at": c.completed_at.isoformat() if c.completed_at else None,
        "recurrence": c.recurrence,
        "last_reset_date": c.last_reset_date,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _occurrence_date(chore: Chore) -> str:
    """Return the current local day for recurring chores, or a one-off key."""
    if not chore.recurrence:
        return "one-off"
    return datetime.now(ZoneInfo(get_settings().tz)).date().isoformat()


@router.get("")
def list_chores(
    completed: bool | None = None,
    person: str | None = None,
    db: Session = Depends(get_db),
):
    tz_name = get_settings().tz
    today = datetime.now(ZoneInfo(tz_name)).date()
    today_iso = today.isoformat()

    # Automatically advance past-due recurring chores so they roll over to their next occurrence
    recurring = db.query(Chore).filter(Chore.recurrence != "").all()
    has_changes = False
    for c in recurring:
        orig_due = date.fromisoformat(c.due_date) if c.due_date else None
        completed_on_past_day = False
        if c.completed and c.completed_at:
            dt = c.completed_at
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            completed_on_past_day = dt.astimezone(ZoneInfo(tz_name)).date() < today

        if (orig_due and orig_due < today) or completed_on_past_day:
            new_due = next_due_date(today, c.recurrence, ref_date=orig_due)
            c.due_date = new_due.isoformat()
            c.completed = False
            c.completed_at = None
            has_changes = True

    if has_changes:
        db.commit()
        manager.broadcast_threadsafe("chores")

    q = db.query(Chore)
    if completed is not None:
        q = q.filter(Chore.completed == completed)
    if person is not None:
        q = q.filter(Chore.assigned_to == person)
    rows = q.order_by(Chore.completed.asc(), Chore.created_at.desc()).all()
    return [_chore_dict(c) for c in rows]


@router.post("")
async def create_chore(body: ChoreCreate, db: Session = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(400, "title required")
    due_date = body.due_date
    if body.recurrence:
        today = datetime.now(ZoneInfo(get_settings().tz)).date()
        orig_due = date.fromisoformat(due_date) if due_date else None
        ref = max(orig_due, today) if orig_due else today
        due_date = next_due_date(ref, body.recurrence, ref_date=orig_due).isoformat()
    row = Chore(
        title=body.title.strip(),
        assigned_to=body.assigned_to,
        coins=max(1, body.coins),
        due_date=due_date,
        notes=body.notes,
        recurrence=body.recurrence,
    )
    db.add(row)
    db.commit()
    await manager.broadcast("chores")
    return _chore_dict(row)


@router.patch("/{chore_id}")
async def patch_chore(chore_id: int, body: ChorePatch, db: Session = Depends(get_db)):
    row = db.get(Chore, chore_id)
    if row is None:
        raise HTTPException(404)
    if body.title is not None:
        row.title = body.title
    if body.assigned_to is not None:
        row.assigned_to = body.assigned_to
    if body.coins is not None:
        row.coins = max(1, body.coins)
    if body.due_date is not None:
        row.due_date = body.due_date
    if body.notes is not None:
        row.notes = body.notes
    if body.recurrence is not None:
        row.recurrence = body.recurrence
        if body.recurrence:
            today = datetime.now(ZoneInfo(get_settings().tz)).date()
            cur_due = row.due_date
            orig_due = date.fromisoformat(cur_due) if cur_due else None
            ref = max(orig_due, today) if orig_due else today
            row.due_date = next_due_date(ref, body.recurrence, ref_date=orig_due).isoformat()
    if body.completed is not None and body.completed != row.completed:
        row.completed = body.completed
        if body.completed:
            row.completed_at = datetime.now(timezone.utc)
            # Record coin earning
            if row.assigned_to:
                occurrence_date = _occurrence_date(row)
                existing = (
                    db.query(CoinTransaction.id)
                    .filter(
                        CoinTransaction.person_name == row.assigned_to,
                        CoinTransaction.reason == "chore_completed",
                        CoinTransaction.reference_id == row.id,
                        CoinTransaction.occurrence_date == occurrence_date,
                    )
                    .first()
                )
                if existing is None:
                    db.add(
                        CoinTransaction(
                            person_name=row.assigned_to,
                            amount=row.coins,
                            reason="chore_completed",
                            reference_id=row.id,
                            occurrence_date=occurrence_date,
                        )
                    )
        else:
            row.completed_at = None
            if row.assigned_to:
                occurrence_date = _occurrence_date(row)
                db.query(CoinTransaction).filter(
                    CoinTransaction.person_name == row.assigned_to,
                    CoinTransaction.reason == "chore_completed",
                    CoinTransaction.reference_id == row.id,
                    CoinTransaction.occurrence_date == occurrence_date,
                ).delete()
    db.commit()
    await manager.broadcast("chores")
    return _chore_dict(row)


@router.delete("/{chore_id}", status_code=204)
async def delete_chore(chore_id: int, db: Session = Depends(get_db)):
    row = db.get(Chore, chore_id)
    if row is None:
        raise HTTPException(404)
    db.delete(row)
    db.commit()
    await manager.broadcast("chores")


@router.post("/reset-dates")
async def reset_chore_dates(body: ChoreResetDatesRequest = ChoreResetDatesRequest(), db: Session = Depends(get_db)):
    """
    Advance all recurring chores and past-due one-off chores to today or their next upcoming scheduled date.
    """
    today = datetime.now(ZoneInfo(get_settings().tz)).date()
    chores = db.query(Chore).all()
    updated_count = 0

    for chore in chores:
        changed = False
        orig_due = date.fromisoformat(chore.due_date) if chore.due_date else None

        if chore.recurrence:
            new_due = next_due_date(today, chore.recurrence, ref_date=orig_due)
            new_due_str = new_due.isoformat()
            if chore.due_date != new_due_str:
                chore.due_date = new_due_str
                changed = True
            if body.reset_completed and chore.completed:
                # Clear completed status so chore is fresh for its upcoming occurrence
                chore.completed = False
                chore.completed_at = None
                changed = True
        elif body.include_one_off and orig_due and orig_due < today:
            chore.due_date = today.isoformat()
            changed = True

        if changed:
            updated_count += 1

    if updated_count > 0:
        db.commit()
        await manager.broadcast("chores")

    return {
        "updated_count": updated_count,
        "total_chores": len(chores),
        "today": today.isoformat(),
    }
