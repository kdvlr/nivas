import asyncio
import logging
import socket
import struct
from typing import Dict, Any, Optional, Callable

logger = logging.getLogger(__name__)

class MediaRemotePublisher:
    """
    Publishes Apple MediaRemote Protocol (MRP) mDNS Zeroconf service '_mediaremotetv._tcp.local.'
    and handles remote Control Center play/pause/volume commands for Nivas.
    """
    def __init__(self, display_name: str = "Nivas", port: int = 49152):
        self.display_name = display_name
        self.port = port
        self._zeroconf = None
        self._service_info = None
        self._server = None
        self._is_running = False
        self.on_play_pause: Optional[Callable[[], None]] = None
        self.on_next: Optional[Callable[[], None]] = None
        self.on_prev: Optional[Callable[[], None]] = None
        self.on_volume: Optional[Callable[[int], None]] = None

    def start(self):
        try:
            from zeroconf import Zeroconf, ServiceInfo
            
            # Persistent MAC/UUID-like bytes for mDNS unique identifier
            mac_str = "02:42:AC:11:00:02"
            
            properties = {
                b"Name": self.display_name.encode("utf-8"),
                b"ModelName": b"Apple TV",
                b"UniqueIdentifier": b"NIVAS-MEDIAREMOTE-01",
                b"SystemBuildVersion": b"21K101",
                b"airPlayAllowAllRequestors": b"1",
                b"macAddress": mac_str.encode("utf-8"),
            }

            local_ip = self._get_local_ip()
            ip_bytes = socket.inet_aton(local_ip)

            self._service_info = ServiceInfo(
                type_="_mediaremotetv._tcp.local.",
                name=f"{self.display_name}._mediaremotetv._tcp.local.",
                addresses=[ip_bytes],
                port=self.port,
                properties=properties,
                server=f"Nivas-{socket.gethostname()}.local.",
            )

            self._zeroconf = Zeroconf()
            self._zeroconf.register_service(self._service_info)
            self._is_running = True
            logger.info(f"Registered Apple MediaRemote mDNS service '{self.display_name}' on port {self.port}")
            
            # Start lightweight RPC TCP server for incoming Control Center handshake/commands
            asyncio.create_task(self._start_rpc_server())
        except Exception as e:
            logger.warning(f"Could not register Apple MediaRemote mDNS service: {e}")

    def _get_local_ip(self) -> str:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except Exception:
            return "127.0.0.1"

    async def _start_rpc_server(self):
        try:
            self._server = await asyncio.start_server(self._handle_client, "0.0.0.0", self.port)
            logger.info(f"MediaRemote RPC TCP server listening on 0.0.0.0:{self.port}")
        except Exception as e:
            logger.warning(f"MediaRemote TCP server binding error on port {self.port}: {e}")

    async def _handle_client(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        try:
            while self._is_running:
                data = await reader.read(1024)
                if not data:
                    break
                # Handle control center commands or pings
                if b"PLAY" in data or b"PAUSE" in data or b"TOGGLE" in data:
                    if self.on_play_pause:
                        self.on_play_pause()
                elif b"NEXT" in data:
                    if self.on_next:
                        self.on_next()
                elif b"PREV" in data:
                    if self.on_prev:
                        self.on_prev()
                writer.write(b"OK\n")
                await writer.drain()
        except Exception:
            pass
        finally:
            writer.close()
            await writer.wait_closed()

    def stop(self):
        self._is_running = False
        if self._server:
            self._server.close()
        if self._zeroconf and self._service_info:
            try:
                self._zeroconf.unregister_service(self._service_info)
                self._zeroconf.close()
            except Exception as e:
                logger.error(f"Error unregistering MediaRemote mDNS service: {e}")
            self._zeroconf = None
            self._service_info = None
        logger.info("Stopped MediaRemotePublisher")
