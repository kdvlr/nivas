"""Pulls each source, feeds snapshots to the merge engine, pushes write-backs."""

import asyncio
import logging

from sqlalchemy.orm import Session

from .. import sync_status
from ..config import get_settings
from ..db import SessionLocal
from ..integrations.alexa_lists import alexa
from ..integrations.icloud_reminders import icloud
from ..models import CalendarSelection, Setting, ShoppingItem, Task
from ..ws import manager
from .merge import SourceListItem, SourceTask, sync_shopping, sync_tasks

log = logging.getLogger(__name__)


def get_setting(db: Session, key: str, default=None):
    row = db.get(Setting, key)
    return row.value if row is not None else default


def set_setting(db: Session, key: str, value) -> None:
    row = db.get(Setting, key)
    if row is None:
        db.add(Setting(key=key, value=value))
    else:
        row.value = value
    db.commit()


def _shopping_list_name(db: Session) -> str:
    return get_setting(db, "icloud_shopping_list", get_settings().icloud_shopping_list)


# ---- pull syncs -------------------------------------------------------------


def sync_google_calendars() -> bool:
    from ..integrations import google_calendar

    changed = False
    with SessionLocal() as db:
        selections = db.query(CalendarSelection).filter(CalendarSelection.enabled).all()
        if not selections:
            return False
        errors = []
        for sel in selections:
            try:
                changed |= google_calendar.sync_selection(db, sel)
            except Exception as e:
                log.warning("calendar sync failed for %s: %s", sel.name, e)
                errors.append(f"{sel.name}: {e}")
        sync_status.report("google", not errors, "; ".join(errors)[:300])
    return changed


def sync_icloud() -> bool:
    changed = False
    with SessionLocal() as db:
        if icloud.status().get("error") == "no credentials configured":
            return False
        try:
            lists = icloud.get_lists()
        except Exception as e:
            log.warning("iCloud sync failed: %s", e)
            sync_status.report("icloud", False, str(e)[:300])
            return False

        shopping_name = _shopping_list_name(db)
        person_map: dict = get_setting(db, "list_person_map", {}) or {}
        task_lists = get_setting(db, "icloud_task_lists")
        if task_lists is None:
            task_lists = [name for name in lists if name != shopping_name]

        tasks: list[SourceTask] = []
        for name in task_lists:
            for r in lists.get(name, []):
                tasks.append(
                    SourceTask(
                        source="icloud",
                        external_id=r["guid"],
                        title=r["title"],
                        completed=r["completed"],
                        due_date=r["due"],
                        notes=r["notes"],
                        list_name=name,
                        person_name=person_map.get(name, ""),
                    )
                )
        changed |= sync_tasks(db, "icloud", tasks)

        shopping = [
            SourceListItem(
                source="icloud", external_id=r["guid"], title=r["title"], completed=r["completed"]
            )
            for r in lists.get(shopping_name, [])
        ]
        changed |= sync_shopping(db, "icloud", shopping)
        sync_status.report("icloud", True)
    return changed


async def sync_alexa() -> bool:
    changed = False
    if (await alexa.status()).get("error") == "not connected" and not get_settings().amazon_email:
        return False
    try:
        lists = await alexa.get_lists()
    except Exception as e:
        log.warning("Alexa sync failed: %s", e)
        sync_status.report("alexa", False, str(e)[:300])
        return False

    def do_tasks_sync(tasks_list) -> bool:
        with SessionLocal() as db:
            return sync_tasks(db, "alexa", tasks_list)

    def do_shopping_sync(shopping_list) -> bool:
        with SessionLocal() as db:
            return sync_shopping(db, "alexa", shopping_list)

    todo = lists.get("todo")
    if todo:
        tasks = [
            SourceTask(
                source="alexa",
                external_id=f"{todo['id']}:{it['id']}",
                title=it["title"],
                completed=it["completed"],
                list_name="Alexa To-do",
            )
            for it in todo["items"]
        ]
        changed |= await asyncio.to_thread(do_tasks_sync, tasks)

    shopping = lists.get("shopping")
    if shopping:
        items = [
            SourceListItem(
                source="alexa",
                external_id=f"{shopping['id']}:{it['id']}",
                title=it["title"],
                completed=it["completed"],
            )
            for it in shopping["items"]
        ]
        changed |= await asyncio.to_thread(do_shopping_sync, items)
    sync_status.report("alexa", True)
    return changed


# ---- write-backs -------------------------------------------------------------


def _split_alexa_id(external_id: str) -> tuple[str, str]:
    list_id, _, item_id = external_id.partition(":")
    return list_id, item_id


async def write_task_completion(task: Task, completed: bool) -> None:
    """Best-effort write-back; local state is already saved, source failures just log."""
    try:
        if task.source == "icloud":
            await asyncio.to_thread(icloud.set_completed, task.external_id, completed)
        elif task.source == "alexa":
            list_id, item_id = _split_alexa_id(task.external_id)
            await alexa.set_completed(list_id, item_id, completed)
    except Exception as e:
        log.warning("write-back to %s failed for task %s: %s", task.source, task.id, e)


async def write_shopping_completion(item: ShoppingItem, completed: bool) -> None:
    for ref in item.sources:
        try:
            if ref["source"] == "icloud":
                await asyncio.to_thread(icloud.set_completed, ref["external_id"], completed)
            elif ref["source"] == "alexa":
                list_id, item_id = _split_alexa_id(ref["external_id"])
                await alexa.set_completed(list_id, item_id, completed)
        except Exception as e:
            log.warning("shopping write-back to %s failed: %s", ref["source"], e)


async def add_shopping_everywhere(title: str) -> None:
    """Push a locally-added item to both sources (next sync picks up their IDs)."""
    with SessionLocal() as db:
        shopping_name = _shopping_list_name(db)
    try:
        await asyncio.to_thread(icloud.add, title, shopping_name)
    except Exception as e:
        log.warning("could not add '%s' to iCloud: %s", title, e)
    try:
        await alexa.add("shopping", title)
    except Exception as e:
        log.warning("could not add '%s' to Alexa: %s", title, e)


# ---- housekeeping ------------------------------------------------------------

COMPLETED_RETENTION_DAYS = 90


def cleanup_old_completed() -> int:
    """Delete completed items older than the retention window. Returns rows removed."""
    from datetime import datetime, timedelta, timezone

    from ..models import Chore

    cutoff = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(
        days=COMPLETED_RETENTION_DAYS
    )
    removed = 0
    with SessionLocal() as db:
        removed += (
            db.query(Task)
            .filter(Task.completed, Task.completed_at.isnot(None), Task.completed_at < cutoff)
            .delete(synchronize_session=False)
        )
        removed += (
            db.query(Chore)
            .filter(
                Chore.completed,
                Chore.recurrence == "",
                Chore.completed_at.isnot(None),
                Chore.completed_at < cutoff,
            )
            .delete(synchronize_session=False)
        )
        removed += (
            db.query(ShoppingItem)
            .filter(ShoppingItem.completed, ShoppingItem.updated_at < cutoff)
            .delete(synchronize_session=False)
        )
        db.commit()
    if removed:
        log.info("cleanup: removed %d completed items older than %d days", removed, COMPLETED_RETENTION_DAYS)
    return removed


# ---- scheduler entrypoints ---------------------------------------------------


async def job_calendar() -> None:
    if await asyncio.to_thread(sync_google_calendars):
        await manager.broadcast("calendar")


async def job_icloud() -> None:
    if await asyncio.to_thread(sync_icloud):
        await manager.broadcast("tasks")
        await manager.broadcast("shopping")


async def job_alexa() -> None:
    if await sync_alexa():
        await manager.broadcast("tasks")
        await manager.broadcast("shopping")
