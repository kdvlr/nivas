import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Icon from './Icon'
import { api } from '../lib/api'
import { Track } from './ytmusic/MiniPlayerBar'
import { usePlayerElapsed } from '../lib/playerProgress'
import AudioReactiveCanvas, { SpectrumData } from './AudioReactiveCanvas'

export type LyricsVisualMode = 'ambient' | 'party' | 'starlight'

export interface SyncedLyricLine {
  time: number
  text: string
}

export interface LyricsPayload {
  videoId: string
  synced: boolean
  lines: SyncedLyricLine[]
  plain: string
  lyrics?: string
  source: string
}

interface FullscreenLyricsProps {
  track: Track
  isPlaying: boolean
  isBuffering?: boolean
  durationSeconds: number
  onClose: () => void
  onTogglePlay: () => void
  onNextTrack: () => void
  onPrevTrack: () => void
  onSeek: (seconds: number) => void
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

function decodeBase64ToBytes(b64: string): Uint8Array {
  const bin = window.atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i)
  }
  return out
}

export default function FullscreenLyrics({
  track,
  isPlaying,
  isBuffering,
  durationSeconds,
  onClose,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
}: FullscreenLyricsProps) {
  const rawElapsed = usePlayerElapsed()
  const [smoothElapsed, setSmoothElapsed] = useState(rawElapsed)
  const lastSyncRef = useRef<{ elapsed: number; at: number }>({
    elapsed: rawElapsed,
    at: performance.now(),
  })

  const [lyricsData, setLyricsData] = useState<LyricsPayload | null>(null)
  const [spectrum, setSpectrum] = useState<SpectrumData | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncOffset, setSyncOffset] = useState(0)
  const [visualMode, setVisualMode] = useState<LyricsVisualMode>('ambient')
  const [bouncingStar, setBouncingStar] = useState(true)

  const effectiveTimeRef = useRef(rawElapsed)
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([])
  const userScrollingUntilRef = useRef(0)

  // Keep smooth sub-second clock synced with server elapsed without layout thrashing
  useEffect(() => {
    lastSyncRef.current = { elapsed: rawElapsed, at: performance.now() }
    setSmoothElapsed(rawElapsed)
  }, [rawElapsed, track.videoId])

  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      const dt = (performance.now() - lastSyncRef.current.at) / 1000
      const next = lastSyncRef.current.elapsed + dt
      setSmoothElapsed(durationSeconds > 0 ? Math.min(next, durationSeconds) : next)
    }, 80)
    return () => window.clearInterval(id)
  }, [isPlaying, durationSeconds])

  // Load persisted settings from server on mount
  useEffect(() => {
    api
      .get<{ syncOffset?: number; visualMode?: LyricsVisualMode; bouncingStar?: boolean }>(
        '/api/ytmusic/lyrics/settings',
      )
      .then((res) => {
        if (typeof res?.syncOffset === 'number') setSyncOffset(res.syncOffset)
        if (res?.visualMode && ['ambient', 'party', 'starlight'].includes(res.visualMode)) {
          setVisualMode(res.visualMode)
        }
        if (typeof res?.bouncingStar === 'boolean') setBouncingStar(res.bouncingStar)
      })
      .catch(() => {})
  }, [])

  const persistSettings = useCallback(
    (patch: { syncOffset?: number; visualMode?: LyricsVisualMode; bouncingStar?: boolean }) => {
      api.put('/api/ytmusic/lyrics/settings', patch).catch(() => {})
    },
    [],
  )

  const adjustOffset = useCallback(
    (delta: number) => {
      setSyncOffset((prev) => {
        const next = Math.round(Math.max(-10, Math.min(10, prev + delta)) * 10) / 10
        persistSettings({ syncOffset: next })
        return next
      })
    },
    [persistSettings],
  )

  const handleVisualMode = useCallback(
    (mode: LyricsVisualMode) => {
      setVisualMode(mode)
      persistSettings({ visualMode: mode })
    },
    [persistSettings],
  )

  const handleToggleStar = useCallback(() => {
    setBouncingStar((prev) => {
      const next = !prev
      persistSettings({ bouncingStar: next })
      return next
    })
  }, [persistSettings])

  // Fetch lyrics on-demand for current track
  const fetchLyrics = useCallback(
    (refresh = false) => {
      setLoading(true)
      const params = new URLSearchParams()
      if (track.title) params.set('title', track.title)
      if (track.artist) params.set('artist', track.artist)
      if (track.album) params.set('album', track.album)
      const dur = durationSeconds || Number(track.duration) || 0
      if (dur > 0) params.set('duration', String(Math.round(dur)))
      if (refresh) params.set('refresh', 'true')

      api
        .get<LyricsPayload>(`/api/ytmusic/lyrics/${encodeURIComponent(track.videoId)}?${params.toString()}`)
        .then((res) => {
          setLyricsData(res || null)
        })
        .catch(() => setLyricsData(null))
        .finally(() => setLoading(false))
    },
    [track.videoId, track.title, track.artist, track.album, track.duration, durationSeconds],
  )

  useEffect(() => {
    lineRefs.current = []
    fetchLyrics(false)
  }, [fetchLyrics])

  // Fetch real FFT audio spectrum for Winamp-style Dance Party & Starlight visuals
  useEffect(() => {
    if (visualMode === 'ambient') return
    let cancelled = false
    setSpectrum(null)
    api
      .get<{ available?: boolean; fps?: number; bands?: number; data?: string }>(
        `/api/ytmusic/lyrics/spectrum/${encodeURIComponent(track.videoId)}`,
      )
      .then((res) => {
        if (cancelled || !res?.available || !res.data) return
        const bytes = decodeBase64ToBytes(res.data)
        const bands = res.bands || 16
        const fps = res.fps || 12
        setSpectrum({
          fps,
          bands,
          bytes,
          frameCount: Math.floor(bytes.length / bands),
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [track.videoId, visualMode])

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const effectiveTime = Math.max(0, smoothElapsed + syncOffset)
  effectiveTimeRef.current = effectiveTime
  const lines = lyricsData?.lines || []
  const isSynced = Boolean(lyricsData?.synced && lines.length > 0)

  // Compute active line index
  const activeIndex = useMemo(() => {
    if (!isSynced) return -1
    let idx = -1
    for (let i = 0; i < lines.length; i++) {
      if (effectiveTime >= lines[i].time) {
        idx = i
      } else {
        break
      }
    }
    return idx
  }, [isSynced, lines, effectiveTime])

  // Progress [0..1] within the active line for the Follow-the-Bouncing-Star
  const activeLineProgress = useMemo(() => {
    if (!isSynced || activeIndex < 0) return 0
    const start = lines[activeIndex].time
    const nextTime =
      activeIndex + 1 < lines.length
        ? lines[activeIndex + 1].time
        : Math.max(start + 4, durationSeconds || start + 5)
    const span = Math.max(0.8, nextTime - start)
    return Math.max(0, Math.min(1, (effectiveTime - start) / span))
  }, [isSynced, activeIndex, lines, effectiveTime, durationSeconds])

  // Instrumental interlude countdown (before first line if > 4s, or long gap > 6s)
  const interludeProgress = useMemo(() => {
    if (!isSynced || lines.length === 0) return null
    if (activeIndex < 0 && lines[0].time >= 4) {
      return Math.max(0, Math.min(1, effectiveTime / lines[0].time))
    }
    if (activeIndex >= 0 && !lines[activeIndex].text && activeIndex + 1 < lines.length) {
      const start = lines[activeIndex].time
      const end = lines[activeIndex + 1].time
      if (end - start >= 4) {
        return Math.max(0, Math.min(1, (effectiveTime - start) / (end - start)))
      }
    }
    return null
  }, [isSynced, lines, activeIndex, effectiveTime])

  // Smoothly center active line when it changes (synced), or gently scroll plain lyrics proportionally
  useEffect(() => {
    if (Date.now() < userScrollingUntilRef.current) return
    const container = scrollContainerRef.current
    if (!container) return
    if (isSynced && activeIndex >= 0) {
      const el = lineRefs.current[activeIndex]
      if (!el) return
      const targetTop = el.offsetTop - container.clientHeight * 0.38 + el.clientHeight / 2
      container.scrollTo({ top: Math.max(0, targetTop), behavior: 'smooth' })
    }
  }, [activeIndex, isSynced])

  const effectiveDuration = durationSeconds || Number(track.duration) || 0
  const animState = isPlaying ? 'running' : 'paused'

  useEffect(() => {
    if (isSynced || !lyricsData?.plain || !isPlaying || effectiveDuration <= 0) return
    if (Date.now() < userScrollingUntilRef.current) return
    const container = scrollContainerRef.current
    if (!container) return
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight)
    if (maxScroll <= 0) return
    const progress = Math.max(0, Math.min(1, effectiveTime / effectiveDuration))
    container.scrollTo({ top: maxScroll * progress, behavior: 'smooth' })
  }, [isSynced, lyricsData?.plain, isPlaying, Math.floor(effectiveTime / 2), effectiveDuration])

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col overflow-hidden bg-[#0a0b12] text-white select-none"
      role="dialog"
      aria-label="Fullscreen sing-along lyrics"
    >
      <style>{`
        @keyframes flAuroraA {
          0% { transform: translate3d(-6%, -4%, 0) scale(1.18) rotate(0deg); }
          50% { transform: translate3d(5%, 4%, 0) scale(1.26) rotate(10deg); }
          100% { transform: translate3d(-6%, -4%, 0) scale(1.18) rotate(0deg); }
        }
        @keyframes flAuroraB {
          0% { transform: translate3d(6%, 5%, 0) scale(1.22) rotate(0deg); }
          50% { transform: translate3d(-5%, -5%, 0) scale(1.15) rotate(-12deg); }
          100% { transform: translate3d(6%, 5%, 0) scale(1.22) rotate(0deg); }
        }
        @keyframes flEqBounce {
          0%, 100% { transform: scaleY(var(--eq-min, 0.15)); }
          50% { transform: scaleY(var(--eq-max, 0.92)); }
        }
        @keyframes flTwinkle {
          0%, 100% { opacity: 0.18; transform: scale(0.8); }
          50% { opacity: 0.95; transform: scale(1.3); }
        }
        @keyframes flFirefly {
          0%, 100% { transform: translate3d(0, 0, 0) scale(0.85); opacity: 0.25; }
          35% { transform: translate3d(18px, -22px, 0) scale(1.2); opacity: 0.9; }
          70% { transform: translate3d(-14px, -10px, 0) scale(0.95); opacity: 0.6; }
        }
        @keyframes flShoot {
          0%, 82% { transform: translate3d(0, 0, 0) rotate(-32deg) scaleX(0); opacity: 0; }
          88% { transform: translate3d(-110px, 68px, 0) rotate(-32deg) scaleX(1); opacity: 0.95; }
          100% { transform: translate3d(-260px, 160px, 0) rotate(-32deg) scaleX(0.2); opacity: 0; }
        }
        @keyframes flStarHop {
          0%, 100% { transform: translateY(0px) rotate(-8deg) scale(1); }
          50% { transform: translateY(-9px) rotate(12deg) scale(1.18); }
        }
      `}</style>

      {/* Living Blurred Album-Art Backdrop */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {track.thumbnail && (
          <>
            <img
              src={track.thumbnail}
              alt=""
              className="absolute -inset-24 h-[calc(100%+12rem)] w-[calc(100%+12rem)] object-cover opacity-55 blur-[72px] saturate-150 transition-opacity duration-700"
              style={{
                animation: 'flAuroraA 26s ease-in-out infinite',
                animationPlayState: animState,
              }}
            />
            <img
              src={track.thumbnail}
              alt=""
              className="absolute -inset-20 h-[calc(100%+10rem)] w-[calc(100%+10rem)] object-cover opacity-35 mix-blend-screen blur-[96px] saturate-200 transition-opacity duration-700"
              style={{
                animation: 'flAuroraB 34s ease-in-out infinite',
                animationPlayState: animState,
              }}
            />
          </>
        )}
        <div
          className={`absolute inset-0 transition-colors duration-700 ${
            visualMode === 'starlight'
              ? 'bg-gradient-to-b from-[#060918]/85 via-[#090d22]/78 to-[#050713]/92'
              : 'bg-gradient-to-br from-black/72 via-black/62 to-black/82'
          }`}
        />

        {/* Audio-Reactive Winamp-style Canvas (Dance Party & Starlight) */}
        <AudioReactiveCanvas
          mode={visualMode}
          isPlaying={isPlaying}
          timeRef={effectiveTimeRef}
          spectrum={spectrum}
        />
      </div>

      {/* Top Bar: Visual Mode Switcher + Bouncing Star Toggle + Close */}
      <header className="relative z-10 flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 pt-4 pb-2 sm:px-8 sm:pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center rounded-full bg-white/10 p-1 backdrop-blur-md border border-white/10">
            {(
              [
                ['ambient', 'Ambient', 'blur_on'],
                ['party', 'Dance Party', 'equalizer'],
                ['starlight', 'Starlight', 'auto_awesome'],
              ] as [LyricsVisualMode, string, string][]
            ).map(([mode, label, icon]) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleVisualMode(mode)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs sm:text-sm font-medium transition cursor-pointer ${
                  visualMode === mode
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-white/75 hover:text-white'
                }`}
              >
                <Icon name={icon} className="text-base" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleToggleStar}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs sm:text-sm font-medium backdrop-blur-md border transition cursor-pointer ${
              bouncingStar
                ? 'bg-amber-300/25 border-amber-300/50 text-amber-200'
                : 'bg-white/10 border-white/10 text-white/70 hover:text-white'
            }`}
            title="Toggle Follow-the-Bouncing-Star"
          >
            <Icon name="star" className="text-base" />
            <span>Bouncing Star</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {lyricsData?.source && lyricsData.source !== 'none' && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md">
              <span
                className={`h-2 w-2 rounded-full ${
                  isSynced ? 'bg-emerald-400' : 'bg-amber-300'
                }`}
              />
              {isSynced ? 'Synced' : 'Plain'} · {lyricsData.source}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close fullscreen lyrics"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur-md hover:bg-white/25 transition cursor-pointer"
          >
            <Icon name="close" className="text-2xl" />
          </button>
        </div>
      </header>

      {/* Main Stage: Left Artwork/Controls + Right Lyrics */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col lg:flex-row lg:items-center lg:gap-10 px-5 pb-6 sm:px-10">
        {/* Left Column: Album Art, Metadata & Controls */}
        <section className="flex shrink-0 flex-row items-center gap-4 py-2 lg:w-[35%] lg:max-w-[440px] lg:flex-col lg:items-center lg:justify-center lg:gap-6">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.65)] ring-1 ring-white/15 sm:h-24 sm:w-24 lg:h-72 lg:w-72 xl:h-80 xl:w-80 lg:rounded-3xl">
            {track.thumbnail ? (
              <img
                src={track.thumbnail}
                alt={track.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-white/10">
                <Icon name="music_note" className="text-5xl text-white/40" />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1 lg:w-full lg:text-center">
            <h1 className="truncate text-lg font-bold tracking-tight text-white sm:text-xl lg:text-2xl xl:text-3xl">
              {track.title}
            </h1>
            <p className="mt-0.5 truncate text-sm font-medium text-white/75 sm:text-base lg:text-lg">
              {track.artist}
            </p>
            {track.album && (
              <p className="mt-0.5 hidden truncate text-xs text-white/50 lg:block lg:text-sm">
                {track.album}
              </p>
            )}

            {/* Progress Bar */}
            <div className="mt-3 lg:mt-6 flex items-center gap-2.5 text-xs tabular-nums text-white/65">
              <span>{formatTime(smoothElapsed)}</span>
              <input
                type="range"
                min={0}
                max={effectiveDuration || 100}
                value={Math.min(smoothElapsed, effectiveDuration || 100)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Seek position"
                className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
              />
              <span>{formatTime(effectiveDuration)}</span>
            </div>

            {/* Transport Controls */}
            <div className="mt-3 lg:mt-5 flex items-center justify-start lg:justify-center gap-3 sm:gap-5">
              <button
                type="button"
                onClick={onPrevTrack}
                aria-label="Previous track"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
              >
                <Icon name="skip_previous" className="text-2xl" />
              </button>
              <button
                type="button"
                onClick={onTogglePlay}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-950 shadow-lg hover:scale-105 active:scale-95 transition cursor-pointer"
              >
                <Icon
                  name={isBuffering ? 'progress_activity' : isPlaying ? 'pause' : 'play_arrow'}
                  className={`text-3xl ${isBuffering ? 'animate-spin' : ''}`}
                />
              </button>
              <button
                type="button"
                onClick={onNextTrack}
                aria-label="Next track"
                className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition cursor-pointer"
              >
                <Icon name="skip_next" className="text-2xl" />
              </button>
            </div>

            {/* Sync Offset + Refresh */}
            <div className="mt-3 lg:mt-5 hidden sm:flex flex-wrap items-center justify-start lg:justify-center gap-2 text-xs text-white/75">
              <div className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 backdrop-blur-md">
                <button
                  type="button"
                  onClick={() => adjustOffset(-0.5)}
                  className="rounded-full px-1.5 py-0.5 hover:bg-white/15 cursor-pointer"
                  title="Delay lyrics by 0.5s"
                >
                  −0.5s
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncOffset(0)
                    persistSettings({ syncOffset: 0 })
                  }}
                  className="px-1.5 font-medium tabular-nums hover:text-white cursor-pointer"
                  title="Reset sync offset"
                >
                  Sync {syncOffset >= 0 ? `+${syncOffset.toFixed(1)}s` : `${syncOffset.toFixed(1)}s`}
                </button>
                <button
                  type="button"
                  onClick={() => adjustOffset(0.5)}
                  className="rounded-full px-1.5 py-0.5 hover:bg-white/15 cursor-pointer"
                  title="Advance lyrics by 0.5s"
                >
                  +0.5s
                </button>
              </div>
              <button
                type="button"
                onClick={() => fetchLyrics(true)}
                className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20 transition cursor-pointer"
                title="Re-fetch lyrics"
              >
                <Icon name="refresh" className="text-sm" />
                <span>Refresh</span>
              </button>
            </div>
          </div>
        </section>

        {/* Right Column: Masked Lyrics Stage */}
        <section className="relative flex min-h-0 flex-1 flex-col">
          <div
            ref={scrollContainerRef}
            onWheel={() => {
              userScrollingUntilRef.current = Date.now() + 4500
            }}
            onTouchMove={() => {
              userScrollingUntilRef.current = Date.now() + 4500
            }}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-24 sm:px-6 lg:py-36"
            style={{
              maskImage:
                'linear-gradient(to bottom, transparent 0%, black 13%, black 85%, transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to bottom, transparent 0%, black 13%, black 85%, transparent 100%)',
            }}
          >
            {loading ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-white/70">
                <Icon name="progress_activity" className="animate-spin text-4xl text-white" />
                <p className="text-lg font-medium">Finding lyrics…</p>
              </div>
            ) : isSynced ? (
              <div className="mx-auto flex max-w-3xl flex-col gap-5 sm:gap-7">
                {/* Instrumental Intro / Break Dots */}
                {interludeProgress !== null && (
                  <div className="flex items-center gap-3 py-2 pl-2">
                    {[0, 1, 2].map((dot) => {
                      const active = interludeProgress >= dot / 3
                      return (
                        <span
                          key={dot}
                          className={`h-3.5 w-3.5 rounded-full transition-all duration-300 ${
                            active
                              ? 'bg-amber-300 scale-110 shadow-[0_0_12px_rgba(252,211,77,0.85)]'
                              : 'bg-white/25 scale-90'
                          }`}
                        />
                      )
                    })}
                  </div>
                )}

                {lines.map((line, idx) => {
                  const isActive = idx === activeIndex
                  const isPast = idx < activeIndex
                  const isNext = idx === activeIndex + 1

                  if (!line.text) {
                    return <div key={`${idx}-${line.time}`} className="h-4" />
                  }

                  return (
                    <button
                      key={`${idx}-${line.time}`}
                      ref={(el) => {
                        lineRefs.current[idx] = el
                      }}
                      type="button"
                      onClick={() => onSeek(Math.max(0, line.time - syncOffset))}
                      className={`group relative block w-full text-left rounded-2xl px-3 py-2 transition-all duration-500 ease-out cursor-pointer ${
                        isActive
                          ? 'text-white scale-[1.03] origin-left'
                          : isNext
                            ? 'text-white/65 hover:text-white/90'
                            : isPast
                              ? 'text-white/28 hover:text-white/60'
                              : 'text-white/42 hover:text-white/75'
                      }`}
                    >
                      {/* Follow-the-Bouncing-Star indicator */}
                      {isActive && bouncingStar && (
                        <div className="pointer-events-none relative mb-1.5 h-6 w-full max-w-[92%]">
                          <div
                            className="absolute top-0 -ml-3 transition-[left] duration-100 ease-linear"
                            style={{ left: `${Math.round(activeLineProgress * 100)}%` }}
                          >
                            <span
                              className="inline-flex items-center justify-center text-amber-300 drop-shadow-[0_0_10px_rgba(252,211,77,0.95)]"
                              style={{
                                animation: 'flStarHop 0.58s ease-in-out infinite',
                                animationPlayState: animState,
                              }}
                            >
                              <Icon name="star" className="text-2xl" />
                            </span>
                          </div>
                        </div>
                      )}

                      <span
                        className={`block font-bold leading-snug tracking-tight transition-all duration-500 ${
                          isActive
                            ? 'text-2xl sm:text-4xl lg:text-5xl drop-shadow-[0_4px_24px_rgba(255,255,255,0.28)]'
                            : 'text-xl sm:text-3xl lg:text-4xl'
                        }`}
                      >
                        {line.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : lyricsData?.plain ? (
              <div className="mx-auto max-w-3xl space-y-4">
                <p className="whitespace-pre-line text-xl sm:text-2xl lg:text-3xl font-semibold leading-relaxed text-white/90">
                  {lyricsData.plain}
                </p>
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-white/65">
                <Icon name="lyrics" className="text-5xl text-white/30" />
                <p className="text-xl font-semibold text-white/80">Lyrics aren't available for this song</p>
                <p className="text-sm text-white/50">
                  Enjoy the visuals, or tap Refresh to try searching again.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
