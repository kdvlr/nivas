# Sonos Kitchen working checkpoint — 2026-08-11

This checkpoint is the exact `linsrv` source tree and release binary that
successfully played `/tmp/real_song10.wav` on the Kitchen Sonos speaker.

## Confirmed working command

```sh
ssh linsrv "sudo fuser -k 319/udp 320/udp 2>/dev/null || true; docker run --rm --net=host -v /tmp:/tmp -v /tmp/airplay2-rs-build:/app -w /app rust:latest /app/target/release/examples/play_audio 192.168.120.111 7000 /tmp/real_song10.wav --airplay2 --ptp --ptp-master --volume 0.61"
```

## Verification

- Kitchen address: `192.168.120.111:7000`
- Audio was heard and confirmed by the user.
- Music file: `/tmp/real_song10.wav`
- AirPlay 2 timing option: `--ptp --ptp-master`
- Requested volume: `0.61`
- Known limitation: playback works, but volume could not be controlled from
  the Sonos app during this session.

## Saved artifacts

- `sonos-working-source-20260811.tar.gz`: `/tmp/airplay2-rs-build` source from
  `linsrv`, excluding `target/`.
- `play_audio-working`: exact release binary used for the successful playback.

SHA-256:

```text
e198210cba3b28e44b4ea94597e64081e3e5062a6210e87025d53578a8e98f00  play_audio-working
7f5b38b98d2899c345acc2779ca28e0cc7d6ea6c887f3624aa4f845f16e1f54d  sonos-working-source-20260811.tar.gz
```

Do not replace this checkpoint with the local experimental tree unless a new
version has been audibly verified on Kitchen.
