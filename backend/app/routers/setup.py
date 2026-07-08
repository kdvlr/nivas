import asyncio

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from .. import sync_status
from ..config import get_settings
from ..db import get_db
from ..integrations.alexa_lists import alexa
from ..integrations.icloud_reminders import icloud
from ..models import Person
from ..services import sync
from ..ws import manager

router = APIRouter(prefix="/api/setup", tags=["setup"])


class ICloudLogin(BaseModel):
    username: str = ""
    password: str = ""


class TwoFACode(BaseModel):
    code: str


class AmazonLogin(BaseModel):
    email: str = ""
    password: str = ""
    otp_secret: str = ""


class SettingsPut(BaseModel):
    icloud_shopping_list: str | None = None
    icloud_task_lists: list[str] | None = None
    list_person_map: dict[str, str] | None = None
    family_name: str | None = None
    secondary_tz: str | None = None
    secondary_tz_emoji: str | None = None


@router.get("/config")
def get_config(db: Session = Depends(get_db)):
    return {
        "family_name": sync.get_setting(db, "family_name", ""),
        "secondary_tz": sync.get_setting(db, "secondary_tz", "Asia/Kolkata"),
        "secondary_tz_emoji": sync.get_setting(db, "secondary_tz_emoji", "🇮🇳"),
    }


@router.get("/family-name")
def family_name(db: Session = Depends(get_db)):
    return {"name": sync.get_setting(db, "family_name", "")}


class PersonPut(BaseModel):
    name: str
    color: str


class PinVerify(BaseModel):
    pin: str


@router.get("/pin")
def pin_required():
    return {"required": bool(get_settings().setup_pin)}


@router.post("/pin/verify")
def pin_verify(body: PinVerify):
    expected = get_settings().setup_pin
    return {"ok": not expected or body.pin == expected}


@router.get("/status")
async def status(db: Session = Depends(get_db)):
    s = get_settings()
    return {
        "sync": sync_status.snapshot(),
        "icloud": icloud.status(),
        "alexa": await alexa.status(),
        "gemini_configured": bool(s.gemini_api_key),
        "gemini_model": s.gemini_model,
        "icloud_configured": bool(s.icloud_username and s.icloud_password),
        "amazon_configured": bool(s.amazon_email and s.amazon_password),
        "settings": {
            "icloud_shopping_list": sync.get_setting(
                db, "icloud_shopping_list", s.icloud_shopping_list
            ),
            "icloud_task_lists": sync.get_setting(db, "icloud_task_lists"),
            "list_person_map": sync.get_setting(db, "list_person_map", {}),
            "secondary_tz": sync.get_setting(db, "secondary_tz", "Asia/Kolkata"),
            "secondary_tz_emoji": sync.get_setting(db, "secondary_tz_emoji", "🇮🇳"),
        },
    }


@router.post("/icloud/login")
async def icloud_login(body: ICloudLogin):
    return await asyncio.to_thread(icloud.connect, body.username, body.password)


@router.post("/icloud/2fa")
async def icloud_2fa(body: TwoFACode):
    result = await asyncio.to_thread(icloud.submit_2fa, body.code)
    if result.get("connected"):
        await sync.job_icloud()
    return result


@router.get("/icloud/lists")
async def icloud_lists():
    try:
        names = await asyncio.to_thread(icloud.list_names)
        return {"lists": names, "error": ""}
    except Exception as e:
        return {"lists": [], "error": str(e)}


@router.post("/alexa/login")
async def alexa_login(body: AmazonLogin):
    print(f"DEBUG: alexa_login received email='{body.email}'")
    result = await alexa.connect(
        email=body.email or None,
        password=body.password or None,
        otp_secret=body.otp_secret or None
    )
    if result.get("connected"):
        await sync.job_alexa()
    return result


@router.put("/settings")
async def put_settings(body: SettingsPut, db: Session = Depends(get_db)):
    if body.icloud_shopping_list is not None:
        sync.set_setting(db, "icloud_shopping_list", body.icloud_shopping_list)
    if body.icloud_task_lists is not None:
        sync.set_setting(db, "icloud_task_lists", body.icloud_task_lists)
    if body.list_person_map is not None:
        sync.set_setting(db, "list_person_map", body.list_person_map)
    if body.family_name is not None:
        sync.set_setting(db, "family_name", body.family_name.strip())
    if body.secondary_tz is not None:
        sync.set_setting(db, "secondary_tz", body.secondary_tz.strip())
    if body.secondary_tz_emoji is not None:
        sync.set_setting(db, "secondary_tz_emoji", body.secondary_tz_emoji.strip())
    await manager.broadcast("setup")
    return {"ok": True}


@router.get("/people")
def get_people(db: Session = Depends(get_db)):
    from .rewards import person_avatars

    avatars = person_avatars(db)
    return [
        {"id": p.id, "name": p.name, "color": p.color, "avatar": avatars.get(p.name.lower(), "")}
        for p in db.query(Person).all()
    ]


@router.put("/people")
async def put_people(people: list[PersonPut], db: Session = Depends(get_db)):
    db.query(Person).delete()
    for p in people:
        if p.name.strip():
            db.add(Person(name=p.name.strip(), color=p.color))
    db.commit()
    await manager.broadcast("tasks")
    await manager.broadcast("chores")
    await manager.broadcast("calendar")  # calendar colors follow people
    return {"ok": True}


@router.post("/sync")
async def trigger_sync(scope: str = "all"):
    if scope in ("all", "calendar"):
        await sync.job_calendar()
    if scope in ("all", "icloud"):
        await sync.job_icloud()
    if scope in ("all", "alexa"):
        await sync.job_alexa()
    return {"ok": True}
