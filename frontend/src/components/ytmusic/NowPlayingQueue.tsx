import React from 'react'
import Icon from '../Icon'
import { Track } from './MiniPlayerBar'

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
    <section className={`overflow-hidden border border-white/15 bg-slate-950/80 text-white shadow-2xl backdrop-blur-xl ${compact ? 'w-[min(25rem,calc(100vw-3rem))] rounded-3xl' : 'rounded-[2rem]'}`}>
      <div className={compact ? 'flex gap-3 p-3' : 'p-5'}>
        <div className={`shrink-0 overflow-hidden bg-slate-800 shadow-xl ${compact ? 'h-16 w-16 rounded-2xl' : 'aspect-square w-full rounded-3xl'}`}>
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-rose-500/20 text-rose-300">
              <Icon name="music_note" className={compact ? 'text-3xl' : 'text-6xl'} />
            </div>
          )}
        </div>

        <div className={compact ? 'min-w-0 flex-1 self-center' : 'mt-5'}>
          <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-300">
            <span className={`h-2 w-2 rounded-full ${isPlaying ? 'animate-pulse bg-rose-400' : 'bg-white/35'}`} />
            {isPlaying ? 'Now playing' : 'Paused'}
          </div>
          <h2 className={`${compact ? 'text-base' : 'text-2xl'} truncate font-black`}>{currentTrack.title}</h2>
          <p className="truncate text-sm text-white/60">{currentTrack.artist}</p>
          {!compact && currentTrack.album && <p className="mt-1 truncate text-xs text-white/40">{currentTrack.album}</p>}
        </div>
      </div>

      {!compact && (
        <div className="px-5 pb-5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-rose-400 transition-[width]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between font-mono text-[10px] text-white/45">
            <span>{formatTime(elapsedSeconds)}</span>
            <span>{formatTime(durationSeconds)}</span>
          </div>
          {(onTogglePlay || onNextTrack) && (
            <div className="mt-3 flex justify-center gap-3">
              {onTogglePlay && (
                <button onClick={onTogglePlay} className="flex h-11 w-11 items-center justify-center rounded-full bg-rose-500 text-slate-950">
                  <Icon name={isPlaying ? 'pause' : 'play_arrow'} className="text-2xl" />
                </button>
              )}
              {onNextTrack && (
                <button onClick={onNextTrack} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/15">
                  <Icon name="skip_next" className="text-2xl" />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <div className={`border-t border-white/10 ${compact ? 'px-3 py-2.5' : 'px-5 py-4'}`}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/45">Up next · Autoplay</span>
          <Icon name="all_inclusive" className="text-sm text-rose-300" />
        </div>
        {upcoming.length ? (
          <div className="space-y-1.5">
            {upcoming.map((track, index) => (
              <div key={`${track.videoId}-${index}`} className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2">
                <span className="w-4 text-center font-mono text-[10px] text-white/35">{index + 1}</span>
                {track.thumbnail && <img src={track.thumbnail} alt="" className="h-8 w-8 rounded-lg object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-white/90">{track.title}</p>
                  <p className="truncate text-[10px] text-white/45">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="py-2 text-xs text-white/40">Recommendations will appear when playback starts.</p>
        )}
      </div>
    </section>
  )
}
