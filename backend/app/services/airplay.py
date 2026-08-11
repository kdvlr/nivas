import asyncio
import logging
import time
from typing import Any, Dict, List, Optional
import socket

logger = logging.getLogger(__name__)

class AirPlayDevice:
    def __init__(self, identifier: str, name: str, address: str, port: int, model: str = "AirPlay Device"):
        self.id = identifier
        self.name = name
        self.address = address
        self.port = port
        self.model = model
        self.is_selected = False
        self.volume = 70  # 0 to 100
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

class AirPlayService:
    def __init__(self):
        self.devices: Dict[str, AirPlayDevice] = {}
        self.active_targets: List[str] = []
        self.master_volume: int = 70
        self.is_playing: bool = False
        self.current_track: Optional[Dict[str, Any]] = None
        self._zeroconf = None
        self._browser = None

    def start_discovery(self):
        try:
            from zeroconf import Zeroconf, ServiceBrowser

            class AirPlayListener:
                def __init__(self, outer):
                    self.outer = outer

                def remove_service(self, zeroconf, type_, name):
                    dev_id = name.split(".")[0]
                    if dev_id in self.outer.devices:
                        logger.info(f"AirPlay device lost: {name}")

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
                        logger.info(f"Discovered AirPlay endpoint: {dev_name} ({ip_str}:{info.port})")

                def update_service(self, zeroconf, type_, name):
                    self.add_service(zeroconf, type_, name)

            self._zeroconf = Zeroconf()
            self._browser = ServiceBrowser(self._zeroconf, ["_airplay._tcp.local.", "_raop._tcp.local."], AirPlayListener(self))
            logger.info("Started Zeroconf AirPlay device discovery")
        except Exception as e:
            logger.error(f"Failed to start AirPlay mDNS discovery: {e}")

    def stop_discovery(self):
        if self._zeroconf:
            try:
                self._zeroconf.close()
            except Exception as e:
                logger.error(f"Error closing zeroconf: {e}")
            self._zeroconf = None

    def get_devices(self) -> List[Dict[str, Any]]:
        # Return discovered devices sorted by name
        return [dev.to_dict() for dev in sorted(self.devices.values(), key=lambda d: d.name)]

    def toggle_device_selection(self, device_id: str, selected: bool) -> List[Dict[str, Any]]:
        if device_id in self.devices:
            self.devices[device_id].is_selected = selected
            if selected and device_id not in self.active_targets:
                self.active_targets.append(device_id)
            elif not selected and device_id in self.active_targets:
                self.active_targets.remove(device_id)
        return self.get_devices()

    def set_device_volume(self, device_id: str, volume: int) -> Optional[Dict[str, Any]]:
        if device_id in self.devices:
            self.devices[device_id].volume = max(0, min(100, volume))
            return self.devices[device_id].to_dict()
        return None

    def set_master_volume(self, volume: int) -> int:
        self.master_volume = max(0, min(100, volume))
        for dev in self.devices.values():
            if dev.is_selected:
                dev.volume = self.master_volume
        return self.master_volume

    async def play_track(self, track_info: Dict[str, Any], stream_url: str, selected_device_ids: Optional[List[str]] = None):
        self.current_track = track_info
        self.is_playing = True
        
        if selected_device_ids is not None:
            self.active_targets = selected_device_ids
            for dev_id, dev in self.devices.items():
                dev.is_selected = (dev_id in selected_device_ids)

        logger.info(f"Playing track '{track_info.get('title')}' on {len(self.active_targets)} AirPlay endpoints")
        
        # Async stream trigger for active pyatv/raop targets
        for dev_id in self.active_targets:
            device = self.devices.get(dev_id)
            if device:
                asyncio.create_task(self._stream_to_device(device, stream_url))

        return self.get_playback_status()

    async def _stream_to_device(self, device: AirPlayDevice, stream_url: str):
        try:
            import pyatv
            # Scan specific IP for pyatv configuration
            atvs = await pyatv.scan(loop=asyncio.get_running_loop(), hosts=[device.address], timeout=3)
            if atvs:
                atv = await pyatv.connect(atvs[0], loop=asyncio.get_running_loop())
                await atv.stream.play_url(stream_url)
                device.is_connected = True
                logger.info(f"Streaming started on {device.name}")
        except Exception as e:
            logger.warning(f"Direct pyatv stream to {device.name} ({device.address}): {e}")

    async def pause(self):
        self.is_playing = False
        logger.info("Paused AirPlay multi-room playback")
        return self.get_playback_status()

    async def resume(self):
        self.is_playing = True
        logger.info("Resumed AirPlay multi-room playback")
        return self.get_playback_status()

    def get_playback_status(self) -> Dict[str, Any]:
        return {
            "isPlaying": self.is_playing,
            "currentTrack": self.current_track,
            "activeTargets": self.active_targets,
            "masterVolume": self.master_volume,
            "devices": self.get_devices()
        }

airplay_service = AirPlayService()
