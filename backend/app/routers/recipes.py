import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..integrations.recipe_ai import calculate_nutrition_ai, extract_recipe, fetch_html, try_scraper
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
    nutrition: dict | None = None


class NutritionUpdate(BaseModel):
    active_source: str | None = None


def _dict(r: Recipe) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "image_url": r.image_url,
        "total_time": r.total_time,
        "servings": r.servings,
        "tags": r.tags,
        "source_url": r.source_url,
        "prep_time": r.prep_time,
        "cook_time": r.cook_time,
        "ingredients": r.ingredients,
        "steps": r.steps,
        "nutrition": r.nutrition,
    }


@router.get("")
def list_recipes(db: Session = Depends(get_db)):
    rows = db.query(Recipe).order_by(Recipe.created_at.desc()).all()
    return [_dict(r) for r in rows]


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


@router.post("/{recipe_id}/nutrition/ai-estimate")
async def estimate_nutrition_ai(recipe_id: int, db: Session = Depends(get_db)):
    """Run AI nutrition estimation for a recipe and save under nutrition.ai."""
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(404, "Recipe not found")

    try:
        ai_data = await asyncio.to_thread(
            calculate_nutrition_ai,
            title=row.title,
            servings=row.servings,
            ingredients=row.ingredients or [],
            steps=row.steps or [],
        )
    except Exception as e:
        log.warning("AI nutrition calculation failed for recipe %s: %s", recipe_id, e)
        raise HTTPException(500, str(e))

    current = dict(row.nutrition or {})
    current["ai"] = ai_data
    if "active_source" not in current or current.get("active_source") != "website":
        current["active_source"] = "ai"
    row.nutrition = current
    db.commit()
    db.refresh(row)
    await manager.broadcast("recipes")
    return _dict(row)


@router.post("/{recipe_id}/nutrition")
async def calculate_or_extract_nutrition(
    recipe_id: int,
    body: NutritionUpdate | None = None,
    db: Session = Depends(get_db),
):
    """Extract website nutrition or calculate with AI, or update active_source toggle."""
    row = db.get(Recipe, recipe_id)
    if row is None:
        raise HTTPException(404, "Recipe not found")

    if body and body.active_source:
        current = dict(row.nutrition or {})
        current["active_source"] = body.active_source
        row.nutrition = current
        db.commit()
        db.refresh(row)
        await manager.broadcast("recipes")
        return _dict(row)

    current = dict(row.nutrition or {})

    # Try website extraction if source_url exists and we don't already have website nutrition
    if row.source_url and not current.get("website"):
        try:
            html = await asyncio.to_thread(fetch_html, row.source_url)
            scraped = await asyncio.to_thread(try_scraper, row.source_url, html)
            if scraped and scraped.get("nutrition") and scraped["nutrition"].get("website"):
                current["website"] = scraped["nutrition"]["website"]
                if "active_source" not in current:
                    current["active_source"] = "website"
        except Exception as e:
            log.info("Website nutrition scrape failed for recipe %s: %s", recipe_id, e)

    # If neither website nor AI nutrition exists, calculate AI estimate
    if not current.get("website") and not current.get("ai"):
        try:
            ai_data = await asyncio.to_thread(
                calculate_nutrition_ai,
                title=row.title,
                servings=row.servings,
                ingredients=row.ingredients or [],
                steps=row.steps or [],
            )
            current["ai"] = ai_data
            current["active_source"] = "ai"
        except Exception as e:
            log.warning("AI nutrition estimate failed for recipe %s: %s", recipe_id, e)
            raise HTTPException(500, str(e))

    row.nutrition = current
    db.commit()
    db.refresh(row)
    await manager.broadcast("recipes")
    return _dict(row)
