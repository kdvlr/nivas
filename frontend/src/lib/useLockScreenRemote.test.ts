import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildPositionState,
  createSilentWavBytes,
  isExternalAudioInterruption,
  resolveArtworkUrl,
} from './lockScreenRemoteHelpers.ts'

describe('useLockScreenRemote helpers', () => {
  it('generates a valid silent 16-bit mono PCM WAV header and zeroed payload', () => {
    const wav = createSilentWavBytes(1, 8000)
    assert.equal(wav.byteLength, 44 + 8000 * 2)

    const view = new DataView(wav.buffer)
    const riff = String.fromCharCode(wav[0], wav[1], wav[2], wav[3])
    const wave = String.fromCharCode(wav[8], wav[9], wav[10], wav[11])
    assert.equal(riff, 'RIFF')
    assert.equal(wave, 'WAVE')
    assert.equal(view.getUint16(20, true), 1) // PCM
    assert.equal(view.getUint16(22, true), 1) // mono
    assert.equal(view.getUint32(24, true), 8000) // sample rate
    assert.equal(view.getUint32(40, true), 16000) // data bytes

    // All PCM samples should be silent zeroes
    let nonZero = 0
    for (let i = 44; i < wav.length; i++) {
      if (wav[i] !== 0) nonZero++
    }
    assert.equal(nonZero, 0)
  })

  it('resolves relative local artwork paths and upgrades YouTube thumbnails', () => {
    assert.equal(
      resolveArtworkUrl('/api/ytmusic/local/artwork/abc', 'https://nivas.dkiran.com'),
      'https://nivas.dkiran.com/api/ytmusic/local/artwork/abc',
    )
    assert.equal(
      resolveArtworkUrl('https://lh3.googleusercontent.com/abc=w120-h120-l90-rj', 'https://nivas.dkiran.com'),
      'https://lh3.googleusercontent.com/abc=w512-h512-l90-rj',
    )
    assert.equal(resolveArtworkUrl('', 'https://nivas.dkiran.com'), null)
  })

  it('clamps MediaPositionState safely for Safari/iOS', () => {
    assert.equal(buildPositionState(0, 10, true), null)
    assert.equal(buildPositionState(NaN, 10, true), null)
    assert.deepEqual(buildPositionState(240, 260, true), {
      duration: 240,
      position: 240,
      playbackRate: 1,
    })
    assert.deepEqual(buildPositionState(240, -5, false), {
      duration: 240,
      position: 0,
      playbackRate: 0,
    })
  })

  it('distinguishes OS audio interruptions from intentional pauses', () => {
    // Phone call interrupts while Nivas is playing -> external interruption (do NOT pause house speakers)
    assert.equal(
      isExternalAudioInterruption({
        nivasIsPlaying: true,
        programmaticPause: false,
        msSinceMediaSessionPause: -1,
      }),
      true,
    )
    // User tapped Pause on Lock Screen 50ms ago -> intentional pause
    assert.equal(
      isExternalAudioInterruption({
        nivasIsPlaying: true,
        programmaticPause: false,
        msSinceMediaSessionPause: 50,
      }),
      false,
    )
    // Nivas already paused programmatically -> not an interruption
    assert.equal(
      isExternalAudioInterruption({
        nivasIsPlaying: true,
        programmaticPause: true,
        msSinceMediaSessionPause: -1,
      }),
      false,
    )
    // Nivas is not playing -> not an interruption
    assert.equal(
      isExternalAudioInterruption({
        nivasIsPlaying: false,
        programmaticPause: false,
        msSinceMediaSessionPause: -1,
      }),
      false,
    )
  })
})
