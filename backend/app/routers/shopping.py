import uuid

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ShoppingItem
from ..services import sync
from ..services.merge import normalize_title
from ..ws import manager

router = APIRouter(prefix="/api/shopping", tags=["shopping"])


class ItemCreate(BaseModel):
    title: str


class ItemPatch(BaseModel):
    completed: bool


def _item_dict(i: ShoppingItem) -> dict:
    return {
        "id": i.id,
        "title": i.title,
        "completed": i.completed,
        "sources": sorted({r["source"] for r in i.sources}),
    }


@router.get("")
def list_items(db: Session = Depends(get_db)):
    rows = db.query(ShoppingItem).order_by(ShoppingItem.completed, ShoppingItem.title).all()
    return [_item_dict(i) for i in rows]


@router.delete("/completed")
async def clear_completed(bg: BackgroundTasks, db: Session = Depends(get_db)):
    rows = db.query(ShoppingItem).filter(ShoppingItem.completed).all()
    for row in rows:
        bg.add_task(sync.write_shopping_completion, row, True)
        db.delete(row)
    db.commit()
    await manager.broadcast("shopping")
    return {"ok": True, "removed": len(rows)}


@router.post("")
async def add_item(body: ItemCreate, bg: BackgroundTasks, db: Session = Depends(get_db)):
    title = body.title.strip()
    norm = normalize_title(title)
    if not norm:
        raise HTTPException(400, "title required")
    row = db.query(ShoppingItem).filter(ShoppingItem.norm_title == norm).one_or_none()
    if row is None:
        row = ShoppingItem(
            title=title,
            norm_title=norm,
            sources=[{"source": "local", "external_id": str(uuid.uuid4())}],
        )
        db.add(row)
    row.completed = False
    db.commit()
    bg.add_task(sync.add_shopping_everywhere, title)
    await manager.broadcast("shopping")
    return _item_dict(row)


@router.patch("/{item_id}")
async def patch_item(
    item_id: int, body: ItemPatch, bg: BackgroundTasks, db: Session = Depends(get_db)
):
    row = db.get(ShoppingItem, item_id)
    if row is None:
        raise HTTPException(404)
    if row.completed != body.completed:
        row.completed = body.completed
        db.commit()
        bg.add_task(sync.write_shopping_completion, row, body.completed)
    await manager.broadcast("shopping")
    return _item_dict(row)


@router.delete("/{item_id}")
async def delete_item(item_id: int, bg: BackgroundTasks, db: Session = Depends(get_db)):
    row = db.get(ShoppingItem, item_id)
    if row is None:
        raise HTTPException(404)
    bg.add_task(sync.write_shopping_completion, row, True)
    db.delete(row)
    db.commit()
    await manager.broadcast("shopping")
    return {"ok": True}
