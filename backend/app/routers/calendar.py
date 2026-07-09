import os
import asyncio
import json
import logging

os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response
from fastapi.responses import RedirectResponse
from googleapiclient.discovery import build
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..integrations import google_calendar as gcal
from ..models import CalendarAccount, CalendarEvent, CalendarSelection, Person
from ..services import sync
from ..ws import manager

log = logging.getLogger(__name__)
router = APIRouter(prefix="/api/calendar", tags=["calendar"])

PALETTE = [
    "#f87171", "#fb923c", "#fbbf24", "#a3e635", "#4ade80", "#2dd4bf", "#38bdf8", "#818cf8",
    "#c084fc", "#f472b6", "#fb7185", "#facc15", "#34d399", "#22d3ee", "#60a5fa", "#e879f9",
]


def _person_colors(db: Session) -> dict[str, str]:
    return {p.name.lower(): p.color for p in db.query(Person).all()}


class SelectionUpdate(BaseModel):
    id: int
    enabled: bool | None = None
    color: str | None = None
    person_name: str | None = None


class EventCreate(BaseModel):
    selection_id: int
    title: str
    start: str
    end: str
    all_day: bool = False


class EventUpdate(BaseModel):
    title: str | None = None
    start: str | None = None
    end: str | None = None
    all_day: bool | None = None


def _selection_dict(sel: CalendarSelection, person_colors: dict[str, str] | None = None) -> dict:
    # a calendar assigned to a family member inherits that person's color
    color = sel.color
    if person_colors and sel.person_name:
        color = person_colors.get(sel.person_name.lower(), sel.color)
    return {
        "id": sel.id,
        "account_id": sel.account_id,
        "calendar_id": sel.calendar_id,
        "name": sel.name,
        "person_name": sel.person_name,
        "color": color,
        "enabled": sel.enabled,
    }


@router.get("/status")
def status(db: Session = Depends(get_db)):
    accounts = db.query(CalendarAccount).all()
    colors = _person_colors(db)
    return {
        "client_config": gcal.client_config_available(),
        "redirect_uri": gcal.redirect_uri(),
        "accounts": [
            {
                "id": a.id,
                "email": a.email,
                "selections": [_selection_dict(s, colors) for s in a.selections],
            }
            for a in accounts
        ],
    }


@router.get("/auth/start")
def auth_start(response: Response):
    if not gcal.client_config_available():
        raise HTTPException(400, "Google client secret not installed — see Setup instructions")
    flow = gcal.make_flow()
    url, state = flow.authorization_url(access_type="offline", prompt="consent")
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        max_age=300,
        samesite="lax",
    )
    return RedirectResponse(url)


@router.get("/auth/callback")
def auth_callback(code: str, state: str, oauth_state: str | None = Cookie(default=None), db: Session = Depends(get_db)):
    # Relax CSRF check if state cookie is missing (e.g. due to HTTPS proxy/Safari Lax cookie stripping), but enforce if present
    if oauth_state and state != oauth_state:
        raise HTTPException(400, "Invalid OAuth state. Potential CSRF protection trigger.")
    flow = gcal.make_flow(state=state)
    flow.fetch_token(code=code)
    creds = flow.credentials
    info = build("oauth2", "v2", credentials=creds, cache_discovery=False).userinfo().get().execute()
    email = info.get("email", "")
    picture = info.get("picture", "")
    account = db.query(CalendarAccount).filter(CalendarAccount.email == email).one_or_none()
    if account is None:
        account = CalendarAccount(email=email, token_json=creds.to_json(), picture=picture)
        db.add(account)
    else:
        if picture:
            account.picture = picture
        # keep the existing refresh token if Google didn't send a new one
        old = json.loads(account.token_json)
        new = json.loads(creds.to_json())
        if not new.get("refresh_token"):
            new["refresh_token"] = old.get("refresh_token")
        account.token_json = json.dumps(new)
    db.commit()

    # pre-populate this account's calendar list; primary enabled by default
    existing = {s.calendar_id for s in account.selections}
    n_existing = db.query(CalendarSelection).count()
    for i, cal in enumerate(gcal.list_calendars(account, db)):
        if cal["id"] in existing:
            continue
        db.add(
            CalendarSelection(
                account_id=account.id,
                calendar_id=cal["id"],
                name=cal["name"],
                person_name=email.split("@")[0] if cal["primary"] else "",
                color=PALETTE[(n_existing + i) % len(PALETTE)],
                enabled=cal["primary"],
            )
        )
    db.commit()
    return RedirectResponse("/#/setup")


@router.delete("/accounts/{account_id}")
def delete_account(account_id: int, db: Session = Depends(get_db)):
    account = db.get(CalendarAccount, account_id)
    if account is None:
        raise HTTPException(404)
    db.delete(account)
    db.commit()
    return {"ok": True}


@router.put("/selections")
async def update_selections(updates: list[SelectionUpdate], db: Session = Depends(get_db)):
    for u in updates:
        sel = db.get(CalendarSelection, u.id)
        if sel is None:
            continue
        if u.enabled is not None:
            sel.enabled = u.enabled
        if u.color is not None:
            sel.color = u.color
        if u.person_name is not None:
            sel.person_name = u.person_name
    db.commit()
    asyncio.get_running_loop().create_task(sync.job_calendar())
    return {"ok": True}


@router.get("/events")
def events(start: str, end: str, db: Session = Depends(get_db)):
    rows = (
        db.query(CalendarEvent)
        .join(CalendarSelection)
        .filter(CalendarSelection.enabled, CalendarEvent.start < end, CalendarEvent.end > start)
        .all()
    )
    colors = _person_colors(db)
    return [
        {
            "id": e.id,
            "selection_id": e.selection_id,
            "title": e.title,
            "start": e.start,
            "end": e.end,
            "all_day": e.all_day,
            "location": e.location,
            "color": colors.get(e.selection.person_name.lower(), e.selection.color)
            if e.selection.person_name
            else e.selection.color,
            "person_name": e.selection.person_name or e.selection.name,
        }
        for e in rows
    ]


@router.post("/events")
async def create_event(body: EventCreate, db: Session = Depends(get_db)):
    sel = db.get(CalendarSelection, body.selection_id)
    if sel is None:
        raise HTTPException(404, "calendar not found")
    try:
        row = gcal.create_event(db, sel, body.title, body.start, body.end, body.all_day)
    except Exception as e:
        log.warning("create event failed: %s", e)
        raise HTTPException(502, f"Google Calendar error: {e}")
    await manager.broadcast("calendar")
    return {"id": row.id}


@router.patch("/events/{event_id}")
async def update_event(event_id: int, body: EventUpdate, db: Session = Depends(get_db)):
    row = db.get(CalendarEvent, event_id)
    if row is None:
        raise HTTPException(404)
    try:
        gcal.update_event(db, row, body.title, body.start, body.end, body.all_day)
    except Exception as e:
        log.warning("update event failed: %s", e)
        raise HTTPException(502, f"Google Calendar error: {e}")
    await manager.broadcast("calendar")
    return {"ok": True}


@router.delete("/events/{event_id}")
async def delete_event(event_id: int, db: Session = Depends(get_db)):
    row = db.get(CalendarEvent, event_id)
    if row is None:
        raise HTTPException(404)
    try:
        gcal.delete_event(db, row)
    except Exception as e:
        log.warning("delete event failed: %s", e)
        raise HTTPException(502, f"Google Calendar error: {e}")
    await manager.broadcast("calendar")
    return {"ok": True}


@router.post("/sync")
async def manual_sync():
    await sync.job_calendar()
    return {"ok": True}
