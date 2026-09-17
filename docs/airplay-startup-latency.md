# AirPlay startup latency analysis

Date: 2026-09-16

## Executive summary

The approximately 12-second start is dominated by the Sonos PTP clock handshake, not by the HTTP API, Python orchestration, or process creation.

For a cached track selected while Family Room and Kitchen were active, the measured path was:

| Milestone | Timestamp (UTC) | Time from request |
| --- | ---: | ---: |
| `POST /player/play` received | 02:26:29.528 | 0.000 s |
| Native sender connecting | 02:26:29.532 | 0.004 s |
| PTP setup starts | 02:26:29.856 | 0.328 s |
| First PTP attempt sent; delay exchange succeeds | 02:26:30.234 | 0.706 s |
| First attempt expires without Sonos Announce | 02:26:33.235 | 3.707 s |
| Second attempt expires without Sonos Announce | 02:26:36.615 | 7.087 s |
| Third attempt sent | 02:26:36.995 | 7.467 s |
| Sonos Announce received; clock setup complete | 02:26:38.015 | 8.487 s |
| Configured receiver render delay | — | +2.000 s |
| Expected audible start, excluding final RTSP setup | — | about 10.5–12 s |

The delay exchange succeeds on the first attempt. The sender then waits roughly 6.8 additional seconds solely because `run_ptp_group_master_flow` also requires a Sonos Announce and each incomplete attempt has a three-second deadline.

## Complete startup path and optimization opportunities

### 1. Browser action and player API

The browser sends the selected track to `POST /api/ytmusic/player/play`. The backend chooses the default target if necessary, updates the player state, and starts asynchronous playback orchestration.

Observed cost: no material delay in the production sample. This stage was not separately instrumented to sub-millisecond precision, but all Python work through native process launch took only 4 ms on a cache hit.

Optimizations:

- Add one correlation/generation ID to the browser request, Python logs, and native sender logs. This does not make playback faster, but makes every later measurement attributable to one user action.
- Keep the route asynchronous and ensure process termination or other blocking waits never execute on the event-loop thread.
- Ignore duplicate play requests for the same track and coalesce rapidly superseded requests.

Priority: instrumentation and correctness, not a meaningful latency reduction for normal starts.

### 2. Stop and clean up the previous sender

`play_track` stops the previous sender before preparing the new track, and orchestration makes a second defensive stop immediately before launching the replacement. Graceful shutdown can wait up to 1.5 seconds, followed by termination escalation.

Observed cost: not responsible for the measured cached start above; process launch still occurred within 4 ms. It can nevertheless add latency when a previous sender is slow to acknowledge teardown. Repeated teardown/start also discards receiver and PTP state that could otherwise be reused.

Optimizations:

- Record `teardown_requested`, `teardown_complete`, and escalation timestamps.
- Make the stop operation idempotent so the defensive second stop is normally a no-op.
- Keep blocking `Popen.wait` calls out of FastAPI's event-loop thread.
- Longer term, retain the native sender across track changes and instruct it to replace the audio source on the existing sessions. This is the cleanest way to avoid a full AirPlay and PTP setup for every song, but is a larger change than the first targeted fix.

Priority: medium. Important for rapid next/previous operations and room changes, but not the primary measured 12-second delay.

### 3. Resolve a YouTube result to a pure-audio release

For a YouTube item not already marked `isPureAudio`, Nivas performs an additional YouTube Music lookup before preparing media.

Observed cost: not present in the measured local-track samples. It remains an unmeasured network-dependent stage for YouTube selections.

Optimizations:

- Resolve and store the pure-audio ID when search, playlist, related, and autoplay results are created instead of waiting until Play.
- Cache the source-ID to pure-audio-ID mapping.
- Pre-resolve the next queue entries in the background.
- Add start/end timing around this lookup before changing its behavior.

Priority: medium for uncached YouTube songs; zero for local songs and results already marked pure audio.

### 4. Obtain and normalize audio

The native sender is currently given a complete 44.1 kHz, stereo, 16-bit PCM WAV. On a cache miss, Nivas waits for the entire file to be downloaded/decoded and written before starting AirPlay.

Measured production costs:

| Input | Preparation time |
| --- | ---: |
| Prepared/cached WAV | approximately 0 s |
| Local MP3 (`Vaanga Makka Vaanga`) | 1.217 s |
| Local FLAC (`Rut Aa Gayee Re`) | 4.644 s |

YouTube cache-miss time was not captured in this sample and includes both network download and complete-file conversion.

Optimizations:

- Keep prefetching at least the next track. The measured cache-hit path proves this removes the entire preparation delay.
- Prioritize the explicit queue and `play next` entry over speculative autoplay prefetch.
- The Rust `AudioDecoder` already uses Symphonia and can decode multiple file formats and resample them. Pass compatible local MP3/FLAC files directly to the native sender instead of first producing a complete WAV. Validate every format in the library before enabling this path broadly.
- For YouTube, start from a stream or growing local source instead of requiring the whole track to finish downloading and transcoding. This offers a large cold-start gain but is a larger reliability change.
- Preserve the current full-WAV cache as a fallback until direct/streaming decode has passed Sonos/WiiM, pause/resume, seek, and multi-room tests.

Priority: high after the PTP fix. Direct local decoding can save 1–5 seconds on cache misses; prefetch already reduces this stage to nearly zero.

### 5. Artwork and metadata preparation

Artwork download previously shared the audio critical path. It is now scheduled in the background, and cached artwork is attached when available.

Observed cost: no longer blocks sender launch.

Optimizations:

- Keep artwork off the audio critical path.
- Prefetch high-resolution artwork with the next track.
- Send metadata after audio-session readiness if a receiver's metadata request is ever shown to delay startup.

Priority: already optimized; do not spend more startup work here without evidence.

### 6. Native process launch and receiver connection

Python builds the sender command and starts `airplay-play-audio`. Connections to the selected receivers are initiated in parallel.

Observed cached-track cost: 4 ms from API request to native `Connecting` logs. Native connection to PTP setup took roughly another 0.32 seconds.

Optimizations:

- No major process-launch rewrite is justified by the measurements.
- Continue connecting group members in parallel.
- Emit structured milestones for TCP connected, pair-verify complete, RTSP setup complete, and first audio packet so this sub-stage remains visible.
- Reusing a persistent sender would remove most of this stage on track changes, but PTP reuse is the larger benefit.

Priority: low as an isolated optimization.

### 7. Sonos PTP clock negotiation

For a group containing Kitchen, Nivas becomes the PTP master. It sends Sync, Announce, and Signaling packets and waits until every expected PTP peer has both announced itself and completed a delay exchange.

Measured cost: approximately 8.16 seconds from PTP setup start to clock readiness, or 8.48 seconds from the user's cached-track request.

The first delay exchange completed after roughly 0.38 seconds. Sonos did not send the required Announce during either of the first two three-second windows. Its Announce arrived about 1.02 seconds into the third attempt. This behavior repeated across multiple song starts. In one room-change sample, an Announce was already available and PTP completed in about 0.38 seconds, proving the eight-second delay is not inherently required for every setup.

Optimizations, in increasing order of scope:

1. Add an integration test and packet capture around this exact handshake before relaxing its readiness rule.
2. Reduce dead waiting: retransmit the negotiation burst on a shorter cadence instead of waiting three seconds between bursts. This is low risk if the same required readiness conditions remain.
3. Determine from the known-good Apple capture whether a successful Delay Request/Response plus our winning master priority is sufficient to begin RTSP while continuing to listen for Sonos Announce in the background. If confirmed, this can reduce PTP gating from about 8.2 seconds to under one second.
4. Retain one PTP master task and clock identity while playback continues across track boundaries. New tracks would reuse the synchronized clock domain rather than renegotiating. This should provide the most reliable near-instant next-track behavior, but requires persistent native sessions or a separate long-lived timing service.

Priority: highest. This stage accounts for roughly two thirds of the reported start time and nearly all of the cached-track delay.

Safety constraint: do not simply delete PTP readiness waiting. Kitchen previously produced accepted RTSP sessions with silent audio when timing details were wrong. Any relaxed gate must preserve synchronized, audible Sonos/WiiM playback and be verified across VLAN 120.

### 8. Secondary RTSP setup and group start

After the PTP master is ready, the sender completes setup for non-PTP group members and starts all streams on a common timeline.

Observed cost: the current plain-text `Starting playback` and `streaming started` messages lack timestamps, so this stage cannot yet be isolated precisely. The surrounding timestamped logs suggest it is much smaller than PTP negotiation.

Optimizations:

- Timestamp these milestones and the first RTP packet for every receiver.
- Preserve parallel setup where protocol dependencies permit it.
- Do not mark a receiver connected in the UI until its native setup milestone arrives.

Priority: measure first; likely low relative to PTP.

### 9. Receiver render buffer and first audible sample

Nivas configures a 2,000 ms render delay. This gives every room time to buffer and play the same RTP timestamp, preserving synchronization and reliability over the VLAN.

Observed/configured cost: 2.000 seconds by design.

Optimizations:

- After fixing PTP, test 1,500 ms and then 1,000 ms with all three rooms. Measure audible synchronization and packet-loss recovery rather than changing the default blindly.
- If receivers have different minimum safe buffers, use the smallest group-safe value or per-receiver scheduling offsets without changing the common audible start time.
- Keep 2,000 ms as the fallback for mixed Sonos/WiiM groups if shorter values cause silence or loss of synchronization.

Priority: third. Potential saving is 0.5–1 second, but this buffer is serving a real synchronization purpose.

### 10. UI transition from loading to playing

Python currently updates `is_playing` before receiver readiness, while native `Position` output is periodic. A moving browser progress bar therefore does not prove that RTP is flowing or audible.

Optimizations:

- Introduce explicit `preparing`, `connecting`, `buffering`, `playing`, and `failed` states.
- Change to `playing` only after native setup succeeds and the sender reports its first audio packet/timeline start.
- Emit the first progress event immediately instead of waiting for the normal periodic reporting interval.
- Detect absence of sender progress and perform one bounded recovery instead of letting the UI advance silently.

Priority: high for truthful behavior and diagnosing silent starts, but it does not directly reduce acoustic latency.

## Recommended minimum implementation sequence

1. Add correlated timestamps for all milestones, especially timestamped group-start and first-RTP events. This makes the next test definitive and is a small, low-risk change.
2. Fix the PTP negotiation wait. First shorten the retransmission interval while preserving both readiness checks; compare against a packet capture. If Sonos still only Announces on its periodic schedule, validate beginning setup after the first successful delay exchange while Announce monitoring continues.
3. Bypass full-file WAV conversion for supported local formats using the existing Rust decoder, with WAV fallback.
4. Keep next-track prefetch and make its priority deterministic.
5. Only after the above, test reducing the render delay from 2,000 ms.
6. Treat persistent AirPlay/PTP sessions across track changes as the follow-up architecture if the target is effectively gapless starts. It should not be the first change because it expands lifecycle, pause/resume, cleanup, and failure-recovery scope.

## Expected outcome

For a cached track in a mixed Family Room/Kitchen group, removing the two wasted PTP timeout windows should reduce the current approximately 12-second start to roughly 4–6 seconds without changing the 2-second render buffer. If PTP state can safely remain alive across tracks, subsequent prefetched songs should be able to start near the fixed render-buffer duration. Direct local decoding would additionally remove the measured 1–5 seconds of conversion from uncached local songs.

