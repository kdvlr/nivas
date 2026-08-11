import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, Response, Request
from fastapi.responses import RedirectResponse, StreamingResponse
from pydantic import BaseModel
import httpx

from ..services.ytmusic import ytmusic_service
from ..services.airplay import airplay_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ytmusic", tags=["ytmusic"])

class AuthRequest(BaseModel):
    headers: str

class ToggleDeviceRequest(BaseModel):
    deviceId: str
    selected: bool

class DeviceVolumeRequest(BaseModel):
    deviceId: str
    volume: int

class MasterVolumeRequest(BaseModel):
    volume: int

class PlayRequest(BaseModel):
    videoId: str
    title: Optional[str] = "Unknown Title"
    artist: Optional[str] = "Unknown Artist"
    thumbnail: Optional[str] = None
    album: Optional[str] = None
    duration: Optional[int] = 0
    selectedDeviceIds: Optional[List[str]] = None

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
async def get_stream(video_id: str, proxy: bool = Query(False)):
    stream_url = ytmusic_service.get_stream_url(video_id)
    if not stream_url:
        raise HTTPException(status_code=404, detail="Stream URL not found for video")
    
    if not proxy:
        # Fast redirect to CDN audio stream URL
        return RedirectResponse(url=stream_url, status_code=307)
    
    # Proxy audio stream for devices or browser CORS protection
    async def stream_audio():
        async with httpx.AsyncClient(follow_redirects=True) as client:
            async with client.stream("GET", stream_url) as resp:
                async for chunk in resp.aiter_bytes():
                    yield chunk

    return StreamingResponse(stream_audio(), media_type="audio/webm")

# --- AirPlay Endpoint Control APIs ---

@router.get("/airplay/devices")
def list_airplay_devices():
    return airplay_service.get_devices()

@router.post("/airplay/devices/toggle")
def toggle_airplay_device(req: ToggleDeviceRequest):
    return airplay_service.toggle_device_selection(req.deviceId, req.selected)

@router.post("/airplay/volume/device")
def set_device_volume(req: DeviceVolumeRequest):
    updated = airplay_service.set_device_volume(req.deviceId, req.volume)
    if not updated:
        raise HTTPException(status_code=404, detail="AirPlay device not found")
    return updated

@router.post("/airplay/volume/master")
def set_master_volume(req: MasterVolumeRequest):
    new_vol = airplay_service.set_master_volume(req.volume)
    return {"masterVolume": new_vol, "devices": airplay_service.get_devices()}

@router.post("/airplay/play")
async def airplay_play(req: PlayRequest):
    stream_url = ytmusic_service.get_stream_url(req.videoId)
    if not stream_url:
        raise HTTPException(status_code=404, detail="Failed to retrieve audio stream URL")
    
    track_info = {
        "videoId": req.videoId,
        "title": req.title,
        "artist": req.artist,
        "thumbnail": req.thumbnail,
        "album": req.album,
        "duration": req.duration,
        "streamUrl": stream_url
    }
    
    status = await airplay_service.play_track(track_info, stream_url, req.selectedDeviceIds)
    return status

@router.post("/airplay/pause")
async def airplay_pause():
    return await airplay_service.pause()

@router.post("/airplay/resume")
async def airplay_resume():
    return await airplay_service.resume()

@router.get("/airplay/status")
def airplay_status():
    return airplay_service.get_playback_status()
