import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Icon from '../Icon'
import { api } from '../../lib/api'
import AirPlaySelectorModal from './AirPlaySelectorModal'

export interface Track {
  videoId: string
  title: string
  artist: string
  thumbnail?: string
  album?: string
  duration?: number
}

interface MiniPlayerBarProps {
  currentTrack: Track | null
  isPlaying: boolean
  elapsedSeconds: number
  durationSeconds: number
  onTogglePlay: () => void
  onNextTrack: () => void
  onPrevTrack: () => void
  onSeek: (seconds: number) => void
  onOpenFullPlayer: () => void
}

export default function MiniPlayerBar({
  currentTrack,
  isPlaying,
  elapsedSeconds,
  durationSeconds,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onOpenFullPlayer,
}: MiniPlayerBarProps) {
  const [showAirPlayModal, setShowAirPlayModal] = useState(false)
  const airPlayButtonRef = useRef<HTMLButtonElement>(null)
  const [activeAirPlayCount, setActiveAirPlayCount] = useState(0)

  const checkAirPlayStatus = async () => {
    try {
      const res = await api.get<any>('/api/ytmusic/player/state')
      if (res && Array.isArray(res.devices)) {
        const count = res.devices.filter((d: any) => d.isSelected).length
        setActiveAirPlayCount(count)
      }
    } catch (e) {
      // Ignore
    }
  }

  useEffect(() => {
    checkAirPlayStatus()
    const interval = setInterval(checkAirPlayStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  const formatTime = (secs: number) => {
    if (!secs || isNaN(secs)) return '0:00'
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s < 10 ? '0' : ''}${s}`
  }

  if (!currentTrack) return null

  return (
    <>
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="fixed bottom-3 left-3 right-3 md:left-24 md:right-6 z-40 flex items-center justify-between gap-4 rounded-3xl bg-[var(--surface-elevated,#0f172a)]/95 p-3 backdrop-blur-xl border border-white/10 shadow-2xl text-slate-100"
      >
        {/* Track Thumbnail & Metadata */}
        <div
          onClick={onOpenFullPlayer}
          className="flex items-center gap-3 cursor-pointer select-none group min-w-0 flex-1 md:flex-initial"
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-2xl bg-slate-800 border border-white/10 shadow-md">
            {currentTrack.thumbnail ? (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-rose-500/20 text-rose-400">
                <Icon name="music_note" className="text-2xl" />
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-4">
                  <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_100ms] h-full" />
                  <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_300ms] h-3" />
                  <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_200ms] h-full" />
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold truncate group-hover:text-rose-400 transition">
              {currentTrack.title}
            </h4>
            <p className="text-xs text-slate-400 truncate">
              {currentTrack.artist} {currentTrack.album ? `· ${currentTrack.album}` : ''}
            </p>
          </div>
        </div>

        {/* Playback Controls & Progress Bar */}
        <div className="hidden md:flex flex-col items-center gap-1.5 flex-1 max-w-md">
          <div className="flex items-center gap-4">
            <button
              onClick={onPrevTrack}
              className="text-slate-400 hover:text-slate-100 transition p-1"
            >
              <Icon name="skip_previous" className="text-2xl" />
            </button>

            <button
              onClick={onTogglePlay}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-400 text-slate-950 transition shadow-lg shadow-rose-500/30"
            >
              <Icon name={isPlaying ? 'pause' : 'play_arrow'} className="text-2xl font-bold" />
            </button>

            <button
              onClick={onNextTrack}
              className="text-slate-400 hover:text-slate-100 transition p-1"
            >
              <Icon name="skip_next" className="text-2xl" />
            </button>
          </div>

          <div className="flex items-center gap-2 w-full text-[11px] font-mono text-slate-400">
            <span>{formatTime(elapsedSeconds)}</span>
            <input
              type="range"
              min={0}
              max={durationSeconds || 100}
              value={elapsedSeconds}
              onChange={(e) => onSeek(Number(e.target.value))}
              className="w-full h-1 rounded-lg bg-slate-700 accent-rose-400 cursor-pointer"
            />
            <span>{formatTime(durationSeconds)}</span>
          </div>
        </div>

        {/* Right Side Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Play/Pause */}
          <button
            onClick={onTogglePlay}
            className="flex md:hidden h-10 w-10 items-center justify-center rounded-full bg-rose-500 text-slate-950 shadow-md"
          >
            <Icon name={isPlaying ? 'pause' : 'play_arrow'} className="text-2xl" />
          </button>

          {/* AirPlay 2 Trigger Button */}
          <button
            ref={airPlayButtonRef}
            onClick={() => setShowAirPlayModal(true)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-2xl transition border ${
              activeAirPlayCount > 0
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <Icon name="airplay" className="text-lg" />
            <span className="text-xs font-semibold hidden sm:inline">AirPlay</span>
            {activeAirPlayCount > 0 && (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-slate-950">
                {activeAirPlayCount}
              </span>
            )}
          </button>

          {/* Expand Full Player */}
          <button
            onClick={onOpenFullPlayer}
            className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition text-slate-300"
          >
            <Icon name="open_in_full" className="text-lg" />
          </button>
        </div>
      </motion.div>

      <AirPlaySelectorModal
        isOpen={showAirPlayModal}
        onClose={() => setShowAirPlayModal(false)}
        anchorRef={airPlayButtonRef}
      />
    </>
  )
}
