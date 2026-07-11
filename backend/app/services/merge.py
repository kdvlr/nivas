"""Source-agnostic merging of tasks and shopping items.

Sources hand in full snapshots of their current items; these functions reconcile
them with the local DB. Local completions are written back by the routers, so a
snapshot that still contains a locally-completed item does not resurrect it
unless the source itself changed after our completion.
"""

import re
from dataclasses import dataclass
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
    # Load every existing row for this source once, keyed by external_id, instead
    # of a SELECT per snapshot item (snapshots can be hundreds of items).
    existing = {
        row.external_id: row
        for row in db.query(Task).filter(Task.source == source).all()
    }
    for st in snapshot:
        seen_ids.add(st.external_id)
        row = existing.get(st.external_id)
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

    # Items no longer present in the source were deleted there. Use the rows we
    # already loaded rather than a NOT IN query with hundreds of bound params.
    for ext_id, row in existing.items():
        if ext_id not in seen_ids:
            db.delete(row)
            changed = True

    db.commit()
    return changed


def sync_shopping(db: Session, source: str, snapshot: list[SourceListItem]) -> tuple[bool, list[int], list[tuple[str, str]]]:
    """Reconcile one source's shopping snapshot into the deduped combined list.

    Sources like iCloud keep every completed purchase forever, so the same title
    can appear many times (once open, dozens completed). Aggregate by normalized
    title first — an item counts as open if ANY occurrence is open — and never
    import titles that only exist as completed history.
    """
    changed = False
    completed_ids = []
    new_items = []

    # Single pass over the snapshot: normalize each title once, remember a display
    # title per norm, and collect open external IDs. (Normalizing runs 3 regexes,
    # so the old per-new-item `next(... normalize_title ...)` rescan was O(n²).)
    open_refs: dict[str, list[dict]] = {}
    title_for_norm: dict[str, str] = {}
    all_norms: set[str] = set()
    for item in snapshot:
        norm = normalize_title(item.title)
        if not norm:
            continue
        all_norms.add(norm)
        title_for_norm.setdefault(norm, item.title)
        if not item.completed:
            open_refs.setdefault(norm, []).append({"source": source, "external_id": item.external_id})

    # Load all matching rows in one query rather than a SELECT per norm.
    rows_by_norm = {
        row.norm_title: row
        for row in db.query(ShoppingItem).filter(ShoppingItem.norm_title.in_(all_norms)).all()
    } if all_norms else {}

    # Now reconcile with the database
    for norm in all_norms:
        row = rows_by_norm.get(norm)
        active_refs = open_refs.get(norm, [])
        is_open = len(active_refs) > 0

        if row is None:
            if not is_open:
                continue  # completed-only history; don't import
            title = title_for_norm[norm]
            db.add(ShoppingItem(title=title, norm_title=norm, completed=False, sources=active_refs))
            changed = True
            new_items.append((title, source))
            continue

        other_refs = [r for r in row.sources if r["source"] != source]
        had_ref = any(r["source"] == source for r in row.sources)

        if is_open:
            new_refs = other_refs + active_refs
            if new_refs != row.sources:
                row.sources = new_refs
                changed = True
            if row.completed:
                row.completed = False
                changed = True
                new_items.append((row.title, source))
        else:
            # Item is completed or inactive on this source
            if had_ref:
                if other_refs != row.sources:
                    row.sources = other_refs
                    changed = True
                if not row.completed:
                    row.completed = True
                    completed_ids.append(row.id)
                    changed = True

    # Drop this source's refs from items it no longer contains at all.
    for row in db.query(ShoppingItem).filter(ShoppingItem.norm_title.notin_(all_norms)).all():
        had_ref = any(r["source"] == source for r in row.sources)
        if had_ref:
            refs = [r for r in row.sources if r["source"] != source]
            row.sources = refs
            changed = True
            if not refs:
                db.delete(row)
            elif not row.completed:
                row.completed = True
                completed_ids.append(row.id)

    db.commit()
    return changed, completed_ids, new_items
