import asyncio
import io
import json
import subprocess
import time
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest

from app.services.player_engine import AirPlayDevice, GROUP_STREAM_ID, MUSIC_UI_IDLE_TIMEOUT_SECONDS, PlayerEngine


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
        "volume 192.168.120.111 0.4700\n"
        "volume 192.168.100.157 0.8000\n"
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


@pytest.mark.asyncio
async def test_idle_music_session_clears_after_thirty_minutes(monkeypatch):
    engine, _, _ = configured_engine()
    engine.current_track = {"videoId": "paused", "title": "Paused"}
    engine.queue = [{"videoId": "next", "title": "Next"}]
    engine.is_playing = False
    engine._last_audio_at = 100.0

    sleeps = 0
    async def one_tick(_seconds):
        nonlocal sleeps
        sleeps += 1
        if sleeps > 1:
            raise asyncio.CancelledError

    monkeypatch.setattr("app.services.player_engine.asyncio.sleep", one_tick)
    monkeypatch.setattr("app.services.player_engine.time.monotonic", lambda: 100.0 + MUSIC_UI_IDLE_TIMEOUT_SECONDS)

    await engine._playback_ticker()

    assert engine.current_track is None
    assert engine.queue == []


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


def test_speaker_volume_persists_in_preferences(tmp_path):
    engine = PlayerEngine()
    engine._preferences_path = tmp_path / "airplay_preferences.json"
    kitchen = AirPlayDevice("kitchen", "Kitchen", "192.168.120.111", 7000, "Sonos Era 100")
    engine.devices[kitchen.id] = kitchen

    engine.set_device_volume(kitchen.id, 45)

    data = json.loads(engine._preferences_path.read_text(encoding="utf-8"))
    assert data["deviceVolumes"][kitchen.id] == 45

    # Create new engine instance and verify restored volume
    new_engine = PlayerEngine()
    new_engine._preferences_path = engine._preferences_path
    hidden, selected_ids, selected_names, volumes = new_engine._load_preferences()
    assert volumes[kitchen.id] == 45


def test_selected_speaker_persists_and_restores(tmp_path):
    engine = PlayerEngine()
    engine._preferences_path = tmp_path / "airplay_preferences.json"
    master_bed = AirPlayDevice("192.168.1.50", "Master Bedroom", "192.168.1.50", 7000, "Apple TV 4K")
    engine.devices[master_bed.id] = master_bed

    engine.toggle_device(master_bed.id, True)

    data = json.loads(engine._preferences_path.read_text(encoding="utf-8"))
    assert "192.168.1.50" in data["selectedDeviceIds"]
    assert "Master Bedroom" in data["selectedDeviceNames"]

    # Re-instantiate engine and verify preferences
    new_engine = PlayerEngine()
    new_engine._preferences_path = engine._preferences_path
    assert "192.168.1.50" in new_engine._selected_device_ids
    assert "Master Bedroom" in new_engine._selected_device_names


@pytest.mark.asyncio
async def test_scan_devices_discovers_tv_and_restores_selection(tmp_path):
    engine = PlayerEngine()
    engine._preferences_path = tmp_path / "airplay_preferences.json"
    engine._selected_device_names.add("Master Bedroom TV")

    airplay_service = SimpleNamespace(
        port=7000,
        properties={"manufacturer": "Apple", "model": "Apple TV"},
    )
    config = SimpleNamespace(
        address="192.168.1.55",
        name="Master Bedroom TV",
        device_info=SimpleNamespace(model="Apple TV"),
        get_service=lambda protocol: airplay_service if protocol.name == "AirPlay" else None,
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
    assert devices[0]["name"] == "Master Bedroom TV"
    assert devices[0]["isSelected"] is True
    assert "192.168.1.55" in engine.active_targets


def test_played_history_deduplication():
    engine = PlayerEngine()
    now = time.time()
    engine.played_history["recent_track"] = now - 1800  # 30 mins ago
    engine.played_history["old_track"] = now - (5 * 3600)  # 5 hours ago

    recent_ids = engine.get_recently_played_ids(hours=4.0)
    assert "recent_track" in recent_ids
    assert "old_track" not in recent_ids


def test_transcode_to_wav_runs_standard_pcm_transcoding(monkeypatch):
    engine = PlayerEngine()
    captured_cmd = []

    def mock_run(cmd, check=True, stdout=None, stderr=None):
        captured_cmd.extend(cmd)

    monkeypatch.setattr(subprocess, "run", mock_run)
    engine._transcode_to_wav("http://example.com/stream.m4a", "/tmp/output.wav")

    assert "ffmpeg" in captured_cmd
    assert "-acodec" in captured_cmd
    codec_idx = captured_cmd.index("-acodec")
    assert captured_cmd[codec_idx + 1] == "pcm_s16le"


