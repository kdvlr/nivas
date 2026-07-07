import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Task
from ..services import sync
from ..ws import manager

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class TaskCreate(BaseModel):
    title: str
    due_date: str = ""
    person_name: str = ""
    list_name: str = "Dashboard"


class TaskPatch(BaseModel):
    completed: bool | None = None
    title: str | None = None
    due_date: str | None = None
    person_name: str | None = None


def _task_dict(t: Task) -> dict:
    return {
        "id": t.id,
        "source": t.source,
        "list_name": t.list_name,
        "title": t.title,
        "notes": t.notes,
        "due_date": t.due_date,
        "person_name": t.person_name,
        "completed": t.completed,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }


@router.get("")
def list_tasks(range: str = "all", db: Session = Depends(get_db)):
    """range=today: due today/overdue/undated + completed today. range=week: next 7 days."""
    now_local = datetime.now(ZoneInfo(get_settings().tz))
    today = now_local.date().isoformat()
    rows = db.query(Task).order_by(Task.due_date, Task.title).all()

    def visible(t: Task) -> bool:
        if t.completed:
            # keep completed items on the board for 5 days
            done = t.completed_at.replace(tzinfo=timezone.utc) if t.completed_at else None
            if not done:
                return False
            cutoff = now_local - timedelta(days=5)
            return done.astimezone(ZoneInfo(get_settings().tz)) >= cutoff
        if range == "today":
            return not t.due_date or t.due_date[:10] <= today
        if range == "week":
            week_end = (now_local.date() + timedelta(days=7)).isoformat()
            return not t.due_date or t.due_date[:10] <= week_end
        return True

    return {"today": today, "tasks": [_task_dict(t) for t in rows if visible(t)]}


@router.post("")
async def create_task(body: TaskCreate, db: Session = Depends(get_db)):
    row = Task(
        source="local",
        external_id=str(uuid.uuid4()),
        title=body.title.strip(),
        due_date=body.due_date,
        person_name=body.person_name,
        list_name=body.list_name,
    )
    if not row.title:
        raise HTTPException(400, "title required")
    db.add(row)
    db.commit()
    await manager.broadcast("tasks")
    return _task_dict(row)


@router.patch("/{task_id}")
async def patch_task(
    task_id: int, body: TaskPatch, bg: BackgroundTasks, db: Session = Depends(get_db)
):
    row = db.get(Task, task_id)
    if row is None:
        raise HTTPException(404)
    if body.title is not None and row.source == "local":
        row.title = body.title
    if body.due_date is not None and row.source == "local":
        row.due_date = body.due_date
    if body.person_name is not None:
        row.person_name = body.person_name
    if body.completed is not None and body.completed != row.completed:
        row.completed = body.completed
        row.completed_at = datetime.now(timezone.utc) if body.completed else None
        if row.source in ("icloud", "alexa"):
            bg.add_task(sync.write_task_completion, row, body.completed)
    db.commit()
    await manager.broadcast("tasks")
    return _task_dict(row)


@router.delete("/{task_id}")
async def delete_task(task_id: int, db: Session = Depends(get_db)):
    row = db.get(Task, task_id)
    if row is None:
        raise HTTPException(404)
    if row.source != "local":
        raise HTTPException(400, "only dashboard-created tasks can be deleted here")
    db.delete(row)
    db.commit()
    await manager.broadcast("tasks")
    return {"ok": True}
