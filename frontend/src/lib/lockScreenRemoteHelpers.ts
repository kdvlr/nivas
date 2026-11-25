export const LOCK_SCREEN_REMOTE_STORAGE_KEY = 'nivas_lockscreen_remote'

/**
 * Returns true on iPhone / iPad (including iPadOS desktop-mode Safari where
 * navigator.platform is "MacIntel" with touch points > 1), and false on
 * desktop Macs/PCs and Fully Kiosk wall tablets.
 */
export function isIOSDevice(params?: {
  userAgent?: string
  platform?: string
  maxTouchPoints?: number
  isFullyKiosk?: boolean
}): boolean {
  const isFully = params?.isFullyKiosk ?? (typeof window !== 'undefined' && Boolean((window as any).fully))
  if (isFully) return false

  const ua = params?.userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '')
  const platform = params?.platform ?? (typeof navigator !== 'undefined' ? navigator.platform : '')
  const touchPoints = params?.maxTouchPoints ?? (typeof navigator !== 'undefined' ? navigator.maxTouchPoints : 0)

  if (/iPhone|iPad|iPod/i.test(ua)) return true
  if (platform === 'MacIntel' && touchPoints > 1) return true
  return false
}

/**
 * Generates a valid 16-bit mono PCM WAV buffer with imperceptible 1-LSB dither
 * (-90 dBFS, completely inaudible).
 *
 * iOS Safari / WebKit suppresses Lock Screen Now Playing cards for audio
 * shorter than ~5 seconds (to ignore UI sound effects) and may deprioritize
 * all-zero buffers. Using a 30-second 8 kHz PCM WAV (~480 KB in memory) with
 * 1-LSB alternating samples ensures iOS promotes the Lock Screen card reliably.
 */
export function createSilentWavBytes(durationSeconds = 30, sampleRate = 8000): Uint8Array {
  const numChannels = 1
  const bitsPerSample = 16
  const numSamples = Math.max(1, Math.floor(durationSeconds * sampleRate))
  const dataByteLength = numSamples * numChannels * (bitsPerSample / 8)
  const buffer = new ArrayBuffer(44 + dataByteLength)
  const view = new DataView(buffer)

  const writeAscii = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i))
    }
  }

  writeAscii(0, 'RIFF')
  view.setUint32(4, 36 + dataByteLength, true)
  writeAscii(8, 'WAVE')
  writeAscii(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM header size
  view.setUint16(20, 1, true) // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true)
  view.setUint16(32, numChannels * (bitsPerSample / 8), true)
  view.setUint16(34, bitsPerSample, true)
  writeAscii(36, 'data')
  view.setUint32(40, dataByteLength, true)

  // Write imperceptible +/-1 LSB dither (-90 dBFS) so iOS AVAudioSession
  // recognizes non-silent playback and promotes the Lock Screen card.
  for (let i = 0; i < numSamples; i++) {
    view.setInt16(44 + i * 2, i % 2 === 0 ? 1 : -1, true)
  }

  return new Uint8Array(buffer)
}

/**
 * Resolves relative artwork URLs (e.g. local NAS covers) to absolute URLs
 * and upgrades low-res YouTube thumbnails so iOS Lock Screen art stays sharp.
 */
export function resolveArtworkUrl(url?: string, origin?: string): string | null {
  if (!url || !url.trim()) return null
  const upgraded = url
    .trim()
    .replace(/=w\d+-h\d+[^?&]*/, '=w512-h512-l90-rj')
    .replace(/=s\d+[^?&]*/, '=s512')

  if (/^https?:\/\//i.test(upgraded)) return upgraded
  if (!origin) return upgraded
  try {
    return new URL(upgraded, origin).href
  } catch {
    return upgraded
  }
}

/**
 * Builds a MediaPositionState safe for Safari/iOS (which throws TypeError
 * if duration <= 0, NaN, or position > duration).
 */
export function buildPositionState(
  durationSeconds: number,
  elapsedSeconds: number,
  isPlaying: boolean,
): { duration: number; position: number; playbackRate: number } | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return null
  const safeElapsed = Number.isFinite(elapsedSeconds) ? elapsedSeconds : 0
  const position = Math.max(0, Math.min(safeElapsed, durationSeconds))
  return {
    duration: durationSeconds,
    position,
    playbackRate: isPlaying ? 1 : 0,
  }
}

/**
 * Returns true if an <audio> `pause` event was caused by an external OS
 * audio interruption (phone call, YouTube video, etc.) rather than Nivas
 * pausing or the user tapping Pause on the Lock Screen.
 */
export function isExternalAudioInterruption(params: {
  nivasIsPlaying: boolean
  programmaticPause: boolean
  msSinceMediaSessionPause: number
}): boolean {
  if (!params.nivasIsPlaying) return false
  if (params.programmaticPause) return false
  if (params.msSinceMediaSessionPause >= 0 && params.msSinceMediaSessionPause < 750) return false
  return true
}
