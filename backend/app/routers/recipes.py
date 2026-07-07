import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..integrations.recipe_ai import extract_recipe
from ..models import Recipe
from ..ws import manager

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/recipes", tags=["recipes"])


class RecipeFromUrl(BaseModel):
    url: str


class RecipeManual(BaseModel):
    title: str
    servings: str = ""
    prep_time: str = ""
    cook_time: str = ""
    total_time: str = ""
    ingredients: list[str] = []
    steps: list[str] = []
    tags: list[str] = []
    image_url: str = ""
    source_url: str = ""


def _dict(r: Recipe, full: bool = True) -> dict:
    d = {
        "id": r.id,
        "title": r.title,
        "image_url": r.image_url,
        "total_time": r.total_time,
        "servings": r.servings,
        "tags": r.tags,
        "source_url": r.source_url,
    }
    if full:
        d.update(
            {
                "prep_time": r.prep_time,
                "cook_time": r.cook_time,
                "ingredients": r.ingredients,
                "steps": r.steps,
            }
        )
    return d


@router.get("")
def list_recipes(db: Session = Depends(get_db)):
    rows = db.query(Recipe).order_by(Recipe.created_at.desc()).all()
    return [_dict(r, full=False) for r in rows]


@router.get("/{recipe_id}")
def get_recipe(recipe_id: int, db: Session = Depends(get_db)):
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(404)
    return _dict(row)


@router.post("")
async def save_from_url(body: RecipeFromUrl, db: Session = Depends(get_db)):
    url = body.url.strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "enter a full recipe URL")
    try:
        data = await asyncio.to_thread(extract_recipe, url)
    except Exception as e:
        log.warning("recipe extraction failed for %s: %s", url, e)
        raise HTTPException(422, str(e))
    row = Recipe(**data)
    db.add(row)
    db.commit()
    await manager.broadcast("recipes")
    return _dict(row)


@router.post("/manual")
async def save_manual(body: RecipeManual, db: Session = Depends(get_db)):
    row = Recipe(**body.model_dump())
    db.add(row)
    db.commit()
    await manager.broadcast("recipes")
    return _dict(row)


@router.delete("/{recipe_id}")
async def delete_recipe(recipe_id: int, db: Session = Depends(get_db)):
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(404)
    db.delete(row)
    db.commit()
    await manager.broadcast("recipes")
    return {"ok": True}
