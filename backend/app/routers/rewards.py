import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from ..db import SessionLocal, get_db
from ..admin_auth import require_admin
from ..models import CalendarAccount, CalendarSelection, Chore, CoinTransaction, Person, RewardItem, utcnow
from ..utils import is_due_on, next_due_date
from ..ws import manager

log = logging.getLogger(__name__)

router = APIRouter(prefix="/api/rewards", tags=["rewards"])

# Reasons written by a parent rather than earned/spent through normal play.
MANUAL_REASONS = ("manual_adjust", "manual_reset")


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


class AdjustRequest(BaseModel):
    person_name: str
    amount: int  # positive grants coins, negative takes them away
    note: str = ""


class ResetRequest(BaseModel):
    # omit person_name to reset everyone
    person_name: str | None = None
    # clear_history wipes the ledger; otherwise a balancing entry is written so
    # the history of what was earned and spent survives.
    clear_history: bool = False


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
                func.sum(
                    case(
                        (
                            (CoinTransaction.reason == "chore_completed") & (CoinTransaction.amount > 0),
                            CoinTransaction.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("earned"),
            func.coalesce(
                func.sum(
                    case(
                        (CoinTransaction.reason == "chore_missed", CoinTransaction.amount),
                        (
                            (CoinTransaction.reason == "chore_completed") & (CoinTransaction.amount < 0),
                            CoinTransaction.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("lost"),
            func.coalesce(
                func.sum(case((CoinTransaction.reason == "reward_redeemed", CoinTransaction.amount), else_=0)), 0
            ).label("spent"),
            func.coalesce(
                func.sum(
                    case(
                        (CoinTransaction.reason.in_(MANUAL_REASONS), CoinTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("adjusted"),
            func.coalesce(func.sum(CoinTransaction.amount), 0).label("balance"),
        )
        .filter(CoinTransaction.person_name == person_name)
        .one()
    )
    return {
        "earned": int(row.earned),
        "lost": int(row.lost),  # will be negative or zero
        "spent": int(row.spent),  # will be negative or zero
        "adjusted": int(row.adjusted),  # parent adjustments/resets, either sign
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
    people = (
        db.query(Person)
        .filter(Person.chores_enabled != False)
        .order_by(Person.name)
        .all()
    )
    if not people:
        return []
    avatars = person_avatars(db)
    names = [p.name for p in people]
    rows = (
        db.query(
            CoinTransaction.person_name.label("person_name"),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (CoinTransaction.reason == "chore_completed") & (CoinTransaction.amount > 0),
                            CoinTransaction.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("earned"),
            func.coalesce(
                func.sum(
                    case(
                        (CoinTransaction.reason == "chore_missed", CoinTransaction.amount),
                        (
                            (CoinTransaction.reason == "chore_completed") & (CoinTransaction.amount < 0),
                            CoinTransaction.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ).label("lost"),
            func.coalesce(
                func.sum(case((CoinTransaction.reason == "reward_redeemed", CoinTransaction.amount), else_=0)), 0
            ).label("spent"),
            func.coalesce(
                func.sum(
                    case(
                        (CoinTransaction.reason.in_(MANUAL_REASONS), CoinTransaction.amount),
                        else_=0,
                    )
                ),
                0,
            ).label("adjusted"),
            func.coalesce(func.sum(CoinTransaction.amount), 0).label("balance"),
        )
        .filter(CoinTransaction.person_name.in_(names))
        .group_by(CoinTransaction.person_name)
        .all()
    )
    breakdown_map = {
        r.person_name: {
            "earned": int(r.earned),
            "lost": int(r.lost),
            "spent": int(r.spent),
            "adjusted": int(r.adjusted),
            "balance": int(r.balance),
        }
        for r in rows
    }
    default_breakdown = {"earned": 0, "lost": 0, "spent": 0, "adjusted": 0, "balance": 0}
    result = []
    for p in people:
        breakdown = breakdown_map.get(p.name, default_breakdown)
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
async def create_store_item(body: StoreItemCreate, _: None = Depends(require_admin), db: Session = Depends(get_db)):
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
async def patch_store_item(item_id: int, body: StoreItemPatch, _: None = Depends(require_admin), db: Session = Depends(get_db)):
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
async def delete_store_item(item_id: int, _: None = Depends(require_admin), db: Session = Depends(get_db)):
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


# ── Parent controls: manual adjustments and resets ────────────────────


@router.post("/adjust")
async def adjust_balance(body: AdjustRequest, _: None = Depends(require_admin), db: Session = Depends(get_db)):
    """Grant or remove coins by hand, recorded in the ledger like any other change."""
    if body.amount == 0:
        raise HTTPException(400, "amount must not be zero")
    person = db.query(Person).filter(Person.name == body.person_name).first()
    if person is None:
        raise HTTPException(404, f"no person named {body.person_name}")

    txn = CoinTransaction(
        person_name=person.name,
        amount=body.amount,
        reason="manual_adjust",
        reference_id=None,
        created_at=utcnow(),
    )
    db.add(txn)
    db.commit()
    await manager.broadcast("rewards")
    return {"person_name": person.name, **_get_balance_breakdown(db, person.name)}


@router.post("/reset")
async def reset_balance(body: ResetRequest, _: None = Depends(require_admin), db: Session = Depends(get_db)):
    """Zero one child's coins, or everyone's when no name is given."""
    if body.person_name:
        person = db.query(Person).filter(Person.name == body.person_name).first()
        if person is None:
            raise HTTPException(404, f"no person named {body.person_name}")
        names = [person.name]
    else:
        names = [p.name for p in db.query(Person).order_by(Person.name).all()]

    for name in names:
        if body.clear_history:
            db.query(CoinTransaction).filter(CoinTransaction.person_name == name).delete(
                synchronize_session=False
            )
        else:
            balance = _get_balance_breakdown(db, name)["balance"]
            if balance != 0:
                db.add(
                    CoinTransaction(
                        person_name=name,
                        amount=-balance,
                        reason="manual_reset",
                        reference_id=None,
                        created_at=utcnow(),
                    )
                )
    db.commit()
    await manager.broadcast("rewards")
    return {
        "reset": names,
        "cleared_history": body.clear_history,
        "balances": [{"person_name": n, **_get_balance_breakdown(db, n)} for n in names],
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


def _parse_iso_date(val: str | None) -> date | None:
    if not val:
        return None
    try:
        return date.fromisoformat(val[:10])
    except ValueError:
        return None


def _is_due_today(chore: Chore, today: date) -> bool:
    """Check if a recurring chore is due today based on its recurrence pattern."""
    parsed = _parse_iso_date(chore.due_date)
    ref_date = parsed if parsed is not None else (chore.created_at.date() if chore.created_at else today)
    return is_due_on(today, ref_date, chore.recurrence)


def check_missed_chores() -> None:
    """
    Settle same-day chores at end of day (23:59):
    - Positive chores due today (recurring or one-time) lose their coin value if not completed.
    - Recurring chores reset and advance to their next scheduled occurrence.
    - One-time chores due today or earlier are removed after settlement (no overdue carryover).
    - Negative-coin penalty items never change score when unselected and reset cleanly for the next day.
    """
    db = SessionLocal()
    try:
        from zoneinfo import ZoneInfo
        from ..config import get_settings

        try:
            tz = ZoneInfo(get_settings().tz)
        except Exception:
            tz = ZoneInfo("America/Chicago")
        today = datetime.now(tz).date()
        today_iso = today.isoformat()
        tomorrow = today + timedelta(days=1)

        chores = db.query(Chore).all()
        has_changes = False
        penalized = False

        def record_missed(chore: Chore, occ_date: str) -> None:
            nonlocal penalized
            if chore.completed or not chore.assigned_to or chore.coins <= 0:
                return
            already_recorded = (
                db.query(CoinTransaction.id)
                .filter(
                    CoinTransaction.reason == "chore_missed",
                    CoinTransaction.reference_id == chore.id,
                    CoinTransaction.occurrence_date == occ_date,
                )
                .first()
            )
            if already_recorded is None:
                db.add(
                    CoinTransaction(
                        person_name=chore.assigned_to,
                        amount=-chore.coins,
                        reason="chore_missed",
                        reference_id=chore.id,
                        occurrence_date=occ_date,
                        created_at=utcnow(),
                    )
                )
                penalized = True
                log.info(
                    "Missed chore penalty: %s lost %d coin(s) for '%s'",
                    chore.assigned_to,
                    chore.coins,
                    chore.title,
                )

        for chore in chores:
            orig_due = _parse_iso_date(chore.due_date)

            if chore.coins < 0:
                # Penalty items: untouched penalties do not change total score; reset for next day
                if (orig_due is None or orig_due <= today) and chore.last_reset_date != today_iso:
                    chore.completed = False
                    chore.completed_at = None
                    chore.last_reset_date = today_iso
                    if chore.recurrence:
                        chore.due_date = next_due_date(tomorrow, chore.recurrence, ref_date=orig_due).isoformat()
                    elif orig_due is not None:
                        chore.due_date = tomorrow.isoformat()
                    has_changes = True
                continue

            if chore.recurrence:
                is_past = orig_due is not None and orig_due < today
                due_today = _is_due_today(chore, today) or (chore.due_date == today_iso)
                if not (is_past or due_today) or chore.last_reset_date == today_iso:
                    continue

                occ_date = orig_due.isoformat() if (orig_due and orig_due <= today) else today_iso
                record_missed(chore, occ_date)

                chore.completed = False
                chore.completed_at = None
                chore.last_reset_date = today_iso
                chore.due_date = next_due_date(tomorrow, chore.recurrence, ref_date=orig_due).isoformat()
                has_changes = True
            else:
                # One-time chore: if scheduled for a future day, keep in Upcoming
                if orig_due is not None and orig_due > today:
                    continue
                occ_date = orig_due.isoformat() if orig_due is not None else today_iso
                record_missed(chore, occ_date)
                db.delete(chore)
                has_changes = True

        if has_changes:
            db.commit()
            manager.broadcast_threadsafe("chores")
            if penalized:
                manager.broadcast_threadsafe("rewards")
    except Exception:
        log.exception("Error checking missed chores")
        db.rollback()
    finally:
        db.close()
