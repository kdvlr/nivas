import io
import json
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

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


def test_single_sonos_uses_verified_ptp_master_and_track_metadata():
    engine, kitchen, _ = configured_engine()
    track = {
        "title": "Test Song",
        "artist": "Test Artist",
        "album": "Test Album",
        "duration": 245,
    }

    command = engine._build_airplay_command(
        [kitchen],
        "/tmp/song.wav",
        track,
        "/tmp/artwork.jpg",
    )

    assert "--ptp" in command
    assert "--ptp-master" in command
    assert "--ptp-targets" not in command
    assert command[command.index("--title") + 1] == "Test Song"
    assert command[command.index("--artist") + 1] == "Test Artist"
    assert command[command.index("--album") + 1] == "Test Album"
    assert command[command.index("--duration") + 1] == "245.0"
    assert command[command.index("--artwork") + 1] == "/tmp/artwork.jpg"


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


def test_add_to_queue_and_play_next_preserve_requested_order():
    engine, _, _ = configured_engine()
    later = {"videoId": "later", "title": "Later", "artist": "Artist"}
    next_up = {"videoId": "next", "title": "Next", "artist": "Artist"}

    engine.add_to_queue(later)
    engine.add_to_queue(next_up, play_next=True)

    assert [track["videoId"] for track in engine.queue] == ["next", "later"]
    assert engine.get_state()["autoplayEnabled"] is True


def test_replace_queue_supports_reordering_and_removal():
    engine, _, _ = configured_engine()
    engine.queue = [
        {"videoId": "one", "title": "One", "artist": "Artist"},
        {"videoId": "two", "title": "Two", "artist": "Artist"},
        {"videoId": "three", "title": "Three", "artist": "Artist"},
    ]

    state = engine.replace_queue([engine.queue[2], engine.queue[0]])

    assert [track["videoId"] for track in engine.queue] == ["three", "one"]
    assert [track["videoId"] for track in state["queue"]] == ["three", "one"]


def test_hidden_speakers_persist_and_are_deselected(tmp_path):
    engine, kitchen, _ = configured_engine()
    engine._preferences_path = tmp_path / "airplay_preferences.json"

    state = engine.set_device_hidden(kitchen.id, True)

    kitchen_state = next(device for device in state["devices"] if device["id"] == kitchen.id)
    assert kitchen_state["isHidden"] is True
    assert kitchen_state["isSelected"] is False
    assert kitchen.id not in engine.active_targets
    assert json.loads(engine._preferences_path.read_text())["hiddenDeviceIds"] == [kitchen.id]

    restarted = PlayerEngine()
    restarted._preferences_path = engine._preferences_path
    assert restarted._load_hidden_device_ids() == {kitchen.id}


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


@pytest.mark.asyncio
async def test_scan_devices_uses_airplay_service_port():
    engine = PlayerEngine()
    airplay_service = SimpleNamespace(
        port=7001,
        properties={"manufacturer": "Sonos", "model": "Era 100"},
    )
    config = SimpleNamespace(
        address="192.168.120.111",
        name="Kitchen",
        device_info=SimpleNamespace(model="Sonos Era 100"),
        get_service=lambda protocol: airplay_service
        if protocol.name == "AirPlay"
        else None,
    )
    fake_pyatv = SimpleNamespace(
        const=SimpleNamespace(
            Protocol=SimpleNamespace(
                AirPlay=SimpleNamespace(name="AirPlay"),
                RAOP=SimpleNamespace(name="RAOP"),
            )
        ),
        scan=AsyncMock(return_value=[config]),
    )

    with patch.dict("sys.modules", {"pyatv": fake_pyatv}):
        devices = await engine.scan_devices()

    assert len(devices) == 1
    assert devices[0]["address"] == "192.168.120.111"
    assert devices[0]["port"] == 7001
    assert devices[0]["model"] == "Sonos Era 100"
    assert engine._device_uses_ptp(engine.devices["192.168.120.111"]) is True
