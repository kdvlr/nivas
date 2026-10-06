import React, { useState, useEffect, useMemo, useRef, useId } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import { startStarCanvas, startFxCanvas, SkyPhase, SkyKind, SkyState } from './sky/skyEngine'
import { useQuality, Quality } from './sky/useQuality'
import {
  getQueryParam,
  getSeasonalDate,
  isOctober,
  isDecember,
  isElfSeason,
  isChristmasDay,
  isNewYearsDay,
} from './sky/queryParam'
import AmbientCalendarOverlay, { ReminderPayload } from './AmbientCalendarOverlay'
import MiniPlayerBar, { Track } from './ytmusic/MiniPlayerBar'

interface MediaItem {
  url: string
  displayUrl?: string
  videoUrl?: string
  posterUrl?: string
  playbackUrl?: string
  media_bytes?: number
  type: 'image' | 'video' | 'live_photo'
  name: string
  orientation?: 'portrait' | 'landscape'
  width?: number
  height?: number
  date_taken?: string | null
  location_name?: string | null
}

interface Slide {
  id: string
  type: 'single' | 'pair'
  items: MediaItem[]
}

interface SlideshowProps {
  photos: MediaItem[]
  onDismiss: () => void
  currentTrack?: Track | null
  queue?: Track[]
  isPlaying?: boolean
  elapsedSeconds?: number
  durationSeconds?: number
  onTogglePlay?: () => void
  onNextTrack?: () => void
  onPrevTrack?: () => void
  onSeek?: (seconds: number) => void
  onOpenFullPlayer?: () => void
  onClose?: () => void
}

interface WeatherDay {
  sunrise?: string
  sunset?: string
}

interface WeatherResp {
  configured: boolean
  current: { kind?: string } | null
  daily: WeatherDay[]
}

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return ''
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch (e) {
    return ''
  }
}

const hashStr = (s: string) => s.split('').reduce((a, c) => ((a * 31 + c.charCodeAt(0)) >>> 0) % 100000, 7)

// Dev/test override: append ?sky=night&skyfx=rainy anywhere in the URL to preview any sky state.
export { getQueryParam }

const PHASES: SkyPhase[] = ['dawn', 'day', 'dusk', 'night']
const KINDS: SkyKind[] = ['clear', 'cloudy', 'rainy', 'snowy', 'stormy']
const getPhaseOverride = () => PHASES.find((p) => p === getQueryParam('sky')) ?? null
const getKindOverride = () => KINDS.find((k) => k === getQueryParam('skyfx')) ?? null

/** True when the URL carries a valid sky/skyfx preview override. */
export const hasSkyOverride = () => getPhaseOverride() !== null || getKindOverride() !== null

const toKind = (k?: string | null): SkyKind => {
  if (k === 'sunny') return 'clear'
  return KINDS.find((x) => x === k) ?? 'clear'
}

const minsOf = (d: Date) => d.getHours() * 60 + d.getMinutes()

function computePhase(now: Date, sunrise: Date | null, sunset: Date | null): SkyPhase {
  const m = minsOf(now)
  const sr = sunrise ? minsOf(sunrise) : 6 * 60 + 45
  const ss = sunset ? minsOf(sunset) : 19 * 60 + 45
  if (m >= sr - 35 && m < sr + 50) return 'dawn'
  if (m >= sr + 50 && m < ss - 50) return 'day'
  if (m >= ss - 50 && m < ss + 35) return 'dusk'
  return 'night'
}

const SKY_GRADIENTS: Record<SkyPhase, { clear: string; overcast: string }> = {
  dawn: {
    clear: 'linear-gradient(180deg, #232a54 0%, #5b4a7e 34%, #c96f6f 62%, #f2ac6a 82%, #ffd9a3 100%)',
    overcast: 'linear-gradient(180deg, #2b3148 0%, #55516b 45%, #8a6f72 78%, #b78d77 100%)',
  },
  day: {
    clear: 'linear-gradient(180deg, #2f6fbd 0%, #5c9ede 45%, #a7d3f2 80%, #dcedfb 100%)',
    overcast: 'linear-gradient(180deg, #55677d 0%, #7e93a6 50%, #b3c1cc 100%)',
  },
  dusk: {
    clear: 'linear-gradient(180deg, #191f4d 0%, #53407e 35%, #b25f68 62%, #e8894f 82%, #ffbd74 100%)',
    overcast: 'linear-gradient(180deg, #232741 0%, #4c4262 48%, #7d5a5e 78%, #a97e63 100%)',
  },
  night: {
    clear: 'linear-gradient(180deg, #040815 0%, #0a1128 45%, #141d3d 80%, #1d2848 100%)',
    overcast: 'linear-gradient(180deg, #05070f 0%, #0b0f1e 50%, #141a2e 100%)',
  },
}

// A third of a real family library is video, averaging ~23MB and reaching
// 90MB. Streaming one of those for a 9-second slide swamps a kiosk tablet's
// network and media pipeline, so only short/small clips animate; anything
// bigger shows a still frame and stays tap-to-play.
const AUTOPLAY_MAX_BYTES = 5 * 1024 * 1024

const BALLOON_COLORS = ['#f87171', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#c084fc', '#f472b6']

function Balloon({ color }: { color: string }) {
  return (
    <svg width="106" height="181" viewBox="0 0 88 150" className="pointer-events-none" aria-hidden="true">
      <path
        d="M44 4 C20 4 8 24 8 44 C8 68 28 86 44 86 C60 86 80 68 80 44 C80 24 68 4 44 4 Z"
        fill={color}
      />
      <ellipse cx="30" cy="30" rx="9" ry="15" fill="white" opacity="0.28" transform="rotate(-18 30 30)" />
      <path d="M39 86 L49 86 L44 97 Z" fill={color} />
      <path d="M44 97 C 39 113, 50 126, 44 148" stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

const PUMPKIN_PALETTES = [
  // Classic harvest orange
  { base: '#ea580c', mid: '#f97316', light: '#fb923c', rib: '#c2410c' },
  // Deep autumnal gourd
  { base: '#c2410c', mid: '#ea580c', light: '#f97316', rib: '#9a3412' },
  // Golden autumn squash
  { base: '#d97706', mid: '#f59e0b', light: '#fbbf24', rib: '#b45309' },
]

function Pumpkin({ seed = 0 }: { seed?: number }) {
  const p = PUMPKIN_PALETTES[Math.abs(seed) % PUMPKIN_PALETTES.length]
  return (
    <svg width="112" height="181" viewBox="0 0 96 155" className="pointer-events-none" aria-hidden="true">
      {/* Stem & tendril */}
      <path d="M48 30 C46 17 53 10 59 8 C57 8 51 13 48 20 C46 24 45 30 45 30 Z" fill="#2d6a4f" />
      <path
        d="M51 14 C54 12 57 13 58 15 C59 18 57 20 55 20 C53 20 51 18 52 16"
        stroke="#52b788"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />

      {/* Pumpkin Lobes */}
      <ellipse cx="27" cy="59" rx="16" ry="24" fill={p.base} />
      <ellipse cx="69" cy="59" rx="16" ry="24" fill={p.base} />
      <ellipse cx="37" cy="61" rx="17" ry="26" fill={p.mid} />
      <ellipse cx="59" cy="61" rx="17" ry="26" fill={p.mid} />
      <ellipse cx="48" cy="62" rx="17" ry="27" fill={p.light} />

      {/* Rib Creases */}
      <path d="M37 36 C31 46 30 73 37 85" stroke={p.rib} strokeWidth="1.5" fill="none" opacity="0.65" />
      <path d="M59 36 C65 46 66 73 59 85" stroke={p.rib} strokeWidth="1.5" fill="none" opacity="0.65" />
      <path d="M48 35 C47 45 47 75 48 88" stroke={p.rib} strokeWidth="1.1" fill="none" opacity="0.4" />

      {/* Highlight on front lobe */}
      <ellipse cx="42" cy="50" rx="6" ry="13" fill="white" opacity="0.25" transform="rotate(-18 42 50)" />

      {/* Tether Knot & String lifting photo */}
      <ellipse cx="48" cy="89" rx="4" ry="2.5" fill={p.rib} />
      <path d="M48 89 C44 107 52 126 48 153" stroke="rgba(255,255,255,0.72)" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

function JackOLantern({ seed = 0 }: { seed?: number }) {
  const gradId = useId()
  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none filter drop-shadow-[0_0_14px_rgba(251,146,60,0.9)] drop-shadow-[0_0_28px_rgba(234,88,12,0.5)]"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={gradId} cx="50%" cy="55%" r="50%">
          <stop offset="0%" stopColor="#fffbeb" />
          <stop offset="30%" stopColor="#fef08a" />
          <stop offset="68%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#d97706" />
        </radialGradient>
      </defs>

      {/* Stem */}
      <path d="M48 30 C46 17 53 10 59 8 C57 8 51 13 48 20 C46 24 45 30 45 30 Z" fill="#1e3a1f" />

      {/* Darker Night Pumpkin Lobes */}
      <ellipse cx="27" cy="59" rx="16" ry="24" fill="#9a3412" />
      <ellipse cx="69" cy="59" rx="16" ry="24" fill="#9a3412" />
      <ellipse cx="37" cy="61" rx="17" ry="26" fill="#c2410c" />
      <ellipse cx="59" cy="61" rx="17" ry="26" fill="#c2410c" />
      <ellipse cx="48" cy="62" rx="17" ry="27" fill="#ea580c" />

      {/* Rib Shadows */}
      <path d="M37 36 C31 46 30 73 37 85" stroke="#7c2d12" strokeWidth="1.6" fill="none" opacity="0.75" />
      <path d="M59 36 C65 46 66 73 59 85" stroke="#7c2d12" strokeWidth="1.6" fill="none" opacity="0.75" />

      {/* Glowing Carved Eyes */}
      <polygon points="32,50 43,55 36,63" fill={`url(#${gradId})`} />
      <polygon points="64,50 53,55 60,63" fill={`url(#${gradId})`} />

      {/* Glowing Carved Nose */}
      <polygon points="48,60 43,68 53,68" fill={`url(#${gradId})`} />

      {/* Glowing Carved Toothy Mouth */}
      <path
        d="M26 72 
           L32 77 L32 74 
           L39 78 L39 74 
           L48 80 
           L57 74 L57 78 
           L64 74 L64 77 
           L70 72 
           C65 84 57 88 48 88 
           C39 88 31 84 26 72 Z"
        fill={`url(#${gradId})`}
      />

      {/* Tether Knot & String lifting photo */}
      <ellipse cx="48" cy="89" rx="4" ry="2.5" fill="#7c2d12" />
      <path d="M48 89 C44 107 52 126 48 153" stroke="rgba(255,255,255,0.72)" strokeWidth="1.6" fill="none" />
    </svg>
  )
}

function CandyCane({ seed = 0 }: { seed?: number }) {
  const clipId = useId()
  const flip = seed % 2 === 0
  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path
            d={flip ? 'M 36 94 L 36 38 C 36 12, 68 12, 68 34' : 'M 60 94 L 60 38 C 60 12, 28 12, 28 34'}
            stroke="white"
            strokeWidth="15"
            strokeLinecap="round"
            fill="none"
          />
        </clipPath>
      </defs>

      {/* Candy Cane Body clipped with diagonal peppermint stripes */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y="0" width="96" height="155" fill="#f8fafc" />
        {[-30, -14, 2, 18, 34, 50, 66, 82, 98, 114].map((offset) => (
          <rect
            key={offset}
            x="-20"
            y={offset}
            width="140"
            height="8"
            fill="#dc2626"
            transform="rotate(-35 48 48)"
          />
        ))}
        {/* Gloss highlight */}
        <path
          d={flip ? 'M 33 92 L 33 38 C 33 15, 65 15, 65 34' : 'M 63 92 L 63 38 C 63 15, 31 15, 31 34'}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.65"
        />
      </g>

      {/* Satin Ribbon Bow tied around the cane */}
      <g transform={`translate(${flip ? 36 : 60}, 62)`}>
        <path d="M -4 2 Q -12 16 -16 28 L -8 24 Q -6 14 -2 4 Z" fill="#15803d" />
        <path d="M 4 2 Q 12 16 16 28 L 8 24 Q 6 14 2 4 Z" fill="#15803d" />
        <path d="M 0 0 C -18 -12, -22 10, 0 2 Z" fill="#16a34a" />
        <path d="M 0 0 C 18 -12, 22 10, 0 2 Z" fill="#16a34a" />
        <ellipse cx="0" cy="1" rx="4.5" ry="3.5" fill="#eab308" stroke="#ca8a04" strokeWidth="0.8" />
      </g>

      {/* Tether knot and string lifting photo card */}
      <ellipse cx={flip ? 36 : 60} cy="92" rx="3.5" ry="2" fill="#b91c1c" />
      <path
        d={`M ${flip ? 36 : 60} 93 C 44 112 52 130 48 153`}
        stroke="rgba(255,255,255,0.72)"
        strokeWidth="1.6"
        fill="none"
      />
    </svg>
  )
}

function StringLights() {
  const bulbs = useMemo(() => {
    const colors = [
      { fill: '#ef4444', glow: 'rgba(239,68,68,0.85)' },
      { fill: '#22c55e', glow: 'rgba(34,197,94,0.85)' },
      { fill: '#eab308', glow: 'rgba(234,179,8,0.9)' },
      { fill: '#3b82f6', glow: 'rgba(59,130,246,0.85)' },
      { fill: '#f97316', glow: 'rgba(249,115,22,0.85)' },
      { fill: '#ec4899', glow: 'rgba(236,72,153,0.85)' },
    ]
    const list = []
    const totalBulbs = 34
    for (let i = 0; i <= totalBulbs; i++) {
      const xPercent = (i / totalBulbs) * 100
      const scallopPhase = i % 2 === 1 ? 18 : 6
      const color = colors[i % colors.length]
      list.push({
        id: i,
        xPercent,
        y: scallopPhase,
        color,
        dur: 1.6 + ((i * 3) % 7) * 0.25,
        delay: ((i * 5) % 9) * 0.3,
      })
    }
    return list
  }, [])

  return (
    <div className="fixed top-0 left-0 right-0 h-14 pointer-events-none z-30 select-none overflow-hidden">
      <svg
        viewBox="0 0 1920 54"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden="true"
      >
        <style>{`
          @keyframes lightTwinkle {
            0%, 100% { opacity: 0.95; transform: scale(1); }
            50% { opacity: 0.35; transform: scale(0.92); }
          }
        `}</style>
        <path
          d={Array.from({ length: 17 }, (_, i) => {
            const startX = i * (1920 / 17)
            const endX = (i + 1) * (1920 / 17)
            const midX = (startX + endX) / 2
            return `${i === 0 ? `M ${startX} 0` : ''} Q ${midX} 22, ${endX} 0`
          }).join(' ')}
          stroke="#14532d"
          strokeWidth="2.2"
          fill="none"
        />
        {bulbs.map((b) => {
          const px = (b.xPercent / 100) * 1920
          return (
            <g
              key={b.id}
              transform={`translate(${px}, ${b.y})`}
              style={{
                animation: `lightTwinkle ${b.dur}s ease-in-out infinite`,
                animationDelay: `${b.delay}s`,
                transformOrigin: `${px}px ${b.y}px`,
              }}
            >
              <rect x="-3" y="0" width="6" height="5" rx="1" fill="#166534" />
              <path
                d="M 0 4 C -5 8, -5 16, 0 22 C 5 16, 5 8, 0 4 Z"
                fill={b.color.fill}
                style={{ filter: `drop-shadow(0 0 7px ${b.color.glow})` }}
              />
              <ellipse cx="-1" cy="11" rx="1.5" ry="3.5" fill="white" opacity="0.6" />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function Elf({ variant = 'sitting', flip = false }: { variant?: 'sitting' | 'standing' | 'running'; flip?: boolean }) {
  return (
    <svg
      width="64"
      height="80"
      viewBox="0 0 54 68"
      className="pointer-events-none select-none filter drop-shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      {variant === 'sitting' && (
        <g>
          <path d="M 21 44 L 21 58" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M 21 46 L 21 48" stroke="#ffffff" strokeWidth="5" />
          <path d="M 21 52 L 21 54" stroke="#ffffff" strokeWidth="5" />
          <path d="M 19 58 Q 15 60 11 59 Q 8 57 10 54 Q 14 55 19 56 Z" fill="#15803d" />
          <circle cx="9" cy="55" r="1.5" fill="#facc15" />

          <path d="M 31 44 L 31 59" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M 31 47 L 31 49" stroke="#ffffff" strokeWidth="5" />
          <path d="M 31 53 L 31 55" stroke="#ffffff" strokeWidth="5" />
          <path d="M 29 59 Q 25 61 21 60 Q 18 58 20 55 Q 24 56 29 57 Z" fill="#15803d" />
          <circle cx="19" cy="56" r="1.5" fill="#facc15" />
        </g>
      )}

      {variant === 'standing' && (
        <g>
          <path d="M 22 46 L 22 62" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M 22 48 L 22 50" stroke="#ffffff" strokeWidth="5" />
          <path d="M 22 54 L 22 56" stroke="#ffffff" strokeWidth="5" />
          <path d="M 20 62 Q 15 64 10 63 Q 7 60 10 58 Q 15 59 20 60 Z" fill="#15803d" />
          <circle cx="8" cy="59" r="1.6" fill="#facc15" />

          <path d="M 32 46 L 32 62" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M 32 48 L 32 50" stroke="#ffffff" strokeWidth="5" />
          <path d="M 32 54 L 32 56" stroke="#ffffff" strokeWidth="5" />
          <path d="M 34 62 Q 39 64 44 63 Q 47 60 44 58 Q 39 59 34 60 Z" fill="#15803d" />
          <circle cx="46" cy="59" r="1.6" fill="#facc15" />
        </g>
      )}

      {variant === 'running' && (
        <g>
          <path d="M 20 44 L 10 56" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M 17 48 L 15 50" stroke="#ffffff" strokeWidth="5" />
          <path d="M 8 56 Q 3 55 1 51 Q 3 48 7 51 Z" fill="#15803d" />
          <circle cx="2" cy="50" r="1.5" fill="#facc15" />

          <path d="M 30 44 L 40 56" stroke="#dc2626" strokeWidth="5" strokeLinecap="round" />
          <path d="M 34 49 L 36 51" stroke="#ffffff" strokeWidth="5" />
          <path d="M 40 56 Q 46 60 50 58 Q 51 55 46 54 Z" fill="#15803d" />
          <circle cx="50" cy="57" r="1.5" fill="#facc15" />
        </g>
      )}

      {/* Elf Tunic */}
      <path d="M 18 34 Q 14 46 17 47 L 37 47 Q 40 46 36 34 Z" fill="#16a34a" />
      <rect x="17" y="42" width="20" height="4.5" fill="#18181b" />
      <rect x="24" y="41" width="6" height="6.5" rx="1" fill="#facc15" stroke="#18181b" strokeWidth="1" />

      {/* Scalloped Collar */}
      <path d="M 18 33 L 21 38 L 27 34 L 33 38 L 36 33 Z" fill="#dc2626" />
      <circle cx="21" cy="38" r="1" fill="#facc15" />
      <circle cx="33" cy="38" r="1" fill="#facc15" />

      {/* Arms */}
      {variant === 'sitting' && (
        <g>
          <path d="M 18 36 Q 13 42 16 45" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="16" cy="45" r="2.5" fill="#fde68a" />
          <path d="M 36 36 Q 41 42 38 45" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="38" cy="45" r="2.5" fill="#fde68a" />
        </g>
      )}

      {variant === 'standing' && (
        <g>
          <path d="M 18 36 Q 13 40 14 44" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="14" cy="44" r="2.5" fill="#fde68a" />
          <path d="M 36 36 Q 44 32 45 24" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" fill="none" />
          <circle cx="45" cy="24" r="2.5" fill="#fde68a" />
        </g>
      )}

      {variant === 'running' && (
        <g>
          <path d="M 22 36 L 30 40" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
          <rect x="30" y="34" width="11" height="11" rx="1.5" fill="#eab308" />
          <path d="M 35.5 34 L 35.5 45 M 30 39.5 L 41 39.5" stroke="#dc2626" strokeWidth="1.8" />
          <circle cx="35.5" cy="33" r="2" fill="#dc2626" />
        </g>
      )}

      {/* Head, Ears & Face */}
      <path d="M 19 24 C 11 22, 9 17, 18 19 Z" fill="#fde68a" />
      <path d="M 35 24 C 43 22, 45 17, 36 19 Z" fill="#fde68a" />
      <ellipse cx="27" cy="25" rx="9.5" ry="10" fill="#fde68a" />
      <circle cx="21" cy="27" r="2.5" fill="#f43f5e" opacity="0.45" />
      <circle cx="33" cy="27" r="2.5" fill="#f43f5e" opacity="0.45" />
      <path d="M 21 23 Q 23 21 25 23" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M 29 23 Q 31 21 33 23" stroke="#1c1917" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <circle cx="27" cy="25" r="1.1" fill="#f59e0b" />
      <path d="M 24 28 Q 27 31 30 28" stroke="#b91c1c" strokeWidth="1.2" strokeLinecap="round" fill="none" />

      {/* Hat */}
      <path d="M 16 19 Q 27 16 38 19" stroke="#dc2626" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 17 17 C 20 6, 32 3, 44 6 C 48 8, 49 12, 46 16 Z" fill="#16a34a" />
      <circle cx="47" cy="16" r="3.2" fill="#facc15" stroke="#ca8a04" strokeWidth="0.8" />
    </svg>
  )
}

function RunningElf() {
  const [running, setRunning] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDirection(Math.random() < 0.5 ? 1 : -1)
      setRunning(true)
    }, 20_000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleAnimationComplete = () => {
    setRunning(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDirection(Math.random() < 0.5 ? 1 : -1)
      setRunning(true)
    }, 40_000 + Math.random() * 50_000)
  }

  if (!running) return null

  return (
    <motion.div
      initial={{ x: direction === 1 ? -80 : window.innerWidth + 80 }}
      animate={{ x: direction === 1 ? window.innerWidth + 80 : -80 }}
      transition={{ duration: 7.5, ease: 'linear' }}
      onAnimationComplete={handleAnimationComplete}
      className="fixed bottom-1 pointer-events-none z-30 select-none"
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 0.28, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Elf variant="running" flip={direction === -1} />
      </motion.div>
    </motion.div>
  )
}

function CloudLayer({ phase, kind, quality }: SkyState) {
  const overcast = kind !== 'clear'
  const lite = quality === 'low'
  const clouds = useMemo(() => {
    const count = lite ? (overcast ? 3 : 2) : overcast ? 9 : phase === 'night' ? 2 : 5
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      top: 2 + Math.random() * 36,
      width: 26 + Math.random() * 28,
      height: 7 + Math.random() * 6,
      dur: 90 + Math.random() * 90,
      delay: -Math.random() * 180,
      opacity: overcast ? 0.45 + Math.random() * 0.3 : 0.22 + Math.random() * 0.25,
    }))
  }, [phase, overcast, lite])

  const color =
    phase === 'night'
      ? '22,30,52'
      : phase === 'dusk'
        ? '255,196,150'
        : phase === 'dawn'
          ? '255,214,180'
          : overcast
            ? '228,234,240'
            : '255,255,255'

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {clouds.map((c) => (
        <div
          key={c.id}
          className="absolute"
          style={{
            top: `${c.top}vh`,
            left: 0,
            width: `${c.width}vmin`,
            height: `${c.height * 1.5}vmin`,
            // Soft-edged puffs via radial gradients — no blur filter, which is
            // expensive to composite on low-end tablet GPUs.
            background: `radial-gradient(closest-side at 32% 58%, rgb(${color}) 0%, rgba(${color},0.55) 48%, transparent 95%), radial-gradient(closest-side at 68% 42%, rgba(${color},0.9) 0%, rgba(${color},0.45) 52%, transparent 95%)`,
            opacity: c.opacity,
            ...(lite
              ? { transform: `translateX(${20 + c.id * 24}vw)` }
              : { animation: `sky-cloud ${c.dur}s linear infinite`, animationDelay: `${c.delay}s` }),
          }}
        />
      ))}
    </div>
  )
}

function CelestialGlow({ phase, kind }: SkyState) {
  const dim = kind === 'clear' ? 1 : kind === 'cloudy' ? 0.45 : 0.2
  if (phase === 'night') {
    return (
      <div className="absolute inset-0 pointer-events-none" style={{ opacity: dim }}>
        <div
          className="absolute rounded-full"
          style={{
            right: '13%',
            top: '10%',
            width: '70px',
            height: '70px',
            background: 'radial-gradient(circle at 38% 35%, #fdfbf4, #cfd6e6)',
            boxShadow: '0 0 70px 22px rgba(215,228,255,0.32)',
          }}
        />
      </div>
    )
  }
  const glow =
    phase === 'day'
      ? { right: '6%', top: '4%', size: '46vmin', color: 'rgba(255,250,215,0.85)', mid: 'rgba(255,236,170,0.3)' }
      : phase === 'dawn'
        ? { right: '68%', top: '62%', size: '58vmin', color: 'rgba(255,196,120,0.75)', mid: 'rgba(255,170,110,0.28)' }
        : { right: '16%', top: '58%', size: '64vmin', color: 'rgba(255,168,90,0.8)', mid: 'rgba(255,140,80,0.3)' }
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: dim }}>
      <div
        className="absolute rounded-full"
        style={{
          right: glow.right,
          top: glow.top,
          width: glow.size,
          height: glow.size,
          background: `radial-gradient(circle, ${glow.color} 0%, ${glow.mid} 32%, transparent 68%)`,
        }}
      />
    </div>
  )
}

interface CleanVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string
}

function CleanVideo({ src, ...props }: CleanVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = videoRef.current
    if (el) {
      el.muted = true
      el.defaultMuted = true
      const p = el.play()
      if (p !== undefined) {
        p.catch(() => {
          // Autoplay policy prevented playback, silent fallback
        })
      }
    }
    return () => {
      if (el) {
        try {
          el.pause()
          el.src = ""
          el.load()
        } catch (e) {
          // ignore
        }
      }
    }
  }, [src])

  return <video ref={videoRef} src={src} {...props} />
}

/**
 * A video's still frame. Prefers the server-built poster JPEG — a few KB and no
 * media pipeline at all. Falls back to a paused video element for libraries
 * whose derivatives haven't been generated (or where ffmpeg is unavailable).
 */
function VideoStill({ item }: { item: MediaItem }) {
  const [posterFailed, setPosterFailed] = useState(false)
  const clip = item.type === 'live_photo' ? item.videoUrl : item.url
  if (item.posterUrl && !posterFailed) {
    return (
      <img
        src={item.posterUrl}
        decoding="async"
        onError={() => setPosterFailed(true)}
        className="w-full h-full object-contain pointer-events-none"
      />
    )
  }
  if (!clip) return null
  return (
    <CleanVideo
      key={clip}
      src={`${clip}#t=0.1`}
      preload="auto"
      muted
      playsInline
      className="w-full h-full object-contain pointer-events-none"
    />
  )
}

interface RigProps {
  item: MediaItem
  phase: SkyPhase
  kind: SkyKind
  index: number
  pair: boolean
  pairIdx: number
  quality: Quality
  onOpenVideo: (url: string) => void
}

function PhotoRig({ item, phase, kind, index, pair, pairIdx, quality, onOpenVideo }: RigProps) {
  const [mediaFailed, setMediaFailed] = useState(false)
  // On the lowest tier the perpetual sway is dropped: the entrance drift still
  // reads as floating, but nothing animates once a photo has settled.
  const sway = quality !== 'low'
  const seed = hashStr(item.url)
  // Two independent 0..1 values per photo so side-by-side pairs get visibly
  // different rise speeds, resting heights, and sway rhythms.
  const f = (seed % 97) / 97
  const g = (Math.floor(seed / 7) % 89) / 89
  const aspect = item.width && item.height ? `${item.width} / ${item.height}` : pair ? '3/4' : '16/9'
  const delay = pairIdx * 0.18 + f * 0.25
  const rainy = kind === 'rainy' || kind === 'stormy'
  const daylight = phase === 'day' || phase === 'dawn'

  // A physical print: opaque paper mat with a phase-tinted ambient glow so the
  // lantern/starlight mood still reads. Box-shadows rasterize once per layer —
  // cheap even on weak GPUs (unlike backdrop blur).
  const ambient =
    phase === 'dusk'
      ? '0 0 44px 6px rgba(255,170,80,0.30), '
      : phase === 'night'
        ? '0 0 44px 6px rgba(150,185,255,0.22), '
        : ''
  const matShadow = `${ambient}0 4px 10px rgba(0,0,0,0.35), 0 30px 70px rgba(0,0,0,0.5)`
  // Original camera clips are never autoplayed. A verified playback derivative
  // is the only video source eligible for unattended slideshow playback.
  const autoplayable = quality !== 'low' && !!item.playbackUrl
  const tilt = ((seed % 44) / 10 - 2.2) * (pairIdx === 1 ? -1 : 1)

  const media = (
    <div
      className="overflow-hidden bg-neutral-100 relative"
      style={{
        aspectRatio: aspect,
        maxHeight: pair ? '74vh' : daylight ? '78vh' : '82vh',
        maxWidth: pair ? '44vw' : '84vw',
      }}
    >
      {mediaFailed ? (
        <div className="w-full h-full flex items-center justify-center text-slate-400"><Icon name="broken_image" className="text-5xl" /></div>
      ) : item.type === 'image' && (
        <img src={item.displayUrl || item.url} decoding="async" onError={() => setMediaFailed(true)} className="w-full h-full object-contain pointer-events-none" />
      )}
      {item.type === 'live_photo' && item.videoUrl && (
        autoplayable ? (
          <CleanVideo key={item.videoUrl} src={item.playbackUrl!} onError={() => setMediaFailed(true)} autoPlay muted playsInline loop className="w-full h-full object-contain pointer-events-none" />
        ) : (
          <VideoStill item={item} />
        )
      )}
      {item.type === 'video' && (
        autoplayable ? (
          <CleanVideo key={item.url} src={item.playbackUrl!} onError={() => setMediaFailed(true)} autoPlay muted playsInline loop className="w-full h-full object-contain pointer-events-none" />
        ) : (
          <VideoStill item={item} />
        )
      )}
      {(item.type === 'video' || item.type === 'live_photo') && (
        <div className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-black/45 border border-white/40 flex items-center justify-center pointer-events-none">
          <Icon name="play_arrow" className="text-white text-lg" />
        </div>
      )}
    </div>
  )

  const ink = useMemo(() => {
    // Choose ink randomly per photo so each print gets its own authentic ballpoint pen note
    const inks = [
      // Classic Ballpoint Blue (rich Bic / Papermate royal ink)
      {
        color: '#1b3f7a',
        shadow: '0 0 0.35px rgba(27, 63, 122, 0.45), 0.2px 0.2px 0.35px rgba(27, 63, 122, 0.35)',
      },
      // Classic Ballpoint Black (graphite/charcoal oil-based ink)
      {
        color: '#22252a',
        shadow: '0 0 0.35px rgba(34, 37, 42, 0.4), 0.2px 0.2px 0.35px rgba(34, 37, 42, 0.3)',
      },
      // Classic Ballpoint Red (crimson annotation ink)
      {
        color: '#962228',
        shadow: '0 0 0.35px rgba(150, 34, 40, 0.45), 0.2px 0.2px 0.35px rgba(150, 34, 40, 0.35)',
      },
    ]
    const inkSeed = hashStr((item.url || '') + (item.date_taken || '') + (item.location_name || '') + 'ballpoint')
    return inks[inkSeed % inks.length]
  }, [item.url, item.date_taken, item.location_name])

  const caption = (item.location_name || item.date_taken) && (
    <div
      style={{
        fontFamily: "'Caveat', cursive",
        color: ink.color,
        textShadow: ink.shadow,
      }}
      className={`mt-3 mb-0.5 w-full text-center ${pair ? 'text-[1.65rem] sm:text-[1.85rem]' : 'text-[1.85rem] sm:text-[2.15rem]'} font-medium tracking-normal select-none pointer-events-none flex flex-wrap items-center justify-center gap-x-2 leading-relaxed px-1.5`}
    >
      {item.location_name && <span>{item.location_name}</span>}
      {item.location_name && item.date_taken && <span style={{ opacity: 0.65 }}>-</span>}
      {item.date_taken && <span>{formatDate(item.date_taken)}</span>}
    </div>
  )

  const seasonalNow = getSeasonalDate()
  const hasSittingElf = isElfSeason(seasonalNow) && ((seed + pairIdx * 5 + index) % 3 === 0)
  const elfFlip = (seed + index) % 2 === 0

  const card = (
    <div
      className="relative bg-[#faf8f5] p-3.5 pb-4 rounded-[4px] border border-neutral-200/60 flex flex-col items-center pointer-events-auto cursor-pointer"
      style={{ boxShadow: matShadow, transform: `rotate(${tilt.toFixed(1)}deg)` }}
      onClick={(e) => {
        // Prefer the transcoded copy: ~10x smaller and quick to start.
        const full = item.playbackUrl || (item.type === 'live_photo' ? item.videoUrl : item.url)
        if ((item.type === 'video' || item.type === 'live_photo') && full) {
          e.stopPropagation()
          onOpenVideo(full)
        }
      }}
    >
      {hasSittingElf && (
        <div className={`absolute -top-[42px] ${elfFlip ? '-left-3' : '-right-3'} pointer-events-none z-20`}>
          <Elf variant="sitting" flip={elfFlip} />
        </div>
      )}
      {media}
      {caption}
    </div>
  )

  // Select the top attachment element based on weather kind & sky phase
  let topElement: React.ReactNode = null
  const seedOffset = seed + pairIdx * 3 + index

  if (isOctober(seasonalNow)) {
    if (phase === 'dusk' || phase === 'night') {
      topElement = (
        <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
          <JackOLantern seed={seedOffset} />
        </div>
      )
    } else {
      topElement = (
        <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
          <Pumpkin seed={seedOffset} />
        </div>
      )
    }
  } else if (isDecember(seasonalNow)) {
    topElement = (
      <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
        <CandyCane seed={seedOffset} />
      </div>
    )
  } else if (kind === 'snowy') {
    topElement = (
      <div className="absolute bottom-[calc(100%-16px)] pointer-events-none select-none z-10 text-[96px] filter drop-shadow-[0_0_16px_rgba(255,255,255,0.8)] animate-pulse">
        ❄️
      </div>
    )
  } else if (rainy) {
    topElement = (
      <div
        className="absolute bottom-[calc(100%-20px)] pointer-events-none select-none z-10 filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)] flex items-center justify-center"
        style={{ width: '144px', height: '168px', fontSize: '140px', lineHeight: '168px' }}
      >
        ☂️
      </div>
    )
  } else if (phase === 'night') {
    topElement = (
      <div className="absolute bottom-[calc(100%-16px)] pointer-events-none select-none z-10 text-[92px] filter drop-shadow-[0_0_24px_rgba(255,160,50,0.95)]">
        🏮
      </div>
    )
  } else if (phase === 'dawn') {
    topElement = (
      <div className="absolute bottom-[calc(100%-16px)] pointer-events-none select-none z-10 text-[92px] filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]">
        🐓
      </div>
    )
  } else if (phase === 'dusk') {
    topElement = (
      <div className="absolute bottom-[calc(100%-16px)] pointer-events-none select-none z-10 text-[92px] filter drop-shadow-[0_0_20px_rgba(255,200,80,0.9)]">
        🪔
      </div>
    )
  } else {
    // Clear / Sunny / Cloudy Day
    const balloonColor = BALLOON_COLORS[(seed + pairIdx * 3 + index) % BALLOON_COLORS.length]
    topElement = (
      <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
        <Balloon color={balloonColor} />
      </div>
    )
  }

  return (
    <motion.div
      initial={{ y: `${54 + f * 8}vh`, opacity: 0 }}
      animate={{ y: [`${54 + f * 8}vh`, `${2 + g * 3}vh`, `0vh`], opacity: 1 }}
      exit={{ y: '-125vh', opacity: 0.9, transition: { duration: 1.7, ease: 'easeIn', delay: delay * 0.5 } }}
      transition={{
        y: { duration: 9 + f * 1.5, times: [0, 0.42, 1], ease: ['easeOut', 'easeInOut'], delay },
        opacity: { duration: 1.0, delay },
      }}
      className="relative"
    >
      <motion.div
        animate={sway ? { rotate: [-(1.5 + f * 1.0), 1.5 + g * 1.0] } : undefined}
        transition={{ repeat: Infinity, repeatType: 'mirror', duration: 3.3 + g * 1.4, ease: 'easeInOut', delay: f * 2.2 }}
        style={{ transformOrigin: 'top center' }}
        className="relative flex flex-col items-center"
      >
        {topElement}
        {card}
      </motion.div>
    </motion.div>
  )
}

export default function Slideshow({
  photos,
  onDismiss,
  currentTrack,
  queue,
  isPlaying,
  elapsedSeconds,
  durationSeconds,
  onTogglePlay,
  onNextTrack,
  onPrevTrack,
  onSeek,
  onOpenFullPlayer,
  onClose,
}: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const swipeStart = useRef<number | null>(null)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [playerReady, setPlayerReady] = useState(false)
  const [isPortraitViewport, setIsPortraitViewport] = useState(() => window.innerHeight > window.innerWidth)
  // Capture the URL overrides ONCE. The kiosk's idle timer rewrites the hash
  // to "#/home" after a few minutes, which used to erase ?sky=/?skyfx= mid-run
  // and silently drop the sky back to real weather.
  const [override] = useState(() => ({ phase: getPhaseOverride(), kind: getKindOverride() }))
  const [kind, setKind] = useState<SkyKind>(override.kind ?? 'clear')
  const [sun, setSun] = useState<{ sunrise: Date | null; sunset: Date | null }>({ sunrise: null, sunset: null })
  const [now, setNow] = useState(() => new Date())

  const [hidden, setHidden] = useState(() => document.visibilityState === 'hidden')
  const { quality, fps, frameTimeMs } = useQuality(!hidden)
  const { data: config } = useData<{ secondary_tz: string; secondary_tz_emoji: string }>('/api/setup/config', ['setup'])
  const [showDebug, setShowDebug] = useState(() => getQueryParam('debug') === '1')

  const [overlayVisible, setOverlayVisible] = useState(false)
  const [reminderPayload, setReminderPayload] = useState<ReminderPayload | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const handleShowAgenda = (e: Event) => {
      const customEv = e as CustomEvent<{ reminder?: ReminderPayload }>
      const payload = customEv.detail?.reminder || null
      setReminderPayload(payload)
      setOverlayVisible(true)

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        setOverlayVisible(false)
      }, payload ? 30000 : 20000)
    }

    window.addEventListener('trigger-calendar-overlay', handleShowAgenda)
    return () => {
      window.removeEventListener('trigger-calendar-overlay', handleShowAgenda)
      if (timer) clearTimeout(timer)
    }
  }, [])

  const seasonalNow = getSeasonalDate(now)
  const phase: SkyPhase = override.phase ?? computePhase(now, sun.sunrise, sun.sunset)
  const skyState: SkyState = { phase, kind, paused: !!selectedVideo || hidden, quality }
  const stateRef = useRef<SkyState>(skyState)
  stateRef.current = skyState

  const rootRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<HTMLVideoElement>(null)
  const starRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleResize = () => setIsPortraitViewport(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Stop all sky work when the kiosk screen sleeps or the tab is backgrounded.
  useEffect(() => {
    const onVis = () => setHidden(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Real weather drives the sky. Refresh every 15 minutes; tick the clock so
  // time and phase follow the actual sun.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const data = await api.get<WeatherResp>('/api/weather')
        if (!alive) return
        if (!override.kind) setKind(toKind(data.current?.kind))
        const today = data.daily?.[0]
        setSun({
          sunrise: today?.sunrise ? new Date(today.sunrise) : null,
          sunset: today?.sunset ? new Date(today.sunset) : null,
        })
      } catch (e) {
        /* keep defaults */
      }
    }
    load()
    const weatherTimer = setInterval(load, 15 * 60 * 1000)
    const clockTimer = setInterval(() => setNow(new Date()), 1000)
    return () => {
      alive = false
      clearInterval(weatherTimer)
      clearInterval(clockTimer)
    }
  }, [])

  // Re-runs when the quality tier changes, because the canvases themselves are
  // only mounted above the lowest tier — the engines must follow their refs.
  useEffect(() => {
    const stopStars = starRef.current ? startStarCanvas(starRef.current, () => stateRef.current) : undefined
    const stopFx = fxRef.current ? startFxCanvas(fxRef.current, () => stateRef.current) : undefined
    return () => {
      stopStars?.()
      stopFx?.()
    }
  }, [quality])

  // Track shuffle seed so slides re-randomize every time the screensaver mounts or finishes a cycle
  const [shuffleSeed, setShuffleSeed] = useState(() => Math.random())

  // Parse items into slides (landscape/video singly, portraits paired side-by-side)
  const slides = useMemo(() => {
    const list = [...photos]
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]]
    }

    const result: Slide[] = []
    const used = new Set<string>()

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (used.has(item.url)) continue

      if (item.orientation === 'portrait' && !isPortraitViewport) {
        let partner: MediaItem | null = null
        for (let j = i + 1; j < list.length; j++) {
          const nextItem = list[j]
          if (nextItem.orientation === 'portrait' && !used.has(nextItem.url)) {
            partner = nextItem
            break
          }
        }
        if (partner) {
          result.push({ id: `${item.url}_${partner.url}`, type: 'pair', items: [item, partner] })
          used.add(item.url)
          used.add(partner.url)
          continue
        }
      }
      result.push({ id: item.url, type: 'single', items: [item] })
      used.add(item.url)
    }
    return result
  }, [photos, shuffleSeed, isPortraitViewport])

  useEffect(() => {
    setCurrentIdx((index) => Math.max(0, Math.min(index, Math.max(0, slides.length - 1))))
  }, [slides.length])

  // Readiness is probed from the element rather than trusted to events. The
  // poster clip has usually already buffered this URL, so `canplay` can fire
  // before React attaches its (non-bubbling, directly-bound) media listeners —
  // miss it and the spinner would latch on forever. Also covers autoplay being
  // refused, which never fires `playing` at all.
  useEffect(() => {
    if (!selectedVideo) return
    setPlayerReady(false)
    const v = playerRef.current
    if (!v) return
    const check = () => {
      if (v.readyState >= 3) setPlayerReady(true)
    }
    check()
    const poll = setInterval(check, 200)
    // Last resort: never leave a spinner up, even if the browser goes quiet.
    const bail = setTimeout(() => setPlayerReady(true), 3000)
    // Blocked autoplay (common on kiosk browsers with sound) resolves to a
    // rejected promise; show the controls instead of spinning.
    v.play().catch(() => setPlayerReady(true))
    return () => {
      clearInterval(poll)
      clearTimeout(bail)
    }
  }, [selectedVideo])

  // While the full-screen player is open, pause the slide's inline clips so
  // they aren't decoding the same (or another) video underneath it — that
  // contention is what makes the tapped video stutter.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const inline = [...root.querySelectorAll('video')].filter((v) => !v.controls)
    if (selectedVideo) {
      inline.forEach((v) => v.pause())
    } else {
      inline.forEach((v) => {
        if (v.autoplay && v.isConnected) v.play().catch(() => {})
      })
    }
  }, [selectedVideo])

  // Warm the browser cache/decoder for the next slide's images so the decode
  // never lands in the middle of the entrance animation. Clean up references
  // on slide change to avoid memory accumulation on Android WebViews.
  useEffect(() => {
    if (slides.length <= 1) return
    const next = slides[(currentIdx + 1) % slides.length]
    const preloads: HTMLImageElement[] = []
    for (const it of next.items) {
      if (it.type === 'image' || it.type === 'live_photo') {
        const img = new window.Image()
        img.src = it.displayUrl || it.url
        preloads.push(img)
      }
    }
    return () => {
      for (const img of preloads) {
        img.onload = null
        img.onerror = null
        img.src = ''
      }
    }
  }, [currentIdx, slides])

  // Performance telemetry logging for diagnosing Android tablet slowdowns
  useEffect(() => {
    const memoryMb = (performance as any)?.memory ? Math.round((performance as any).memory.usedJSHeapSize / 1048576) : null
    console.info(
      `[Nivas Telemetry] Slide ${currentIdx + 1}/${slides.length} | FPS: ${fps} (${frameTimeMs}ms) | Quality: ${quality}${memoryMb !== null ? ` | Heap: ${memoryMb}MB` : ''}`
    )
  }, [currentIdx, slides.length, fps, frameTimeMs, quality])

  // Advance every 9 seconds, paused while a full video is being watched.
  // When wrapping around at the end of the deck, re-shuffle so the next loop
  // plays in a completely new random order.
  useEffect(() => {
    if (slides.length <= 1 || selectedVideo !== null || paused) return
    const timer = setInterval(() => {
      setCurrentIdx((prev) => {
        const next = prev + 1
        if (next >= slides.length) {
          setShuffleSeed(Math.random())
          return 0
        }
        return next
      })
    }, 9000)
    return () => clearInterval(timer)
  }, [slides.length, selectedVideo, paused])

  if (slides.length === 0) return null

  const activeSlide = slides[currentIdx]
  const overcast = kind !== 'clear'
  const gradient = SKY_GRADIENTS[phase][overcast ? 'overcast' : 'clear']
  const items = activeSlide.items
  const pair = items.length > 1

  // Secondary timezone formatting for the clock overlay
  const secondaryTz = config?.secondary_tz || 'Asia/Kolkata'
  const secondaryEmoji = config?.secondary_tz_emoji || '🇮🇳'
  let secondaryFormatted = ''
  try {
    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
    const localDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: localTz }).format(now)
    const secondaryDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: secondaryTz }).format(now)
    const hasDateDiff = localDateStr !== secondaryDateStr
    const tStr = now.toLocaleTimeString(undefined, { timeZone: secondaryTz, hour: 'numeric', minute: '2-digit' })
    if (hasDateDiff) {
      const dStr = new Intl.DateTimeFormat('en-US', { timeZone: secondaryTz, month: 'short', day: 'numeric' }).format(now)
      secondaryFormatted = `${tStr} (${dStr})`
    } else {
      secondaryFormatted = tStr
    }
  } catch {}

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[100] overflow-hidden cursor-none select-none"
      onClick={onDismiss}
      onTouchStart={(event) => { swipeStart.current = event.changedTouches[0]?.clientX ?? null }}
      onTouchEnd={(event) => {
        const start = swipeStart.current
        const end = event.changedTouches[0]?.clientX
        swipeStart.current = null
        if (start === null || end === undefined || Math.abs(end - start) < 48) return
        event.stopPropagation()
        setCurrentIdx((index) => end < start ? (index + 1) % slides.length : (index - 1 + slides.length) % slides.length)
      }}
    >
      <style>{'@keyframes sky-cloud { from { transform: translateX(-60vmin); } to { transform: translateX(110vw); } }'}</style>

      {/* Clock & Date Ambient Glass Overlay */}
      <div className="absolute top-6 right-6 z-40 flex flex-col items-end select-none">
        <div className="bg-black/30 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/15 text-white shadow-2xl flex flex-col items-end pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onDismiss()
              window.dispatchEvent(new CustomEvent('open-create-timer'))
            }}
            className="text-3xl sm:text-4xl lg:text-5xl font-normal tabular-nums tracking-tight text-white leading-none drop-shadow-md cursor-pointer hover:opacity-85 active:scale-95 transition-all text-right"
            title="Click to set a timer"
          >
            {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </button>
          <div className="text-sm sm:text-base font-medium text-white/80 mt-2 leading-none drop-shadow-sm pointer-events-none">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          {secondaryFormatted && (
            <div className="text-xs sm:text-sm text-white/70 mt-2 leading-none flex items-center gap-1.5 font-light">
              <span>{secondaryEmoji}</span>
              <span>{secondaryFormatted}</span>
            </div>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setOverlayVisible(!overlayVisible)
            }}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold px-3.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white/90 transition-all pointer-events-auto border border-white/15 shadow-sm active:scale-95"
          >
            <Icon name="calendar_month" className="text-base text-[var(--primary)] shrink-0" />
            <span>{overlayVisible ? 'Hide Agenda' : 'View Agenda'}</span>
          </button>
        </div>
      </div>

      {/* Motion & Scheduled Reminder Agenda Overlay */}
      <AmbientCalendarOverlay
        visible={overlayVisible}
        onDismiss={() => setOverlayVisible(false)}
        reminderPayload={reminderPayload}
        onOpenDashboard={onDismiss}
      />

      {/* Debug & Telemetry HUD */}
      <div
        className="absolute top-6 left-6 z-50 text-white/50 text-[11px] font-mono tracking-tight cursor-pointer select-none"
        onClick={(e) => {
          e.stopPropagation()
          setShowDebug(!showDebug)
        }}
      >
        {showDebug ? (
          <div className="bg-black/85 backdrop-blur-md p-3 rounded-xl border border-white/20 text-white space-y-1 shadow-2xl pointer-events-auto min-w-[200px]">
            <div className="font-bold text-amber-400 border-b border-white/10 pb-1 mb-1 flex items-center justify-between">
              <span>⚡ Telemetry & HUD</span>
              <span className="text-[9px] text-white/40">Tap to close</span>
            </div>
            <div>FPS: <span className={fps >= 45 ? 'text-emerald-400' : fps >= 30 ? 'text-amber-400' : 'text-rose-400 font-bold'}>{fps}</span> ({frameTimeMs}ms)</div>
            <div>Quality Tier: <span className="text-cyan-400 font-semibold">{quality.toUpperCase()}</span></div>
            <div>Slide: <span className="text-white font-medium">{currentIdx + 1} / {slides.length}</span></div>
            {(performance as any)?.memory && (
              <div>JS Heap: <span className="text-purple-300">{Math.round((performance as any).memory.usedJSHeapSize / 1048576)} MB</span></div>
            )}
          </div>
        ) : (
          <span className="hover:text-white/80 transition-colors opacity-40 hover:opacity-100">⚙️ Telemetry</span>
        )}
      </div>

      {/* Sky gradient, crossfading between phases */}
      <AnimatePresence>
        <motion.div
          key={`${phase}-${overcast}`}
          className="absolute inset-0"
          style={{ background: gradient }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
        />
      </AnimatePresence>

      {/* Vignette, painted into the same layer as nothing else — kept as a
          sibling of the gradient but non-animating so it rasterizes once. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.26) 100%)' }}
      />

      <CelestialGlow phase={phase} kind={kind} />

      {/* Stars + shooting stars (behind photos) */}
      <canvas ref={starRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <CloudLayer phase={phase} kind={kind} quality={quality} />

      {/* Photos. Plain sync presence: every layer here is already absolutely
          positioned, so popLayout's layout projection was measuring for
          nothing on every frame. */}
      <AnimatePresence>
        <motion.div
          key={activeSlide.id}
          className="absolute inset-0 flex items-center justify-center gap-12 p-10"
          animate={{ zIndex: 10 }}
          exit={{ zIndex: 5 }}
        >
          {items.map((item, idx) => (
            <PhotoRig
              key={item.url}
              item={item}
              phase={phase}
              kind={kind}
              index={currentIdx}
              pair={pair}
              pairIdx={idx}
              quality={quality}
              onOpenVideo={setSelectedVideo}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Weather + delights (rain, snow, fireflies, birds — in front of photos) */}
      <canvas ref={fxRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />

      {/* Holiday Delights (December String Lights & Elves) */}
      {isDecember(seasonalNow) && <StringLights />}
      {isElfSeason(seasonalNow) && (
        <>
          <div className="fixed bottom-2 left-10 pointer-events-none z-30 select-none animate-[bounce_4s_ease-in-out_infinite]">
            <Elf variant="standing" />
          </div>
          <RunningElf />
        </>
      )}

      {/* Bottom right controls & Now Playing dock */}
      <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-[110] flex flex-col items-end gap-3 pointer-events-none">
        {/* Slideshow Controls (positioned above Now Playing when active) */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="flex gap-2 pointer-events-auto"
        >
          <button
            aria-label="Previous slide"
            onClick={(e) => {
              e.stopPropagation()
              setCurrentIdx((i) => (i - 1 + slides.length) % slides.length)
            }}
            className="p-3 rounded-full bg-black/45 hover:bg-black/60 active:scale-95 text-white transition backdrop-blur-md cursor-pointer"
          >
            <Icon name="skip_previous" />
          </button>
          <button
            aria-label={paused ? 'Play slideshow' : 'Pause slideshow'}
            onClick={(e) => {
              e.stopPropagation()
              setPaused((value) => !value)
            }}
            className="p-3 rounded-full bg-black/45 hover:bg-black/60 active:scale-95 text-white transition backdrop-blur-md cursor-pointer"
          >
            <Icon name={paused ? 'play_arrow' : 'pause'} />
          </button>
          <button
            aria-label="Next slide"
            onClick={(e) => {
              e.stopPropagation()
              setCurrentIdx((i) => (i + 1) % slides.length)
            }}
            className="p-3 rounded-full bg-black/45 hover:bg-black/60 active:scale-95 text-white transition backdrop-blur-md cursor-pointer"
          >
            <Icon name="skip_next" />
          </button>
        </div>

        {/* Now Playing MiniPlayerBar */}
        {currentTrack && (
          <MiniPlayerBar
            docked
            currentTrack={currentTrack}
            isPlaying={Boolean(isPlaying)}
            elapsedSeconds={elapsedSeconds ?? 0}
            durationSeconds={durationSeconds ?? 0}
            onTogglePlay={onTogglePlay ?? (() => {})}
            onNextTrack={onNextTrack ?? (() => {})}
            onPrevTrack={onPrevTrack ?? (() => {})}
            onSeek={onSeek ?? (() => {})}
            onOpenFullPlayer={onOpenFullPlayer ?? onDismiss}
            onClose={onClose}
            slideshowMode
            className="pointer-events-auto shrink-0"
          />
        )}
      </div>

      {selectedVideo && (
        <div
          className="fixed inset-0 z-[130] bg-black flex items-center justify-center cursor-default"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedVideo(null)
          }}
        >
          {!playerReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 pointer-events-none">
              <div className="h-10 w-10 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              <span className="text-white/60 text-sm tracking-wide">Loading video…</span>
            </div>
          )}
          <video
            key={selectedVideo}
            ref={playerRef}
            src={selectedVideo}
            controls
            autoPlay
            playsInline
            preload="auto"
            onCanPlay={() => setPlayerReady(true)}
            onLoadedData={() => setPlayerReady(true)}
            onPlaying={() => setPlayerReady(true)}
            className="max-h-[92vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl border border-white/10"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-6 right-6 z-[140] p-3 rounded-full bg-neutral-900/80 hover:bg-neutral-800 text-white border border-white/10 shadow-lg cursor-pointer flex items-center justify-center"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedVideo(null)
            }}
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>
      )}

      <div className="absolute bottom-6 left-6 text-white/35 text-xs font-light tracking-wider z-30 pointer-events-none">
        Tap screen to return
      </div>
    </div>
  )
}
