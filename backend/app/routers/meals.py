from datetime import date, timedelta

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import MealPlanEntry, Recipe
from ..ws import manager

router = APIRouter(prefix="/api/meals", tags=["meals"])

SLOTS = ["breakfast", "lunch", "dinner"]


class MealPut(BaseModel):
    date: str  # YYYY-MM-DD
    slot: str
    text: str = ""
    recipe_id: int | None = None


def _entry_dict(e: MealPlanEntry, recipe: Recipe | None) -> dict:
    return {
        "date": e.date,
        "slot": e.slot,
        "text": e.text,
        "recipe_id": e.recipe_id,
        "recipe_title": recipe.title if recipe else None,
        "recipe_image": recipe.image_url if recipe else None,
    }


@router.get("")
def week(start: str | None = None, days: int = 7, db: Session = Depends(get_db)):
    start_d = date.fromisoformat(start) if start else date.today()
    dates = [(start_d + timedelta(days=i)).isoformat() for i in range(days)]
    rows = db.query(MealPlanEntry).filter(MealPlanEntry.date.in_(dates)).all()
    by_key = {(e.date, e.slot): e for e in rows}
    out = []
    for d in dates:
        slots = {}
        for slot in SLOTS:
            e = by_key.get((d, slot))
            recipe = db.get(Recipe, e.recipe_id) if e and e.recipe_id else None
            slots[slot] = _entry_dict(e, recipe) if e else None
        out.append({"date": d, "slots": slots})
    return out


@router.put("")
async def put_meal(body: MealPut, db: Session = Depends(get_db)):
    row = (
        db.query(MealPlanEntry)
        .filter(MealPlanEntry.date == body.date, MealPlanEntry.slot == body.slot)
        .one_or_none()
    )
    if not body.text and body.recipe_id is None:
        if row is not None:
            db.delete(row)
            db.commit()
        await manager.broadcast("meals")
        return {"ok": True}
    if row is None:
        row = MealPlanEntry(date=body.date, slot=body.slot)
        db.add(row)
    row.text = body.text
    row.recipe_id = body.recipe_id
    db.commit()
    await manager.broadcast("meals")
    return {"ok": True}
