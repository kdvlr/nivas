import asyncio
import json
import logging
import os
import signal
import subprocess
import threading
import time
from typing import Any, Dict, List, Optional
from pathlib import Path

from ..ws import manager
from .ytmusic import ytmusic_service

logger = logging.getLogger(__name__)

GROUP_STREAM_ID = "__airplay_group__"
DEFAULT_PAUSED_SESSION_TIMEOUT_SECONDS = 15 * 60

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
        self._stream_procs: Dict[str, subprocess.Popen] = {}
        self._stream_log_handles: Dict[str, Any] = {}
        self._stream_lock = threading.RLock()
        self._paused_at: Optional[float] = None
        self._paused_stream_expired = False
        self._paused_session_timeout = max(
            1,
            int(os.getenv("AIRPLAY_PAUSE_TIMEOUT_SECONDS", DEFAULT_PAUSED_SESSION_TIMEOUT_SECONDS)),
        )

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
            proc.wait(timeout=3)
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
            proc.wait(timeout=2)
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
            proc.wait(timeout=1)
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
                airplay_service = conf.get_service(pyatv.const.Protocol.AirPlay)
                if airplay_service is None:
                    airplay_service = conf.get_service(pyatv.const.Protocol.RAOP)
                if airplay_service is None:
                    continue

                addr = str(conf.address)
                name = str(conf.name)
                
                # Filter out TV devices (case-insensitive)
                name_lower = name.lower()
                if "tv" in name_lower:
                    continue

                if addr in discovered_addresses:
                    continue
                discovered_addresses.add(addr)

                dev_id = addr
                port = airplay_service.port or 7000
                model = str(conf.device_info.model or "AirPlay Speaker") if conf.device_info else "AirPlay Speaker"

                if dev_id in self.devices:
                    dev = self.devices[dev_id]
                    dev.name = name
                    dev.port = port
                    dev.model = model
                    dev.last_seen = time.time()
                else:
                    dev = AirPlayDevice(
                        identifier=dev_id,
                        name=name,
                        address=addr,
                        port=port,
                        model=model
                    )
                    self.devices[dev_id] = dev
                    logger.info(f"Discovered AirPlay speaker: {name} ({addr}:{port})")

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
            "elapsedSeconds": self.elapsed_seconds,
            "durationSeconds": self.duration_seconds,
            "masterVolume": self.master_volume,
            "activeTargets": self.active_targets,
            "airplaySessionActive": bool(self._stream_procs),
            "pausedSessionExpiresIn": paused_expires_in,
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

            wav_path = f"/tmp/ytmusic_{video_id}.wav"
            logger.info(f"Transcoding track '{track_info['title']}' to 44.1kHz PCM WAV...")

            loop = asyncio.get_running_loop()
            await loop.run_in_executor(None, self._transcode_to_wav, stream_url, wav_path)

            if not os.path.exists(wav_path) or os.path.getsize(wav_path) == 0:
                logger.error(f"Transcoding produced empty file for {video_id}")
                self.is_playing = False
                self._broadcast_state()
                return

            logger.info(f"Transcode complete. Streaming '{track_info['title']}' via airplay2-rs to {len(self.active_targets)} selected AirPlay speakers")

            started = self._start_airplay_streams(wav_path)
            if not started:
                self.is_playing = False
                self._broadcast_state()
            elif not self.is_playing:
                # Pause may have been pressed while the track was transcoding.
                self._write_stream_command("pause")
                self._paused_at = time.monotonic()
        except Exception as e:
            logger.error(f"Error orchestrating playback: {e}")
            self.is_playing = False
            self._broadcast_state()

    def _transcode_to_wav(self, stream_url: str, output_path: str):
        try:
            cmd = ["ffmpeg", "-y", "-i", stream_url, "-vn", "-ar", "44100", "-ac", "2", "-acodec", "pcm_s16le", output_path]
            subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            logger.info(f"Transcoded audio successfully to {output_path}")
        except Exception as e:
            logger.error(f"FFmpeg transcoding error: {e}")

    def _selected_devices(self) -> List[AirPlayDevice]:
        return [self.devices[device_id] for device_id in self.active_targets if device_id in self.devices]

    def _start_airplay_streams(self, wav_path: str):
        """Start one controllable sender for one room or a synchronized group."""
        devices = self._selected_devices()
        if not devices:
            logger.warning("Playback requested without an AirPlay target")
            return False
        return self._start_airplay_process(devices, wav_path)

    def _watch_stream_process(self, stream_id: str, proc: subprocess.Popen, device_ids: List[str]):
        exit_code = proc.wait()
        with self._stream_lock:
            if self._stream_procs.get(stream_id) is not proc:
                return
            self._stream_procs.pop(stream_id, None)
            log_handle = self._stream_log_handles.pop(stream_id, None)
        if log_handle is not None:
            try:
                log_handle.close()
            except OSError:
                pass
        for device_id in device_ids:
            if device_id in self.devices:
                self.devices[device_id].is_connected = False
        if self.is_playing:
            logger.warning("AirPlay stream %s exited with code %s", stream_id, exit_code)
            self.is_playing = False
        self._broadcast_state()

    def _monitor_stream_process(self, stream_id: str, proc: subprocess.Popen, device_ids: List[str]):
        threading.Thread(
            target=self._watch_stream_process,
            args=(stream_id, proc, device_ids),
            daemon=True,
            name=f"airplay-monitor-{stream_id}",
        ).start()

    @staticmethod
    def _device_uses_ptp(device: AirPlayDevice) -> bool:
        identity = f"{device.name} {device.model}".lower()
        return "sonos" in identity or "era " in identity

    def _build_airplay_command(self, devices: List[AirPlayDevice], wav_path: str) -> List[str]:
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
            "--volume",
            f"{volume:.4f}",
        ]
        ptp_targets = [device.address for device in devices if self._device_uses_ptp(device)]
        if ptp_targets:
            cmd.extend(["--ptp-targets", ",".join(ptp_targets)])
        return cmd

    def _start_airplay_process(self, devices: List[AirPlayDevice], wav_path: str) -> bool:
        try:
            cmd = self._build_airplay_command(devices, wav_path)
            log_path = os.getenv("AIRPLAY_LOG_PATH", "/tmp/nivas-airplay.log")
            log_handle = open(log_path, "a", encoding="utf-8", buffering=1)
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=log_handle,
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
            self._monitor_stream_process(GROUP_STREAM_ID, proc, [device.id for device in devices])
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
                    self.is_playing = self._start_airplay_streams(wav_path)
                    self._paused_stream_expired = False
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
            self._stop_current_stream()
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

            # Group membership is negotiated at sender startup. Recreate the
            # shared sender when changing rooms so an old member is never left
            # playing from the prior group session.
            if (self.is_playing or self._stream_procs) and self.current_track:
                video_id = self.current_track.get("videoId")
                wav_path = f"/tmp/ytmusic_{video_id}.wav"
                if os.path.exists(wav_path):
                    was_paused = not self.is_playing
                    self._stop_current_stream()
                    self._start_airplay_streams(wav_path)
                    if was_paused:
                        self._write_stream_command("pause")
                        self._paused_at = time.monotonic()

        self._broadcast_state()
        return self.get_state()

    def set_device_volume(self, device_id: str, volume: int) -> Dict[str, Any]:
        device_id = str(device_id)
        if device_id in self.devices:
            device = self.devices[device_id]
            device.volume = max(0, min(100, volume))
            if device_id in self.active_targets:
                self._write_stream_command(
                    f"volume {device.address} {device.volume / 100.0:.4f}"
                )
        self._broadcast_state()
        return self.get_state()

    def set_master_volume(self, volume: int) -> Dict[str, Any]:
        self.master_volume = max(0, min(100, volume))
        for dev in self.devices.values():
            if dev.is_selected:
                dev.volume = self.master_volume
        self._write_stream_command(f"volume {self.master_volume / 100.0:.4f}")
        self._broadcast_state()
        return self.get_state()

player_engine = PlayerEngine()
