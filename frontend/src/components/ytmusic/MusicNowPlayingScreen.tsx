import React from 'react'
import Icon from '../Icon'
import { Track } from './MiniPlayerBar'
import MusicSourceIcon from './MusicSourceIcon'

interface Props {
  currentTrack: Track
  queue: Track[]
  isPlaying: boolean
  elapsedSeconds: number
  durationSeconds: number
  onTogglePlay: () => void
  onNext: () => void
  onPrevious: () => void
  onMute: () => void
  onDismiss: () => void
}

const formatTime = (seconds = 0) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
const artwork = (url?: string) => url?.replace(/=w\d+-h\d+[^?&]*/, '=w1200-h1200-l90-rj').replace(/=s\d+[^?&]*/, '=s1200')

export default function MusicNowPlayingScreen({ currentTrack, queue, isPlaying, elapsedSeconds, durationSeconds, onTogglePlay, onNext, onPrevious, onMute, onDismiss }: Props) {
  const duration = durationSeconds || currentTrack.duration || 0
  return (
    <div className="fixed inset-0 z-[120] grid bg-[var(--surface)] text-ink xl:grid-cols-[1.12fr_0.88fr]" onPointerDown={onDismiss}>
      <section className="flex items-center justify-center p-8 xl:p-14">
        <div className="aspect-square w-[min(100%,calc(100dvh-7rem))] overflow-hidden rounded-2xl bg-[var(--sc-lowest)] border border-[var(--outline-var)] shadow-2xl">
          {currentTrack.thumbnail ? <img src={artwork(currentTrack.thumbnail)} alt={currentTrack.title} className="h-full w-full object-contain" /> : <Icon name="album" className="text-9xl text-ink-soft/20" />}
        </div>
      </section>
      <aside className="flex min-h-0 flex-col border-l border-[var(--outline-var)] p-8 xl:p-12" onPointerDown={(event) => event.stopPropagation()}>
        <div className="mt-auto">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ink-soft">Now playing</p>
          <div className="mt-3 flex items-center gap-2.5">
            <MusicSourceIcon source={currentTrack.source} size={20} />
            <h1 className="text-3xl xl:text-4xl font-bold leading-tight text-ink truncate">{currentTrack.title}</h1>
          </div>
          <p className="mt-2 text-xl text-ink-soft">{currentTrack.artist}</p>
          <div className="mt-8 flex items-center justify-center gap-5">
            <button onClick={onPrevious} className="flex h-16 w-16 items-center justify-center rounded-full hover:bg-[var(--sc-high)] text-ink-soft hover:text-ink cursor-pointer"><Icon name="skip_previous" className="text-4xl" /></button>
            <button onClick={onTogglePlay} className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--primary)] hover:brightness-110 text-[var(--on-primary)] shadow-lg cursor-pointer"><Icon name={isPlaying ? 'pause' : 'play_arrow'} filled className="text-5xl" /></button>
            <button onClick={onNext} className="flex h-16 w-16 items-center justify-center rounded-full hover:bg-[var(--sc-high)] text-ink-soft hover:text-ink cursor-pointer"><Icon name="skip_next" className="text-4xl" /></button>
            <button onClick={onMute} className="flex h-16 w-16 items-center justify-center rounded-full hover:bg-[var(--sc-high)] text-ink-soft hover:text-ink cursor-pointer"><Icon name="volume_off" className="text-3xl" /></button>
          </div>
          <div className="mt-7 flex items-center gap-3 text-xs tabular-nums text-ink-soft">
            <span>{formatTime(elapsedSeconds)}</span><div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--outline-var)]/40"><div className="h-full bg-[var(--primary)] rounded-full transition-all duration-300" style={{ width: `${duration ? Math.min(100, elapsedSeconds / duration * 100) : 0}%` }} /></div><span>{formatTime(duration)}</span>
          </div>
        </div>
        <div className="mt-10 min-h-0 flex-1 overflow-hidden border-t border-[var(--outline-var)] pt-5">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">Up next</h2>
          <div className="max-h-full overflow-y-auto">
            {queue.slice(0, 8).map((track) => (
              <div key={track.videoId} className="flex items-center gap-3 border-b border-[var(--outline-var)]/30 py-3">
                {track.thumbnail && <img src={track.thumbnail} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <MusicSourceIcon source={track.source} size={13} />
                    <p className="truncate font-semibold text-ink">{track.title}</p>
                  </div>
                  <p className="truncate text-sm text-ink-soft">{track.artist}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  )
}
