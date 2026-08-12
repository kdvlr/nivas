import logging
from typing import Optional, List, Any, Dict
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel
import httpx

from ..services.ytmusic import ytmusic_service
from ..services.player_engine import player_engine

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ytmusic", tags=["ytmusic"])

class AuthRequest(BaseModel):
    headers: str

class ToggleDeviceRequest(BaseModel):
    deviceId: str
    selected: bool

class HideDeviceRequest(BaseModel):
    deviceId: str
    hidden: bool

class DeviceVolumeRequest(BaseModel):
    deviceId: str
    volume: int

class MasterVolumeRequest(BaseModel):
    volume: int

class SeekRequest(BaseModel):
    seconds: float

class PlayRequest(BaseModel):
    videoId: str
    title: Optional[str] = "Unknown Title"
    artist: Optional[str] = "Unknown Artist"
    thumbnail: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[int] = 0
    queue: Optional[List[Dict[str, Any]]] = None

class QueueRequest(BaseModel):
    videoId: str
    title: Optional[str] = "Unknown Title"
    artist: Optional[str] = "Unknown Artist"
    thumbnail: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[int] = 0

class QueueUpdateRequest(BaseModel):
    queue: List[Dict[str, Any]]

@router.get("/auth")
def get_auth_status():
    return ytmusic_service.get_auth_status()

@router.post("/auth")
def save_auth(req: AuthRequest):
    success = ytmusic_service.save_auth_headers(req.headers)
    if not success:
        raise HTTPException(status_code=400, detail="Invalid headers or JSON format")
    return ytmusic_service.get_auth_status()

@router.delete("/auth")
def clear_auth():
    ytmusic_service.clear_auth()
    return ytmusic_service.get_auth_status()

@router.get("/search")
def search(q: str = Query(..., min_length=1), filter: Optional[str] = None):
    return ytmusic_service.search(query=q, filter_type=filter)

@router.get("/home")
def get_home(limit: int = Query(6, ge=1, le=20)):
    return ytmusic_service.get_home(limit=limit)

@router.get("/charts")
def get_charts(country: str = Query("US", min_length=2, max_length=5)):
    return ytmusic_service.get_charts(country=country)

@router.get("/artist/{channel_id}")
def get_artist(channel_id: str):
    data = ytmusic_service.get_artist(channel_id)
    if not data:
        raise HTTPException(status_code=404, detail="Artist not found")
    return data

@router.get("/album/{browse_id}")
def get_album(browse_id: str):
    data = ytmusic_service.get_album(browse_id)
    if not data:
        raise HTTPException(status_code=404, detail="Album not found")
    return data

@router.get("/playlist/{playlist_id}")
def get_playlist(playlist_id: str, limit: int = Query(100, ge=1, le=500)):
    data = ytmusic_service.get_playlist(playlist_id, limit=limit)
    if not data:
        raise HTTPException(status_code=404, detail="Playlist not found")
    return data

@router.get("/watch")
def get_watch(video_id: Optional[str] = None, playlist_id: Optional[str] = None):
    if not video_id and not playlist_id:
        raise HTTPException(status_code=400, detail="Must provide video_id or playlist_id")
    return ytmusic_service.get_watch_playlist(video_id=video_id, playlist_id=playlist_id)

@router.get("/lyrics/{video_id}")
def get_lyrics(video_id: str):
    return ytmusic_service.get_lyrics(video_id)

@router.get("/stream/{video_id}")
async def get_stream(video_id: str):
    stream_url = ytmusic_service.get_stream_url(video_id)
    if not stream_url:
        raise HTTPException(status_code=404, detail="Stream URL not found for video")
    return RedirectResponse(url=stream_url, status_code=307)

# --- Server-Side AirPlay & Synchronized Player Engine APIs ---

@router.get("/player/state")
def get_player_state():
    return player_engine.get_state()

@router.post("/player/play")
async def player_play(req: PlayRequest):
    return await player_engine.play_track(req.model_dump(), req.queue)

@router.post("/player/pause")
async def player_pause():
    return await player_engine.pause()

@router.post("/player/resume")
async def player_resume():
    return await player_engine.resume()

@router.post("/player/next")
async def player_next():
    return await player_engine.next_track()

@router.post("/player/queue")
def player_add_queue(req: QueueRequest):
    try:
        return player_engine.add_to_queue(req.model_dump())
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

@router.post("/player/queue/next")
def player_play_next(req: QueueRequest):
    try:
        return player_engine.add_to_queue(req.model_dump(), play_next=True)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

@router.put("/player/queue")
def player_replace_queue(req: QueueUpdateRequest):
    try:
        return player_engine.replace_queue(req.queue)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error

@router.post("/player/prev")
async def player_prev():
    return await player_engine.prev_track()

@router.post("/player/seek")
async def player_seek(req: SeekRequest):
    return await player_engine.seek(req.seconds)

@router.get("/airplay/devices")
def list_airplay_devices():
    return player_engine.get_state()["devices"]

@router.post("/airplay/devices/toggle")
def toggle_airplay_device(req: ToggleDeviceRequest):
    return player_engine.toggle_device(req.deviceId, req.selected)

@router.post("/airplay/devices/hide")
def hide_airplay_device(req: HideDeviceRequest):
    return player_engine.set_device_hidden(req.deviceId, req.hidden)

@router.post("/airplay/volume/device")
def set_device_volume(req: DeviceVolumeRequest):
    return player_engine.set_device_volume(req.deviceId, req.volume)

@router.post("/airplay/volume/master")
def set_master_volume(req: MasterVolumeRequest):
    return player_engine.set_master_volume(req.volume)
