import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from '../components/ytmusic/MiniPlayerBar'
import { getPlayerElapsed, subscribePlayerElapsed } from './playerProgress'
import {
  LOCK_SCREEN_REMOTE_STORAGE_KEY,
  buildPositionState,
  createSilentWavBytes,
  isExternalAudioInterruption,
  resolveArtworkUrl,
} from './lockScreenRemoteHelpers'

export {
  LOCK_SCREEN_REMOTE_STORAGE_KEY,
  buildPositionState,
  createSilentWavBytes,
  isExternalAudioInterruption,
  resolveArtworkUrl,
}

export interface LockScreenRemoteState {
  supported: boolean
  enabled: boolean
  isArmed: boolean
  toggle: () => void
  arm: () => void
}

export interface UseLockScreenRemoteOptions {
  currentTrack: Track | null
  isPlaying: boolean
  durationSeconds: number
  onPlay: () => void
  onPause: () => void
  onNext: () => void
  onPrev: () => void
  onSeek: (seconds: number) => void
  onStop?: () => void
}

function readStoredEnabled(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(LOCK_SCREEN_REMOTE_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function writeStoredEnabled(enabled: boolean) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (enabled) localStorage.setItem(LOCK_SCREEN_REMOTE_STORAGE_KEY, '1')
      else localStorage.removeItem(LOCK_SCREEN_REMOTE_STORAGE_KEY)
    }
  } catch {
    // ignore storage quota / privacy mode errors
  }
}

function supportsMediaSession(): boolean {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof Audio !== 'undefined'
}

export function useLockScreenRemote({
  currentTrack,
  isPlaying,
  durationSeconds,
  onPlay,
  onPause,
  onNext,
  onPrev,
  onSeek,
  onStop,
}: UseLockScreenRemoteOptions): LockScreenRemoteState {
  const supported = supportsMediaSession()
  const [enabled, setEnabled] = useState<boolean>(() => (supported ? readStoredEnabled() : false))
  const [isArmed, setIsArmed] = useState<boolean>(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const blobUrlRef = useRef<string | null>(null)
  const programmaticPauseRef = useRef<boolean>(false)
  const lastMediaSessionPauseAtRef = useRef<number>(-1)
  const lastReportedPositionRef = useRef<{ position: number; at: number } | null>(null)

  const stateRef = useRef({
    enabled,
    isArmed,
    isPlaying,
    durationSeconds,
    hasTrack: Boolean(currentTrack),
    onPlay,
    onPause,
    onNext,
    onPrev,
    onSeek,
    onStop,
  })
  stateRef.current = {
    enabled,
    isArmed,
    isPlaying,
    durationSeconds,
    hasTrack: Boolean(currentTrack),
    onPlay,
    onPause,
    onNext,
    onPrev,
    onSeek,
    onStop,
  }

  const syncPositionState = useCallback((force = false) => {
    if (!supported || !stateRef.current.enabled || !stateRef.current.isArmed) return
    const ms = navigator.mediaSession
    if (typeof ms?.setPositionState !== 'function') return

    const duration = stateRef.current.durationSeconds
    const elapsed = getPlayerElapsed()
    const payload = buildPositionState(duration, elapsed, stateRef.current.isPlaying)
    if (!payload) return

    const now = Date.now()
    const prev = lastReportedPositionRef.current
    if (!force && prev) {
      const expected = prev.position + (stateRef.current.isPlaying ? (now - prev.at) / 1000 : 0)
      if (Math.abs(payload.position - expected) < 2.0) return
    }

    try {
      ms.setPositionState(payload)
      lastReportedPositionRef.current = { position: payload.position, at: now }
    } catch {
      // ignore unsupported or transient MediaPositionState errors
    }
  }, [supported])

  const ensureAudioElement = useCallback((): HTMLAudioElement | null => {
    if (!supported) return null
    if (audioRef.current) return audioRef.current

    const wavBytes = createSilentWavBytes(1, 8000)
    const blob = new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' })
    const url = URL.createObjectURL(blob)
    blobUrlRef.current = url

    const audio = new Audio(url)
    audio.loop = true
    audio.preload = 'auto'
    audio.setAttribute('playsinline', '')
    audio.setAttribute('webkit-playsinline', '')
    // Keep volume non-zero so iOS Safari grants MediaSession focus; the WAV
    // itself is 100% digital silence (all zero PCM samples).
    audio.volume = 0.01

    audio.addEventListener('pause', () => {
      const msSinceAction =
        lastMediaSessionPauseAtRef.current >= 0
          ? Date.now() - lastMediaSessionPauseAtRef.current
          : -1
      if (
        isExternalAudioInterruption({
          nivasIsPlaying: stateRef.current.isPlaying,
          programmaticPause: programmaticPauseRef.current,
          msSinceMediaSessionPause: msSinceAction,
        })
      ) {
        // Another app (phone call, YouTube, etc.) took iOS audio focus.
        // Yield this phone's Lock Screen without pausing the house speakers.
        setIsArmed(false)
      }
      programmaticPauseRef.current = false
    })

    audioRef.current = audio
    return audio
  }, [supported])

  const teardownAudio = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      programmaticPauseRef.current = true
      try {
        audio.pause()
        audio.src = ''
        audio.load()
      } catch {
        // ignore
      }
      audioRef.current = null
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current)
      blobUrlRef.current = null
    }
    if (supported) {
      try {
        navigator.mediaSession.playbackState = 'none'
        navigator.mediaSession.metadata = null
        const actions: MediaSessionAction[] = [
          'play',
          'pause',
          'nexttrack',
          'previoustrack',
          'seekto',
          'stop',
        ]
        for (const action of actions) {
          try {
            navigator.mediaSession.setActionHandler(action, null)
          } catch {
            // ignore unsupported actions
          }
        }
      } catch {
        // ignore
      }
    }
    lastReportedPositionRef.current = null
    setIsArmed(false)
  }, [supported])

  const arm = useCallback(() => {
    if (!supported) return
    const audio = ensureAudioElement()
    if (!audio) return

    const playPromise = audio.play()
    if (playPromise && typeof playPromise.then === 'function') {
      playPromise
        .then(() => {
          setIsArmed(true)
          if (!stateRef.current.isPlaying) {
            programmaticPauseRef.current = true
            audio.pause()
          }
          syncPositionState(true)
        })
        .catch(() => {
          setIsArmed(false)
        })
    } else {
      setIsArmed(true)
      syncPositionState(true)
    }
  }, [supported, ensureAudioElement, syncPositionState])

  const toggle = useCallback(() => {
    if (!supported) return
    if (enabled && isArmed) {
      setEnabled(false)
      writeStoredEnabled(false)
      teardownAudio()
    } else {
      setEnabled(true)
      writeStoredEnabled(true)
      arm()
    }
  }, [supported, enabled, isArmed, teardownAudio, arm])

  // Sync silent <audio> play/pause with Nivas playback state while armed.
  useEffect(() => {
    if (!supported || !enabled || !isArmed) return
    const audio = audioRef.current
    if (!audio) return

    if (isPlaying && currentTrack) {
      if (audio.paused) {
        audio.play().catch(() => {
          setIsArmed(false)
        })
      }
      navigator.mediaSession.playbackState = 'playing'
    } else if (currentTrack) {
      if (!audio.paused) {
        programmaticPauseRef.current = true
        audio.pause()
      }
      navigator.mediaSession.playbackState = 'paused'
    } else {
      if (!audio.paused) {
        programmaticPauseRef.current = true
        audio.pause()
      }
      navigator.mediaSession.playbackState = 'none'
    }
    syncPositionState(true)
  }, [supported, enabled, isArmed, isPlaying, currentTrack, syncPositionState])

  // Sync MediaMetadata whenever the active track changes.
  useEffect(() => {
    if (!supported || !enabled || !isArmed) return
    if (!currentTrack) {
      navigator.mediaSession.metadata = null
      return
    }
    const artworkHref = resolveArtworkUrl(currentTrack.thumbnail, window.location.origin)
    const artwork: MediaImage[] = artworkHref
      ? [{ src: artworkHref, sizes: '512x512', type: 'image/jpeg' }]
      : []

    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title || 'Nivas',
        artist: currentTrack.artist || 'Nivas',
        album: currentTrack.album || 'Nivas',
        artwork,
      })
    } catch {
      // ignore if MediaMetadata constructor is unavailable
    }
    lastReportedPositionRef.current = null
    syncPositionState(true)
  }, [supported, enabled, isArmed, currentTrack, durationSeconds, syncPositionState])

  // Register MediaSession action handlers while armed.
  useEffect(() => {
    if (!supported || !enabled || !isArmed) return
    const ms = navigator.mediaSession

    const bind = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, handler)
      } catch {
        // ignore actions unsupported by the browser
      }
    }

    bind('play', () => {
      audioRef.current?.play().catch(() => {})
      stateRef.current.onPlay()
    })
    bind('pause', () => {
      lastMediaSessionPauseAtRef.current = Date.now()
      programmaticPauseRef.current = true
      audioRef.current?.pause()
      stateRef.current.onPause()
    })
    bind('nexttrack', () => {
      stateRef.current.onNext()
    })
    bind('previoustrack', () => {
      stateRef.current.onPrev()
    })
    bind('seekto', (details) => {
      if (typeof details.seekTime === 'number' && Number.isFinite(details.seekTime)) {
        stateRef.current.onSeek(Math.max(0, details.seekTime))
        lastReportedPositionRef.current = null
        syncPositionState(true)
      }
    })
    bind('stop', () => {
      if (stateRef.current.onStop) stateRef.current.onStop()
      else stateRef.current.onPause()
    })

    return () => {
      bind('play', null)
      bind('pause', null)
      bind('nexttrack', null)
      bind('previoustrack', null)
      bind('seekto', null)
      bind('stop', null)
    }
  }, [supported, enabled, isArmed, syncPositionState])

  // Subscribe to per-second elapsed store without re-rendering App.
  useEffect(() => {
    if (!supported || !enabled || !isArmed) return
    return subscribePlayerElapsed(() => {
      syncPositionState(false)
    })
  }, [supported, enabled, isArmed, syncPositionState])

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      teardownAudio()
    }
  }, [teardownAudio])

  return {
    supported,
    enabled,
    isArmed,
    toggle,
    arm,
  }
}
