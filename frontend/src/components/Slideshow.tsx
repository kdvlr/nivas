import React, { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon'
import { api } from '../lib/api'
import { startStarCanvas, startFxCanvas, SkyPhase, SkyKind, SkyState } from './sky/skyEngine'

interface MediaItem {
  url: string
  videoUrl?: string
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

// Dev/test override: append ?sky=night&skyfx=rainy to preview any sky state.
const QP = new URLSearchParams(window.location.search)
const PHASES: SkyPhase[] = ['dawn', 'day', 'dusk', 'night']
const KINDS: SkyKind[] = ['clear', 'cloudy', 'rainy', 'snowy', 'stormy']
const PHASE_OVERRIDE = PHASES.find((p) => p === QP.get('sky')) ?? null
const KIND_OVERRIDE = KINDS.find((k) => k === QP.get('skyfx')) ?? null

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

function CloudLayer({ phase, kind }: SkyState) {
  const overcast = kind !== 'clear'
  const clouds = useMemo(() => {
    const count = overcast ? 9 : phase === 'night' ? 2 : 5
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      top: 2 + Math.random() * 36,
      width: 26 + Math.random() * 28,
      height: 7 + Math.random() * 6,
      dur: 90 + Math.random() * 90,
      delay: -Math.random() * 180,
      opacity: overcast ? 0.45 + Math.random() * 0.3 : 0.22 + Math.random() * 0.25,
    }))
  }, [phase, overcast])

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
            animation: `sky-cloud ${c.dur}s linear infinite`,
            animationDelay: `${c.delay}s`,
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

interface RigProps {
  item: MediaItem
  phase: SkyPhase
  kind: SkyKind
  index: number
  pair: boolean
  pairIdx: number
  onOpenVideo: (url: string) => void
}

function PhotoRig({ item, phase, kind, index, pair, pairIdx, onOpenVideo }: RigProps) {
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
  const tilt = ((seed % 44) / 10 - 2.2) * (pairIdx === 1 ? -1 : 1)

  const media = (
    <div
      className="overflow-hidden bg-neutral-100 relative"
      style={{
        aspectRatio: aspect,
        maxHeight: pair ? '44vh' : daylight ? '50vh' : '54vh',
        maxWidth: pair ? '30vw' : '62vw',
      }}
    >
      {item.type === 'image' && <img src={item.url} className="w-full h-full object-contain pointer-events-none" />}
      {item.type === 'live_photo' && item.videoUrl && (
        <video key={item.videoUrl} src={item.videoUrl} autoPlay muted playsInline loop className="w-full h-full object-contain pointer-events-none" />
      )}
      {item.type === 'video' && (
        <video key={item.url} src={item.url} autoPlay muted playsInline loop className="w-full h-full object-contain pointer-events-none" />
      )}
      {(item.type === 'video' || item.type === 'live_photo') && (
        <div className="absolute bottom-2 right-2 z-10 w-8 h-8 rounded-full bg-black/45 border border-white/40 flex items-center justify-center pointer-events-none">
          <Icon name="play_arrow" className="text-white text-lg" />
        </div>
      )}
    </div>
  )

  const caption = (item.location_name || item.date_taken) && (
    <div
      style={{ fontFamily: "'Caveat', cursive" }}
      className={`mt-3 mb-0.5 w-full text-center ${pair ? 'text-[1.6rem]' : 'text-[1.8rem]'} font-bold tracking-wide text-slate-700/85 select-none pointer-events-none flex flex-wrap items-center justify-center gap-x-2 leading-tight px-1.5`}
    >
      {item.location_name && <span>{item.location_name}</span>}
      {item.location_name && item.date_taken && <span className="text-slate-400/70">-</span>}
      {item.date_taken && <span>{formatDate(item.date_taken)}</span>}
    </div>
  )

  const card = (
    <div
      className="bg-[#faf8f5] p-3.5 pb-4 rounded-[4px] border border-neutral-200/60 flex flex-col items-center pointer-events-auto cursor-pointer"
      style={{ boxShadow: matShadow, transform: `rotate(${tilt.toFixed(1)}deg)` }}
      onClick={(e) => {
        const full = item.type === 'live_photo' ? item.videoUrl : item.url
        if ((item.type === 'video' || item.type === 'live_photo') && full) {
          e.stopPropagation()
          onOpenVideo(full)
        }
      }}
    >
      {media}
      {caption}
    </div>
  )

  if (phase === 'night') {
    const sx = `${(pairIdx === 0 ? -1 : 1) * (12 + (seed % 18))}vw`
    const sy = `${-(8 + (seed % 16))}vh`
    const ex = `${(seed % 2 === 0 ? 1 : -1) * (14 + (seed % 14))}vw`
    const ey = `${-(10 + ((seed >> 3) % 12))}vh`
    return (
      <motion.div
        initial={{ x: sx, y: sy, scale: 0.06, opacity: 0 }}
        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        exit={{ x: ex, y: ey, scale: 0.04, opacity: 0, transition: { duration: 1.8, ease: 'easeIn', delay: delay * 0.5 } }}
        transition={{ duration: 2.2 + f * 0.8, ease: [0.16, 1, 0.3, 1], delay, opacity: { duration: 1.3, delay } }}
        className="relative"
      >
        <motion.div
          animate={{ y: [-(5 + f * 4), 5 + g * 4] }}
          transition={{ repeat: Infinity, repeatType: 'mirror', duration: 4.2 + g * 2, ease: 'easeInOut', delay: f * 1.5 }}
        >
          {card}
        </motion.div>
      </motion.div>
    )
  }

  if (phase === 'dusk') {
    return (
      <motion.div
        initial={{ y: `${44 + f * 6}vh`, opacity: 0 }}
        animate={{ y: [`${44 + f * 6}vh`, `${3 + g * 4}vh`, `-${1 + f * 4}vh`], opacity: 1 }}
        exit={{ y: '-85vh', opacity: 0, transition: { duration: 2.1, ease: 'easeIn', delay: delay * 0.5 } }}
        transition={{
          y: { duration: 9.5 + f * 1.5, times: [0, 0.5, 1], ease: ['easeOut', 'easeInOut'], delay },
          opacity: { duration: 1.2, delay },
        }}
        className="relative"
      >
        <motion.div
          animate={{ rotate: [-(0.9 + f * 0.8), 0.9 + g * 0.8] }}
          transition={{ repeat: Infinity, repeatType: 'mirror', duration: 4.2 + g * 1.4, ease: 'easeInOut', delay: f * 2 }}
          style={{ transformOrigin: 'top center' }}
        >
          {card}
        </motion.div>
      </motion.div>
    )
  }

  // Day and dawn: photos drift up carried by a balloon (or shelter under an
  // umbrella when it's raining).
  const balloonColor = BALLOON_COLORS[(seed + pairIdx * 3 + index) % BALLOON_COLORS.length]
  return (
    <motion.div
      initial={{ y: `${54 + f * 8}vh`, opacity: 0 }}
      animate={{ y: [`${54 + f * 8}vh`, `${4 + g * 5}vh`, `-${2 + f * 5}vh`], opacity: 1 }}
      exit={{ y: '-125vh', opacity: 0.9, transition: { duration: 1.7, ease: 'easeIn', delay: delay * 0.5 } }}
      transition={{
        y: { duration: 9 + f * 1.5, times: [0, 0.42, 1], ease: ['easeOut', 'easeInOut'], delay },
        opacity: { duration: 1.0, delay },
      }}
      className="relative"
    >
      <motion.div
        animate={{ rotate: [-(1.7 + f * 1.3), 1.7 + g * 1.3] }}
        transition={{ repeat: Infinity, repeatType: 'mirror', duration: 3.3 + g * 1.4, ease: 'easeInOut', delay: f * 2.2 }}
        style={{ transformOrigin: 'top center' }}
        className="flex flex-col items-center"
      >
        {rainy ? (
          <div className="text-7xl -mb-1 pointer-events-none select-none" style={{ filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.35))' }}>
            ☂️
          </div>
        ) : (
          <div className="-mb-2">
            <Balloon color={balloonColor} />
          </div>
        )}
        {card}
      </motion.div>
    </motion.div>
  )
}

export default function Slideshow({ photos, onDismiss }: SlideshowProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const [selectedVideo, setSelectedVideo] = useState<string | null>(null)
  const [isPortraitViewport, setIsPortraitViewport] = useState(() => window.innerHeight > window.innerWidth)
  const [kind, setKind] = useState<SkyKind>(KIND_OVERRIDE ?? 'clear')
  const [sun, setSun] = useState<{ sunrise: Date | null; sunset: Date | null }>({ sunrise: null, sunset: null })
  const [now, setNow] = useState(() => new Date())

  const phase: SkyPhase = PHASE_OVERRIDE ?? computePhase(now, sun.sunrise, sun.sunset)
  const skyState: SkyState = { phase, kind, paused: !!selectedVideo }
  const stateRef = useRef<SkyState>(skyState)
  stateRef.current = skyState

  const starRef = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const handleResize = () => setIsPortraitViewport(window.innerHeight > window.innerWidth)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Real weather drives the sky. Refresh every 15 minutes; tick the clock so
  // the phase (dawn/day/dusk/night) follows the actual sun.
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const data = await api.get<WeatherResp>('/api/weather')
        if (!alive) return
        if (!KIND_OVERRIDE) setKind(toKind(data.current?.kind))
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
    const clockTimer = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => {
      alive = false
      clearInterval(weatherTimer)
      clearInterval(clockTimer)
    }
  }, [])

  useEffect(() => {
    const stopStars = starRef.current ? startStarCanvas(starRef.current, () => stateRef.current) : undefined
    const stopFx = fxRef.current ? startFxCanvas(fxRef.current, () => stateRef.current) : undefined
    return () => {
      stopStars?.()
      stopFx?.()
    }
  }, [])

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

      if (item.orientation === 'portrait') {
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
  }, [photos])

  // Advance every 9 seconds, paused while a full video is being watched.
  useEffect(() => {
    if (slides.length <= 1 || selectedVideo !== null) return
    const timer = setInterval(() => {
      setCurrentIdx((prev) => (prev + 1) % slides.length)
    }, 9000)
    return () => clearInterval(timer)
  }, [slides.length, selectedVideo])

  if (slides.length === 0) return null

  const activeSlide = slides[currentIdx]
  const overcast = kind !== 'clear'
  const gradient = SKY_GRADIENTS[phase][overcast ? 'overcast' : 'clear']
  const items = isPortraitViewport ? activeSlide.items.slice(0, 1) : activeSlide.items
  const pair = items.length > 1

  return (
    <div
      className="fixed inset-0 z-[100] overflow-hidden cursor-none select-none"
      onClick={onDismiss}
    >
      <style>{'@keyframes sky-cloud { from { transform: translateX(-60vmin); } to { transform: translateX(110vw); } }'}</style>

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

      <CelestialGlow phase={phase} kind={kind} />

      {/* Stars + shooting stars (behind photos) */}
      <canvas ref={starRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <CloudLayer phase={phase} kind={kind} />

      {/* Soft vignette so photos pop against a bright sky */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.26) 100%)' }}
      />

      {/* Photos */}
      <AnimatePresence mode="popLayout">
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
              onOpenVideo={setSelectedVideo}
            />
          ))}
        </motion.div>
      </AnimatePresence>

      {/* Weather + delights (rain, snow, fireflies, birds — in front of photos) */}
      <canvas ref={fxRef} className="absolute inset-0 w-full h-full pointer-events-none z-20" />

      {selectedVideo && (
        <div
          className="fixed inset-0 z-[130] bg-black flex items-center justify-center cursor-default"
          onClick={(e) => {
            e.stopPropagation()
            setSelectedVideo(null)
          }}
        >
          <video
            src={selectedVideo}
            controls
            autoPlay
            playsInline
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
