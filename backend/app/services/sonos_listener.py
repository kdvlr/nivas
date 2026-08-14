import asyncio
import logging
import socket
import threading
from typing import Dict, Optional, Any, Callable

logger = logging.getLogger(__name__)

class SonosEventListener:
    """
    Subscribes to UPnP events (RenderingControl for volume, AVTransport for playback state)
    for active Sonos devices and syncs changes back to PlayerEngine.
    """
    def __init__(self, on_volume_change: Callable[[str, int], None], on_state_change: Callable[[bool], None]):
        self.on_volume_change = on_volume_change
        self.on_state_change = on_state_change
        self.subscriptions: Dict[str, Dict[str, Any]] = {}
        self._is_running = False

    def start(self):
        self._is_running = True
        logger.info("SonosEventListener initialized for active devices")

    def sync_active_devices(self, active_devices: Dict[str, Any]):
        """
        Dynamically subscribe to UPnP events ONLY for selected/active Sonos devices.
        """
        if not self._is_running:
            return

        try:
            import soco
        except ImportError:
            logger.debug("soco package not installed; skipping Sonos UPnP listener")
            return

        active_sonos_ips = set()
        for dev_id, dev in active_devices.items():
            model = getattr(dev, "model", "") or ""
            name = getattr(dev, "name", "") or ""
            if "sonos" in model.lower() or "sonos" in name.lower() or "play:" in model.lower() or "era" in model.lower() or "symfonisk" in model.lower():
                active_sonos_ips.add(dev.address)

        # Unsubscribe removed devices
        current_ips = list(self.subscriptions.keys())
        for ip in current_ips:
            if ip not in active_sonos_ips:
                self._unsubscribe_device(ip)

        # Subscribe new devices
        for ip in active_sonos_ips:
            if ip not in self.subscriptions:
                self._subscribe_device(ip)

    def _subscribe_device(self, ip: str):
        try:
            import soco
            device = soco.SoCo(ip)
            subs = {}

            def handle_rendering_control(event):
                if not self._is_running:
                    return
                val = event.variables.get("volume")
                if val is not None:
                    # 'Master' or channel volume
                    vol = val.get("Master") or val.get("LF") or list(val.values())[0] if isinstance(val, dict) else val
                    try:
                        self.on_volume_change(ip, int(vol))
                    except Exception as e:
                        logger.error(f"Error handling Sonos volume event on {ip}: {e}")

            def handle_av_transport(event):
                if not self._is_running:
                    return
                transport_state = event.variables.get("transport_state")
                if transport_state:
                    state_str = str(transport_state).upper()
                    logger.info(f"Sonos AVTransport state on {ip}: {state_str}")
                    try:
                        if state_str == "PLAYING":
                            self.on_state_change(True)
                        elif state_str in ("PAUSED_PLAYBACK", "STOPPED"):
                            self.on_state_change(False)
                    except Exception as e:
                        logger.error(f"Error handling Sonos state event on {ip}: {e}")

            try:
                sub_vol = device.renderingControl.subscribe(auto_renew=True)
                sub_vol.callback = handle_rendering_control
                subs["volume"] = sub_vol
                logger.info(f"Subscribed to UPnP RenderingControl volume events for Sonos speaker at {ip}")
            except Exception as e:
                logger.warning(f"Failed to subscribe to UPnP volume events for Sonos speaker at {ip}: {e}")

            try:
                sub_transport = device.avTransport.subscribe(auto_renew=True)
                sub_transport.callback = handle_av_transport
                subs["transport"] = sub_transport
                logger.info(f"Subscribed to UPnP AVTransport state events for Sonos speaker at {ip}")
            except Exception as e:
                logger.warning(f"Failed to subscribe to UPnP transport events for Sonos speaker at {ip}: {e}")

            if subs:
                self.subscriptions[ip] = subs
        except Exception as e:
            logger.warning(f"Failed to setup UPnP subscriptions for Sonos speaker at {ip}: {e}")

    def _unsubscribe_device(self, ip: str):
        if ip in self.subscriptions:
            subs = self.subscriptions.pop(ip)
            for sub_type, sub in subs.items():
                try:
                    sub.unsubscribe()
                    logger.info(f"Unsubscribed UPnP {sub_type} events for Sonos speaker at {ip}")
                except Exception as e:
                    logger.warning(f"Error unsubscribing UPnP {sub_type} events for {ip}: {e}")

    def stop(self):
        self._is_running = False
        ips = list(self.subscriptions.keys())
        for ip in ips:
            self._unsubscribe_device(ip)
        try:
            import soco.events_base
            soco.events_base.event_listener.stop()
        except Exception:
            pass
        logger.info("Stopped SonosEventListener")
