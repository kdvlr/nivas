# Sonos source pause/resume working checkpoint

Confirmed on 2026-08-11 against Kitchen Sonos Era 100 at
`192.168.120.111:7000` using `/tmp/real_song120.wav`.

Working behavior:

- Audio playback
- Source/Nivas pause
- Source/Nivas resume
- Sonos-app volume control retained from the preceding checkpoint

The key resume correction is to capture the next RTP sequence and wire
timestamp at pause, send that position in `FLUSH`, then send the same RTP-Info
in `RECORD` before restarting packet production.

Test command:

```sh
sudo pkill -f [t]arget/release/examples/play_audio || true
sudo fuser -k 319/udp 320/udp 2>/dev/null || true
docker run --rm --net=host \
  -v /tmp:/tmp \
  -v /tmp/airplay2-rs-build:/app \
  -w /app rust:latest \
  /app/target/release/examples/play_audio \
  192.168.120.111 7000 /tmp/real_song120.wav \
  --airplay2 --ptp --ptp-master --volume 0.61 --source-pause-test
```

`airplay2-rs-source.tar.gz` contains the exact confirmed source tree.
`SHA256SUMS` records its checksum.
