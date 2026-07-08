from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Chore, CoinTransaction
from ..ws import manager

router = APIRouter(prefix="/api/chores", tags=["chores"])


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


@router.get("")
def list_chores(
    completed: bool | None = None,
    person: str | None = None,
    db: Session = Depends(get_db),
):
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
    row = Chore(
        title=body.title.strip(),
        assigned_to=body.assigned_to,
        coins=body.coins,
        due_date=body.due_date,
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
    if body.completed is not None and body.completed != row.completed:
        row.completed = body.completed
        if body.completed:
            row.completed_at = datetime.now(timezone.utc)
            # Record coin earning
            if row.assigned_to:
                txn = CoinTransaction(
                    person_name=row.assigned_to,
                    amount=row.coins,
                    reason="chore_completed",
                    reference_id=row.id,
                )
                db.add(txn)
        else:
            row.completed_at = None
            if row.assigned_to:
                db.query(CoinTransaction).filter(
                    CoinTransaction.person_name == row.assigned_to,
                    CoinTransaction.reason == "chore_completed",
                    CoinTransaction.reference_id == row.id,
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
