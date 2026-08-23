import React from 'react'
import Icon from '../Icon'
import { Track } from './MiniPlayerBar'
import MusicSourceIcon from './MusicSourceIcon'

interface NowPlayingQueueProps {
  currentTrack: Track | null
  queue: Track[]
  isPlaying: boolean
  compact?: boolean
  elapsedSeconds?: number
  durationSeconds?: number
  onTogglePlay?: () => void
  onNextTrack?: () => void
}

const formatTime = (seconds = 0) => {
  const value = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`
}

export default function NowPlayingQueue({
  currentTrack,
  queue,
  isPlaying,
  compact = false,
  elapsedSeconds = 0,
  durationSeconds = 0,
  onTogglePlay,
  onNextTrack,
}: NowPlayingQueueProps) {
  if (!currentTrack) return null
  const upcoming = queue.slice(0, compact ? 3 : 8)
  const progress = durationSeconds > 0 ? Math.min(100, (elapsedSeconds / durationSeconds) * 100) : 0

  return (
    <section className={`overflow-hidden border border-[var(--outline-var)] glass text-ink shadow-2xl ${compact ? 'w-[min(25rem,calc(100vw-3rem))] rounded-3xl' : 'rounded-[2rem]'}`}>
      <div className={compact ? 'flex gap-3 p-3' : 'p-5'}>
        <div className={`shrink-0 overflow-hidden bg-[var(--sc-high)] border border-[var(--outline-var)] shadow-xl ${compact ? 'h-16 w-16 rounded-2xl' : 'aspect-square w-full rounded-3xl'}`}>
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-[var(--primary)]/15 text-[var(--primary)]">
              <Icon name="music_note" className={compact ? 'text-3xl' : 'text-6xl'} />
            </div>
          )}
        </div>

        <div className={compact ? 'min-w-0 flex-1 self-center' : 'mt-5'}>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--primary)]">
            <span className={`h-2 w-2 rounded-full ${isPlaying ? 'animate-pulse bg-[var(--primary)]' : 'bg-[var(--outline)]'}`} />
            {isPlaying ? 'Now playing' : 'Paused'}
          </div>
          <div className="flex items-center gap-1.5 min-w-0">
            <MusicSourceIcon source={currentTrack.source} size={compact ? 13 : 16} />
            <h2 className={`${compact ? 'text-base' : 'text-2xl'} truncate font-black text-ink`}>{currentTrack.title}</h2>
          </div>
          <p className="truncate text-sm text-ink-soft">{currentTrack.artist}</p>
          {!compact && currentTrack.album && <p className="mt-1 truncate text-xs text-ink-faint">{currentTrack.album}</p>}
        </div>
      </div>

      {!compact && (
        <div className="px-5 pb-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--outline-var)]/40">
            <div className="h-full rounded-full bg-[var(--primary)] transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-ink-soft">
            <span>{formatTime(elapsedSeconds)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          {(onTogglePlay || onNextTrack) && (
            <div className="mt-3 flex justify-center gap-3">
              {onTogglePlay && (
                <button onClick={onTogglePlay} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--primary)] hover:brightness-110 text-[var(--on-primary)] shadow-md cursor-pointer">
                  <Icon name={isPlaying ? 'pause' : 'play_arrow'} className="text-2xl" />
                </button>
              )}
              {onNextTrack && (
                <button onClick={onNextTrack} className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--sc)] border border-[var(--outline-var)] text-ink hover:bg-[var(--sc-high)] cursor-pointer">
                  <Icon name="skip_next" className="text-2xl" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`border-t border-[var(--outline-var)] ${compact ? 'px-3 py-2.5' : 'px-5 py-4'}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink-soft">Up next · Autoplay</span>
          <Icon name="all_inclusive" className="text-sm text-[var(--primary)]" />
        </div>
        {upcoming.length ? (
          <div className="space-y-1.5">
            {upcoming.map((track, index) => (
              <div key={`${track.videoId}-${index}`} className="flex items-center gap-2.5 rounded-xl bg-[var(--sc)] border border-[var(--outline-var)]/30 p-2">
                <span className="w-4 text-center font-mono text-[10px] text-ink-soft">{index + 1}</span>
                {track.thumbnail && <img src={track.thumbnail} alt="" className="h-8 w-8 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <MusicSourceIcon source={track.source} size={11} />
                    <p className="truncate text-xs font-semibold text-ink">{track.title}</p>
                  </div>
                  <p className="truncate text-[10px] text-ink-soft">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xs text-ink-soft">Recommendations will appear when playback starts.</p>
        )}
      </div>
    </section>
  )
}
