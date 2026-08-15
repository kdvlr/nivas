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
  onPrevTrack?: () => void
  onSeek?: (seconds: number) => void
  onOpenFullPlayer: () => void
  slideshowMode?: boolean
  className?: string
}

export default function MiniPlayerBar({
  currentTrack,
  isPlaying,
  elapsedSeconds,
  durationSeconds,
  onTogglePlay,
  onNextTrack,
  onOpenFullPlayer,
  slideshowMode = false,
  className = '',
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

  if (!currentTrack) return null

  const progressPercent = durationSeconds > 0
    ? Math.min(100, Math.max(0, (elapsedSeconds / durationSeconds) * 100))
    : 0

  return (
    <>
      <motion.div
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        onClick={(e) => e.stopPropagation()}
        className={`fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px))] inset-x-3 sm:inset-x-auto sm:right-6 sm:bottom-6 select-none bg-black/35 backdrop-blur-xl border border-white/15 rounded-2xl sm:rounded-3xl p-3 text-white shadow-2xl transition-all w-auto max-w-[320px] mx-auto sm:mx-0 sm:w-[310px] ${
          slideshowMode ? 'z-[110]' : 'z-40'
        } ${className}`}
      >
        {/* Track Thumbnail & Metadata */}
        <div
          onClick={onOpenFullPlayer}
          className="flex items-center gap-3 cursor-pointer group"
          title="Open Now Playing"
        >
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-slate-800 border border-white/10 shadow-md">
            {currentTrack.thumbnail ? (
              <img
                src={currentTrack.thumbnail}
                alt={currentTrack.title}
                className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-rose-500/20 text-rose-400">
                <Icon name="music_note" className="text-xl" />
              </div>
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="flex items-end gap-0.5 h-3.5">
                  <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_100ms] h-full" />
                  <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_300ms] h-2.5" />
                  <span className="w-1 bg-rose-400 rounded-full animate-[bounce_1s_infinite_200ms] h-full" />
                </div>
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-semibold truncate text-white leading-tight group-hover:text-rose-400 transition">
              {currentTrack.title}
            </h4>
            <p className="text-xs text-white/70 truncate mt-1 leading-tight font-normal">
              {currentTrack.artist || 'Unknown Artist'}
            </p>
          </div>
        </div>

        {/* Slim Progress Bar */}
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden my-2.5">
          <div
            className="h-full bg-rose-500 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Action Controls: AirPlay, Play/Pause, Next, Full Player */}
        <div className="flex items-center justify-between gap-1 pt-0.5">
          {/* AirPlay Button */}
          <button
            ref={airPlayButtonRef}
            onClick={() => setShowAirPlayModal(true)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl transition border shadow-sm active:scale-95 cursor-pointer ${
              activeAirPlayCount > 0
                ? 'bg-sky-500/25 text-sky-300 border-sky-400/40'
                : 'bg-white/15 hover:bg-white/25 text-white/90 border-white/15'
            }`}
            title="AirPlay audio output"
          >
            <Icon name="airplay" className="text-sm shrink-0" />
            <span className="text-xs font-semibold">AirPlay</span>
            {activeAirPlayCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-500 text-[10px] font-bold text-slate-950 ml-0.5">
                {activeAirPlayCount}
              </span>
            )}
          </button>

          {/* Playback Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={onTogglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-500 hover:bg-rose-400 text-slate-950 shadow-md shadow-rose-500/25 active:scale-95 transition cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              <Icon name={isPlaying ? 'pause' : 'play_arrow'} className="text-xl font-bold" />
            </button>

            <button
              onClick={onNextTrack}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white/90 border border-white/15 active:scale-95 transition cursor-pointer"
              title="Next Track"
            >
              <Icon name="skip_next" className="text-lg" />
            </button>

            <button
              onClick={onOpenFullPlayer}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/15 hover:bg-white/25 text-white/90 border border-white/15 active:scale-95 transition cursor-pointer"
              title="Open Full Player"
            >
              <Icon name="open_in_full" className="text-sm" />
            </button>
          </div>
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
