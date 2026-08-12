import io
import time

import pytest

from app.services.player_engine import AirPlayDevice, GROUP_STREAM_ID, PlayerEngine


class FakeProcess:
    def __init__(self):
        self.stdin = io.StringIO()
        self.pid = 12345
        self.returncode = None

    def poll(self):
        return self.returncode

    def wait(self, timeout=None):
        self.returncode = 0
        return 0


def configured_engine():
    engine = PlayerEngine()
    kitchen = AirPlayDevice(
        "kitchen", "Kitchen", "192.168.120.111", 7000, "Sonos Era 100"
    )
    family = AirPlayDevice(
        "family", "Family Room", "192.168.100.157", 7000, "WiiM Mini"
    )
    for device in (kitchen, family):
        device.is_selected = True
        engine.devices[device.id] = device
        engine.active_targets.append(device.id)
    return engine, kitchen, family


def test_build_command_uses_mixed_timing_and_runtime_volume():
    engine, kitchen, family = configured_engine()
    engine.master_volume = 42

    command = engine._build_airplay_command([kitchen, family], "/tmp/song.wav")

    assert command[:4] == [
        "/usr/local/bin/airplay-play-audio",
        "192.168.120.111,192.168.100.157",
        "7000",
        "/tmp/song.wav",
    ]
    assert "--control-stdin" in command
    assert command[command.index("--volume") + 1] == "0.4200"
    assert command[command.index("--ptp-targets") + 1] == "192.168.120.111"


@pytest.mark.asyncio
async def test_pause_and_resume_keep_the_same_sender_process():
    engine, _, _ = configured_engine()
    process = FakeProcess()
    engine._stream_procs[GROUP_STREAM_ID] = process
    engine.current_track = {"videoId": "track"}
    engine.is_playing = True

    await engine.pause()
    assert engine._stream_procs[GROUP_STREAM_ID] is process
    assert process.stdin.getvalue() == "pause\n"
    assert engine.is_playing is False
    assert engine._paused_at is not None

    await engine.resume()
    assert engine._stream_procs[GROUP_STREAM_ID] is process
    assert process.stdin.getvalue() == "pause\nresume\n"
    assert engine.is_playing is True
    assert engine._paused_at is None


def test_volume_commands_are_state_driven_and_targetable():
    engine, kitchen, _ = configured_engine()
    process = FakeProcess()
    engine._stream_procs[GROUP_STREAM_ID] = process

    engine.set_device_volume(kitchen.id, 37)
    engine.set_master_volume(64)

    assert process.stdin.getvalue() == (
        "volume 192.168.120.111 0.3700\n"
        "volume 0.6400\n"
    )


def test_expired_pause_stops_process_and_releases_devices():
    engine, kitchen, family = configured_engine()
    process = FakeProcess()
    engine._stream_procs[GROUP_STREAM_ID] = process
    kitchen.is_connected = True
    family.is_connected = True
    engine._paused_session_timeout = 10
    engine._paused_at = time.monotonic() - 11

    assert engine._cleanup_expired_paused_session() is True

    assert process.stdin.getvalue() == "stop\n"
    assert engine._stream_procs == {}
    assert kitchen.is_connected is False
    assert family.is_connected is False
    assert engine._paused_stream_expired is True
