from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from ..services.kids_daily_service import kids_daily_service

router = APIRouter(prefix="/api/kids-daily", tags=["kids-daily"])

class SettingsUpdateRequest(BaseModel):
    force_banner_active: Optional[bool] = None
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None

@router.get("/today")
def get_today_content(date: Optional[str] = None):
    """
    Public endpoint for the Home banner.
    Returns today's word, fun fact, and STEM questions (without revealing answers).
    """
    payload = kids_daily_service.get_today_payload(date_str=date)
    content = payload.get("content", {})
    
    # Strip answers for public view
    public_stem_5yo = {
        "topic": content.get("stem_5yo", {}).get("topic", "Science"),
        "question": content.get("stem_5yo", {}).get("question", ""),
        "hint": content.get("stem_5yo", {}).get("hint", ""),
    }
    public_stem_9yo = {
        "topic": content.get("stem_9yo", {}).get("topic", "STEM"),
        "question": content.get("stem_9yo", {}).get("question", ""),
        "hint": content.get("stem_9yo", {}).get("hint", ""),
    }

    return {
        "date": payload.get("date"),
        "is_active_window": payload.get("is_active_window"),
        "force_active": payload.get("force_active"),
        "word_of_the_day": content.get("word_of_the_day", {}),
        "fun_fact": content.get("fun_fact", {}),
        "stem_5yo": public_stem_5yo,
        "stem_9yo": public_stem_9yo,
    }

@router.get("/admin")
def get_admin_content(date: Optional[str] = None):
    """
    Admin endpoint for Setup view (protected behind PIN on frontend).
    Returns full content including answers and parent explanations.
    """
    payload = kids_daily_service.get_today_payload(date_str=date)
    return {
        **payload,
        "settings": kids_daily_service.get_settings(),
    }

@router.post("/regenerate")
@router.post("/admin/regenerate")
def regenerate_content(date: Optional[str] = None):
    """
    Force re-generation of today's content with Gemini AI.
    """
    payload = kids_daily_service.get_today_payload(date_str=date, force_regenerate=True)
    return {
        **payload,
        "settings": kids_daily_service.get_settings(),
    }

@router.get("/settings")
def get_settings():
    return kids_daily_service.get_settings()

@router.post("/settings")
def update_settings(body: SettingsUpdateRequest):
    updates = {}
    if body.force_banner_active is not None:
        updates["force_banner_active"] = body.force_banner_active
    if body.gemini_api_key is not None:
        updates["gemini_api_key"] = body.gemini_api_key
    if body.gemini_model is not None:
        updates["gemini_model"] = body.gemini_model
    return kids_daily_service.update_settings(updates)
