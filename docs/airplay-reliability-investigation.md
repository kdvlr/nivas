# AirPlay reliability investigation — 2026-09-16

## User-reported symptoms

- Adding or removing a speaker takes too long.
- Songs take too long to start.
- Occasionally the player progress advances but no audio is audible.

Investigate these together. Preserve working Sonos/WiiM synchronization, runtime volume control, source pause/resume, VLAN compatibility, and idle-session cleanup.

## Confirmed code observations

- `PlayerEngine.toggle_device` stops and recreates the entire shared sender for a membership change. All retained speakers repeat setup and buffering.
- Production logs show identical group starts at 11:15:30.180 and 11:15:30.207 on September 16. This suggests overlapping restart work, but the initiating requests still need correlation.
- `_orchestrate_playback` waits for audio conversion and artwork together before launching the sender. An uncached track must be converted to a complete WAV first. Artwork retrieval can therefore delay audio startup too.
- `_start_airplay_process` marks devices connected immediately after process creation, before native pairing/setup success is confirmed.
- `_playback_ticker` advances elapsed time whenever `is_playing` and `current_track` are set. It does not require receiver readiness or recent sender progress. Moving UI progress does not establish that audio is being transmitted or rendered.

## Next investigation and verification

1. Correlate each play/room-change generation with media preparation, process launch, each receiver's setup, first packets, and native progress.
2. Serialize/coalesce membership changes and ignore redundant selections. Evaluate dynamic group membership while retaining a common playback timeline.
3. Separate loading/connecting from active playback; reject stale sender events. Make startup failure and stalled sender progress visible with bounded recovery.
4. Remove artwork from the critical path and measure cache/prefetch behavior before changing audio buffering.
5. Reproduce silent playback and distinguish setup failure, muted volume, stale sessions, and receiver rejection. Packet transmission alone does not prove audible playback.
6. Verify local and YouTube tracks, cached and uncached starts, individual speakers and mixed Sonos/WiiM groups, rapid room changes, pause/resume, and idle cleanup.

No live playback or deployment was changed during this diagnostic inspection. Root cause of intermittent silence is not yet confirmed.
