# All-three AirPlay checkpoint (2026-08-11)

Audibly confirmed synchronized playback of `/tmp/real_song10.wav` on:

- Kitchen (`192.168.120.111`, Sonos Era 100) using PTP
- Living Room (`192.168.120.72`, WiiM Mini) using NTP
- Family Room (`192.168.100.157`, WiiM Mini) using NTP

## Verified command

```sh
sudo fuser -k 319/udp 320/udp 2>/dev/null || true
docker run --rm --net=host \
  -v /tmp:/tmp \
  -v /tmp/airplay2-rs-build:/app \
  -w /app rust:latest \
  /app/target/release/examples/play_audio \
  192.168.120.72,192.168.100.157,192.168.120.111 \
  7000 /tmp/real_song10.wav \
  --airplay2 \
  --ptp-targets 192.168.120.111 \
  --volume 0.61
```

## Key behavior

- NTP sync packets use the legacy unencrypted 20-byte PT84 format, even though audio is encrypted.
- PTP retains its separate Sonos-compatible sync path.
- `play_audio` accepts `--ptp-targets` so one process can use PTP for selected receivers and NTP for the remaining receivers.
- Audio remains encrypted independently with each receiver's session key.

## Files and SHA-256

- `play_audio-working`: `e3e310742ba363297a5b7055292e1392935d2eb1278d68c5f65ffa2d06bbe1b4`
- `all-three-working-source-20260811.tar.gz`: `a76fef5fcaf69198572817c57287965065544eba94c36ea27e31bf0069ccf24e`

The source archive excludes `target/`. The standalone binary is the exact release binary used for the successful test.
