import asyncio
import json
import logging
import time
import socket
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..ws import manager
from .ytmusic import ytmusic_service

logger = logging.getLogger(__name__)

class AirPlayDevice:
    def __init__(self, identifier: str, name: str, address: str, port: int, model: str = "AirPlay Speaker"):
        self.id = identifier
        self.name = name
        self.address = address
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
        
        self._zeroconf = None
        self._browser = None
        self._ticker_task: Optional[asyncio.Task] = None
        self._stream_process: Optional[asyncio.subprocess.Process] = None

    def start(self):
        self.start_mdns_discovery()
        if self._ticker_task is None or self._ticker_task.done():
            loop = asyncio.get_event_loop()
            self._ticker_task = loop.create_task(self._playback_ticker())

    def stop(self):
        self.stop_mdns_discovery()
        if self._ticker_task and not self._ticker_task.done():
            self._ticker_task.cancel()

    def start_mdns_discovery(self):
        try:
            from zeroconf import Zeroconf, ServiceBrowser

            class AirPlayListener:
                def __init__(self, outer):
                    self.outer = outer

                def remove_service(self, zeroconf, type_, name):
                    dev_id = name.split(".")[0]
                    if dev_id in self.outer.devices:
                        logger.info(f"AirPlay speaker offline: {name}")

                def add_service(self, zeroconf, type_, name):
                    info = zeroconf.get_service_info(type_, name)
                    if info:
                        addresses = [socket.inet_ntoa(addr) for addr in info.addresses if len(addr) == 4]
                        ip_str = addresses[0] if addresses else "127.0.0.1"
                        dev_id = info.properties.get(b"deviceid", b"").decode("utf-8") or name.split(".")[0]
                        dev_name = info.name.split(".")[0].replace("\\", "")
                        model = info.properties.get(b"model", b"AirPlay Speaker").decode("utf-8")
                        
                        device = AirPlayDevice(
                            identifier=dev_id,
                            name=dev_name,
                            address=ip_str,
                            port=info.port or 7000,
                            model=model
                        )
                        self.outer.devices[dev_id] = device
                        logger.info(f"Discovered AirPlay speaker on LAN: {dev_name} ({ip_str}:{info.port})")
                        self.outer._broadcast_state()

                def update_service(self, zeroconf, type_, name):
                    self.add_service(zeroconf, type_, name)

            self._zeroconf = Zeroconf()
            self._browser = ServiceBrowser(self._zeroconf, ["_airplay._tcp.local.", "_raop._tcp.local."], AirPlayListener(self))
            logger.info("Started AirPlay Zeroconf discovery")
        except Exception as e:
            logger.error(f"Failed to start AirPlay mDNS discovery: {e}")

    def stop_mdns_discovery(self):
        if self._zeroconf:
            try:
                self._zeroconf.close()
            except Exception as e:
                logger.error(f"Error closing zeroconf: {e}")
            self._zeroconf = None

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
            data = json.dumps({"type": "player_state", "payload": self.get_state()})
            manager.broadcast_json({"type": "player_state", "payload": self.get_state()})
        except Exception as e:
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

        stream_url = ytmusic_service.get_stream_url(video_id)
        if not stream_url:
            logger.error(f"Could not extract stream URL for video: {video_id}")
            return self.get_state()

        self.current_track = {
            "videoId": video_id,
            "title": track.get("title", "Unknown Title"),
            "artist": track.get("artist", "Unknown Artist"),
            "thumbnail": track.get("thumbnail"),
            "album": track.get("album"),
            "duration": track.get("duration", 0),
            "streamUrl": stream_url
        }
        self.elapsed_seconds = 0
        self.duration_seconds = track.get("duration", 0) or 180
        self.is_playing = True
        
        if queue is not None:
            self.queue = queue

        logger.info(f"Server-Side AirPlay Playback started for '{self.current_track['title']}' on {len(self.active_targets)} speakers")

        # Spawn pyatv streaming tasks for selected AirPlay devices
        for dev_id in self.active_targets:
            device = self.devices.get(dev_id)
            if device:
                asyncio.create_task(self._stream_to_airplay_device(device, stream_url))

        self._broadcast_state()
        return self.get_state()

    async def _stream_to_airplay_device(self, device: AirPlayDevice, stream_url: str):
        try:
            import pyatv
            loop = asyncio.get_running_loop()
            atvs = await pyatv.scan(loop=loop, hosts=[device.address], timeout=3)
            if atvs:
                atv = await pyatv.connect(atvs[0], loop=loop)
                await atv.stream.play_url(stream_url)
                device.is_connected = True
                logger.info(f"Successfully connected and streaming to AirPlay speaker: {device.name}")
        except Exception as e:
            logger.warning(f"Server-side AirPlay stream to {device.name} ({device.address}): {e}")

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
        if device_id in self.devices:
            self.devices[device_id].is_selected = selected
            if selected and device_id not in self.active_targets:
                self.active_targets.append(device_id)
            elif not selected and device_id in self.active_targets:
                self.active_targets.remove(device_id)
            
            # Trigger stream connection if playing
            if self.is_playing and selected and self.current_track:
                stream_url = self.current_track.get("streamUrl")
                if stream_url:
                    asyncio.create_task(self._stream_to_airplay_device(self.devices[device_id], stream_url))

        self._broadcast_state()
        return self.get_state()

    def set_device_volume(self, device_id: str, volume: int) -> Dict[str, Any]:
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
