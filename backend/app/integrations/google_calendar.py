"""Google Calendar: OAuth (multi-account), incremental sync, event CRUD."""

import json
import logging

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy.orm import Session

from ..config import get_settings
from ..models import CalendarAccount, CalendarEvent, CalendarSelection

log = logging.getLogger(__name__)

SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",  # profile photo for avatars
    "openid",
]


def redirect_uri() -> str:
    return f"{get_settings().base_url}/api/calendar/auth/callback"


def client_config_available() -> bool:
    return get_settings().google_client_secret_file.exists()


def make_flow(state: str | None = None) -> Flow:
    return Flow.from_client_secrets_file(
        str(get_settings().google_client_secret_file),
        scopes=SCOPES,
        state=state,
        redirect_uri=redirect_uri(),
        autogenerate_code_verifier=False,
    )


def credentials_for(account: CalendarAccount, db: Session) -> Credentials:
    creds = Credentials.from_authorized_user_info(json.loads(account.token_json), SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        account.token_json = creds.to_json()
        db.commit()
    return creds


def service_for(account: CalendarAccount, db: Session):
    return build("calendar", "v3", credentials=credentials_for(account, db), cache_discovery=False)


def list_calendars(account: CalendarAccount, db: Session) -> list[dict]:
    svc = service_for(account, db)
    items = svc.calendarList().list().execute().get("items", [])
    return [
        {"id": c["id"], "name": c.get("summary", c["id"]), "primary": c.get("primary", False)}
        for c in items
    ]


def _event_times(ev: dict) -> tuple[str, str, bool]:
    start, end = ev.get("start", {}), ev.get("end", {})
    if "date" in start:
        return start["date"], end.get("date", start["date"]), True
    return start.get("dateTime", ""), end.get("dateTime", ""), False


def sync_selection(db: Session, selection: CalendarSelection) -> bool:
    """Incremental sync of one calendar into the local event cache."""
    svc = service_for(selection.account, db)
    changed = False
    page_token = None
    sync_token = selection.sync_token or None
    try:
        while True:
            kwargs: dict = {"calendarId": selection.calendar_id, "singleEvents": True}
            if sync_token:
                kwargs["syncToken"] = sync_token
            else:
                kwargs["maxResults"] = 2500
            if page_token:
                kwargs["pageToken"] = page_token
            resp = svc.events().list(**kwargs).execute()
            for ev in resp.get("items", []):
                ext_id = ev["id"]
                row = (
                    db.query(CalendarEvent)
                    .filter(
                        CalendarEvent.selection_id == selection.id,
                        CalendarEvent.external_id == ext_id,
                    )
                    .one_or_none()
                )
                if ev.get("status") == "cancelled":
                    if row is not None:
                        db.delete(row)
                        changed = True
                    continue
                start, end, all_day = _event_times(ev)
                if not start:
                    continue
                if row is None:
                    row = CalendarEvent(selection_id=selection.id, external_id=ext_id)
                    db.add(row)
                new = {
                    "title": ev.get("summary", "(no title)"),
                    "start": start,
                    "end": end,
                    "all_day": all_day,
                    "location": ev.get("location", ""),
                    "description": ev.get("description", ""),
                }
                if any(getattr(row, k) != v for k, v in new.items()):
                    for k, v in new.items():
                        setattr(row, k, v)
                    changed = True
            page_token = resp.get("nextPageToken")
            if not page_token:
                selection.sync_token = resp.get("nextSyncToken", "")
                break
    except HttpError as e:
        if e.resp.status == 410:  # sync token expired: full resync
            selection.sync_token = ""
            db.query(CalendarEvent).filter(CalendarEvent.selection_id == selection.id).delete()
            db.commit()
            return sync_selection(db, selection)
        raise
    db.commit()
    return changed


def _to_google_body(
    title: str, start: str, end: str, all_day: bool, description: str = "", location: str = ""
) -> dict:
    tz = get_settings().tz
    if all_day:
        times = {"start": {"date": start[:10]}, "end": {"date": end[:10]}}
    else:
        times = {
            "start": {"dateTime": start, "timeZone": tz},
            "end": {"dateTime": end, "timeZone": tz},
        }
    return {
        "summary": title,
        "description": description,
        "location": location,
        **times,
    }


def create_event(
    db: Session,
    selection: CalendarSelection,
    title: str,
    start: str,
    end: str,
    all_day: bool,
    description: str = "",
    location: str = "",
) -> CalendarEvent:
    svc = service_for(selection.account, db)
    ev = (
        svc.events()
        .insert(
            calendarId=selection.calendar_id,
            body=_to_google_body(title, start, end, all_day, description, location),
        )
        .execute()
    )
    start_s, end_s, all_day_s = _event_times(ev)
    row = CalendarEvent(
        selection_id=selection.id,
        external_id=ev["id"],
        title=ev.get("summary", title),
        start=start_s,
        end=end_s,
        all_day=all_day_s,
        description=ev.get("description", description),
        location=ev.get("location", location),
    )
    db.add(row)
    db.commit()
    return row


def update_event(
    db: Session,
    event: CalendarEvent,
    title: str | None = None,
    start: str | None = None,
    end: str | None = None,
    all_day: bool | None = None,
    description: str | None = None,
    location: str | None = None,
) -> CalendarEvent:
    selection = event.selection
    svc = service_for(selection.account, db)
    new_title = title if title is not None else event.title
    new_start = start if start is not None else event.start
    new_end = end if end is not None else event.end
    new_all_day = all_day if all_day is not None else event.all_day
    new_description = description if description is not None else event.description
    new_location = location if location is not None else event.location
    svc.events().patch(
        calendarId=selection.calendar_id,
        eventId=event.external_id,
        body=_to_google_body(
            new_title, new_start, new_end, new_all_day, new_description, new_location
        ),
    ).execute()
    event.title = new_title
    event.start = new_start
    event.end = new_end
    event.all_day = new_all_day
    event.description = new_description
    event.location = new_location
    db.commit()
    return event


def delete_event(db: Session, event: CalendarEvent) -> None:
    selection = event.selection
    svc = service_for(selection.account, db)
    try:
        svc.events().delete(calendarId=selection.calendar_id, eventId=event.external_id).execute()
    except HttpError as e:
        if e.resp.status not in (404, 410):
            raise
    db.delete(event)
    db.commit()
