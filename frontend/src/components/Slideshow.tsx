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
  getHolidayOverride,
  isOctober,
  isNovember,
  isDiwaliSeason,
  isThanksgivingWeek,
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
const getPhaseOverride = () => {
  const p = PHASES.find((x) => x === getQueryParam('sky'))
  if (p) return p
  const h = getHolidayOverride()?.toLowerCase()
  if (h === 'spooky') return 'night'
  return null
}
const getKindOverride = () => KINDS.find((k) => k === getQueryParam('skyfx')) ?? null

/** True when the URL carries a valid sky/skyfx/holiday preview override. */
export const hasSkyOverride = () =>
  getPhaseOverride() !== null ||
  getKindOverride() !== null ||
  getHolidayOverride() !== null

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
  const flip = seed % 2 === 0
  const canePath = flip
    ? 'M 36 94 L 36 38 C 36 12, 68 12, 68 36'
    : 'M 60 94 L 60 38 C 60 12, 28 12, 28 36'

  // Safe sanitized mask ID with NO colons (Android WebView / WebKit compatibility)
  const maskId = useMemo(() => `cc_mask_${seed}_${flip ? 'l' : 'r'}`, [seed, flip])

  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
      aria-hidden="true"
    >
      <defs>
        <mask id={maskId}>
          <path
            d={canePath}
            stroke="white"
            strokeWidth="16"
            strokeLinecap="round"
            fill="none"
          />
        </mask>
      </defs>

      {/* Guaranteed base path with direct red and white stripes */}
      <path
        d={canePath}
        stroke="#dc2626"
        strokeWidth="16"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={canePath}
        stroke="#ffffff"
        strokeWidth="16"
        strokeDasharray="12 12"
        strokeLinecap="butt"
        fill="none"
      />

      {/* Masked diagonal peppermint candy stripes with green pin-stripe accents */}
      <g mask={`url(#${maskId})`}>
        <rect x="0" y="0" width="96" height="155" fill="#ffffff" />
        {[-36, -20, -4, 12, 28, 44, 60, 76, 92, 108, 124].map((offset) => (
          <g key={offset} transform="rotate(-35 48 48)">
            <rect
              x="-20"
              y={offset}
              width="140"
              height="8"
              fill="#dc2626"
            />
            <rect
              x="-20"
              y={offset + 9.5}
              width="140"
              height="2"
              fill="#15803d"
            />
          </g>
        ))}
        {/* Gloss highlight */}
        <path
          d={flip ? 'M 33 92 L 33 38 C 33 15, 65 15, 65 34' : 'M 63 92 L 63 38 C 63 15, 31 15, 31 34'}
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />
      </g>

      {/* Satin Ribbon Bow tied around the cane at y=62 */}
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

function AutumnLeafTopper({ seed = 0 }: { seed?: number }) {
  const flip = seed % 2 === 0
  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.3)]"
      aria-hidden="true"
    >
      <g transform={flip ? 'translate(96, 0) scale(-1, 1)' : undefined}>
        {/* Amber Birch Leaf (Background tilted right) */}
        <g transform="translate(56, 52) rotate(28)">
          <path
            d="M 0 0 C 12 -12, 18 -26, 0 -38 C -18 -26, -12 -12, 0 0 Z"
            fill="#d97706"
          />
          <path d="M 0 0 L 0 -34" stroke="#92400e" strokeWidth="0.8" fill="none" />
        </g>

        {/* Golden Oak Leaf (Background tilted left) */}
        <g transform="translate(38, 54) rotate(-32)">
          <path
            d="M 0 0 C -10 -8, -14 -16, -6 -20 C -15 -25, -12 -34, -2 -38 C -8 -44, 2 -50, 0 -52 C -2 -50, 8 -44, 2 -38 C 12 -34, 15 -25, 6 -20 C 14 -16, 10 -8, 0 0 Z"
            fill="#eab308"
          />
          <path d="M 0 0 L 0 -48" stroke="#ca8a04" strokeWidth="1" fill="none" />
        </g>

        {/* Crimson Sugar Maple Leaf (Foreground Center) */}
        <g transform="translate(48, 56) rotate(-4)">
          <path
            d="M 0 0 L 0 -8 
               L -10 -4 L -18 -8 L -12 -14 
               L -22 -22 L -10 -22 
               L 0 -36 
               L 10 -22 L 22 -22 
               L 12 -14 L 18 -8 L 10 -4 
               L 0 -8 Z"
            fill="#dc2626"
          />
          {/* Maple veins */}
          <path d="M 0 0 L 0 -32 M 0 -12 L -15 -19 M 0 -12 L 15 -19" stroke="#991b1b" strokeWidth="1.2" fill="none" />
        </g>

        {/* Acorn clustered in front */}
        <g transform="translate(48, 62)">
          {/* Nut */}
          <path
            d="M -7 4 C -7 14, 7 14, 7 4 Z"
            fill="#78350f"
          />
          {/* Nut highlight */}
          <ellipse cx="-2.5" cy="7" rx="1.5" ry="3" fill="#92400e" opacity="0.6" />
          {/* Textured Cupule Cap */}
          <ellipse cx="0" cy="3" rx="8" ry="4" fill="#451a03" />
          <path d="M -6 3 Q 0 1 6 3 M -5 4 Q 0 2 5 4" stroke="#5c2607" strokeWidth="0.8" fill="none" />
          {/* Stem */}
          <path d="M 0 0 Q -2 -5 -4 -7" stroke="#451a03" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>

        {/* Rustic Twine Bow */}
        <g transform="translate(48, 60)">
          <path d="M 0 0 C -12 -6, -14 4, 0 2 Z" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <path d="M 0 0 C 12 -6, 14 4, 0 2 Z" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" />
          <circle cx="0" cy="1" r="2.2" fill="#b45309" />
          {/* Bow tails */}
          <path d="M -2 2 Q -8 10 -10 16" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 2 2 Q 8 10 11 15" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        </g>

        {/* Tether Knot & Rustic Twine lifting photo */}
        <ellipse cx="48" cy="88" rx="3.5" ry="2.2" fill="#92400e" />
        <path
          d="M 48 88 C 43 108 53 128 48 153"
          stroke="#ca8a04"
          strokeWidth="1.8"
          strokeDasharray="4 2"
          fill="none"
        />
      </g>
    </svg>
  )
}

function DiyaTopper({ seed = 0 }: { seed?: number }) {
  const diyaGradId = useId()
  const flameGradId = useId()

  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none filter drop-shadow-[0_0_18px_rgba(251,191,36,0.95)] drop-shadow-[0_0_32px_rgba(249,115,22,0.6)]"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={diyaGradId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="60%" stopColor="#c2410c" />
          <stop offset="100%" stopColor="#7c2d12" />
        </linearGradient>
        <radialGradient id={flameGradId} cx="50%" cy="60%" r="50%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#fef08a" />
          <stop offset="65%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#dc2626" />
        </radialGradient>
      </defs>

      <style>{`
        @keyframes diyaFlameDance {
          0%, 100% { transform: scale(1) rotate(-1deg); }
          50% { transform: scale(1.08, 0.94) rotate(2deg); }
        }
        @keyframes diyaGlowPulse {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>

      {/* Radiant ambient glow halo */}
      <circle cx="48" cy="38" r="24" fill="rgba(251, 191, 36, 0.25)" style={{ animation: 'diyaGlowPulse 2.4s ease-in-out infinite' }} />

      {/* Dancing Teardrop Flame */}
      <g style={{ transformOrigin: '48px 46px', animation: 'diyaFlameDance 1.8s ease-in-out infinite' }}>
        {/* Outer flame */}
        <path
          d="M 48 20 C 42 30, 40 42, 48 46 C 56 42, 54 30, 48 20 Z"
          fill={`url(#${flameGradId})`}
        />
        {/* Inner white flame core */}
        <ellipse cx="48" cy="40" rx="3.5" ry="5.5" fill="#ffffff" opacity="0.9" />
      </g>

      {/* Cotton wick */}
      <path d="M 48 46 L 48 50" stroke="#451a03" strokeWidth="2.2" strokeLinecap="round" />

      {/* Ornate Terracotta Diya Bowl */}
      <g>
        {/* Base shadow / foot */}
        <ellipse cx="48" cy="74" rx="14" ry="4" fill="#5c1d06" />

        {/* Diya Clay Body */}
        <path
          d="M 22 56 
             C 22 72, 34 76, 48 76 
             C 62 76, 74 72, 74 56 
             C 74 54, 70 52, 65 52 
             C 56 52, 52 48, 48 48 
             C 44 48, 40 52, 31 52 
             C 26 52, 22 54, 22 56 Z"
          fill={`url(#${diyaGradId})`}
        />

        {/* Diya Rim Beading / Gold Filigree */}
        <path
          d="M 23 54 Q 48 58 73 54"
          stroke="#facc15"
          strokeWidth="1.8"
          strokeDasharray="2.5 2.5"
          fill="none"
        />

        {/* Decorative floral carving on bowl */}
        <path
          d="M 38 64 Q 48 70 58 64 M 44 67 Q 48 71 52 67"
          stroke="#fbbf24"
          strokeWidth="1.4"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="48" cy="62" r="2" fill="#facc15" />
      </g>

      {/* Golden Bead Tether Suspender lifting photo */}
      <ellipse cx="48" cy="78" rx="3.5" ry="2" fill="#ca8a04" />
      <g stroke="#facc15" strokeWidth="1.6" fill="none">
        <path d="M 48 79 C 45 98 52 118 48 153" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="3 3" />
        <circle cx="48" cy="85" r="1.6" fill="#facc15" />
        <circle cx="47" cy="102" r="1.6" fill="#facc15" />
        <circle cx="49" cy="120" r="1.6" fill="#facc15" />
        <circle cx="48" cy="138" r="1.6" fill="#facc15" />
      </g>
    </svg>
  )
}

function ThanksgivingTopper({ seed = 0 }: { seed?: number }) {
  const flip = seed % 2 === 0
  return (
    <svg
      width="112"
      height="181"
      viewBox="0 0 96 155"
      className="pointer-events-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
      aria-hidden="true"
    >
      <g transform={flip ? 'translate(96, 0) scale(-1, 1)' : undefined}>
        {/* Cornucopia Woven Horn Basket */}
        <path
          d="M 22 24 
             C 14 30, 16 46, 26 50 
             C 34 54, 46 56, 56 60 
             C 68 64, 76 68, 78 72 
             C 74 74, 52 74, 38 68 
             C 24 62, 14 50, 12 36 
             C 10 26, 16 18, 22 24 Z"
          fill="#78350f"
        />
        {/* Curled horn tip */}
        <path
          d="M 22 24 C 26 20, 24 14, 18 16 C 14 18, 14 24, 18 26"
          stroke="#451a03"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        {/* Wicker Weave Texture Ribs */}
        <path
          d="M 18 34 Q 24 40 28 48 
             M 28 38 Q 36 46 42 54 
             M 38 44 Q 48 52 56 60 
             M 50 50 Q 62 58 70 66"
          stroke="#92400e"
          strokeWidth="1.6"
          fill="none"
        />
        {/* Cornucopia Rim Opening */}
        <ellipse cx="64" cy="62" rx="16" ry="12" fill="#451a03" transform="rotate(-25 64 62)" />
        <ellipse cx="64" cy="62" rx="16" ry="12" stroke="#b45309" strokeWidth="2.5" fill="none" transform="rotate(-25 64 62)" />

        {/* Harvest Bounty overflowing from horn opening */}
        {/* Flint/Indian Corn */}
        <g transform="translate(62, 44) rotate(35)">
          <path d="M 0 0 C 4 -8, 10 -16, 12 -24 C 10 -26, 6 -26, 4 -22 C 2 -14, -2 -8, 0 0 Z" fill="#eab308" />
          <circle cx="6" cy="-14" r="1.2" fill="#b91c1c" />
          <circle cx="4" cy="-8" r="1.2" fill="#78350f" />
          <circle cx="8" cy="-18" r="1.2" fill="#ea580c" />
          <path d="M 0 0 C -4 -4, -6 -12, -4 -16 M 2 0 C 6 -4, 10 -8, 12 -12" stroke="#ca8a04" strokeWidth="1.2" fill="none" />
        </g>

        {/* Mini Pumpkin Gourd */}
        <g transform="translate(60, 62)">
          <ellipse cx="0" cy="0" rx="9" ry="8" fill="#ea580c" />
          <ellipse cx="-4" cy="0" rx="6" ry="7.5" fill="#f97316" />
          <ellipse cx="4" cy="0" rx="6" ry="7.5" fill="#f97316" />
          <ellipse cx="0" cy="0" rx="4" ry="8" fill="#fb923c" />
          <path d="M 0 -8 C 0 -11, 2 -13, 4 -14" stroke="#16a34a" strokeWidth="1.6" strokeLinecap="round" fill="none" />
        </g>

        {/* Red Apple */}
        <g transform="translate(74, 56)">
          <ellipse cx="0" cy="0" rx="6.5" ry="6" fill="#dc2626" />
          <path d="M 0 -6 L 1 -9" stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
          <ellipse cx="-2" cy="-2" rx="1.5" ry="3" fill="#ffffff" opacity="0.4" transform="rotate(-20 -2 -2)" />
        </g>

        {/* Purple Grapes Cluster */}
        <g transform="translate(72, 70)">
          <circle cx="-5" cy="0" r="3.2" fill="#7e22ce" />
          <circle cx="0" cy="0" r="3.2" fill="#9333ea" />
          <circle cx="5" cy="0" r="3.2" fill="#7e22ce" />
          <circle cx="-2.5" cy="4" r="3" fill="#6b21a8" />
          <circle cx="2.5" cy="4" r="3" fill="#7e22ce" />
          <circle cx="0" cy="8" r="2.8" fill="#581c87" />
        </g>

        {/* Tied Ribbon Knot at Horn Neck */}
        <g transform="translate(36, 62)">
          <ellipse cx="0" cy="0" rx="3.5" ry="2.5" fill="#b45309" />
          <path d="M -3 0 Q -8 8 -11 14" stroke="#d97706" strokeWidth="2" strokeLinecap="round" fill="none" />
          <path d="M 3 0 Q 7 8 9 14" stroke="#d97706" strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>

        {/* Tether Knot & String lifting photo card */}
        <ellipse cx="48" cy="88" rx="4" ry="2.5" fill="#78350f" />
        <path
          d="M 48 88 C 44 107 52 126 48 153"
          stroke="#d97706"
          strokeWidth="1.8"
          strokeDasharray="4 2"
          fill="none"
        />
      </g>
    </svg>
  )
}

function AutumnHarvestHorizon({
  seasonalDate,
  phase,
}: {
  seasonalDate?: Date
  phase: SkyPhase
}) {
  const isNightOrDusk = phase === 'night' || phase === 'dusk'
  const isDiwali = isDiwaliSeason(seasonalDate)

  return (
    <div className="absolute bottom-0 left-0 right-0 h-44 pointer-events-none z-[2] select-none overflow-hidden">
      <svg
        viewBox="0 0 1920 176"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden="true"
      >
        <style>{`
          @keyframes harvestDiyaFlicker {
            0%, 100% { opacity: 0.95; filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.9)); }
            50% { opacity: 0.7; filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.6)); }
          }
          @keyframes rangoliGlow {
            0%, 100% { opacity: 0.85; filter: drop-shadow(0 0 12px rgba(251, 191, 36, 0.7)); }
            50% { opacity: 0.55; filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.4)); }
          }
          @keyframes treeSway {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(1.2deg); }
          }
        `}</style>

        {/* --- Background Rolling Hills Silhouette --- */}
        <path
          d="M 0 176 L 0 115 Q 320 85, 640 105 Q 960 125, 1280 95 Q 1600 80, 1920 102 L 1920 176 Z"
          fill={isNightOrDusk ? '#1c1008' : '#78350f'}
          opacity={isNightOrDusk ? '0.85' : '0.65'}
        />

        {/* Distant Rustic Barn on distant ridge */}
        <g transform="translate(1120, 84)" opacity="0.8">
          <polygon points="0,20 18,6 36,20 36,36 0,36" fill={isNightOrDusk ? '#2a140a' : '#991b1b'} />
          <polygon points="12,14 18,9 24,14 24,22 12,22" fill={isNightOrDusk ? '#160a04' : '#ffffff'} />
          <rect x="39" y="10" width="10" height="26" fill={isNightOrDusk ? '#201006' : '#64748b'} />
          <ellipse cx="44" cy="10" rx="5" ry="3" fill={isNightOrDusk ? '#2a140a' : '#94a3b8'} />
        </g>

        {/* --- Foreground Rolling Ridge --- */}
        <path
          d="M 0 176 L 0 108 Q 280 88, 560 104 Q 840 120, 1120 98 Q 1400 82, 1680 100 Q 1820 106, 1920 94 L 1920 176 Z"
          fill={isNightOrDusk ? '#0d0703' : '#451a03'}
        />

        {/* --- Autumn Trees (Oak, Maple, Birch) --- */}
        {/* Tree 1: Golden Birch (Left, x = 110) */}
        <g transform="translate(110, 110)">
          <path d="M -3 45 Q 0 20 -2 0 Q 3 20 5 45 Z" fill="#e2e8f0" stroke="#64748b" strokeWidth="0.8" />
          <path d="M 0 25 L -8 18 M 2 15 L 10 8" stroke="#64748b" strokeWidth="1.2" />
          <g style={{ transformOrigin: '0 0', animation: 'treeSway 6s ease-in-out infinite' }}>
            <circle cx="0" cy="-22" r="28" fill="#eab308" opacity="0.9" />
            <circle cx="-16" cy="-15" r="20" fill="#facc15" opacity="0.95" />
            <circle cx="16" cy="-18" r="22" fill="#ca8a04" opacity="0.9" />
            <circle cx="0" cy="-34" r="18" fill="#fef08a" opacity="0.85" />
          </g>
        </g>

        {/* Tree 2: Crimson Sugar Maple (x = 340) */}
        <g transform="translate(340, 106)">
          <path d="M -4 48 Q 0 22 -2 0 Q 4 22 6 48 Z" fill="#291206" />
          <g style={{ transformOrigin: '0 0', animation: 'treeSway 7.5s ease-in-out infinite', animationDelay: '1.2s' }}>
            <circle cx="0" cy="-24" r="32" fill="#b91c1c" opacity="0.92" />
            <circle cx="-18" cy="-16" r="24" fill="#dc2626" opacity="0.95" />
            <circle cx="18" cy="-20" r="24" fill="#991b1b" opacity="0.9" />
            <circle cx="0" cy="-38" r="20" fill="#ef4444" opacity="0.85" />
          </g>
        </g>

        {/* Tree 3: Amber Oak (Right, x = 1580) */}
        <g transform="translate(1580, 102)">
          <path d="M -5 50 Q 0 24 -2 0 Q 5 24 7 50 Z" fill="#291206" />
          <g style={{ transformOrigin: '0 0', animation: 'treeSway 6.8s ease-in-out infinite', animationDelay: '0.6s' }}>
            <circle cx="0" cy="-26" r="34" fill="#d97706" opacity="0.92" />
            <circle cx="-20" cy="-18" r="26" fill="#f59e0b" opacity="0.95" />
            <circle cx="20" cy="-22" r="26" fill="#b45309" opacity="0.9" />
            <circle cx="0" cy="-42" r="22" fill="#fbbf24" opacity="0.85" />
          </g>
        </g>

        {/* Tree 4: Deep Rust Maple (Right edge, x = 1820) */}
        <g transform="translate(1820, 108)">
          <path d="M -4 46 Q 0 22 -2 0 Q 4 22 6 46 Z" fill="#291206" />
          <g style={{ transformOrigin: '0 0', animation: 'treeSway 7s ease-in-out infinite', animationDelay: '2s' }}>
            <circle cx="0" cy="-22" r="28" fill="#9a3412" opacity="0.92" />
            <circle cx="-16" cy="-14" r="22" fill="#c2410c" opacity="0.95" />
            <circle cx="16" cy="-18" r="22" fill="#7c2d12" opacity="0.9" />
          </g>
        </g>

        {/* --- Rustic Split-Rail Wooden Fence --- */}
        <g stroke={isNightOrDusk ? '#3b2314' : '#78350f'} strokeWidth="2.5" strokeLinecap="round">
          {[220, 260, 300, 480, 520, 560, 600, 1260, 1300, 1340, 1380, 1680, 1720, 1760].map((px) => (
            <g key={px}>
              <line x1={px} y1="134" x2={px} y2="100" />
              <line x1={px - 4} y1="130" x2={px + 4} y2="104" strokeWidth="1.5" opacity="0.75" />
            </g>
          ))}
          <path d="M 215 108 L 305 108 M 215 122 L 305 122" />
          <path d="M 475 108 L 605 108 M 475 122 L 605 122" />
          <path d="M 1255 108 L 1385 108 M 1255 122 L 1385 122" />
          <path d="M 1675 108 L 1765 108 M 1675 122 L 1765 122" />
        </g>

        {/* --- Golden Round Hay Bales in the field --- */}
        <g transform="translate(440, 118)">
          <ellipse cx="0" cy="0" rx="14" ry="10" fill={isNightOrDusk ? '#5c3a1e' : '#b45309'} />
          <ellipse cx="6" cy="0" rx="14" ry="10" fill={isNightOrDusk ? '#784d28' : '#d97706'} />
          <ellipse cx="6" cy="0" rx="11" ry="8" stroke={isNightOrDusk ? '#5c3a1e' : '#b45309'} strokeWidth="1.2" fill="none" />
        </g>
        <g transform="translate(1420, 114)">
          <ellipse cx="0" cy="0" rx="15" ry="11" fill={isNightOrDusk ? '#5c3a1e' : '#b45309'} />
          <ellipse cx="7" cy="0" rx="15" ry="11" fill={isNightOrDusk ? '#784d28' : '#d97706'} />
          <ellipse cx="7" cy="0" rx="12" ry="9" stroke={isNightOrDusk ? '#5c3a1e' : '#b45309'} strokeWidth="1.2" fill="none" />
        </g>

        {/* --- Harvest Field Pumpkins Scattered Around --- */}
        <g>
          <ellipse cx="236" cy="132" rx="7" ry="5.5" fill="#ea580c" />
          <ellipse cx="244" cy="133" rx="6" ry="5" fill="#f97316" />
          <path d="M 236 127 L 235 124 M 244 128 L 245 125" stroke="#15803d" strokeWidth="1.2" strokeLinecap="round" />

          <ellipse cx="582" cy="130" rx="8" ry="6.2" fill="#c2410c" />
          <ellipse cx="574" cy="132" rx="6.5" ry="5.2" fill="#ea580c" />

          <ellipse cx="1320" cy="128" rx="8" ry="6" fill="#ea580c" />
          <ellipse cx="1328" cy="129" rx="6.5" ry="5.2" fill="#f97316" />

          <ellipse cx="1704" cy="128" rx="7.5" ry="5.8" fill="#c2410c" />
        </g>

        {/* --- DIWALI SPECIAL: Glowing Diyas & Radiant Rangoli --- */}
        {isDiwali && (
          <g>
            {/* Glowing Clay Diyas on Fence Posts & Hill Crests */}
            {[220, 300, 480, 600, 800, 960, 1120, 1260, 1380, 1680, 1760].map((dx, i) => (
              <g key={dx} transform={`translate(${dx}, ${dx === 800 || dx === 960 || dx === 1120 ? 116 : 98})`}>
                <path d="M -6 4 Q 0 7 6 4 Q 0 0 -6 4 Z" fill="#9a3412" stroke="#ea580c" strokeWidth="0.8" />
                <g style={{ transformOrigin: '0 3px', animation: `harvestDiyaFlicker ${1.6 + (i % 4) * 0.3}s ease-in-out infinite`, animationDelay: `${(i % 5) * 0.25}s` }}>
                  <path d="M 0 -5 C -2.5 -1, -2.5 3, 0 3 C 2.5 3, 2.5 -1, 0 -5 Z" fill="#facc15" />
                  <ellipse cx="0" cy="1" rx="1.2" ry="2" fill="#ffffff" />
                </g>
              </g>
            ))}

            {/* Radiant Glowing Rangoli Geometric Mandala in Bottom Center (x = 960) */}
            <g transform="translate(960, 142)" style={{ animation: 'rangoliGlow 3.5s ease-in-out infinite' }}>
              <circle cx="0" cy="0" r="28" stroke="#facc15" strokeWidth="1.2" strokeDasharray="3 3" fill="none" opacity="0.85" />
              <circle cx="0" cy="0" r="20" stroke="#f97316" strokeWidth="1.5" fill="none" opacity="0.9" />
              <polygon points="0,-18 5,-7 17,-7 8,1 12,12 0,6 -12,12 -8,1 -17,-7 -5,-7" fill="#fbbf24" opacity="0.6" />
              <polygon points="0,18 -5,7 -17,7 -8,-1 -12,-12 0,-6 12,-12 8,-1 17,7 5,7" fill="#f43f5e" opacity="0.5" />
              <circle cx="0" cy="0" r="8" fill="#ea580c" opacity="0.85" />
              <ellipse cx="0" cy="1" rx="4.5" ry="2.5" fill="#fef08a" />
              <g style={{ transformOrigin: '0 0', animation: 'harvestDiyaFlicker 1.8s ease-in-out infinite' }}>
                <path d="M 0 -8 C -2 -3, -2 0, 0 0 C 2 0, 2 -3, 0 -8 Z" fill="#ffffff" />
              </g>
            </g>
          </g>
        )}
      </svg>
    </div>
  )
}

function Squirrel({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="72"
      height="56"
      viewBox="0 0 64 48"
      className="pointer-events-none select-none filter drop-shadow-[0_2px_6px_rgba(0,0,0,0.35)]"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes squirrelTailWiggle {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(8deg); }
        }
        @keyframes squirrelChew {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-1.2px); }
        }
      `}</style>

      {/* Fluffy Bushy Tail arching over back */}
      <g style={{ transformOrigin: '14px 34px', animation: 'squirrelTailWiggle 1.4s ease-in-out infinite' }}>
        <path
          d="M 14 34 
             C 6 36, 0 28, 2 18 
             C 4 8, 14 2, 22 4 
             C 28 6, 26 14, 20 18 
             C 14 22, 16 30, 20 34 Z"
          fill="#b45309"
        />
        <path
          d="M 10 24 C 6 16, 12 10, 18 10 C 20 12, 16 18, 14 24 Z"
          fill="#d97706"
        />
      </g>

      {/* Squirrel Body */}
      <ellipse cx="28" cy="32" rx="14" ry="10" fill="#92400e" />
      <ellipse cx="32" cy="34" rx="8" ry="6" fill="#fef3c7" opacity="0.85" />

      {/* Scampering back leg & paw */}
      <ellipse cx="18" cy="36" rx="6" ry="5" fill="#78350f" />
      <path d="M 14 39 L 10 42 L 15 42 Z" fill="#78350f" />

      {/* Squirrel Head & Ears */}
      <g style={{ animation: 'squirrelChew 0.8s ease-in-out infinite' }}>
        <ellipse cx="44" cy="24" rx="8" ry="7" fill="#92400e" />
        <circle cx="48" cy="27" r="4.2" fill="#b45309" />
        <path d="M 40 18 C 38 12, 42 12, 44 18 Z" fill="#78350f" />
        <path d="M 41 17 C 40 14, 42 14, 43 17 Z" fill="#fef3c7" />
        <circle cx="45" cy="22" r="1.8" fill="#1c1917" />
        <circle cx="44.5" cy="21.5" r="0.6" fill="#ffffff" />
        <circle cx="51" cy="25" r="1.1" fill="#1c1917" />
      </g>

      {/* Front Paws holding Acorn */}
      <g>
        <g transform="translate(48, 30)">
          <ellipse cx="0" cy="2" rx="3.2" ry="4" fill="#78350f" />
          <ellipse cx="0" cy="-1" rx="3.8" ry="2" fill="#451a03" />
        </g>
        <ellipse cx="45" cy="31" rx="3.5" ry="2.2" fill="#92400e" />
        <ellipse cx="48" cy="34" rx="3.5" ry="2.2" fill="#92400e" />
      </g>
    </svg>
  )
}

function RunningSquirrel() {
  const [running, setRunning] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDirection(Math.random() < 0.5 ? 1 : -1)
      setRunning(true)
    }, 18_000)

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
    }, 35_000 + Math.random() * 45_000)
  }

  if (!running) return null

  return (
    <motion.div
      initial={{ x: direction === 1 ? -80 : window.innerWidth + 80 }}
      animate={{ x: direction === 1 ? window.innerWidth + 80 : -80 }}
      transition={{ duration: 6.8, ease: 'linear' }}
      onAnimationComplete={handleAnimationComplete}
      className="fixed bottom-1 pointer-events-none z-30 select-none"
    >
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 0.24, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Squirrel flip={direction === -1} />
      </motion.div>
    </motion.div>
  )
}

function Turkey({ flip = false }: { flip?: boolean }) {
  return (
    <svg
      width="84"
      height="80"
      viewBox="0 0 76 72"
      className="pointer-events-none select-none filter drop-shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes turkeyWattleSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(14deg); }
        }
        @keyframes turkeyTailFan {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05, 0.98); }
        }
      `}</style>

      {/* Magnificent Fanned Tail Feathers */}
      <g style={{ transformOrigin: '24px 44px', animation: 'turkeyTailFan 2s ease-in-out infinite' }}>
        {[-50, -35, -20, -5, 10, 25, 40].map((deg, i) => (
          <g key={deg} transform={`translate(24, 44) rotate(${deg}) translate(0, -32)`}>
            <path d="M -4 16 L -5 -6 Q 0 -12 5 -6 L 4 16 Z" fill={i % 2 === 0 ? '#78350f' : '#b45309'} />
            <path d="M -4.5 4 L 4.5 4 L 4.8 -2 L -4.8 -2 Z" fill="#d97706" />
            <path d="M -4.8 -2 L 4.8 -2 Q 0 -10 -4.8 -2 Z" fill="#fde047" />
          </g>
        ))}
      </g>

      {/* Plump Turkey Body */}
      <ellipse cx="36" cy="46" rx="16" ry="14" fill="#451a03" />
      <path
        d="M 28 42 C 26 50, 36 56, 44 48 C 42 42, 34 38, 28 42 Z"
        fill="#78350f"
      />

      {/* Turkey Neck and Head */}
      <path
        d="M 44 44 C 48 36, 52 28, 50 20 C 53 22, 56 28, 52 44 Z"
        fill="#b91c1c"
      />
      <circle cx="50" cy="20" r="7" fill="#b91c1c" />

      {/* Pilgrim Hat on Turkey's Head */}
      <g transform="translate(50, 14)">
        <ellipse cx="0" cy="0" rx="10" ry="2.5" fill="#18181b" />
        <polygon points="-6,0 6,0 4.5,-12 -4.5,-12" fill="#27272a" />
        <rect x="-5" y="-3.5" width="10" height="3" fill="#ca8a04" />
        <rect x="-2" y="-4.5" width="4" height="4.5" fill="#facc15" stroke="#18181b" strokeWidth="0.8" />
      </g>

      {/* Eye & Beak */}
      <circle cx="53" cy="19" r="1.8" fill="#ffffff" />
      <circle cx="54" cy="19" r="1" fill="#18181b" />
      <polygon points="56,19 63,22 56,24" fill="#f59e0b" />

      {/* Red Wattle & Snood */}
      <g style={{ transformOrigin: '55px 22px', animation: 'turkeyWattleSway 1.2s ease-in-out infinite' }}>
        <path
          d="M 55 21 C 58 20, 60 26, 57 32 C 55 36, 52 34, 54 28 Z"
          fill="#dc2626"
        />
      </g>

      {/* Big Yellow Turkey Legs & Strutting Feet */}
      <g stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round">
        <line x1="32" y1="58" x2="30" y2="67" />
        <path d="M 24 67 L 30 67 L 33 65 M 30 67 L 32 69" fill="none" />

        <line x1="42" y1="58" x2="44" y2="67" />
        <path d="M 38 67 L 44 67 L 47 65 M 44 67 L 46 69" fill="none" />
      </g>
    </svg>
  )
}

function StruttingTurkey() {
  const [strutting, setStrutting] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDirection(Math.random() < 0.5 ? 1 : -1)
      setStrutting(true)
    }, 15_000)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleAnimationComplete = () => {
    setStrutting(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      setDirection(Math.random() < 0.5 ? 1 : -1)
      setStrutting(true)
    }, 30_000 + Math.random() * 40_000)
  }

  if (!strutting) return null

  return (
    <motion.div
      initial={{ x: direction === 1 ? -90 : window.innerWidth + 90 }}
      animate={{ x: direction === 1 ? window.innerWidth + 90 : -90 }}
      transition={{ duration: 8.5, ease: 'linear' }}
      onAnimationComplete={handleAnimationComplete}
      className="fixed bottom-1 pointer-events-none z-30 select-none"
    >
      <motion.div
        animate={{ y: [0, -7, 0] }}
        transition={{ duration: 0.38, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Turkey flip={direction === -1} />
      </motion.div>
    </motion.div>
  )
}

function StringLights() {
  const bulbs = useMemo(() => {
    const colors = [
      { fill: '#ef4444', glow: 'rgba(239,68,68,0.9)' },
      { fill: '#22c55e', glow: 'rgba(34,197,94,0.9)' },
      { fill: '#eab308', glow: 'rgba(234,179,8,0.95)' },
      { fill: '#3b82f6', glow: 'rgba(59,130,246,0.9)' },
      { fill: '#f97316', glow: 'rgba(249,115,22,0.9)' },
      { fill: '#ec4899', glow: 'rgba(236,72,153,0.9)' },
    ]
    const list = []
    const totalBulbs = 36
    const numScallops = 18
    const scallopWidth = 1920 / numScallops
    for (let i = 0; i <= totalBulbs; i++) {
      const px = (i / totalBulbs) * 1920
      const scallopIdx = Math.floor(px / scallopWidth)
      const xInScallop = (px - scallopIdx * scallopWidth) / scallopWidth
      const py = 6 + 18 * Math.sin(xInScallop * Math.PI)
      const color = colors[i % colors.length]
      list.push({
        id: i,
        px: Math.round(px),
        py: Math.round(py),
        color,
        dur: (1.5 + ((i * 7) % 5) * 0.25).toFixed(2),
        delay: (((i * 11) % 9) * 0.25).toFixed(2),
      })
    }
    return list
  }, [])

  return (
    <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none z-[2] select-none overflow-hidden">
      <svg
        viewBox="0 0 1920 60"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden="true"
      >
        <style>{`
          @keyframes stringBulbTwinkle {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.25; }
          }
        `}</style>
        {/* Scalloped pine-green cord */}
        <path
          d={Array.from({ length: 18 }, (_, i) => {
            const startX = i * (1920 / 18)
            const endX = (i + 1) * (1920 / 18)
            const midX = (startX + endX) / 2
            return `${i === 0 ? `M ${startX} 6` : ''} Q ${midX} 26, ${endX} 6`
          }).join(' ')}
          stroke="#14532d"
          strokeWidth="2.5"
          fill="none"
        />
        {/* Twinkling C9 Holiday Bulbs */}
        {bulbs.map((b) => (
          <g key={b.id} transform={`translate(${b.px}, ${b.py})`}>
            {/* Green socket fixture */}
            <rect x="-3" y="0" width="6" height="5" rx="1" fill="#166534" />
            {/* Bulb body with pure opacity animation (no CSS transform conflicts) */}
            <g
              style={{
                animation: `stringBulbTwinkle ${b.dur}s ease-in-out infinite`,
                animationDelay: `${b.delay}s`,
              }}
            >
              <path
                d="M 0 4 C -5 8, -5 17, 0 23 C 5 17, 5 8, 0 4 Z"
                fill={b.color.fill}
                style={{ filter: `drop-shadow(0 0 7px ${b.color.glow})` }}
              />
              <ellipse cx="-1.2" cy="11" rx="1.4" ry="3.5" fill="white" opacity="0.65" />
            </g>
          </g>
        ))}
      </svg>
    </div>
  )
}

function SittingElf({
  seed = 0,
  flip = false,
}: {
  seed?: number
  flip?: boolean
}) {
  const isAlt = seed % 2 === 1
  const tunicColor = isAlt ? '#dc2626' : '#16a34a'
  const collarColor = isAlt ? '#16a34a' : '#dc2626'
  const hatTrim = isAlt ? '#16a34a' : '#dc2626'
  const hatMain = isAlt ? '#dc2626' : '#16a34a'

  return (
    <svg
      width="78"
      height="88"
      viewBox="0 0 78 88"
      className="pointer-events-none select-none filter drop-shadow-[0_4px_12px_rgba(0,0,0,0.35)]"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
      <style>{`
        @keyframes elfLegLeft {
          0%, 100% { transform: rotate(-16deg); }
          50% { transform: rotate(14deg); }
        }
        @keyframes elfLegRight {
          0%, 100% { transform: rotate(14deg); }
          50% { transform: rotate(-16deg); }
        }
        @keyframes elfHandWave {
          0%, 65%, 100% { transform: rotate(0deg); }
          72% { transform: rotate(-28deg); }
          78% { transform: rotate(12deg); }
          84% { transform: rotate(-24deg); }
          90% { transform: rotate(8deg); }
        }
        @keyframes elfBellJiggle {
          0%, 75%, 100% { transform: rotate(0deg); }
          80% { transform: rotate(-18deg); }
          85% { transform: rotate(18deg); }
          90% { transform: rotate(-12deg); }
          95% { transform: rotate(6deg); }
        }
        @keyframes elfTorsoSway {
          0%, 100% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg); }
        }
      `}</style>

      {/* Dangling Legs swinging back and forth in front of photo card mat (y=52 is photo card top edge) */}
      <g style={{ transformOrigin: '30px 50px', animation: 'elfLegLeft 2.2s ease-in-out infinite' }}>
        <path d="M 30 50 L 30 68" stroke="#dc2626" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 30 53 L 30 55" stroke="#ffffff" strokeWidth="5.5" />
        <path d="M 30 61 L 30 63" stroke="#ffffff" strokeWidth="5.5" />
        {/* Curled green elf boot with bell */}
        <path d="M 27 68 Q 23 71 18 70 Q 14 67 17 64 Q 22 65 28 66 Z" fill="#15803d" />
        <circle cx="15" cy="65" r="1.8" fill="#facc15" stroke="#ca8a04" strokeWidth="0.5" />
      </g>

      <g style={{ transformOrigin: '48px 50px', animation: 'elfLegRight 2.2s ease-in-out infinite' }}>
        <path d="M 48 50 L 48 68" stroke="#dc2626" strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 48 53 L 48 55" stroke="#ffffff" strokeWidth="5.5" />
        <path d="M 48 61 L 48 63" stroke="#ffffff" strokeWidth="5.5" />
        {/* Curled green elf boot with bell */}
        <path d="M 45 68 Q 41 71 36 70 Q 32 67 35 64 Q 40 65 46 66 Z" fill="#15803d" />
        <circle cx="33" cy="65" r="1.8" fill="#facc15" stroke="#ca8a04" strokeWidth="0.5" />
      </g>

      {/* Torso & Head resting on top of the photo card */}
      <g style={{ transformOrigin: '39px 52px', animation: 'elfTorsoSway 3.2s ease-in-out infinite' }}>
        {/* Tunic & buttocks resting on frame */}
        <path d="M 23 38 Q 20 52 24 53 L 54 53 Q 58 52 55 38 Z" fill={tunicColor} />
        {/* Black belt with gold buckle */}
        <rect x="23" y="47" width="32" height="5" fill="#18181b" />
        <rect x="35" y="46" width="8" height="7" rx="1.5" fill="#facc15" stroke="#18181b" strokeWidth="1" />

        {/* Scalloped festive collar with golden bells */}
        <path d="M 25 37 L 29 43 L 39 38 L 49 43 L 53 37 Z" fill={collarColor} />
        <circle cx="29" cy="43" r="1.2" fill="#facc15" />
        <circle cx="49" cy="43" r="1.2" fill="#facc15" />

        {/* Left hand resting on photo card top border */}
        <path d="M 25 40 Q 18 46 22 52" stroke={tunicColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <circle cx="22" cy="52" r="3" fill="#fde68a" />

        {/* Right arm & waving hand */}
        <g style={{ transformOrigin: '53px 40px', animation: 'elfHandWave 4.5s ease-in-out infinite' }}>
          <path d="M 53 40 Q 61 46 56 52" stroke={tunicColor} strokeWidth="4.5" strokeLinecap="round" fill="none" />
          <circle cx="56" cy="52" r="3" fill="#fde68a" />
        </g>

        {/* Pointy Elf Ears */}
        <path d="M 27 28 C 17 26, 14 20, 26 23 Z" fill="#fde68a" />
        <path d="M 51 28 C 61 26, 64 20, 52 23 Z" fill="#fde68a" />

        {/* Head & Face */}
        <ellipse cx="39" cy="29" rx="12" ry="12.5" fill="#fde68a" />
        {/* Rosy cheeks */}
        <circle cx="31" cy="32" r="3" fill="#f43f5e" opacity="0.45" />
        <circle cx="47" cy="32" r="3" fill="#f43f5e" opacity="0.45" />
        {/* Happy smiling eyes */}
        <path d="M 31 27 Q 34 24 37 27" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M 41 27 Q 44 24 47 27" stroke="#1c1917" strokeWidth="1.5" strokeLinecap="round" fill="none" />
        {/* Button nose */}
        <circle cx="39" cy="30" r="1.3" fill="#f59e0b" />
        {/* Merry smile */}
        <path d="M 35 33 Q 39 37 43 33" stroke="#b91c1c" strokeWidth="1.5" strokeLinecap="round" fill="none" />

        {/* Floppy Hat */}
        <path d="M 23 23 Q 39 19 55 23" stroke={hatTrim} strokeWidth="5.5" strokeLinecap="round" />
        <path d="M 25 21 C 29 8, 45 4, 61 8 C 66 10, 67 15, 63 19 Z" fill={hatMain} />

        {/* Hat Tip & Gold Jingle Bell (jiggling animation) */}
        <g style={{ transformOrigin: '63px 19px', animation: 'elfBellJiggle 3.2s ease-in-out infinite' }}>
          <circle cx="64" cy="19" r="4" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
          <path d="M 62 19 L 66 19" stroke="#854d0e" strokeWidth="0.8" />
        </g>
      </g>
    </svg>
  )
}

function Elf({ variant = 'running', flip = false }: { variant?: 'running'; flip?: boolean }) {
  return (
    <svg
      width="64"
      height="80"
      viewBox="0 0 54 68"
      className="pointer-events-none select-none filter drop-shadow-[0_3px_8px_rgba(0,0,0,0.35)]"
      style={{ transform: flip ? 'scaleX(-1)' : undefined }}
      aria-hidden="true"
    >
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

      {/* Elf Tunic */}
      <path d="M 18 34 Q 14 46 17 47 L 37 47 Q 40 46 36 34 Z" fill="#16a34a" />
      <rect x="17" y="42" width="20" height="4.5" fill="#18181b" />
      <rect x="24" y="41" width="6" height="6.5" rx="1" fill="#facc15" stroke="#18181b" strokeWidth="1" />

      {/* Scalloped Collar */}
      <path d="M 18 33 L 21 38 L 27 34 L 33 38 L 36 33 Z" fill="#dc2626" />
      <circle cx="21" cy="38" r="1" fill="#facc15" />
      <circle cx="33" cy="38" r="1" fill="#facc15" />

      {/* Running Arms holding gift */}
      <g>
        <path d="M 22 36 L 30 40" stroke="#16a34a" strokeWidth="4" strokeLinecap="round" />
        <rect x="30" y="34" width="11" height="11" rx="1.5" fill="#eab308" />
        <path d="M 35.5 34 L 35.5 45 M 30 39.5 L 41 39.5" stroke="#dc2626" strokeWidth="1.8" />
        <circle cx="35.5" cy="33" r="2" fill="#dc2626" />
      </g>

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

function Spider({ scale = 1, hourglassColor = '#ef4444' }: { scale?: number; hourglassColor?: string }) {
  return (
    <g
      transform={`scale(${scale})`}
      className="filter drop-shadow-[0_0_2px_rgba(255,255,255,0.4)] drop-shadow-[0_3px_6px_rgba(0,0,0,0.6)]"
    >
      {/* 8 Creepy jointed spider legs - thin light white outline */}
      <g stroke="rgba(255, 255, 255, 0.85)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Left Legs */}
        <path d="M -2 -4 Q -12 -12 -16 -4 L -14 6" />
        <path d="M -3 -1 Q -16 -6 -20 3 L -16 12" />
        <path d="M -3 3 Q -17 5 -18 14 L -13 22" />
        <path d="M -2 7 Q -14 12 -15 22 L -9 27" />
        {/* Right Legs */}
        <path d="M 2 -4 Q 12 -12 16 -4 L 14 6" />
        <path d="M 3 -1 Q 16 -6 20 3 L 16 12" />
        <path d="M 3 3 Q 17 5 18 14 L 13 22" />
        <path d="M 2 7 Q 14 12 15 22 L 9 27" />
      </g>

      {/* 8 Creepy jointed spider legs - dark body */}
      <g stroke="#18181b" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        {/* Left Legs */}
        <path d="M -2 -4 Q -12 -12 -16 -4 L -14 6" />
        <path d="M -3 -1 Q -16 -6 -20 3 L -16 12" />
        <path d="M -3 3 Q -17 5 -18 14 L -13 22" />
        <path d="M -2 7 Q -14 12 -15 22 L -9 27" />
        {/* Right Legs */}
        <path d="M 2 -4 Q 12 -12 16 -4 L 14 6" />
        <path d="M 3 -1 Q 16 -6 20 3 L 16 12" />
        <path d="M 3 3 Q 17 5 18 14 L 13 22" />
        <path d="M 2 7 Q 14 12 15 22 L 9 27" />
      </g>

      {/* Spider Abdomen with thin light white outline */}
      <ellipse cx="0" cy="8" rx="6.5" ry="8.5" fill="#18181b" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1" />
      {/* Hourglass/spooky marking on back */}
      <path
        d="M -2.2 4 L 2.2 4 L 0 8 L 2.2 12 L -2.2 12 L 0 8 Z"
        fill={hourglassColor}
        opacity="0.95"
      />

      {/* Cephalothorax (Head) with thin light white outline */}
      <circle cx="0" cy="-1" r="4.5" fill="#27272a" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="1" />

      {/* Chelicerae / fangs with thin light white outline */}
      <path d="M -1.8 -5 L -1.5 -8 M 1.8 -5 L 1.5 -8" stroke="rgba(255, 255, 255, 0.85)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M -1.8 -5 L -1.5 -8 M 1.8 -5 L 1.5 -8" stroke="#3f3f46" strokeWidth="1.2" strokeLinecap="round" />

      {/* Glowing beady eyes */}
      <g style={{ animation: 'spiderEyesPulse 2.5s ease-in-out infinite' }}>
        <circle cx="-1.8" cy="-2" r="1.1" fill="#f87171" style={{ filter: 'drop-shadow(0 0 2.5px #ef4444)' }} />
        <circle cx="1.8" cy="-2" r="1.1" fill="#f87171" style={{ filter: 'drop-shadow(0 0 2.5px #ef4444)' }} />
        <circle cx="-3.2" cy="-0.8" r="0.7" fill="#fca5a5" />
        <circle cx="3.2" cy="-0.8" r="0.7" fill="#fca5a5" />
      </g>
    </g>
  )
}

function SpookyWebsAndSpiders() {
  return (
    <div className="absolute top-0 left-0 right-0 h-[480px] pointer-events-none z-30 select-none overflow-hidden">
      <svg
        viewBox="0 0 1920 480"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden="true"
      >
        <style>{`
          @keyframes spiderFloat1 {
            0%, 100% { transform: translateY(28px); }
            45%, 60% { transform: translateY(220px); }
            82% { transform: translateY(48px); }
          }
          @keyframes spiderFloat2 {
            0%, 100% { transform: translateY(35px); }
            42%, 65% { transform: translateY(330px); }
            80% { transform: translateY(65px); }
          }
          @keyframes spiderFloat3 {
            0%, 100% { transform: translateY(24px); }
            40%, 62% { transform: translateY(275px); }
            78% { transform: translateY(52px); }
          }
          @keyframes spiderFloat4 {
            0%, 100% { transform: translateY(30px); }
            46%, 64% { transform: translateY(215px); }
            84% { transform: translateY(58px); }
          }
          @keyframes spiderSway1 {
            0%, 100% { transform: rotate(-5deg); }
            50% { transform: rotate(5deg); }
          }
          @keyframes spiderSway2 {
            0%, 100% { transform: rotate(6deg); }
            50% { transform: rotate(-5deg); }
          }
          @keyframes spiderEyesPulse {
            0%, 100% { opacity: 0.95; }
            50% { opacity: 0.45; }
          }
        `}</style>

        {/* --- Cobweb in Top-Left Corner --- */}
        <g stroke="rgba(241, 245, 249, 0.42)" strokeWidth="1.2" fill="none">
          <line x1="0" y1="0" x2="0" y2="180" />
          <line x1="0" y1="0" x2="45" y2="165" />
          <line x1="0" y1="0" x2="90" y2="135" />
          <line x1="0" y1="0" x2="135" y2="95" />
          <line x1="0" y1="0" x2="170" y2="50" />
          <line x1="0" y1="0" x2="195" y2="0" />

          <path d="M 0 38 Q 12 36, 26 26 Q 36 12, 42 0" />
          <path d="M 0 78 Q 24 72, 48 55 Q 68 32, 85 0" />
          <path d="M 0 125 Q 36 116, 75 92 Q 112 55, 138 0" />
          <path d="M 0 175 Q 45 160, 90 132 Q 135 90, 188 0" />
        </g>

        {/* --- Cobweb in Top-Right Corner --- */}
        <g stroke="rgba(241, 245, 249, 0.42)" strokeWidth="1.2" fill="none">
          <line x1="1920" y1="0" x2="1920" y2="170" />
          <line x1="1920" y1="0" x2="1875" y2="155" />
          <line x1="1920" y1="0" x2="1830" y2="125" />
          <line x1="1920" y1="0" x2="1785" y2="88" />
          <line x1="1920" y1="0" x2="1750" y2="45" />
          <line x1="1920" y1="0" x2="1730" y2="0" />

          <path d="M 1920 35 Q 1908 34, 1895 24 Q 1885 10, 1880 0" />
          <path d="M 1920 72 Q 1898 68, 1874 52 Q 1855 30, 1840 0" />
          <path d="M 1920 118 Q 1886 110, 1848 85 Q 1815 50, 1790 0" />
          <path d="M 1920 165 Q 1878 152, 1832 122 Q 1788 84, 1735 0" />
        </g>

        {/* Gossamer Ceiling Silk Droops */}
        <path
          d="M 195 0 Q 360 22, 520 0 M 520 0 Q 720 28, 920 0 M 920 0 Q 1160 26, 1400 0 M 1400 0 Q 1565 24, 1730 0"
          stroke="rgba(241, 245, 249, 0.32)"
          strokeWidth="1.1"
          fill="none"
        />

        {/* --- SPIDER 1 (Left near corner, x = 240) --- */}
        <g transform="translate(240, 0)">
          <g style={{ animation: 'spiderFloat1 8.5s ease-in-out infinite' }}>
            <line x1="0" y1="-500" x2="0" y2="0" stroke="rgba(241, 245, 249, 0.65)" strokeWidth="1.2" />
            <g style={{ transformOrigin: '0 0', animation: 'spiderSway1 3.2s ease-in-out infinite' }}>
              <Spider scale={1.05} hourglassColor="#ef4444" />
            </g>
          </g>
        </g>

        {/* --- SPIDER 2 (Center-Left, x = 680) --- */}
        <g transform="translate(680, 0)">
          <g style={{ animation: 'spiderFloat2 11s ease-in-out infinite', animationDelay: '1.8s' }}>
            <line x1="0" y1="-500" x2="0" y2="0" stroke="rgba(241, 245, 249, 0.65)" strokeWidth="1.2" />
            <g style={{ transformOrigin: '0 0', animation: 'spiderSway2 3.6s ease-in-out infinite' }}>
              <Spider scale={1.25} hourglassColor="#f97316" />
            </g>
          </g>
        </g>

        {/* --- SPIDER 3 (Center-Right, x = 1260) --- */}
        <g transform="translate(1260, 0)">
          <g style={{ animation: 'spiderFloat3 9.8s ease-in-out infinite', animationDelay: '4.2s' }}>
            <line x1="0" y1="-500" x2="0" y2="0" stroke="rgba(241, 245, 249, 0.65)" strokeWidth="1.2" />
            <g style={{ transformOrigin: '0 0', animation: 'spiderSway1 2.9s ease-in-out infinite' }}>
              <Spider scale={1.15} hourglassColor="#ef4444" />
            </g>
          </g>
        </g>

        {/* --- SPIDER 4 (Right near corner, x = 1710) --- */}
        <g transform="translate(1710, 0)">
          <g style={{ animation: 'spiderFloat4 8.2s ease-in-out infinite', animationDelay: '0.8s' }}>
            <line x1="0" y1="-500" x2="0" y2="0" stroke="rgba(241, 245, 249, 0.65)" strokeWidth="1.2" />
            <g style={{ transformOrigin: '0 0', animation: 'spiderSway2 3.4s ease-in-out infinite' }}>
              <Spider scale={1.0} hourglassColor="#eab308" />
            </g>
          </g>
        </g>
      </svg>
    </div>
  )
}

function SpookyGraveyard() {
  return (
    <div className="absolute bottom-0 left-0 right-0 h-44 pointer-events-none z-[2] select-none overflow-hidden">
      <svg
        viewBox="0 0 1920 176"
        preserveAspectRatio="none"
        className="w-full h-full"
        aria-hidden="true"
      >
        <style>{`
          @keyframes skeletonArmWave {
            0%, 100% { transform: rotate(0deg); }
            35% { transform: rotate(-24deg); }
            65% { transform: rotate(18deg); }
          }
          @keyframes skeletonLegSwingLeft {
            0%, 100% { transform: rotate(-15deg); }
            50% { transform: rotate(12deg); }
          }
          @keyframes skeletonLegSwingRight {
            0%, 100% { transform: rotate(12deg); }
            50% { transform: rotate(-15deg); }
          }
          @keyframes jackFlicker {
            0%, 100% { opacity: 0.95; filter: drop-shadow(0 0 10px rgba(249, 115, 22, 0.95)); }
            30% { opacity: 0.72; filter: drop-shadow(0 0 6px rgba(249, 115, 22, 0.7)); }
            65% { opacity: 1; filter: drop-shadow(0 0 14px rgba(251, 146, 60, 1)); }
            85% { opacity: 0.8; filter: drop-shadow(0 0 8px rgba(249, 115, 22, 0.75)); }
          }
          @keyframes ravenHeadTilt {
            0%, 80%, 100% { transform: rotate(0deg); }
            85% { transform: rotate(-18deg); }
            92% { transform: rotate(15deg); }
          }
          @keyframes groundFogDrift {
            0%, 100% { transform: translateX(0); opacity: 0.35; }
            50% { transform: translateX(25px); opacity: 0.55; }
          }
          @keyframes ghostWisp {
            0%, 100% { transform: translate(0, 0); opacity: 0.45; }
            35% { transform: translate(35px, -14px); opacity: 0.75; }
            70% { transform: translate(-25px, -8px); opacity: 0.4; }
          }
        `}</style>

        {/* --- Background Rolling Hill Silhouette --- */}
        <path
          d="M 0 176 L 0 120 Q 300 102, 600 115 Q 900 128, 1200 106 Q 1500 92, 1920 110 L 1920 176 Z"
          fill="#060813"
          opacity="0.9"
        />

        {/* --- Victorian Iron Fence with Spiked Spears --- */}
        <g stroke="#1e293b" strokeWidth="2" strokeLinecap="round">
          {[270, 290, 310, 330, 350, 750, 770, 790, 810, 830, 850, 1370, 1390, 1410, 1430, 1530, 1550, 1570].map((fx) => (
            <g key={fx}>
              <line x1={fx} y1="140" x2={fx} y2="108" />
              <path d={`M ${fx - 2} 108 L ${fx} 100 L ${fx + 2} 108 Z`} fill="#1e293b" />
            </g>
          ))}
          <path d="M 265 118 L 355 118 M 265 132 L 355 132" />
          <path d="M 745 118 L 855 118 M 745 132 L 855 132" />
          <path d="M 1365 118 L 1435 118 M 1365 132 L 1435 132" />
          <path d="M 1525 118 L 1575 118 M 1525 132 L 1575 132" />
        </g>

        {/* --- Foreground Hill Silhouette --- */}
        <path
          d="M 0 176 L 0 106 Q 240 92, 480 104 Q 720 116, 960 98 Q 1200 84, 1440 102 Q 1680 114, 1920 96 L 1920 176 Z"
          fill="#0a0a0f"
        />

        {/* --- Spooky Gnarly Dead Tree (Left, x = 80) --- */}
        <g fill="#09090b" stroke="#09090b" strokeLinejoin="round" strokeLinecap="round">
          <path d="M 65 176 Q 78 135 84 100 Q 88 70 82 48 Q 92 68 96 100 Q 104 140 112 176 Z" />
          <path d="M 85 85 Q 60 70 42 62 Q 32 58 24 64 M 42 62 Q 40 48 32 38" strokeWidth="3" fill="none" />
          <path d="M 86 65 Q 108 52 135 56 Q 148 58 158 50 M 135 56 Q 145 42 160 38" strokeWidth="2.5" fill="none" />
          <path d="M 82 48 Q 78 30 68 18 Q 62 10 52 8 M 68 18 Q 78 12 85 4" strokeWidth="2" fill="none" />
        </g>

        {/* --- Spooky Gnarly Dead Tree (Right, x = 1840) --- */}
        <g fill="#09090b" stroke="#09090b" strokeLinejoin="round" strokeLinecap="round">
          <path d="M 1822 176 Q 1836 135 1842 100 Q 1845 72 1840 52 Q 1850 72 1854 100 Q 1862 140 1870 176 Z" />
          <path d="M 1842 85 Q 1820 68 1800 62 Q 1785 58 1774 65 M 1800 62 Q 1795 48 1785 40" strokeWidth="3" fill="none" />
          <path d="M 1844 65 Q 1865 52 1888 56 Q 1902 58 1912 50" strokeWidth="2.5" fill="none" />
          <path d="M 1840 52 Q 1834 30 1822 20 Q 1814 12 1804 10 M 1822 20 Q 1832 12 1840 6" strokeWidth="2" fill="none" />
        </g>

        {/* --- Tombstones & Headstones --- */}
        {/* Tombstone 1: Classic "R.I.P." Headstone (x = 180, tilted) */}
        <g transform="translate(180, 96) rotate(-5)">
          <path d="M 0 45 L 0 16 C 0 2, 34 2, 34 16 L 34 45 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <path d="M 28 6 L 22 14 L 26 20" stroke="#0f172a" strokeWidth="0.8" fill="none" />
          <text x="17" y="24" textAnchor="middle" fill="#64748b" fontSize="7.5" fontWeight="bold" fontFamily="serif" letterSpacing="1">
            R.I.P.
          </text>
        </g>

        {/* Tombstone 2: Celtic Cross (x = 380) with Perched Raven */}
        <g transform="translate(380, 84)">
          <rect x="-14" y="44" width="28" height="12" fill="#1e293b" />
          <rect x="-11" y="38" width="22" height="7" fill="#334155" />
          <rect x="-4" y="0" width="8" height="40" fill="#334155" />
          <rect x="-14" y="10" width="28" height="7" fill="#334155" />
          <circle cx="0" cy="13.5" r="9" stroke="#475569" strokeWidth="2" fill="none" />
          <g transform="translate(0, -1)" style={{ transformOrigin: '0 0', animation: 'ravenHeadTilt 4s ease-in-out infinite' }}>
            <ellipse cx="2" cy="-4" rx="4.5" ry="3.5" fill="#020617" />
            <ellipse cx="6" cy="-7" rx="2.5" ry="2.5" fill="#020617" />
            <path d="M 8 -7 L 13 -6.5 L 8 -5.5 Z" fill="#020617" />
            <circle cx="6.5" cy="-7.5" r="0.6" fill="#facc15" />
            <path d="M -2 -3 L -8 -1 L -3 -5 Z" fill="#020617" />
          </g>
        </g>

        {/* Tombstone 3: Gothic Arched Headstone (x = 720) */}
        <g transform="translate(720, 94)">
          <path d="M 0 45 L 0 18 C 0 5, 30 5, 30 18 L 30 45 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <path d="M 15 12 L 15 28 M 9 18 L 21 18" stroke="#475569" strokeWidth="1.2" />
        </g>

        {/* Tombstone 4: Weathered Arched Stone with Crack (x = 980) */}
        <g transform="translate(980, 90)">
          <path d="M 0 45 L 0 16 C 0 4, 32 4, 32 16 L 32 45 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <path d="M 8 10 L 14 20 L 11 28" stroke="#0f172a" strokeWidth="0.8" fill="none" />
          <circle cx="16" cy="18" r="4" fill="#334155" />
          <circle cx="14.5" cy="17.5" r="1.1" fill="#0f172a" />
          <circle cx="17.5" cy="17.5" r="1.1" fill="#0f172a" />
        </g>

        {/* Tombstone 5: Obelisk Monument (x = 1140) */}
        <g transform="translate(1140, 80)">
          <rect x="-10" y="52" width="20" height="10" fill="#1e293b" />
          <polygon points="-7,52 7,52 4,6 -4,6" fill="#334155" />
          <polygon points="-4,6 4,6 0,0" fill="#475569" />
        </g>

        {/* Tombstone 6: Tilted Sunken Grave (x = 1350) */}
        <g transform="translate(1350, 98) rotate(10)">
          <path d="M 0 45 L 0 14 C 0 2, 28 2, 28 14 L 28 45 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <text x="14" y="22" textAnchor="middle" fill="#64748b" fontSize="6.5" fontWeight="bold" fontFamily="serif">
            RIP
          </text>
        </g>

        {/* Tombstone 7 & Crypt: Wide stone slab where Skeleton 2 sits (x = 1440) */}
        <g transform="translate(1440, 102)">
          <rect x="0" y="10" width="56" height="30" rx="1" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <rect x="-3" y="6" width="62" height="6" rx="1" fill="#334155" />
        </g>

        {/* Tombstone 8: Rounded Headstone (x = 1620) */}
        <g transform="translate(1620, 92) rotate(-4)">
          <path d="M 0 45 L 0 15 C 0 3, 26 3, 26 15 L 26 45 Z" fill="#1e293b" stroke="#334155" strokeWidth="1" />
          <path d="M 13 10 L 13 22 M 8 14 L 18 14" stroke="#475569" strokeWidth="1" />
        </g>

        {/* --- SKELETON 1 (Rising from Grave & Waving Bony Arm, x = 480) --- */}
        <g transform="translate(480, 95)">
          <ellipse cx="0" cy="22" rx="26" ry="7" fill="#1c1917" />

          {/* Ribcage & Spine */}
          <line x1="0" y1="0" x2="0" y2="20" stroke="#f1f5f9" strokeWidth="2.5" />
          <path d="M -7 6 Q 0 8 7 6" stroke="#f1f5f9" strokeWidth="1.8" fill="none" />
          <path d="M -8 11 Q 0 13 8 11" stroke="#f1f5f9" strokeWidth="1.8" fill="none" />
          <path d="M -7 16 Q 0 18 7 16" stroke="#f1f5f9" strokeWidth="1.8" fill="none" />

          {/* Left Arm resting on dirt */}
          <path d="M -8 4 L -16 12 L -22 17" stroke="#f1f5f9" strokeWidth="2" strokeLinecap="round" fill="none" />

          {/* Skull */}
          <ellipse cx="0" cy="-10" rx="8" ry="9" fill="#f1f5f9" />
          <rect x="-4.5" y="-3" width="9" height="5" fill="#f1f5f9" rx="1" />
          <ellipse cx="-2.8" cy="-11" rx="2.2" ry="2.6" fill="#09090b" />
          <ellipse cx="2.8" cy="-11" rx="2.2" ry="2.6" fill="#09090b" />
          <circle cx="-2.8" cy="-11" r="1.1" fill="#a3e635" style={{ filter: 'drop-shadow(0 0 3px #84cc16)' }} />
          <circle cx="2.8" cy="-11" r="1.1" fill="#a3e635" style={{ filter: 'drop-shadow(0 0 3px #84cc16)' }} />
          <polygon points="0,-7 -1,-5 1,-5" fill="#09090b" />
          <path d="M -3 -0.5 L 3 -0.5 M -2 -2 L -2 1 M 0 -2 L 0 1 M 2 -2 L 2 1" stroke="#09090b" strokeWidth="0.8" />

          {/* Right Arm raised from grave, waving clawed hand */}
          <g style={{ transformOrigin: '8px 4px', animation: 'skeletonArmWave 3.6s ease-in-out infinite' }}>
            <path d="M 8 4 L 18 -6 L 22 -18" stroke="#f1f5f9" strokeWidth="2.2" strokeLinecap="round" fill="none" />
            <path d="M 22 -18 L 20 -24 M 22 -18 L 23 -25 M 22 -18 L 26 -23" stroke="#f1f5f9" strokeWidth="1.4" strokeLinecap="round" />
          </g>
        </g>

        {/* --- SKELETON 2 (Sitting on Crypt Slab & Swinging Bony Legs, x = 1468) --- */}
        <g transform="translate(1468, 86)">
          <line x1="0" y1="0" x2="0" y2="18" stroke="#f1f5f9" strokeWidth="2.2" />
          <path d="M -6 5 Q 0 7 6 5" stroke="#f1f5f9" strokeWidth="1.6" fill="none" />
          <path d="M -7 10 Q 0 12 7 10" stroke="#f1f5f9" strokeWidth="1.6" fill="none" />
          <path d="M -6 15 Q 0 17 6 15" stroke="#f1f5f9" strokeWidth="1.6" fill="none" />

          {/* Skull */}
          <ellipse cx="0" cy="-9" rx="7.5" ry="8.5" fill="#f1f5f9" />
          <rect x="-4" y="-2" width="8" height="4.5" fill="#f1f5f9" rx="1" />
          <circle cx="-2.5" cy="-10" r="1.9" fill="#09090b" />
          <circle cx="2.5" cy="-10" r="1.9" fill="#09090b" />
          <circle cx="-2.5" cy="-10" r="1" fill="#a3e635" style={{ filter: 'drop-shadow(0 0 3px #84cc16)' }} />
          <circle cx="2.5" cy="-10" r="1" fill="#a3e635" style={{ filter: 'drop-shadow(0 0 3px #84cc16)' }} />
          <polygon points="0,-6 -0.8,-4.5 0.8,-4.5" fill="#09090b" />
          <path d="M -2.5 0 L 2.5 0 M -1.5 -1.5 L -1.5 1 M 0 -1.5 L 0 1 M 1.5 -1.5 L 1.5 1" stroke="#09090b" strokeWidth="0.7" />

          {/* Arms resting on stone */}
          <path d="M -7 4 L -14 12 L -12 22" stroke="#f1f5f9" strokeWidth="1.8" strokeLinecap="round" fill="none" />
          <path d="M 7 4 L 14 12 L 12 22" stroke="#f1f5f9" strokeWidth="1.8" strokeLinecap="round" fill="none" />

          {/* Dangling Bony Legs swinging */}
          <g style={{ transformOrigin: '-3px 20px', animation: 'skeletonLegSwingLeft 2.4s ease-in-out infinite' }}>
            <path d="M -3 20 L -4 34 L -4 46 M -4 46 L 2 48" stroke="#f1f5f9" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
          <g style={{ transformOrigin: '3px 20px', animation: 'skeletonLegSwingRight 2.4s ease-in-out infinite' }}>
            <path d="M 3 20 L 4 34 L 5 46 M 5 46 L 11 48" stroke="#f1f5f9" strokeWidth="2" strokeLinecap="round" fill="none" />
          </g>
        </g>

        {/* --- Half-buried skulls in grass --- */}
        <g transform="translate(225, 136)">
          <circle cx="0" cy="0" r="5" fill="#cbd5e1" />
          <circle cx="-1.5" cy="-0.5" r="1.2" fill="#09090b" />
          <circle cx="1.5" cy="-0.5" r="1.2" fill="#09090b" />
          <circle cx="-1.5" cy="-0.5" r="0.6" fill="#a3e635" />
          <circle cx="1.5" cy="-0.5" r="0.6" fill="#a3e635" />
        </g>
        <g transform="translate(1180, 128) rotate(-15)">
          <circle cx="0" cy="0" r="4.5" fill="#cbd5e1" />
          <circle cx="-1.4" cy="-0.5" r="1.1" fill="#09090b" />
          <circle cx="1.4" cy="-0.5" r="1.1" fill="#09090b" />
          <circle cx="-1.4" cy="-0.5" r="0.6" fill="#a3e635" />
          <circle cx="1.4" cy="-0.5" r="0.6" fill="#a3e635" />
        </g>

        {/* --- Glowing Ground Jack-o'-Lanterns (3 Flickering Pumpkins) --- */}
        <g transform="translate(260, 132)">
          <path d="M 0 -8 Q -1 -12 2 -14" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
          <ellipse cx="0" cy="0" rx="11" ry="8.5" fill="#ea580c" stroke="#c2410c" strokeWidth="0.8" />
          <ellipse cx="-4" cy="0" rx="6" ry="8" fill="#ea580c" />
          <ellipse cx="4" cy="0" rx="6" ry="8" fill="#ea580c" />
          <g style={{ animation: 'jackFlicker 2.8s ease-in-out infinite' }}>
            <polygon points="-5,-3 -2,-1 -5,1" fill="#fef08a" />
            <polygon points="5,-3 2,-1 5,1" fill="#fef08a" />
            <polygon points="0,-1 -1.5,1 1.5,1" fill="#fef08a" />
            <path d="M -6 3 L -3 5 L 0 3 L 3 5 L 6 3 Q 0 8 -6 3 Z" fill="#fef08a" />
          </g>
        </g>

        <g transform="translate(880, 126)">
          <path d="M 0 -9 Q 1 -13 -2 -15" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
          <ellipse cx="0" cy="0" rx="12" ry="9" fill="#c2410c" stroke="#9a3412" strokeWidth="0.8" />
          <ellipse cx="-4.5" cy="0" rx="7" ry="8.5" fill="#ea580c" />
          <ellipse cx="4.5" cy="0" rx="7" ry="8.5" fill="#ea580c" />
          <g style={{ animation: 'jackFlicker 3.2s ease-in-out infinite', animationDelay: '0.9s' }}>
            <polygon points="-5,-3 -2,-1 -5,1" fill="#fef08a" />
            <polygon points="5,-3 2,-1 5,1" fill="#fef08a" />
            <polygon points="0,-1 -1.5,1 1.5,1" fill="#fef08a" />
            <path d="M -6 3 L -3 5 L 0 3 L 3 5 L 6 3 Q 0 8 -6 3 Z" fill="#fef08a" />
          </g>
        </g>

        <g transform="translate(1700, 128)">
          <path d="M 0 -8 Q -1 -12 2 -14" stroke="#15803d" strokeWidth="2" strokeLinecap="round" fill="none" />
          <ellipse cx="0" cy="0" rx="10.5" ry="8" fill="#ea580c" stroke="#c2410c" strokeWidth="0.8" />
          <ellipse cx="-4" cy="0" rx="5.5" ry="7.5" fill="#ea580c" />
          <ellipse cx="4" cy="0" rx="5.5" ry="7.5" fill="#ea580c" />
          <g style={{ animation: 'jackFlicker 2.6s ease-in-out infinite', animationDelay: '1.5s' }}>
            <polygon points="-4.5,-2.5 -2,-0.5 -4.5,1.5" fill="#fef08a" />
            <polygon points="4.5,-2.5 2,-0.5 4.5,1.5" fill="#fef08a" />
            <path d="M -5 2.5 L -2 4.5 L 0 2.5 L 2 4.5 L 5 2.5 Q 0 7 -5 2.5 Z" fill="#fef08a" />
          </g>
        </g>

        {/* --- Eerie Floating Will-o'-the-Wisp Ghost (x = 610, y = 80) --- */}
        <g transform="translate(610, 80)">
          <g style={{ animation: 'ghostWisp 6.5s ease-in-out infinite' }}>
            <path
              d="M -8 16 C -8 4, -8 -8, 0 -8 C 8 -8, 8 4, 8 16 C 5 13, 2 15, 0 12 C -2 15, -5 13, -8 16 Z"
              fill="rgba(165, 243, 252, 0.55)"
              style={{ filter: 'drop-shadow(0 0 8px rgba(34, 211, 238, 0.7))' }}
            />
            <circle cx="-2.5" cy="-1" r="1.1" fill="#083344" />
            <circle cx="2.5" cy="-1" r="1.1" fill="#083344" />
          </g>
        </g>

        {/* --- Rolling Eerie Ground Fog / Mist Layers --- */}
        <g style={{ animation: 'groundFogDrift 8s ease-in-out infinite' }}>
          <path
            d="M 0 176 L 0 148 Q 240 138, 480 145 Q 720 152, 960 142 Q 1200 132, 1440 144 Q 1680 152, 1920 140 L 1920 176 Z"
            fill="rgba(168, 85, 247, 0.12)"
          />
          <path
            d="M 0 176 L 0 154 Q 300 146, 600 152 Q 900 158, 1200 148 Q 1500 142, 1920 150 L 1920 176 Z"
            fill="rgba(56, 189, 248, 0.10)"
          />
        </g>
      </svg>
    </div>
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
  seasonalDate?: Date
  onOpenVideo: (url: string) => void
}

function PhotoRig({ item, phase, kind, index, pair, pairIdx, quality, seasonalDate, onOpenVideo }: RigProps) {
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

  const seasonalNow = seasonalDate ?? getSeasonalDate()
  const hasSittingElf = isElfSeason(seasonalNow)
  const seedOffset = seed + pairIdx * 3 + index
  const elfPosition = pair ? (pairIdx === 0 ? 'left' : 'right') : 'right'
  const elfFlip = pair ? pairIdx === 0 : false

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
        <div
          className={`absolute -top-[50px] ${elfPosition === 'left' ? 'left-6' : 'right-6'} pointer-events-none z-20 select-none`}
        >
          <SittingElf seed={seedOffset} flip={elfFlip} />
        </div>
      )}
      {media}
      {caption}
    </div>
  )

  // Select the top attachment element based on weather kind & sky phase
  let topElement: React.ReactNode = null

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
  } else if (isNovember(seasonalNow)) {
    if (isDiwaliSeason(seasonalNow)) {
      topElement = (
        <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
          <DiyaTopper seed={seedOffset} />
        </div>
      )
    } else if (isThanksgivingWeek(seasonalNow)) {
      topElement = (
        <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
          <ThanksgivingTopper seed={seedOffset} />
        </div>
      )
    } else {
      topElement = (
        <div className="absolute bottom-[calc(100%-12px)] pointer-events-none select-none z-10">
          <AutumnLeafTopper seed={seedOffset} />
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

  const [seasonalDate] = useState(() => getSeasonalDate(now))
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

      {/* String lights along the top sky background (behind photos & decorations) */}
      {isDecember(seasonalDate) && <StringLights />}

      {/* October dusk/night spooky delights: skeletons & graveyard at bottom (behind photos) */}
      {isOctober(seasonalDate) && (phase === 'dusk' || phase === 'night') && (
        <SpookyGraveyard />
      )}

      {/* November autumn harvest countryside horizon (behind photos) */}
      {isNovember(seasonalDate) && (
        <AutumnHarvestHorizon seasonalDate={seasonalDate} phase={phase} />
      )}

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
              seasonalDate={seasonalDate}
              onOpenVideo={setSelectedVideo}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Weather + delights (rain, snow, fireflies, birds — in front of photos) */}
      <canvas ref={fxRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />

      {/* October dusk/night spooky delights: webs & spiders dangling in FRONT of photos */}
      {isOctober(seasonalDate) && (phase === 'dusk' || phase === 'night') && (
        <SpookyWebsAndSpiders />
      )}

      {/* Holiday Delights (Running Elf across bottom bezel) */}
      {isElfSeason(seasonalDate) && <RunningElf />}

      {/* November Autumn Delights: Running Squirrel (when not Thanksgiving week) */}
      {isNovember(seasonalDate) && !isThanksgivingWeek(seasonalDate) && <RunningSquirrel />}

      {/* Thanksgiving Week: Strutting Cartoon Turkey */}
      {isThanksgivingWeek(seasonalDate) && <StruttingTurkey />}

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
