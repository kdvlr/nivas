import logging
from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..admin_auth import require_admin
from ..db import get_db
from ..config import get_settings
from ..models import Chore, CoinTransaction
from ..utils import next_due_date
from ..ws import manager

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chores", tags=["chores"])


def _parse_iso_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except ValueError:
        return None


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
    """Return the scheduled ISO date (or current local day) for a chore occurrence."""
    parsed_due = _parse_iso_date(chore.due_date)
    if parsed_due is not None:
        return parsed_due.isoformat()
    return datetime.now(ZoneInfo(get_settings().tz)).date().isoformat()


def _record_missed_penalty_if_needed(db: Session, chore: Chore, occ_date: str) -> bool:
    """Deduct coins once for an uncompleted positive chore on `occ_date`."""
    if chore.completed or not chore.assigned_to or chore.coins <= 0:
        return False
    already_recorded = (
        db.query(CoinTransaction.id)
        .filter(
            CoinTransaction.reason == "chore_missed",
            CoinTransaction.reference_id == chore.id,
            CoinTransaction.occurrence_date == occ_date,
        )
        .first()
    )
    if already_recorded is not None:
        return False
    db.add(
        CoinTransaction(
            person_name=chore.assigned_to,
            amount=-chore.coins,
            reason="chore_missed",
            reference_id=chore.id,
            occurrence_date=occ_date,
            created_at=datetime.now(timezone.utc),
        )
    )
    log.info(
        "Missed chore penalty: %s lost %d coin(s) for '%s' (due %s)",
        chore.assigned_to,
        chore.coins,
        chore.title,
        occ_date,
    )
    return True


def _local_date(dt: datetime | None, tz: ZoneInfo) -> date | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz).date()


@router.get("")
def list_chores(
    completed: bool | None = None,
    person: str | None = None,
    db: Session = Depends(get_db),
):
    tz = ZoneInfo(get_settings().tz)
    today = datetime.now(tz).date()
    today_iso = today.isoformat()

    # Same-day chore lifecycle: settle any past-day chores so nothing is ever "overdue"
    all_chores = db.query(Chore).all()
    has_changes = False
    penalized = False
    for c in all_chores:
        orig_due = _parse_iso_date(c.due_date)
        completed_date = _local_date(c.completed_at, tz)
        created_date = _local_date(c.created_at, tz)
        completed_on_past_day = bool(c.completed and completed_date is not None and completed_date < today)

        if c.coins < 0:
            # Manual penalty buttons: never auto-deduct if unselected; reset cleanly on a new day
            should_reset = (orig_due is not None and orig_due < today) or (orig_due is None and completed_on_past_day)
            if should_reset:
                c.completed = False
                c.completed_at = None
                c.last_reset_date = today_iso
                if c.recurrence:
                    c.due_date = next_due_date(today, c.recurrence, ref_date=orig_due).isoformat()
                elif orig_due is not None:
                    c.due_date = today_iso
                has_changes = True
        elif c.recurrence:
            # Recurring chores: dock missed points for past due date, then advance to next scheduled occurrence
            should_rollover = (orig_due is not None and orig_due < today) or (orig_due is None and completed_on_past_day)
            if should_rollover:
                if orig_due is not None and orig_due < today:
                    if _record_missed_penalty_if_needed(db, c, orig_due.isoformat()):
                        penalized = True
                new_due = next_due_date(today, c.recurrence, ref_date=orig_due)
                c.due_date = new_due.isoformat()
                c.completed = False
                c.completed_at = None
                c.last_reset_date = today_iso
                has_changes = True
        else:
            # One-time same-day chores: dock points if missed on their due day, then remove (no overdue carryover)
            created_on_past_day = created_date is not None and created_date < today
            is_expired = (orig_due is not None and orig_due < today) or (
                orig_due is None and (completed_on_past_day or created_on_past_day)
            )
            if is_expired:
                occ_date = (
                    orig_due.isoformat()
                    if orig_due is not None
                    else (created_date.isoformat() if created_date is not None else today_iso)
                )
                if _record_missed_penalty_if_needed(db, c, occ_date):
                    penalized = True
                db.delete(c)
                has_changes = True

    if has_changes:
        db.commit()
        manager.broadcast_threadsafe("chores")
        if penalized:
            manager.broadcast_threadsafe("rewards")

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
    today = datetime.now(ZoneInfo(get_settings().tz)).date()
    if body.recurrence:
        orig_due = _parse_iso_date(due_date)
        ref = max(orig_due, today) if orig_due else today
        due_date = next_due_date(ref, body.recurrence, ref_date=orig_due).isoformat()
    elif not due_date and body.coins >= 0:
        due_date = today.isoformat()
    row = Chore(
        title=body.title.strip(),
        assigned_to=body.assigned_to,
        coins=body.coins,
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
        row.coins = body.coins
    if body.due_date is not None:
        row.due_date = body.due_date
    if body.notes is not None:
        row.notes = body.notes
    if body.recurrence is not None:
        row.recurrence = body.recurrence
        if body.recurrence:
            today = datetime.now(ZoneInfo(get_settings().tz)).date()
            orig_due = _parse_iso_date(row.due_date)
            ref = max(orig_due, today) if orig_due else today
            row.due_date = next_due_date(ref, body.recurrence, ref_date=orig_due).isoformat()
    if body.completed is not None and body.completed != row.completed:
        row.completed = body.completed
        if body.completed:
            row.completed_at = datetime.now(timezone.utc)
            # Record coin earning
            if row.assigned_to:
                occurrence_date = _occurrence_date(row)
                # If there was a chore_missed penalty recorded for this occurrence, remove it
                db.query(CoinTransaction).filter(
                    CoinTransaction.reason == "chore_missed",
                    CoinTransaction.reference_id == row.id,
                    CoinTransaction.occurrence_date.in_([occurrence_date, row.due_date]),
                ).delete(synchronize_session="fetch")

                existing = (
                    db.query(CoinTransaction)
                    .filter(
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
                    existing.person_name = row.assigned_to
                    existing.amount = row.coins
        else:
            row.completed_at = None
            occurrence_date = _occurrence_date(row)
            today_iso = datetime.now(ZoneInfo(get_settings().tz)).date().isoformat()
            db.query(CoinTransaction).filter(
                CoinTransaction.reason == "chore_completed",
                CoinTransaction.reference_id == row.id,
                CoinTransaction.occurrence_date.in_([occurrence_date, today_iso]),
            ).delete(synchronize_session="fetch")
    db.commit()
    await manager.broadcast("chores")
    await manager.broadcast("rewards")
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
async def reset_chore_dates(
    body: ChoreResetDatesRequest = ChoreResetDatesRequest(),
    _: None = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Advance all recurring chores and past-due one-off chores to today or their next upcoming scheduled date.
    """
    today = datetime.now(ZoneInfo(get_settings().tz)).date()
    chores = db.query(Chore).all()
    updated_count = 0

    for chore in chores:
        changed = False
        orig_due = _parse_iso_date(chore.due_date)

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
