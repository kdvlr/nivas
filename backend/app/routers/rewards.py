import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..db import SessionLocal, get_db
from ..models import CalendarAccount, CalendarSelection, Chore, CoinTransaction, Person, RewardItem, utcnow
from ..utils import is_due_on
from ..ws import manager

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rewards", tags=["rewards"])


class StoreItemCreate(BaseModel):
    title: str
    coin_cost: int = 1
    emoji: str = "🎁"


class StoreItemPatch(BaseModel):
    title: str | None = None
    coin_cost: int | None = None
    emoji: str | None = None


class RedeemRequest(BaseModel):
    person_name: str
    reward_item_id: int


def _item_dict(item: RewardItem) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "coin_cost": item.coin_cost,
        "emoji": item.emoji,
        "created_at": item.created_at.isoformat() if item.created_at else None,
    }


def _get_balance_breakdown(db: Session, person_name: str) -> dict:
    """Return earned/lost/spent/balance breakdown for a person from CoinTransaction."""
    row = (
        db.query(
            func.coalesce(
                func.sum(case((CoinTransaction.reason == "chore_completed", CoinTransaction.amount), else_=0)), 0
            ).label("earned"),
            func.coalesce(
                func.sum(case((CoinTransaction.reason == "chore_missed", CoinTransaction.amount), else_=0)), 0
            ).label("lost"),
            func.coalesce(
                func.sum(case((CoinTransaction.reason == "reward_redeemed", CoinTransaction.amount), else_=0)), 0
            ).label("spent"),
            func.coalesce(func.sum(CoinTransaction.amount), 0).label("balance"),
        )
        .filter(CoinTransaction.person_name == person_name)
        .one()
    )
    return {
        "earned": int(row.earned),
        "lost": int(row.lost),  # will be negative or zero
        "spent": int(row.spent),  # will be negative or zero
        "balance": int(row.balance),
    }


# ── Balances ──────────────────────────────────────────────────────────


def person_avatars(db: Session) -> dict[str, str]:
    """person_name (lowercase) -> Google profile photo, via their assigned calendars."""
    rows = (
        db.query(CalendarSelection.person_name, CalendarAccount.picture)
        .join(CalendarAccount)
        .filter(CalendarSelection.person_name != "", CalendarAccount.picture != "")
        .all()
    )
    return {name.lower(): picture for name, picture in rows}


@router.get("/balances")
def get_balances(db: Session = Depends(get_db)):
    people = db.query(Person).order_by(Person.name).all()
    avatars = person_avatars(db)
    result = []
    for p in people:
        breakdown = _get_balance_breakdown(db, p.name)
        result.append(
            {
                "person_name": p.name,
                "color": p.color,
                "avatar_emoji": p.avatar_emoji or "",
                "avatar": avatars.get(p.name.lower(), ""),
                **breakdown,
            }
        )
    return result


# ── Store CRUD ────────────────────────────────────────────────────────


@router.get("/store")
def list_store(db: Session = Depends(get_db)):
    rows = db.query(RewardItem).order_by(RewardItem.id).all()
    return [_item_dict(r) for r in rows]


@router.post("/store")
async def create_store_item(body: StoreItemCreate, db: Session = Depends(get_db)):
    if not body.title.strip():
        raise HTTPException(400, "title required")
    row = RewardItem(
        title=body.title.strip(),
        coin_cost=body.coin_cost,
        emoji=body.emoji,
    )
    db.add(row)
    db.commit()
    await manager.broadcast("rewards")
    return _item_dict(row)


@router.patch("/store/{item_id}")
async def patch_store_item(item_id: int, body: StoreItemPatch, db: Session = Depends(get_db)):
    row = db.get(RewardItem, item_id)
    if row is None:
        raise HTTPException(404)
    if body.title is not None:
        row.title = body.title
    if body.coin_cost is not None:
        row.coin_cost = body.coin_cost
    if body.emoji is not None:
        row.emoji = body.emoji
    db.commit()
    await manager.broadcast("rewards")
    return _item_dict(row)


@router.delete("/store/{item_id}", status_code=204)
async def delete_store_item(item_id: int, db: Session = Depends(get_db)):
    row = db.get(RewardItem, item_id)
    if row is None:
        raise HTTPException(404)
    db.delete(row)
    db.commit()
    await manager.broadcast("rewards")


# ── Redemption ────────────────────────────────────────────────────────


@router.post("/redeem")
async def redeem_reward(body: RedeemRequest, db: Session = Depends(get_db)):
    item = db.get(RewardItem, body.reward_item_id)
    if item is None:
        raise HTTPException(404, "reward item not found")

    breakdown = _get_balance_breakdown(db, body.person_name)
    balance = breakdown["balance"]
    if balance < item.coin_cost:
        raise HTTPException(
            400,
            f"{body.person_name} has {balance} coin(s) but needs {item.coin_cost}",
        )

    txn = CoinTransaction(
        person_name=body.person_name,
        amount=-item.coin_cost,
        reason="reward_redeemed",
        reference_id=item.id,
        created_at=utcnow(),
    )
    db.add(txn)
    db.commit()
    await manager.broadcast("rewards")
    return {
        "id": txn.id,
        "person_name": txn.person_name,
        "reward_title": item.title,
        "reward_emoji": item.emoji,
        "coins_spent": item.coin_cost,
        "redeemed_at": txn.created_at.isoformat(),
    }


# ── Transaction history ──────────────────────────────────────────────


@router.get("/transactions")
def transaction_history(person: str | None = None, db: Session = Depends(get_db)):
    q = db.query(CoinTransaction)
    if person is not None:
        q = q.filter(CoinTransaction.person_name == person)
    rows = q.order_by(CoinTransaction.created_at.desc()).limit(50).all()
    return [
        {
            "id": t.id,
            "person_name": t.person_name,
            "amount": t.amount,
            "reason": t.reason,
            "reference_id": t.reference_id,
            "created_at": t.created_at.isoformat(),
        }
        for t in rows
    ]


# ── History (recent redemptions) ─────────────────────────────────────


@router.get("/history")
def redemption_history(db: Session = Depends(get_db)):
    rows = (
        db.query(CoinTransaction, RewardItem)
        .outerjoin(RewardItem, CoinTransaction.reference_id == RewardItem.id)
        .filter(CoinTransaction.reason == "reward_redeemed")
        .order_by(CoinTransaction.created_at.desc())
        .limit(20)
        .all()
    )
    return [
        {
            "id": txn.id,
            "person_name": txn.person_name,
            "reward_title": item.title if item else "Deleted Reward",
            "reward_emoji": item.emoji if item else "🎁",
            "coins_spent": abs(txn.amount),
            "redeemed_at": txn.created_at.isoformat(),
        }
        for txn, item in rows
    ]


# ── Missed chores check (called by scheduler) ────────────────────────


def _is_due_today(chore: Chore, today: date) -> bool:
    """Check if a recurring chore is due today based on its recurrence pattern."""
    ref_date = date.fromisoformat(chore.due_date) if chore.due_date else chore.created_at.date()
    return is_due_on(today, ref_date, chore.recurrence)


def check_missed_chores() -> None:
    """
    Check for recurring chores not completed by end of day.
    Penalise assigned person by deducting their chore's coin value.
    Then reset the chore for its next occurrence.
    Called by the scheduler daily at 23:59.
    """
    db = SessionLocal()
    try:
        today = date.today()
        today_iso = today.isoformat()

        chores = db.query(Chore).filter(Chore.recurrence != "").all()
        penalised = False

        for chore in chores:
            if not _is_due_today(chore, today):
                continue
            # Already processed today (reset already happened)
            if chore.last_reset_date == today_iso:
                continue
            # Not completed → penalty
            if not chore.completed and chore.assigned_to:
                txn = CoinTransaction(
                    person_name=chore.assigned_to,
                    amount=-chore.coins,
                    reason="chore_missed",
                    reference_id=chore.id,
                    created_at=utcnow(),
                )
                db.add(txn)
                penalised = True
                log.info("Missed chore penalty: %s owes %d coin(s) for '%s'", chore.assigned_to, chore.coins, chore.title)

            # Reset recurring chore for next occurrence
            chore.completed = False
            chore.completed_at = None
            chore.last_reset_date = today_iso

        db.commit()
        if penalised:
            manager.broadcast_threadsafe("rewards")
            manager.broadcast_threadsafe("chores")
    except Exception:
        log.exception("Error checking missed chores")
        db.rollback()
    finally:
        db.close()
