"""Source-agnostic merging of tasks and shopping items.

Sources hand in full snapshots of their current items; these functions reconcile
them with the local DB. Local completions are written back by the routers, so a
snapshot that still contains a locally-completed item does not resurrect it
unless the source itself changed after our completion.
"""

import re
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ..models import ShoppingItem, Task


@dataclass
class SourceTask:
    source: str  # icloud | alexa
    external_id: str
    title: str
    completed: bool = False
    due_date: str = ""
    notes: str = ""
    list_name: str = ""
    person_name: str = ""


@dataclass
class SourceListItem:
    source: str
    external_id: str
    title: str
    completed: bool = False


def normalize_title(title: str) -> str:
    """Dedupe key: lowercase, collapse whitespace, strip punctuation and quantities like '2x'."""
    t = title.strip().lower()
    t = re.sub(r"^\d+\s*x?\s+", "", t)
    t = re.sub(r"[^\w\s]", "", t)
    t = re.sub(r"\s+", " ", t)
    return t


def sync_tasks(db: Session, source: str, snapshot: list[SourceTask]) -> bool:
    """Reconcile one source's task snapshot. Returns True if anything changed."""
    changed = False
    seen_ids = set()
    for st in snapshot:
        seen_ids.add(st.external_id)
        row = (
            db.query(Task)
            .filter(Task.source == source, Task.external_id == st.external_id)
            .one_or_none()
        )
        if row is None:
            # Never import items that were already completed before we first saw
            # them — keeps years of old completed reminders out of the dashboard.
            if st.completed:
                continue
            row = Task(
                source=source,
                external_id=st.external_id,
                title=st.title,
                completed=st.completed,
                completed_at=datetime.now(timezone.utc) if st.completed else None,
                due_date=st.due_date,
                notes=st.notes,
                list_name=st.list_name,
                person_name=st.person_name,
            )
            db.add(row)
            changed = True
            continue
        updates = {
            "title": st.title,
            "due_date": st.due_date,
            "notes": st.notes,
            "list_name": st.list_name,
        }
        if st.person_name:
            updates["person_name"] = st.person_name
        for attr, val in updates.items():
            if getattr(row, attr) != val:
                setattr(row, attr, val)
                changed = True
        if row.completed != st.completed:
            row.completed = st.completed
            row.completed_at = datetime.now(timezone.utc) if st.completed else None
            changed = True

    # Items no longer present in the source were deleted there.
    stale = (
        db.query(Task)
        .filter(Task.source == source, Task.external_id.notin_(seen_ids))
        .all()
    )
    for row in stale:
        db.delete(row)
        changed = True

    db.commit()
    return changed


def sync_shopping(db: Session, source: str, snapshot: list[SourceListItem]) -> bool:
    """Reconcile one source's shopping snapshot into the deduped combined list.

    Sources like iCloud keep every completed purchase forever, so the same title
    can appear many times (once open, dozens completed). Aggregate by normalized
    title first — an item counts as open if ANY occurrence is open — and never
    import titles that only exist as completed history.
    """
    changed = False
    agg: dict[str, dict] = {}
    for item in snapshot:
        norm = normalize_title(item.title)
        if not norm:
            continue
        a = agg.setdefault(
            norm, {"title": item.title, "open": False, "external_id": item.external_id}
        )
        if not item.completed:
            a["open"] = True
            a["external_id"] = item.external_id  # write-backs target the open occurrence

    for norm, a in agg.items():
        row = db.query(ShoppingItem).filter(ShoppingItem.norm_title == norm).one_or_none()
        ref = {"source": source, "external_id": a["external_id"]}
        if row is None:
            if not a["open"]:
                continue  # completed-only history; don't import
            db.add(ShoppingItem(title=a["title"], norm_title=norm, completed=False, sources=[ref]))
            changed = True
            continue
        had_ref = any(r["source"] == source for r in row.sources)
        if a["open"] or had_ref:
            refs = [r for r in row.sources if r["source"] != source] + [ref]
            if refs != row.sources:
                row.sources = refs
                changed = True
        if a["open"] and row.completed:
            # re-added (or still open) in the source reactivates it everywhere
            row.completed = False
            changed = True
        elif not a["open"] and not row.completed and had_ref:
            # a linked item was completed on the source side (e.g. checked off on a phone)
            row.completed = True
            changed = True

    # Drop this source's refs from items it no longer contains at all.
    seen_norms = set(agg)
    for row in db.query(ShoppingItem).filter(ShoppingItem.norm_title.notin_(seen_norms)).all():
        refs = [r for r in row.sources if r["source"] != source]
        if refs != row.sources:
            row.sources = refs
            changed = True
            if not refs:  # gone from every source
                db.delete(row)

    db.commit()
    return changed
