# Sonos audio + volume working checkpoint

Validated on 2026-08-11 against Kitchen (`192.168.120.111`, Sonos Era 100):

- Audio playback works with PTP master mode.
- Sonos-app volume control works.
- The encrypted AirPlay event channel uses separately derived, reversed Events keys.
- `POST /command` messages decrypt successfully and receive minimal encrypted RTSP acknowledgments.
- Pause commands are decoded, but resume is not yet working.

Source archive SHA-256:

`3803adba98310c7c978e0d54449b28e2bad907b62f302aaa5ac85e64267f8841`

Test command:

```sh
sudo fuser -k 319/udp 320/udp 2>/dev/null || true
docker run --rm --net=host \
  -v /tmp:/tmp \
  -v /tmp/airplay2-rs-build:/app \
  -w /app rust:latest \
  /app/target/release/examples/play_audio \
  192.168.120.111 7000 /tmp/real_song120.wav \
  --airplay2 --ptp --ptp-master --volume 0.61
```
