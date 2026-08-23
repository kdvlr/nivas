import asyncio
import glob
import io
import json
import logging
import os
import signal
import subprocess
import threading
import time
from typing import Any, Dict, List, Optional
from pathlib import Path

import httpx
from PIL import Image

from ..config import get_settings
from ..ws import manager
from .ytmusic import ytmusic_service
from .sonos_listener import SonosEventListener
from .media_remote import MediaRemotePublisher

logger = logging.getLogger(__name__)

GROUP_STREAM_ID = "__airplay_group__"
DEFAULT_PAUSED_SESSION_TIMEOUT_SECONDS = 15 * 60
MUSIC_UI_IDLE_TIMEOUT_SECONDS = 30 * 60

class AirPlayDevice:
    def __init__(self, identifier: str, name: str, address: str, port: int = 7000, model: str = "AirPlay Speaker", volume: int = 70):
        self.id = str(identifier)
        self.name = name
        self.address = str(address)
        self.port = port
        self.model = model
        self.is_selected = False
        self.volume = volume
        self.is_connected = False
        self.is_hidden = False
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
            "isHidden": self.is_hidden,
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
        self.autoplay_enabled: bool = True
        self._last_audio_at: Optional[float] = None
        self.played_history: Dict[str, float] = {}
        self.history: List[Dict[str, Any]] = []
        self._preferences_path = Path(get_settings().data_dir) / "airplay_preferences.json"
        self._hidden_device_ids, self._selected_device_ids, self._selected_device_names, self._device_volumes = self._load_preferences()

        self._scanner_task: Optional[asyncio.Task] = None
        self._ticker_task: Optional[asyncio.Task] = None
        self._play_task: Optional[asyncio.Task] = None
        self._stream_procs: Dict[str, subprocess.Popen] = {}
        self._stream_log_handles: Dict[str, Any] = {}
        self._stream_lock = threading.RLock()
        self._paused_at: Optional[float] = None
        self._paused_stream_expired = False
        self._event_loop: Optional[asyncio.AbstractEventLoop] = None
        self._advancing = False
        self._play_generation_id: int = 0
        self._stream_start_offset: float = 0.0
        self._prefetching_video_ids: set[str] = set()
        self._paused_session_timeout = max(
            1,
            int(os.getenv("AIRPLAY_PAUSE_TIMEOUT_SECONDS", DEFAULT_PAUSED_SESSION_TIMEOUT_SECONDS)),
        )
        self.sonos_listener = SonosEventListener(
            on_volume_change=self._on_external_sonos_volume,
            on_state_change=self._on_external_sonos_state,
        )
        self.media_remote = MediaRemotePublisher(display_name="Nivas", port=49152)

    @staticmethod
    def _reap_orphaned_airplay_processes(tracked_pids: Optional[set[int]] = None):
        """Clean up any untracked airplay-play-audio processes running in the system."""
        import glob
        tracked = tracked_pids or set()
        for p in glob.glob("/proc/[0-9]*/cmdline"):
            try:
                with open(p, "rb") as f:
                    cmd = f.read().replace(b"\x00", b" ").decode("utf-8", errors="ignore").strip()
                parts = cmd.split()
                if parts and (parts[0] == "airplay-play-audio" or parts[0].endswith("/airplay-play-audio")):
                    pid = int(p.split("/")[2])
                    if pid not in tracked and pid != os.getpid():
                        logger.warning("Reaping untracked orphaned AirPlay sender PID %s", pid)
                        try:
                            os.kill(pid, signal.SIGKILL)
                        except (ProcessLookupError, PermissionError, OSError):
                            pass
            except Exception:
                pass

    def get_recently_played_ids(self, hours: float = 4.0) -> set[str]:
        cutoff = time.time() - (hours * 3600)
        self.played_history = {
            vid: ts for vid, ts in self.played_history.items()
            if ts > cutoff
        }
        return set(self.played_history.keys())

    def _update_master_volume_from_devices(self) -> None:
        selected_devs = [dev for dev in self.devices.values() if dev.is_selected]
        if selected_devs:
            self.master_volume = round(sum(dev.volume for dev in selected_devs) / len(selected_devs))
        self._advancing = False
        self._paused_session_timeout = max(
            1,
            int(os.getenv("AIRPLAY_PAUSE_TIMEOUT_SECONDS", DEFAULT_PAUSED_SESSION_TIMEOUT_SECONDS)),
        )

    def _load_preferences(self) -> tuple[set[str], set[str], set[str], dict[str, int]]:
        try:
            data = json.loads(self._preferences_path.read_text(encoding="utf-8"))
            hidden = {str(device_id) for device_id in data.get("hiddenDeviceIds", [])}
            selected_ids = {str(device_id) for device_id in data.get("selectedDeviceIds", [])}
            selected_names = {str(name) for name in data.get("selectedDeviceNames", [])}
            raw_volumes = data.get("deviceVolumes", {})
            volumes = {str(k): int(v) for k, v in raw_volumes.items() if isinstance(v, (int, float))}
            return hidden, selected_ids, selected_names, volumes
        except (FileNotFoundError, json.JSONDecodeError, OSError, AttributeError):
            return set(), set(), set(), {}

    def _load_hidden_device_ids(self) -> set[str]:
        hidden, _, _, _ = self._load_preferences()
        return hidden

    def _save_preferences(self) -> None:
        try:
            self._preferences_path.parent.mkdir(parents=True, exist_ok=True)
            temporary_path = self._preferences_path.with_suffix(".tmp")
            payload = {
                "hiddenDeviceIds": sorted(self._hidden_device_ids),
                "selectedDeviceIds": sorted(self._selected_device_ids),
                "selectedDeviceNames": sorted(self._selected_device_names),
                "deviceVolumes": self._device_volumes,
            }
            temporary_path.write_text(
                json.dumps(payload, indent=2),
                encoding="utf-8",
            )
            temporary_path.replace(self._preferences_path)
        except Exception as e:
            logger.error("Failed to save AirPlay preferences: %s", e)

    def _save_hidden_device_ids(self) -> None:
        self._save_preferences()

    def _on_external_sonos_volume(self, ip: str, volume: int):
        for dev_id, dev in self.devices.items():
            if dev.address == ip:
                dev.volume = max(0, min(100, volume))
                self._device_volumes[dev_id] = dev.volume
                self._save_preferences()
                self._update_master_volume_from_devices()
                self._broadcast_state()
                break

    def _on_external_sonos_state(self, is_playing: bool):
        if self.is_playing != is_playing and self._event_loop and self._event_loop.is_running():
            logger.info("External Sonos state change: is_playing=%s", is_playing)
            if is_playing:
                asyncio.run_coroutine_threadsafe(self.resume(), self._event_loop)
            else:
                asyncio.run_coroutine_threadsafe(self.pause(), self._event_loop)

    def start(self):
        loop = asyncio.get_event_loop()
        self._event_loop = loop
        if self._scanner_task is None or self._scanner_task.done():
            self._scanner_task = loop.create_task(self._device_scanner_loop())
        if self._ticker_task is None or self._ticker_task.done():
            self._ticker_task = loop.create_task(self._playback_ticker())
        
        self.sonos_listener.start()
        self.media_remote.on_play_pause = lambda: asyncio.run_coroutine_threadsafe(self.toggle_play_pause(), loop)
        self.media_remote.on_next = lambda: asyncio.run_coroutine_threadsafe(self.next_track(), loop)
        self.media_remote.on_prev = lambda: asyncio.run_coroutine_threadsafe(self.prev_track(), loop)
        self.media_remote.start(loop)

    def stop(self):
        if self._scanner_task and not self._scanner_task.done():
            self._scanner_task.cancel()
        if self._ticker_task and not self._ticker_task.done():
            self._ticker_task.cancel()
        self.sonos_listener.stop()
        self.media_remote.stop()
        self._stop_current_stream()

    async def stop_playback(self) -> Dict[str, Any]:
        """Stops the current track, terminates streaming processes, and clears active track."""
        self.is_playing = False
        self._stop_current_stream()
        self.current_track = None
        self.elapsed_seconds = 0
        self.duration_seconds = 0
        self.queue.clear()
        self.history.clear()
        self.media_remote.update_state(
            PlaybackState.STOPPED,
            title="Not Playing",
            artist="",
            album="",
            duration=0,
            elapsed=0,
        )
        return self.get_state()

    def _write_stream_command(self, command: str) -> bool:
        """Send a command to every active native sender process."""
        sent = False
        with self._stream_lock:
            processes = list(self._stream_procs.values())
        for proc in processes:
            if proc.poll() is not None or proc.stdin is None:
                continue
            try:
                proc.stdin.write(f"{command}\n")
                proc.stdin.flush()
                sent = True
            except (BrokenPipeError, OSError, ValueError):
                logger.warning("AirPlay control pipe closed while sending %s", command)
        return sent

    @staticmethod
    def _terminate_stream_process(proc: subprocess.Popen):
        """Request protocol cleanup, then escalate without leaving descendants."""
        if proc.poll() is not None:
            return
        try:
            if proc.stdin is not None:
                proc.stdin.write("stop\n")
                proc.stdin.flush()
            proc.wait(timeout=0.3)
            return
        except (BrokenPipeError, OSError, ValueError, subprocess.TimeoutExpired):
            pass

        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                proc.terminate()
            except OSError:
                return
        try:
            proc.wait(timeout=0.5)
            return
        except subprocess.TimeoutExpired:
            pass

        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError, OSError):
            try:
                proc.kill()
            except OSError:
                return
        try:
            proc.wait(timeout=0.2)
        except subprocess.TimeoutExpired:
            logger.error("AirPlay sender %s did not exit after SIGKILL", proc.pid)

    def _stop_current_stream(self):
        if self._play_task and not self._play_task.done():
            self._play_task.cancel()
            self._play_task = None

        with self._stream_lock:
            processes = list(self._stream_procs.items())
            self._stream_procs.clear()
            log_handles = list(self._stream_log_handles.values())
            self._stream_log_handles.clear()
        for _, proc in processes:
            self._terminate_stream_process(proc)
        for handle in log_handles:
            try:
                handle.close()
            except OSError:
                pass
        self._paused_at = None
        self._paused_stream_expired = False
        for device in self.devices.values():
            device.is_connected = False
        self._reap_orphaned_airplay_processes()

    async def _device_scanner_loop(self):
        while True:
            try:
                await self.scan_devices()
                sleep_sec = 60 if self.is_playing else 15
                await asyncio.sleep(sleep_sec)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in pyatv scanner loop: {e}")
                await asyncio.sleep(30)

    async def scan_devices(self) -> List[Dict[str, Any]]:
        try:
            import pyatv
            loop = asyncio.get_running_loop()
            results = await pyatv.scan(loop, timeout=3)
            
            discovered_addresses = set()
            for conf in results:
                airplay_service = conf.get_service(pyatv.const.Protocol.AirPlay)
                if airplay_service is None:
                    airplay_service = conf.get_service(pyatv.const.Protocol.RAOP)
                if airplay_service is None:
                    continue

                addr = str(conf.address)
                name = str(conf.name)

                if addr in discovered_addresses:
                    continue
                discovered_addresses.add(addr)

                dev_id = addr
                port = airplay_service.port or 7000
                properties = airplay_service.properties or {}
                advertised_model = properties.get("model") or properties.get("am")
                manufacturer = properties.get("manufacturer")
                if advertised_model:
                    model = " ".join(
                        part for part in (manufacturer, advertised_model) if part
                    )
                else:
                    model = (
                        str(conf.device_info.model or "AirPlay Speaker")
                        if conf.device_info
                        else "AirPlay Speaker"
                    )

                is_prev_selected = (dev_id in self._selected_device_ids or name in self._selected_device_names)

                if dev_id in self.devices:
                    dev = self.devices[dev_id]
                    dev.name = name
                    dev.port = port
                    dev.model = model
                    dev.last_seen = time.time()
                    if is_prev_selected and not dev.is_selected:
                        dev.is_selected = True
                        if dev_id not in self.active_targets:
                            self.active_targets.append(dev_id)
                else:
                    saved_vol = self._device_volumes.get(dev_id, 70)
                    dev = AirPlayDevice(
                        identifier=dev_id,
                        name=name,
                        address=addr,
                        port=port,
                        model=model,
                        volume=saved_vol
                    )
                    dev.is_hidden = dev_id in self._hidden_device_ids
                    if is_prev_selected:
                        dev.is_selected = True
                        if dev_id not in self.active_targets:
                            self.active_targets.append(dev_id)
                    self.devices[dev_id] = dev
                    logger.info(f"Discovered AirPlay speaker: {name} ({addr}:{port}) with volume {saved_vol}")

            self._ensure_default_target()
            self._broadcast_state()
        except Exception as e:
            logger.error(f"AirPlay scan error: {e}")
        return self.get_state()["devices"]

    async def _playback_ticker(self):
        while True:
            try:
                await asyncio.sleep(1)
                if self.is_playing and self.current_track:
                    self._last_audio_at = time.monotonic()
                    self.elapsed_seconds += 1
                    # Deterministic ticker watchdog fallback (+15s grace period)
                    if (
                        self.duration_seconds > 0
                        and self.elapsed_seconds >= self.duration_seconds + 15
                    ):
                        logger.info(
                            "Watchdog: Track elapsed seconds (%s) reached duration (%s) + 15s grace period; advancing to next track",
                            self.elapsed_seconds,
                            self.duration_seconds,
                        )
                        await self.next_track()
                    else:
                        self._broadcast_state()
                elif (
                    self.current_track
                    and self._last_audio_at is not None
                    and time.monotonic() - self._last_audio_at >= MUSIC_UI_IDLE_TIMEOUT_SECONDS
                ):
                    self.current_track = None
                    self.queue = []
                    self.elapsed_seconds = 0
                    self.duration_seconds = 0
                    self._last_audio_at = None
                    self._broadcast_state()
                elif self._cleanup_expired_paused_session():
                    self._broadcast_state()
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in playback ticker: {e}")

    def _cleanup_expired_paused_session(self) -> bool:
        if (
            self._paused_at is None
            or not self._stream_procs
            or time.monotonic() - self._paused_at < self._paused_session_timeout
        ):
            return False
        logger.info(
            "Cleaning up AirPlay session paused for %ss",
            self._paused_session_timeout,
        )
        self._stop_current_stream()
        # Retain this marker so resume can recreate the session explicitly.
        self._paused_stream_expired = True
        return True

    def _broadcast_state(self):
        try:
            state = self.get_state()
            if hasattr(self, "sonos_listener") and self.sonos_listener:
                self.sonos_listener.sync_active_devices(self.devices)
            manager.broadcast_json({"type": "player_state", "payload": state})
        except Exception:
            pass

    def get_state(self) -> Dict[str, Any]:
        paused_expires_in = None
        if self._paused_at is not None and self._stream_procs:
            paused_expires_in = max(
                0,
                int(self._paused_session_timeout - (time.monotonic() - self._paused_at)),
            )
        return {
            "isPlaying": self.is_playing,
            "currentTrack": self.current_track,
            "queue": self.queue,
            "autoplayEnabled": self.autoplay_enabled,
            "elapsedSeconds": self.elapsed_seconds,
            "durationSeconds": self.duration_seconds,
            "masterVolume": self.master_volume,
            "activeTargets": self.active_targets,
            "airplaySessionActive": bool(self._stream_procs),
            "pausedSessionExpiresIn": paused_expires_in,
            "devices": [dev.to_dict() for dev in sorted(self.devices.values(), key=lambda d: d.name)]
        }

    def _ensure_default_target(self):
        # 1. Restore selection for any discovered devices matching previously saved selected IDs/names
        if self._selected_device_ids or self._selected_device_names:
            for dev in self.devices.values():
                if (dev.id in self._selected_device_ids or dev.name in self._selected_device_names) and not dev.is_hidden:
                    dev.is_selected = True
                    if dev.id not in self.active_targets:
                        self.active_targets.append(dev.id)

        # 2. If no saved target matches, fall back to Kitchen or first available non-hidden device
        if not self.active_targets or not self._selected_devices():
            kitchen_dev = next(
                (dev for dev in self.devices.values() if ("kitchen" in dev.name.lower() or "kitchen" in dev.model.lower()) and not dev.is_hidden),
                None
            )
            if kitchen_dev:
                kitchen_dev.is_selected = True
                if kitchen_dev.id not in self.active_targets:
                    self.active_targets.append(kitchen_dev.id)
            elif self.devices:
                first_dev = next((dev for dev in sorted(self.devices.values(), key=lambda d: d.name) if not dev.is_hidden), None)
                if first_dev:
                    first_dev.is_selected = True
                    if first_dev.id not in self.active_targets:
                        self.active_targets.append(first_dev.id)

    async def play_track(self, track: Dict[str, Any], queue: Optional[List[Dict[str, Any]]] = None, is_back: bool = False):
        video_id = track.get("videoId")
        if not video_id:
            return self.get_state()

        # Save currently playing track to history before switching to a new track
        if not is_back and self.current_track and self.current_track.get("videoId"):
            if self.current_track.get("videoId") != video_id:
                self.history.append(dict(self.current_track))
                if len(self.history) > 50:
                    self.history = self.history[-50:]

        self._ensure_default_target()
        self._stop_current_stream()
        self._stream_start_offset = 0.0

        self._play_generation_id += 1
        generation_id = self._play_generation_id

        parsed_duration = ytmusic_service._parse_duration_seconds(track.get("duration"))
        self.current_track = {
            "videoId": video_id,
            "title": track.get("title", "Unknown Title"),
            "artist": track.get("artist", "Unknown Artist"),
            "thumbnail": track.get("thumbnail"),
            "album": track.get("album"),
            "duration": parsed_duration,
            "isPureAudio": track.get("isPureAudio", False),
        }
        self.played_history[video_id] = time.time()
        self.elapsed_seconds = 0
        self.duration_seconds = float(parsed_duration or 180)
        self.is_playing = True
        self._last_audio_at = time.monotonic()

        self.queue = [
            normalized
            for item in (queue or [])
            if (normalized := ytmusic_service.normalize_song(item)) is not None
            and normalized["videoId"] != video_id
        ]

        loop = asyncio.get_running_loop()
        self._play_task = loop.create_task(self._orchestrate_playback(video_id, self.current_track, generation_id))

        self._broadcast_state()
        return self.get_state()

    async def _fetch_autoplay_recommendations(self, video_id: str):
        try:
            if not self.autoplay_enabled:
                return
            loop = asyncio.get_running_loop()
            recommendations = await loop.run_in_executor(
                None,
                ytmusic_service.get_autoplay_tracks,
                video_id,
            )
            if not recommendations or self.current_track.get("videoId") != video_id:
                return

            recent_ids = self.get_recently_played_ids(hours=4.0)
            filtered_recs = [r for r in recommendations if r["videoId"] not in recent_ids]
            if not filtered_recs and recommendations:
                recent_1h = self.get_recently_played_ids(hours=1.0)
                filtered_recs = [r for r in recommendations if r["videoId"] not in recent_1h] or recommendations

            existing_ids = {video_id, *(item["videoId"] for item in self.queue)}
            added = False
            for recommendation in filtered_recs:
                if recommendation["videoId"] not in existing_ids:
                    self.queue.append(recommendation)
                    existing_ids.add(recommendation["videoId"])
                    added = True
            if added:
                self._broadcast_state()
                loop.create_task(self._prefetch_next_track())
        except Exception as e:
            logger.warning(f"Background autoplay recommendation fetch failed: {e}")

    async def _prefetch_next_track(self):
        try:
            tracks_to_prefetch = []
            if self.queue:
                # Pre-fetch the upcoming 2 tracks so track-to-track handover is instant
                tracks_to_prefetch = [t for t in self.queue[:2] if t and t.get("videoId")]

            loop = asyncio.get_running_loop()

            async def _prefetch_single(track_item: Dict[str, Any]):
                if not track_item.get("isPureAudio"):
                    resolved = await loop.run_in_executor(
                        None,
                        ytmusic_service.resolve_pure_audio_song,
                        track_item,
                    )
                    if resolved and resolved.get("videoId"):
                        track_item.update(resolved)
                vid = track_item.get("videoId")
                if not vid or vid in self._prefetching_video_ids:
                    return
                self._prefetching_video_ids.add(vid)
                try:
                    wpath = f"/tmp/ytmusic_{vid}.wav"
                    apath = f"/tmp/ytmusic_{vid}_artwork.jpg"
                    subtasks = []

                    if not os.path.exists(wpath) or os.path.getsize(wpath) <= 44:
                        logger.info("Pre-fetching track in background: %s (%s)", track_item.get("title"), vid)
                        subtasks.append(loop.run_in_executor(None, self._transcode_to_wav, vid, wpath))

                    if not os.path.exists(apath) and track_item.get("thumbnail"):
                        subtasks.append(loop.run_in_executor(None, self._download_artwork, track_item["thumbnail"], apath))

                    if subtasks:
                        await asyncio.gather(*subtasks, return_exceptions=True)
                finally:
                    self._prefetching_video_ids.discard(vid)

            prefetch_tasks = [
                _prefetch_single(t)
                for t in tracks_to_prefetch
                if t.get("videoId") and t["videoId"] not in self._prefetching_video_ids
            ]

            if prefetch_tasks:
                await asyncio.gather(*prefetch_tasks, return_exceptions=True)
        except Exception as e:
            logger.debug(f"Next track prefetch background task error: {e}")

    async def _orchestrate_playback(self, video_id: str, track_info: Dict[str, Any], generation_id: int):
        try:
            loop = asyncio.get_running_loop()

            # Ensure pure audio studio release is used instead of promotional video cuts
            if not track_info.get("isPureAudio"):
                resolved = await loop.run_in_executor(
                    None,
                    ytmusic_service.resolve_pure_audio_song,
                    track_info,
                )
                if resolved and resolved.get("videoId") and resolved["videoId"] != video_id:
                    logger.info(
                        "Resolved music video %s (%s) to pure audio release %s (%s)",
                        track_info.get("title"),
                        video_id,
                        resolved.get("title"),
                        resolved.get("videoId"),
                    )
                    video_id = resolved["videoId"]
                    track_info.update(resolved)
                    if self.current_track and generation_id == self._play_generation_id:
                        self.current_track.update(resolved)
                        if resolved.get("duration"):
                            self.duration_seconds = float(resolved["duration"])
                        self._broadcast_state()

            wav_path = f"/tmp/ytmusic_{video_id}.wav"
            artwork_path = f"/tmp/ytmusic_{video_id}_artwork.jpg"

            # Concurrently transcode audio and download artwork in parallel
            fetch_tasks = []
            if not os.path.exists(wav_path) or os.path.getsize(wav_path) <= 44:
                logger.info(f"Downloading and converting track '{track_info['title']}' to 44.1kHz PCM WAV...")
                fetch_tasks.append(loop.run_in_executor(None, self._transcode_to_wav, video_id, wav_path))

            thumbnail_url = track_info.get("thumbnail")
            if thumbnail_url and (not os.path.exists(artwork_path) or os.path.getsize(artwork_path) == 0):
                fetch_tasks.append(loop.run_in_executor(None, self._download_artwork, thumbnail_url, artwork_path))

            if fetch_tasks:
                await asyncio.gather(*fetch_tasks, return_exceptions=True)

            if generation_id != self._play_generation_id:
                logger.info("Aborting stale playback orchestration (generation %s superseded by %s)", generation_id, self._play_generation_id)
                return

            if not os.path.exists(wav_path) or os.path.getsize(wav_path) <= 44:
                logger.warning(
                    "Transcoding produced unplayable file for %s (%s); advancing to next track",
                    track_info.get("title"),
                    video_id,
                )
                await self.next_track()
                return

            file_size = os.path.getsize(wav_path)
            if file_size > 44:
                calc_duration = int((file_size - 44) / 176400)
                if calc_duration > 0:
                    self.duration_seconds = calc_duration

            artwork_arg = artwork_path if os.path.exists(artwork_path) and os.path.getsize(artwork_path) > 0 else None

            self._stop_current_stream()
            logger.info(f"Transcode complete. Streaming '{track_info['title']}' via airplay2-rs to {len(self.active_targets)} selected AirPlay speakers")
            started = self._start_airplay_streams(
                wav_path,
                track_info,
                artwork_arg,
            )

            if not started:
                self.is_playing = False
                self._broadcast_state()
            else:
                if not self.is_playing:
                    # Pause may have been pressed while the track was transcoding.
                    self._write_stream_command("pause")
                    self._paused_at = time.monotonic()
                # Spawn background non-blocking tasks for autoplay recommendations & next-track prefetch
                loop.create_task(self._fetch_autoplay_recommendations(video_id))
                loop.create_task(self._prefetch_next_track())
        except Exception as e:
            logger.error(f"Error orchestrating playback: {e}")
            self.is_playing = False
            self._broadcast_state()

    def _transcode_to_wav(self, source: str, output_path: str):
        if os.path.exists(output_path) and os.path.getsize(output_path) > 44:
            return
        try:
            # 1. Direct HTTP/HTTPS audio URL (non-YouTube)
            if source.startswith("http://") or (source.startswith("https://") and not ("youtube.com" in source or "youtu.be" in source)):
                cmd = [
                    "ffmpeg", "-y", "-i", source,
                    "-vn", "-ar", "44100", "-ac", "2", "-acodec", "pcm_s16le",
                    output_path
                ]
                subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                logger.info(f"Transcoded direct audio URL successfully to {output_path}")
                return

            # 2. Strict yt-dlp download & extract into thread-isolated temp file
            import yt_dlp
            url = source if (source.startswith("http://") or source.startswith("https://")) else f"https://www.youtube.com/watch?v={source}"
            tmp_base = f"{output_path}.{os.getpid()}_{threading.get_ident()}_{int(time.time() * 1000)}.tmp"
            tmp_wav = f"{tmp_base}.wav"
            ydl_opts = {
                "format": "bestaudio/best",
                "outtmpl": f"{tmp_base}.%(ext)s",
                "postprocessors": [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "wav",
                    "preferredquality": "0",
                }],
                "postprocessor_args": [
                    "-ar", "44100",
                    "-ac", "2",
                    "-acodec", "pcm_s16le",
                ],
                "extractor_args": {
                    "youtube": {
                        "player_client": ["android", "web", "ios"]
                    }
                },
                "quiet": True,
                "no_warnings": True,
            }
            try:
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([url])
                if os.path.exists(tmp_wav) and os.path.getsize(tmp_wav) > 44:
                    os.replace(tmp_wav, output_path)
                    logger.info(f"Downloaded and converted audio successfully to 44.1kHz WAV: {output_path}")
                else:
                    logger.error(f"yt-dlp output missing or empty for {source}")
            finally:
                for f in glob.glob(f"{tmp_base}.*"):
                    try:
                        os.remove(f)
                    except OSError:
                        pass
        except Exception as e:
            logger.error(f"yt-dlp download/transcoding error: {e}")

    def _selected_devices(self) -> List[AirPlayDevice]:
        return [self.devices[device_id] for device_id in self.active_targets if device_id in self.devices]

    def _start_airplay_streams(
        self,
        wav_path: str,
        track_info: Optional[Dict[str, Any]] = None,
        artwork_path: Optional[str] = None,
    ):
        """Start one controllable sender for one room or a synchronized group."""
        devices = self._selected_devices()
        if not devices:
            logger.warning("Playback requested without an AirPlay target")
            return False
        return self._start_airplay_process(devices, wav_path, track_info, artwork_path)

    def _watch_stream_process(
        self,
        stream_id: str,
        proc: subprocess.Popen,
        device_ids: List[str],
        log_handle: Optional[Any] = None,
    ):
        if proc.stdout:
            try:
                for line in iter(proc.stdout.readline, ""):
                    if not line:
                        break
                    if log_handle:
                        try:
                            log_handle.write(line)
                            log_handle.flush()
                        except Exception:
                            pass
                    line_clean = line.strip()
                    if "REMOTE_EVENT: Pause" in line_clean:
                        logger.info("Received AirPlay remote event: Pause")
                        if self._event_loop and self._event_loop.is_running():
                            def _apply_pause():
                                self.is_playing = False
                                self._paused_at = time.monotonic()
                                self._broadcast_state()
                            self._event_loop.call_soon_threadsafe(_apply_pause)
                    elif "REMOTE_EVENT: Play" in line_clean:
                        logger.info("Received AirPlay remote event: Play")
                        if self._event_loop and self._event_loop.is_running():
                            def _apply_play():
                                self.is_playing = True
                                self._paused_at = None
                                self._broadcast_state()
                            self._event_loop.call_soon_threadsafe(_apply_play)
                    elif "REMOTE_EVENT: Next" in line_clean:
                        logger.info("Received AirPlay remote event: Next")
                        if self._event_loop and self._event_loop.is_running():
                            asyncio.run_coroutine_threadsafe(self.next_track(), self._event_loop)
                    elif "REMOTE_EVENT: Prev" in line_clean:
                        logger.info("Received AirPlay remote event: Prev")
                        if self._event_loop and self._event_loop.is_running():
                            asyncio.run_coroutine_threadsafe(self.prev_track(), self._event_loop)
                    elif "Reached end of audio" in line_clean or "Decoder EOF and buffer empty" in line_clean:
                        logger.info("AirPlay stream reached EOF; advancing to next track")
                        if self._event_loop and self._event_loop.is_running():
                            asyncio.run_coroutine_threadsafe(self.next_track(), self._event_loop)
                    elif line_clean.startswith("Position:") and "s," in line_clean:
                        try:
                            pos_str = line_clean.split("Position:")[1].split("s,")[0].strip()
                            pos_sec = int(float(pos_str))
                            calculated_sec = max(0, int(self._stream_start_offset + pos_sec))
                            if self.duration_seconds > 0:
                                self.elapsed_seconds = min(self.duration_seconds, calculated_sec)
                            else:
                                self.elapsed_seconds = calculated_sec
                        except Exception:
                            pass
            except Exception as e:
                logger.debug(f"Stream output reader error: {e}")

        exit_code = proc.wait()
        with self._stream_lock:
            if self._stream_procs.get(stream_id) is not proc:
                return
            self._stream_procs.pop(stream_id, None)
            stored_log = self._stream_log_handles.pop(stream_id, None)
        if stored_log is not None:
            try:
                stored_log.close()
            except OSError:
                pass
        for device_id in device_ids:
            if device_id in self.devices:
                self.devices[device_id].is_connected = False
        if self.is_playing and exit_code == 0 and self._event_loop:
            logger.info("AirPlay track finished; advancing to next track")
            asyncio.run_coroutine_threadsafe(self.next_track(), self._event_loop)
            return
        if self.is_playing:
            logger.warning("AirPlay stream %s exited with code %s", stream_id, exit_code)
            self.is_playing = False
        self._broadcast_state()

    def _monitor_stream_process(
        self,
        stream_id: str,
        proc: subprocess.Popen,
        device_ids: List[str],
        log_handle: Optional[Any] = None,
    ):
        threading.Thread(
            target=self._watch_stream_process,
            args=(stream_id, proc, device_ids, log_handle),
            daemon=True,
            name=f"airplay-monitor-{stream_id}",
        ).start()

    @staticmethod
    def _device_uses_ptp(device: AirPlayDevice) -> bool:
        identity = f"{device.name} {device.model}".lower()
        return "sonos" in identity or "era " in identity

    def _build_airplay_command(
        self,
        devices: List[AirPlayDevice],
        wav_path: str,
        track_info: Optional[Dict[str, Any]] = None,
        artwork_path: Optional[str] = None,
    ) -> List[str]:
        ports = {device.port for device in devices}
        if len(ports) != 1:
            raise ValueError("A synchronized AirPlay group must use one RTSP port")

        target_ips = ",".join(device.address for device in devices)
        # This is the current Nivas state, not a receiver-specific constant.
        volume = max(0.0, min(1.0, self.master_volume / 100.0))
        cmd = [
            "/usr/local/bin/airplay-play-audio",
            target_ips,
            str(devices[0].port),
            wav_path,
            "--airplay2",
            "--control-stdin",
            "--dacp",
            "--remote-control-events",
            "--volume",
            f"{volume:.4f}",
        ]

        ptp_ips = [device.address for device in devices if self._device_uses_ptp(device)]
        if ptp_ips:
            if len(ptp_ips) == len(devices):
                cmd.extend(["--ptp", "--ptp-master"])
            else:
                cmd.extend([
                    "--ptp-targets",
                    ",".join(ptp_ips),
                    "--ptp-master",
                ])

        if track_info:
            for flag, key in (
                ("--title", "title"),
                ("--artist", "artist"),
                ("--album", "album"),
            ):
                value = track_info.get(key)
                if value:
                    cmd.extend([flag, str(value)])
            duration = track_info.get("duration")
            if duration:
                cmd.extend(["--duration", str(float(duration))])
        if artwork_path:
            cmd.extend(["--artwork", artwork_path])
        return cmd

    def _start_airplay_process(
        self,
        devices: List[AirPlayDevice],
        wav_path: str,
        track_info: Optional[Dict[str, Any]] = None,
        artwork_path: Optional[str] = None,
    ) -> bool:
        try:
            cmd = self._build_airplay_command(devices, wav_path, track_info, artwork_path)
            log_path = os.getenv("AIRPLAY_LOG_PATH", "/tmp/nivas-airplay.log")
            log_handle = open(log_path, "a", encoding="utf-8", buffering=1)
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                bufsize=1,
                start_new_session=True,
            )
            with self._stream_lock:
                self._stream_procs[GROUP_STREAM_ID] = proc
                self._stream_log_handles[GROUP_STREAM_ID] = log_handle
            for device in devices:
                device.is_connected = True
            self._monitor_stream_process(GROUP_STREAM_ID, proc, [device.id for device in devices], log_handle)
            # Preserve per-room state without embedding a Sonos or test volume.
            for device in devices:
                value = max(0.0, min(1.0, device.volume / 100.0))
                self._write_stream_command(f"volume {device.address} {value:.4f}")
            logger.info(
                "Started native AirPlay stream for %s (PTP: %s)",
                ", ".join(device.name for device in devices),
                ", ".join(
                    device.name for device in devices if self._device_uses_ptp(device)
                ) or "none",
            )
            return True
        except Exception as e:
            logger.error("Failed to start native AirPlay stream: %s", e)
            try:
                log_handle.close()
            except (NameError, OSError):
                pass
            return False

    @staticmethod
    def _download_artwork(url: Optional[str], output_path: str) -> Optional[str]:
        if not url:
            return None
        try:
            response = httpx.get(url, timeout=15, follow_redirects=True)
            response.raise_for_status()
            with Image.open(io.BytesIO(response.content)) as image:
                image.convert("RGB").save(output_path, format="JPEG", quality=90)
            return output_path
        except Exception as error:
            logger.warning("Could not prepare AirPlay artwork: %s", error)
            return None

    async def pause(self):
        if self._stream_procs:
            self._write_stream_command("pause")
            self._paused_at = time.monotonic()
            self._paused_stream_expired = False
        self.is_playing = False
        self._broadcast_state()
        return self.get_state()

    async def resume(self):
        if self.current_track:
            if self._stream_procs:
                self._write_stream_command("resume")
                self.is_playing = True
                self._paused_at = None
            else:
                video_id = self.current_track.get("videoId")
                wav_path = f"/tmp/ytmusic_{video_id}.wav"
                if os.path.exists(wav_path):
                    # A deliberately expired session cannot retain its RTP
                    # timeline. Recreate it cleanly and restart the local file.
                    self.elapsed_seconds = 0
                    artwork_path = f"/tmp/ytmusic_{video_id}_artwork.jpg"
                    self.is_playing = self._start_airplay_streams(
                        wav_path,
                        self.current_track,
                        artwork_path if os.path.exists(artwork_path) else None,
                    )
                    self._paused_stream_expired = False
        self._broadcast_state()
        return self.get_state()

    async def seek(self, seconds: float):
        if not self.current_track:
            return self.get_state()

        target_seconds = max(0.0, min(self.duration_seconds, float(seconds)))
        self.elapsed_seconds = target_seconds
        self._stream_start_offset = target_seconds

        video_id = self.current_track.get("videoId")
        wav_path = f"/tmp/ytmusic_{video_id}.wav"

        if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
            was_paused = not self.is_playing
            self._stop_current_stream()

            audio_target = wav_path
            if target_seconds > 0.5:
                offset_wav = f"/tmp/ytmusic_{video_id}_offset.wav"
                try:
                    cmd = [
                        "ffmpeg", "-y", "-ss", str(target_seconds),
                        "-i", wav_path, "-vn", "-ar", "44100",
                        "-ac", "2", "-acodec", "pcm_s16le", offset_wav
                    ]
                    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    if os.path.exists(offset_wav) and os.path.getsize(offset_wav) > 0:
                        audio_target = offset_wav
                except Exception as e:
                    logger.warning(f"Could not create seeked audio file: {e}")

            artwork_path = f"/tmp/ytmusic_{video_id}_artwork.jpg"
            artwork_arg = artwork_path if os.path.exists(artwork_path) and os.path.getsize(artwork_path) > 0 else None
            started = self._start_airplay_streams(audio_target, self.current_track, artwork_arg)
            if started:
                self.elapsed_seconds = target_seconds
                if was_paused:
                    self._write_stream_command("pause")
                    self._paused_at = time.monotonic()
                else:
                    self.is_playing = True
                    self._paused_at = None

        self._broadcast_state()
        return self.get_state()

    async def next_track(self):
        if self._advancing:
            return self.get_state()
        self._advancing = True
        try:
            if self.queue:
                next_t = self.queue.pop(0)
                remaining = list(self.queue)
                await self.play_track(next_t, remaining)
            elif self.autoplay_enabled and self.current_track and self.current_track.get("videoId"):
                video_id = self.current_track["videoId"]
                loop = asyncio.get_running_loop()
                recommendations = await loop.run_in_executor(
                    None,
                    ytmusic_service.get_autoplay_tracks,
                    video_id,
                )
                if recommendations:
                    next_t = recommendations.pop(0)
                    await self.play_track(next_t, recommendations)
                else:
                    self.is_playing = False
                    self.current_track = None
                    self.elapsed_seconds = 0
                    self._stop_current_stream()
                    self._broadcast_state()
            else:
                self.is_playing = False
                self.current_track = None
                self.elapsed_seconds = 0
                self._stop_current_stream()
                self._broadcast_state()
        finally:
            self._advancing = False
        return self.get_state()

    def add_to_queue(self, track: Dict[str, Any], play_next: bool = False) -> Dict[str, Any]:
        normalized = ytmusic_service.normalize_song(track)
        if normalized is None:
            raise ValueError("Only songs can be added to the queue")
        if play_next:
            self.queue.insert(0, normalized)
        else:
            self.queue.append(normalized)
        if self._event_loop and self._event_loop.is_running():
            self._event_loop.create_task(self._prefetch_next_track())
        self._broadcast_state()
        return self.get_state()

    def add_tracks_to_queue(self, tracks: List[Dict[str, Any]], play_next: bool = False) -> Dict[str, Any]:
        normalized_tracks: List[Dict[str, Any]] = []
        current_video_id = (self.current_track or {}).get("videoId")
        for t in tracks:
            normalized = ytmusic_service.normalize_song(t)
            if normalized and normalized["videoId"] != current_video_id:
                normalized_tracks.append(normalized)

        if not normalized_tracks:
            return self.get_state()

        if play_next:
            # Insert at beginning in the same order
            for i, t in enumerate(normalized_tracks):
                self.queue.insert(i, t)
        else:
            self.queue.extend(normalized_tracks)

        if self._event_loop and self._event_loop.is_running():
            self._event_loop.create_task(self._prefetch_next_track())
        self._broadcast_state()
        return self.get_state()

    def replace_queue(self, queue: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Replace the upcoming queue after a user reorder or removal."""
        normalized_queue: List[Dict[str, Any]] = []
        current_video_id = (self.current_track or {}).get("videoId")
        for track in queue:
            normalized = ytmusic_service.normalize_song(track)
            if normalized is None:
                raise ValueError("Only songs can be added to the queue")
            if normalized["videoId"] != current_video_id:
                normalized_queue.append(normalized)
        self.queue = normalized_queue
        if self._event_loop and self._event_loop.is_running():
            self._event_loop.create_task(self._prefetch_next_track())
        self._broadcast_state()
        return self.get_state()

    async def prev_track(self):
        if self._advancing:
            return self.get_state()

        # 1. If currently playing and more than 3 seconds elapsed, restart current track from beginning
        if self.current_track and self.elapsed_seconds > 3.0:
            logger.info("Restarting current track from beginning (elapsed > 3s)")
            self.elapsed_seconds = 0
            self._stream_start_offset = 0.0
            self._play_generation_id += 1
            generation_id = self._play_generation_id
            video_id = self.current_track.get("videoId")
            wav_path = f"/tmp/ytmusic_{video_id}.wav"
            artwork_path = f"/tmp/ytmusic_{video_id}_artwork.jpg"
            artwork_arg = artwork_path if os.path.exists(artwork_path) and os.path.getsize(artwork_path) > 0 else None
            if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                self._stop_current_stream()
                self.is_playing = self._start_airplay_streams(wav_path, self.current_track, artwork_arg)
            else:
                loop = asyncio.get_running_loop()
                self._play_task = loop.create_task(self._orchestrate_playback(video_id, self.current_track, generation_id))
            self._broadcast_state()
            return self.get_state()

        # 2. If less than or equal to 3 seconds elapsed (or at start) and history exists, go back to previous track
        if self.history:
            prev_t = self.history.pop()
            # Place current track at front of queue so forward next can resume
            remaining = list(self.queue)
            if self.current_track and self.current_track.get("videoId") != prev_t.get("videoId"):
                remaining.insert(0, self.current_track)
            logger.info("Navigating back to previous track: %s", prev_t.get("title"))
            await self.play_track(prev_t, remaining, is_back=True)
            return self.get_state()

        # 3. Fallback: restart current track from beginning if no history
        if self.current_track:
            self.elapsed_seconds = 0
            self._stream_start_offset = 0.0
            video_id = self.current_track.get("videoId")
            wav_path = f"/tmp/ytmusic_{video_id}.wav"
            artwork_path = f"/tmp/ytmusic_{video_id}_artwork.jpg"
            artwork_arg = artwork_path if os.path.exists(artwork_path) and os.path.getsize(artwork_path) > 0 else None
            if os.path.exists(wav_path) and os.path.getsize(wav_path) > 44:
                self._stop_current_stream()
                self.is_playing = self._start_airplay_streams(wav_path, self.current_track, artwork_arg)
            self._broadcast_state()
            return self.get_state()

        return self.get_state()

    def toggle_device(self, device_id: str, selected: bool) -> Dict[str, Any]:
        device_id = str(device_id)
        if device_id in self.devices:
            dev = self.devices[device_id]
            dev.is_selected = selected
            if selected:
                if device_id not in self.active_targets:
                    self.active_targets.append(device_id)
                self._selected_device_ids.add(device_id)
                self._selected_device_names.add(dev.name)
            else:
                if device_id in self.active_targets:
                    self.active_targets.remove(device_id)
                self._selected_device_ids.discard(device_id)
                self._selected_device_names.discard(dev.name)

            self._save_preferences()

            # Group membership is negotiated at sender startup. Recreate the
            # shared sender when changing rooms so an old member is never left
            # playing from the prior group session.
            if (self.is_playing or self._stream_procs) and self.current_track:
                video_id = self.current_track.get("videoId")
                wav_path = f"/tmp/ytmusic_{video_id}.wav"
                if os.path.exists(wav_path):
                    was_paused = not self.is_playing
                    current_offset = max(0.0, self.elapsed_seconds)
                    self._stop_current_stream()
                    self._stream_start_offset = current_offset

                    audio_target = wav_path
                    if current_offset > 1:
                        offset_wav = f"/tmp/ytmusic_{video_id}_offset.wav"
                        try:
                            cmd = [
                                "ffmpeg", "-y", "-ss", str(current_offset),
                                "-i", wav_path, "-vn", "-ar", "44100",
                                "-ac", "2", "-acodec", "pcm_s16le", offset_wav
                            ]
                            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                            if os.path.exists(offset_wav) and os.path.getsize(offset_wav) > 0:
                                audio_target = offset_wav
                        except Exception as e:
                            logger.warning(f"Could not create seeked audio file for room toggle: {e}")

                    artwork_path = f"/tmp/ytmusic_{video_id}_artwork.jpg"
                    started = self._start_airplay_streams(
                        audio_target,
                        self.current_track,
                        artwork_path if os.path.exists(artwork_path) else None,
                    )
                    if started:
                        self.elapsed_seconds = current_offset
                        if was_paused:
                            self._write_stream_command("pause")
                            self._paused_at = time.monotonic()

        self._update_master_volume_from_devices()
        self._broadcast_state()
        return self.get_state()

    def set_device_hidden(self, device_id: str, hidden: bool) -> Dict[str, Any]:
        device_id = str(device_id)
        device = self.devices.get(device_id)
        if hidden:
            self._hidden_device_ids.add(device_id)
            if device and device.is_selected:
                self.toggle_device(device_id, False)
        else:
            self._hidden_device_ids.discard(device_id)
        if device:
            device.is_hidden = hidden
        self._save_preferences()
        self._broadcast_state()
        return self.get_state()

    def set_device_volume(self, device_id: str, volume: int) -> Dict[str, Any]:
        device_id = str(device_id)
        vol = max(0, min(100, volume))
        self._device_volumes[device_id] = vol
        if device_id in self.devices:
            device = self.devices[device_id]
            device.volume = vol
            if device_id in self.active_targets:
                self._write_stream_command(
                    f"volume {device.address} {device.volume / 100.0:.4f}"
                )
        self._update_master_volume_from_devices()
        self._save_preferences()
        self._broadcast_state()
        return self.get_state()

    def set_master_volume(self, volume: int) -> Dict[str, Any]:
        target_volume = max(0, min(100, volume))
        delta = target_volume - self.master_volume
        self.master_volume = target_volume
        for dev in self.devices.values():
            if dev.is_selected:
                new_vol = max(0, min(100, dev.volume + delta))
                dev.volume = new_vol
                self._device_volumes[dev.id] = new_vol
                if dev.id in self.active_targets:
                    self._write_stream_command(
                        f"volume {dev.address} {dev.volume / 100.0:.4f}"
                    )
        self._save_preferences()
        self._broadcast_state()
        return self.get_state()

player_engine = PlayerEngine()
