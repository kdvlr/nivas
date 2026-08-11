import asyncio
import json
import logging
import os
import subprocess
import time
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..ws import manager
from .ytmusic import ytmusic_service

logger = logging.getLogger(__name__)

class AirPlayDevice:
    def __init__(self, identifier: str, name: str, address: str, port: int = 7000, model: str = "AirPlay Speaker"):
        self.id = str(identifier)
        self.name = name
        self.address = str(address)
        self.port = port
        self.model = model
        self.is_selected = False
        self.volume = 70
        self.is_connected = False
        self.last_seen = time.time()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "address": self.address,
            "port": self.port,
            "model": self.model,
            "isSelected": self.is_selected,
            "volume": self.volume,
            "isConnected": self.is_connected,
            "lastSeen": self.last_seen
        }

class PlayerEngine:
    def __init__(self):
        self.is_playing: bool = False
        self.current_track: Optional[Dict[str, Any]] = None
        self.queue: List[Dict[str, Any]] = []
        self.elapsed_seconds: float = 0
        self.duration_seconds: float = 0
        self.master_volume: int = 70
        self.devices: Dict[str, AirPlayDevice] = {}
        self.active_targets: List[str] = []
        
        self._scanner_task: Optional[asyncio.Task] = None
        self._ticker_task: Optional[asyncio.Task] = None
        self._play_task: Optional[asyncio.Task] = None
        self._stream_tasks: List[asyncio.Task] = []

    def start(self):
        loop = asyncio.get_event_loop()
        if self._scanner_task is None or self._scanner_task.done():
            self._scanner_task = loop.create_task(self._device_scanner_loop())
        if self._ticker_task is None or self._ticker_task.done():
            self._ticker_task = loop.create_task(self._playback_ticker())

    def stop(self):
        if self._scanner_task and not self._scanner_task.done():
            self._scanner_task.cancel()
        if self._ticker_task and not self._ticker_task.done():
            self._ticker_task.cancel()
        self._stop_current_stream()

    def _stop_current_stream(self):
        if self._play_task and not self._play_task.done():
            self._play_task.cancel()
            self._play_task = None

        for task in self._stream_tasks:
            if not task.done():
                task.cancel()
        self._stream_tasks.clear()

    async def _device_scanner_loop(self):
        while True:
            try:
                await self.scan_devices()
                await asyncio.sleep(10)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pyatv scanner loop: {e}")
                await asyncio.sleep(10)

    async def scan_devices(self) -> List[Dict[str, Any]]:
        try:
            import pyatv
            loop = asyncio.get_running_loop()
            results = await pyatv.scan(loop, timeout=3)
            
            discovered_addresses = set()
            for conf in results:
                addr = str(conf.address)
                name = str(conf.name)
                
                # Filter out TV and MacBook devices (case-insensitive)
                name_lower = name.lower()
                if "tv" in name_lower or "macbook" in name_lower:
                    continue

                if addr in discovered_addresses:
                    continue
                discovered_addresses.add(addr)

                dev_id = addr
                model = str(conf.device_info.model or "AirPlay Speaker") if conf.device_info else "AirPlay Speaker"

                if dev_id in self.devices:
                    # Update existing device info while preserving selection & volume
                    dev = self.devices[dev_id]
                    dev.name = name
                    dev.model = model
                    dev.last_seen = time.time()
                else:
                    # Register new discovered device
                    dev = AirPlayDevice(
                        identifier=dev_id,
                        name=name,
                        address=addr,
                        port=7000,
                        model=model
                    )
                    self.devices[dev_id] = dev
                    logger.info(f"Discovered AirPlay speaker: {name} ({addr})")

            self._broadcast_state()
        except Exception as e:
            logger.error(f"AirPlay scan error: {e}")
        return self.get_state()["devices"]

    async def _playback_ticker(self):
        while True:
            try:
                await asyncio.sleep(1)
                if self.is_playing and self.current_track:
                    self.elapsed_seconds += 1
                    if self.duration_seconds > 0 and self.elapsed_seconds >= self.duration_seconds:
                        await self.next_track()
                    else:
                        self._broadcast_state()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in playback ticker: {e}")

    def _broadcast_state(self):
        try:
            state = self.get_state()
            manager.broadcast_json({"type": "player_state", "payload": state})
        except Exception:
            pass

    def get_state(self) -> Dict[str, Any]:
        return {
            "isPlaying": self.is_playing,
            "currentTrack": self.current_track,
            "queue": self.queue,
            "elapsedSeconds": self.elapsed_seconds,
            "durationSeconds": self.duration_seconds,
            "masterVolume": self.master_volume,
            "activeTargets": self.active_targets,
            "devices": [dev.to_dict() for dev in sorted(self.devices.values(), key=lambda d: d.name)]
        }

    async def play_track(self, track: Dict[str, Any], queue: Optional[List[Dict[str, Any]]] = None):
        video_id = track.get("videoId")
        if not video_id:
            return self.get_state()

        self._stop_current_stream()

        self.current_track = {
            "videoId": video_id,
            "title": track.get("title", "Unknown Title"),
            "artist": track.get("artist", "Unknown Artist"),
            "thumbnail": track.get("thumbnail"),
            "album": track.get("album"),
            "duration": track.get("duration", 0),
        }
        self.elapsed_seconds = 0
        self.duration_seconds = track.get("duration", 0) or 180
        self.is_playing = True
        
        if queue is not None:
            self.queue = queue

        # Launch transcode and streaming workflow asynchronously in background task
        loop = asyncio.get_running_loop()
        self._play_task = loop.create_task(self._orchestrate_playback(video_id, self.current_track))

        self._broadcast_state()
        return self.get_state()

    async def _orchestrate_playback(self, video_id: str, track_info: Dict[str, Any]):
        try:
            stream_url = ytmusic_service.get_stream_url(video_id)
            if not stream_url:
                logger.error(f"Could not extract stream URL for track {video_id}")
                self.is_playing = False
                self._broadcast_state()
                return

            mp3_path = f"/tmp/ytmusic_{video_id}.mp3"
            logger.info(f"Transcoding track '{track_info['title']}' to MP3...")

            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._transcode_to_mp3, stream_url, mp3_path)

            if not os.path.exists(mp3_path) or os.path.getsize(mp3_path) == 0:
                logger.error(f"Transcoding produced empty file for {video_id}")
                self.is_playing = False
                self._broadcast_state()
                return

            logger.info(f"Transcode complete. Streaming '{track_info['title']}' to {len(self.active_targets)} selected AirPlay speakers")

            for dev_id in self.active_targets:
                device = self.devices.get(dev_id)
                if device:
                    task = loop.create_task(self._stream_to_device(device, mp3_path, track_info))
                    self._stream_tasks.append(task)
        except Exception as e:
            logger.error(f"Error orchestrating playback: {e}")
            self.is_playing = False
            self._broadcast_state()

    def _transcode_to_mp3(self, stream_url: str, output_path: str):
        try:
            cmd = ["ffmpeg", "-y", "-i", stream_url, "-vn", "-acodec", "libmp3lame", "-b:a", "320k", output_path]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            logger.info(f"Transcoded audio successfully to {output_path}")
        except Exception as e:
            logger.error(f"FFmpeg transcoding error: {e}")

    async def _stream_to_device(self, device: AirPlayDevice, mp3_path: str, track_info: Dict[str, Any]):
        try:
            import pyatv
            from pyatv.interface import MediaMetadata
            loop = asyncio.get_running_loop()
            results = await pyatv.scan(loop, hosts=[device.address], timeout=3)
            if results:
                conf = results[0]
                atv = await pyatv.connect(conf, loop=loop)
                try:
                    device.is_connected = True
                    self._broadcast_state()
                    
                    meta = MediaMetadata(
                        title=track_info.get("title", "YouTube Music"),
                        artist=track_info.get("artist", "Nivas"),
                        album=track_info.get("album") or "YouTube Music",
                        duration=int(self.duration_seconds)
                    )
                    
                    logger.info(f"Starting pyatv stream to speaker: {device.name} ({device.address})")
                    await atv.stream.stream_file(mp3_path, metadata=meta, override_missing_metadata=True)
                    logger.info(f"Finished pyatv stream to speaker: {device.name}")
                finally:
                    atv.close()
                    device.is_connected = False
                    self._broadcast_state()
        except Exception as e:
            logger.warning(f"Error streaming to AirPlay speaker {device.name} ({device.address}): {e}")

    async def pause(self):
        self.is_playing = False
        self._broadcast_state()
        return self.get_state()

    async def resume(self):
        if self.current_track:
            self.is_playing = True
        self._broadcast_state()
        return self.get_state()

    async def seek(self, seconds: float):
        self.elapsed_seconds = max(0, min(self.duration_seconds, seconds))
        self._broadcast_state()
        return self.get_state()

    async def next_track(self):
        if self.queue and len(self.queue) > 0:
            next_t = self.queue.pop(0)
            await self.play_track(next_t)
        else:
            self.is_playing = False
            self.current_track = None
            self.elapsed_seconds = 0
            self._broadcast_state()
        return self.get_state()

    async def prev_track(self):
        self.elapsed_seconds = 0
        self._broadcast_state()
        return self.get_state()

    def toggle_device(self, device_id: str, selected: bool) -> Dict[str, Any]:
        device_id = str(device_id)
        if device_id in self.devices:
            self.devices[device_id].is_selected = selected
            if selected and device_id not in self.active_targets:
                self.active_targets.append(device_id)
            elif not selected and device_id in self.active_targets:
                self.active_targets.remove(device_id)
            
            if self.is_playing and selected and self.current_track:
                video_id = self.current_track.get("videoId")
                mp3_path = f"/tmp/ytmusic_{video_id}.mp3"
                if os.path.exists(mp3_path) and os.path.getsize(mp3_path) > 0:
                    loop = asyncio.get_event_loop()
                    task = loop.create_task(self._stream_to_device(self.devices[device_id], mp3_path, self.current_track))
                    self._stream_tasks.append(task)

        self._broadcast_state()
        return self.get_state()

    def set_device_volume(self, device_id: str, volume: int) -> Dict[str, Any]:
        device_id = str(device_id)
        if device_id in self.devices:
            self.devices[device_id].volume = max(0, min(100, volume))
        self._broadcast_state()
        return self.get_state()

    def set_master_volume(self, volume: int) -> Dict[str, Any]:
        self.master_volume = max(0, min(100, volume))
        for dev in self.devices.values():
            if dev.is_selected:
                dev.volume = self.master_volume
        self._broadcast_state()
        return self.get_state()

player_engine = PlayerEngine()
