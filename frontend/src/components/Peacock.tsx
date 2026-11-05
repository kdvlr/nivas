import { memo, useId, useState, useEffect, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import type { Quality } from './sky/useQuality'
import { autumnVisits } from '../lib/autumnAmbience'
import { getQueryParam } from './sky/queryParam'

export interface PeacockProps {
  quality?: Quality
  paused?: boolean
  onDisplayChange?: (isDisplaying: boolean) => void
}

type PeacockState = 'walking' | 'gathering' | 'fanning' | 'shimmering' | 'retracting' | 'resuming'

/**
 * Regal Indian Blue Peacock (Mayura - Pavo cristatus)
 *
 * Walks majestically across the screen with a proud high-stepping gait,
 * rhythmic serpentine neck bobs, swaying crown crest, and long trailing train.
 *
 * Pauses near the center, turns forward, and opens an iridescent feather fan
 * with three tiers of eyespots. Static feather detail and slow grouped motion
 * keep the small silhouette readable on Android tablets.
 */
export const Peacock = memo(function Peacock({
  quality = 'high',
  paused = false,
  onDisplayChange,
}: PeacockProps) {
  const uid = useId()
  const isLow = quality === 'low'

  const [active, setActive] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)
  const [state, setState] = useState<PeacockState>('walking')
  const [displayX, setDisplayX] = useState<number>(960)

  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const activeRef = useRef(false)
  const triggerRef = useRef<() => void>(() => {})
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Query parameter overrides for developer testing:
  // ?peacock=1, ?peacock=display, ?peacock=walk, ?peacock=freeze
  const peacockParam = useMemo(() => getQueryParam('peacock')?.toLowerCase() ?? null, [])

  // Fan feather layout: 37 radiating plumes across 172° arch
  const fanFeathers = useMemo(() => {
    const count = quality === 'high' ? 37 : quality === 'medium' ? 25 : 19
    const feathers = []
    const startAngle = -Math.PI * 0.98 // ~ -176 deg (sweeps almost down to ground level)
    const endAngle = -Math.PI * 0.02   // ~ -4 deg

    for (let i = 0; i < count; i++) {
      const angle = startAngle + (i / (count - 1)) * (endAngle - startAngle)
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      // Arched crest height
      const shaftLen = 255 + Math.sin((i / (count - 1)) * Math.PI) * 28

      const tipX = cos * shaftLen
      const tipY = sin * shaftLen
      const deg = (angle * 180) / Math.PI + 90

      // Tier 1: Outer Ocelli on EVERY shaft (37 eyes)
      const o1 = { x: cos * (shaftLen - 19), y: sin * (shaftLen - 19), scale: 1.22, deg }

      // Tier 2: Middle Ocelli on alternate shafts (19 eyes)
      const o2 = i % 2 === 0 ? { x: cos * (shaftLen * 0.70), y: sin * (shaftLen * 0.70), scale: 0.98, deg } : null

      // Tier 3: Inner Ocelli on every 3rd shaft (13 eyes)
      const o3 = i % 3 === 1 ? { x: cos * (shaftLen * 0.44), y: sin * (shaftLen * 0.44), scale: 0.78, deg } : null

      feathers.push({
        id: i,
        deg,
        shaftLen,
        tipX,
        tipY,
        o1,
        o2,
        o3,
      })
    }
    return feathers
  }, [quality])

  // Scheduling and trigger loop
  useEffect(() => {
    const trigger = (e?: Event) => {
      if (activeRef.current) return
      if (timerRef.current) clearTimeout(timerRef.current)

      const isForced = Boolean(peacockParam) || Boolean((e as CustomEvent)?.detail?.force)

      // Reserve walking, the full display, and brief photo-transition pauses.
      const claimDuration = 45_000
      if (!isForced && (document.hidden || !autumnVisits.claim(performance.now(), claimDuration))) {
        timerRef.current = setTimeout(trigger, 8_000)
        return
      }

      activeRef.current = true
      const dir: 1 | -1 = (e as CustomEvent)?.detail?.direction ?? (Math.random() < 0.5 ? 1 : -1)
      setDirection(dir)

      // Pick a random stopping point between 36% and 64% of screen width
      const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920
      const stopX = screenW * (0.36 + Math.random() * 0.28)
      setDisplayX(stopX)

      const isFrozenDisplay = peacockParam === 'freeze' || peacockParam === 'display' || Boolean((e as CustomEvent)?.detail?.freeze)
      setState(isFrozenDisplay ? 'shimmering' : 'walking')
      setActive(true)
    }

    triggerRef.current = trigger
    window.addEventListener('trigger-peacock', trigger)

    // Initial trigger: immediate if URL param exists, else staggered (8-16s)
    const initialDelay = peacockParam ? 500 : 8_000 + Math.random() * 8_000
    timerRef.current = setTimeout(trigger, initialDelay)

    return () => {
      window.removeEventListener('trigger-peacock', trigger)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [peacockParam])

  // Lifecycle transitions for the Display sequence
  const handleReachDisplayPoint = () => {
    if (peacockParam === 'walk') {
      setState('resuming')
      return
    }

    onDisplayChange?.(true)
    setState('gathering')

  }

  // One phase timer, preserving remaining time across photo-transition pauses.
  useEffect(() => {
    if (!active || peacockParam === 'freeze' || peacockParam === 'display') return
    const phases: Partial<Record<PeacockState, [number, PeacockState]>> = {
      gathering: [1000, 'fanning'],
      fanning: [2200, 'shimmering'],
      shimmering: [6000, 'retracting'],
      retracting: [2000, 'resuming'],
    }
    const phase = phases[state]
    if (!phase) return
    let remaining = phase[0]
    let started = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      if (pausedRef.current) { timer = setTimeout(tick, 100); return }
      started = performance.now()
      timer = setTimeout(() => {
        remaining -= performance.now() - started
        if (remaining <= 0) {
          setState(phase[1])
          if (phase[1] === 'resuming') onDisplayChange?.(false)
        } else tick()
      }, Math.min(100, remaining))
    }
    tick()
    return () => clearTimeout(timer)
  }, [active, state, peacockParam, onDisplayChange])

  const handleSequenceComplete = () => {
    activeRef.current = false
    setActive(false)
    setState('walking')
    onDisplayChange?.(false)

    // Schedule next visit in 2.5 to 5 minutes
    if (timerRef.current) clearTimeout(timerRef.current)
    const nextInterval = peacockParam ? 8_000 : 150_000 + Math.random() * 150_000
    timerRef.current = setTimeout(() => triggerRef.current(), nextInterval)
  }

  if (!active) return null

  const isDisplaying =
    state === 'fanning' || state === 'shimmering' || state === 'retracting' || state === 'gathering'
  const isShimmering = state === 'shimmering'
  const fanOpen = state === 'fanning' || isShimmering
  const screenW = typeof window !== 'undefined' ? window.innerWidth : 1920

  // Start offscreen and transit to opposite offscreen edge
  const startX = direction === 1 ? -90 : screenW + 90
  const exitX = direction === 1 ? screenW + 90 : -90

  return (
    <div
      className="peacock fixed bottom-1 pointer-events-none z-30 select-none overflow-visible"
      style={{ left: 0, right: 0 }}
      aria-hidden="true"
    >
      <style>{`
        /* Peacock Crest Sway */
        @keyframes peacockCrestSway {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(5deg); }
        }

        /* Head & Neck Bob Cycle while walking */
        @keyframes peacockHeadWalk {
          0%, 100% { transform: translate(0px, 0px) rotate(0deg); }
          30% { transform: translate(6px, -4px) rotate(3deg); }
          65% { transform: translate(-3px, 2px) rotate(-1.5deg); }
        }

        /* Folded Tail Walking Sway */
        @keyframes peacockTailWalk {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-3.5deg); }
        }

        /* Strutting Walking Legs */
        @keyframes peacockLeg1 {
          0% { transform: rotate(20deg); }
          25% { transform: rotate(0deg) translateY(-8px); }
          50% { transform: rotate(-24deg); }
          75% { transform: rotate(-6deg); }
          100% { transform: rotate(20deg); }
        }
        @keyframes peacockLeg2 {
          0% { transform: rotate(-24deg); }
          25% { transform: rotate(-6deg); }
          50% { transform: rotate(20deg); }
          75% { transform: rotate(0deg) translateY(-8px); }
          100% { transform: rotate(-24deg); }
        }

        /* Display Plumage Shimmer (Rapid Feather Vibration / Stridulation) */
        @keyframes peacockFeatherQuiver {
          0% { transform: translate(310px, 360px) rotate(0deg) scale(1); }
          100% { transform: translate(310px, 360px) rotate(0.3deg) scale(1.003); }
        }

        /* Display Proud Body Sway */
        @keyframes peacockDisplaySway {
          0%, 100% { transform: rotate(-1.5deg); }
          50% { transform: rotate(1.5deg); }
        }

        /* Display Head Tilt */
        @keyframes peacockHeadTilt {
          0%, 100% { transform: rotate(0deg); }
          35% { transform: rotate(-6deg); }
          70% { transform: rotate(5deg); }
        }

        .peacock-walking-leg1 { animation: peacockLeg1 0.95s linear infinite; }
        .peacock-walking-leg2 { animation: peacockLeg2 0.95s linear infinite; }
        .peacock-walking-neck { animation: peacockHeadWalk 1.9s ease-in-out infinite; }
        .peacock-walking-tail { animation: peacockTailWalk 1.9s ease-in-out infinite; }
        .peacock-crest-sway { animation: peacockCrestSway 2.5s ease-in-out infinite; }
        .peacock-shimmer-fan { animation: peacockFeatherQuiver 1.8s ease-in-out infinite alternate !important; }
        .peacock-swaying-body { animation: peacockDisplaySway 3.2s ease-in-out infinite alternate !important; }
        .peacock-head-tilt { animation: peacockHeadTilt 4.5s ease-in-out infinite !important; }
        @media (prefers-reduced-motion: reduce) {
          .peacock svg * { animation: none !important; transition-duration: 0.01ms !important; }
        }
      `}</style>

      <motion.div
        initial={{ x: isDisplaying ? displayX : startX }}
        animate={
          state === 'walking'
            ? { x: [startX, displayX] }
            : state === 'resuming'
            ? { x: [displayX, exitX] }
            : { x: displayX }
        }
        transition={
          state === 'walking'
            ? { duration: 9.5, ease: 'linear' }
            : state === 'resuming'
            ? { duration: 9.5, ease: 'linear' }
            : { duration: 0 }
        }
        onAnimationComplete={() => {
          if (state === 'walking') {
            handleReachDisplayPoint()
          } else if (state === 'resuming') {
            handleSequenceComplete()
          }
        }}
        className="absolute bottom-0 overflow-visible"
        style={{ width: 155, height: 125, marginLeft: -77.5 }}
      >
        <svg
          viewBox="0 0 620 500"
          className="w-full h-full overflow-visible"
          style={{
            transform: direction === -1 ? 'scaleX(-1)' : undefined,
            transformOrigin: '50% 80%',
          }}
        >
          <defs>
            {/* Iridescent Royal Cobalt & Cyan Neck Gradient */}
            <linearGradient id={`${uid}-p-neck`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#0c2461" />
              <stop offset="25%" stopColor="#0f38b8" />
              <stop offset="55%" stopColor="#0284c7" />
              <stop offset="85%" stopColor="#00b4d8" />
              <stop offset="100%" stopColor="#00e5ff" />
            </linearGradient>

            {/* Muscular Breast Ultramarine Gradient */}
            <linearGradient id={`${uid}-p-breast`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0c2461" />
              <stop offset="40%" stopColor="#1e3799" />
              <stop offset="75%" stopColor="#084e72" />
              <stop offset="100%" stopColor="#047857" />
            </linearGradient>

            {/* Iridescent Emerald & Bronze Mantle Gradient */}
            <linearGradient id={`${uid}-p-mantle`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#047857" />
              <stop offset="40%" stopColor="#10b981" />
              <stop offset="70%" stopColor="#d97706" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>

            {/* Master Ocellus (Peacock Eyespot) */}
            <g id={`${uid}-ocellus`}>
              {/* 1. Outer Emerald Oval Border */}
              <ellipse cx="0" cy="0" rx="13" ry="17" fill="#047857" />
              <ellipse cx="0" cy="0" rx="11.5" ry="15" fill="#10b981" />
              {/* 2. Golden Bronze Ring */}
              <ellipse cx="0" cy="1.2" rx="9" ry="12" fill="#d97706" />
              <ellipse cx="0" cy="1.2" rx="7.5" ry="10.2" fill="#f59e0b" />
              {/* 3. Electric Peacock Cyan & Cobalt Crescent */}
              <path d="M -6 -1 C -6 5.5, 6 5.5, 6 -1 C 6 -5.5, -6 -5.5, -6 -1 Z" fill="#00e5ff" />
              <path d="M -4.6 -0.8 C -4.6 4, 4.6 4, 4.6 -0.8 C 4.6 -4.2, -4.6 -4.2, -4.6 -0.8 Z" fill="#0284c7" />
              {/* 4. Deep Velvet Obsidian Pupil */}
              <ellipse cx="0" cy="-0.6" rx="3.4" ry="4" fill="#0b0f19" />
              <ellipse cx="0" cy="-0.6" rx="2.5" ry="3" fill="#1e1b4b" />
              {/* 5. Specular Glint Reflection */}
              <circle cx="-1" cy="-1.8" r="1" fill="#ffffff" />
            </g>

            {/* Small Ocellus for Train */}
            <g id={`${uid}-ocellus-sm`}>
              <ellipse cx="0" cy="0" rx="8.5" ry="11.5" fill="#047857" />
              <ellipse cx="0" cy="0" rx="7" ry="9.5" fill="#f59e0b" />
              <ellipse cx="0" cy="0" rx="4.8" ry="6.6" fill="#00e5ff" />
              <ellipse cx="0" cy="-0.4" rx="2.6" ry="3.2" fill="#0b0f19" />
              <circle cx="-0.8" cy="-1.4" r="0.75" fill="#ffffff" />
            </g>

            {/* Crown Crest Pinna (Aigrette Feather) */}
            <g id={`${uid}-crest-pinna`}>
              <line x1="0" y1="0" x2="0" y2="-30" stroke="#d4af37" strokeWidth="1.2" />
              {/* Spatulate Tip */}
              <ellipse cx="0" cy="-32" rx="3.2" ry="4.8" fill="#00e5ff" />
              <ellipse cx="0" cy="-32" rx="1.9" ry="3.2" fill="#0f38b8" />
              <circle cx="0" cy="-32.5" r="0.85" fill="#fef08a" />
            </g>

            {/* Scapular Zebra Barring Pattern for Wings */}
            <pattern id={`${uid}-wing-stripes`} width="6" height="4" patternUnits="userSpaceOnUse">
              <rect width="6" height="4" fill="#fef3c7" />
              <path d="M 0 0 L 6 0 L 3 4 Z" fill="#451a03" />
            </pattern>
          </defs>

          {/* ========================================================== */}
          {/* 1. TOWERING FULL DISPLAY FAN (Center: 310, 360)             -->
          {/* ========================================================== */}
          <g
            transform="translate(310, 360) scale(1)"
            style={{
              transition: 'transform 2.1s cubic-bezier(0.22, 0.68, 0.3, 1), opacity 1.6s ease',
              transform: fanOpen ? 'translate(310px, 360px) scale(1)' : 'translate(310px, 360px) scale(0.035, 0.72)',
              opacity: fanOpen ? 1 : 0,
              transformOrigin: '0px 0px',
            }}
            className={isShimmering && !paused && !isLow ? 'peacock-shimmer-fan' : undefined}
          >
            {/* Ambient Green & Gold Backdrop Aura */}
            <path d="M -290 0 A 290 290 0 0 1 290 0 Z" fill="rgba(4, 120, 87, 0.28)" />
            <path d="M -265 0 A 265 265 0 0 1 265 0 Z" fill="rgba(217, 119, 6, 0.10)" />

            {/* 37 Radiating Feathers */}
            {fanFeathers.map((f) => (
              <g key={`shaft-${f.id}`}>
                {/* Fine paired barbs share one static path per plume. */}
                <g transform={`rotate(${f.deg})`}>
                  <path d={`M 0 -28 Q -15 -${f.shaftLen * .5} -9 -${f.shaftLen - 15} Q 0 -${f.shaftLen + 8} 9 -${f.shaftLen - 15} Q 15 -${f.shaftLen * .5} 0 -28`}
                    fill={f.id % 2 ? '#087f70' : '#116b4b'} opacity=".65" />
                  <path d={Array.from({ length: 12 }, (_, n) => {
                    const y = 42 + n * (f.shaftLen - 65) / 12
                    return `M -9 -${y + 12} L 0 -${y} L 9 -${y + 12}`
                  }).join(' ')} stroke={f.id % 2 ? '#8cba57' : '#46cbb3'} strokeWidth="1" fill="none" opacity=".7" />
                </g>
                {/* 1. Golden shaft (rachis) */}
                <line
                  x1="0"
                  y1="0"
                  x2={f.tipX}
                  y2={f.tipY}
                  stroke="#84cc16"
                  strokeWidth="1.5"
                  opacity="0.88"
                />

                {/* 2. Feather barbules at tip */}
                <path
                  d={`M ${f.tipX * 0.88} ${f.tipY * 0.88} Q ${f.tipX * 0.94 + 11} ${f.tipY * 0.94 - 8} ${f.tipX} ${f.tipY} Q ${f.tipX * 0.94 - 11} ${f.tipY * 0.94 + 8} ${f.tipX * 0.88} ${f.tipY * 0.88}`}
                  fill="#047857"
                  opacity="0.65"
                />

                {/* 3. T-feather gold perimeter crown */}
                <circle cx={f.tipX} cy={f.tipY} r="3.8" fill="#d97706" opacity="0.88" />

                {/* Tier 1: Outer Ocelli on EVERY shaft */}
                <use
                  href={`#${uid}-ocellus`}
                  transform={`translate(${f.o1.x}, ${f.o1.y}) rotate(${f.o1.deg}) scale(${f.o1.scale})`}
                />

                {/* Tier 2: Middle Ocelli on alternate shafts */}
                {f.o2 && (
                  <use
                    href={`#${uid}-ocellus`}
                    transform={`translate(${f.o2.x}, ${f.o2.y}) rotate(${f.o2.deg}) scale(${f.o2.scale})`}
                  />
                )}

                {/* Tier 3: Inner Ocelli on every 3rd shaft */}
                {f.o3 && (
                  <use
                    href={`#${uid}-ocellus`}
                    transform={`translate(${f.o3.x}, ${f.o3.y}) rotate(${f.o3.deg}) scale(${f.o3.scale})`}
                  />
                )}
              </g>
            ))}

            {/* Fluffy Basal Tail Down Feathers Cushioning the Fan Root */}
            <path d="M -58 0 C -58 -42, 58 -42, 58 0 Z" fill="#1e293b" opacity="0.95" />
            <path d="M -42 0 C -42 -28, 42 -28, 42 0 Z" fill="#334155" />
            <path d="M -25 0 C -25 -18, 25 -18, 25 0 Z" fill="#475569" />
          </g>

          {/* ========================================================== */}
          {/* 2. FRONT-FACING DISPLAY PEACOCK (Center: 310, 360)          -->
          {/* ========================================================== */}
          <g
            style={{
              transition: 'opacity 0.75s ease, transform 1s ease-in-out',
              transform: isDisplaying ? 'scaleX(1)' : 'scaleX(0.15)',
              opacity: isDisplaying ? 1 : 0,
              pointerEvents: isDisplaying ? 'auto' : 'none',
              transformOrigin: '310px 400px',
            }}
            className={isShimmering && !paused && !isLow ? 'peacock-swaying-body' : undefined}
          >
            {/* Left Leg (Standing Firm) */}
            <g>
              <line x1="290" y1="360" x2="286" y2="410" stroke="#64748b" strokeWidth="4.2" strokeLinecap="round" />
              <line x1="286" y1="410" x2="282" y2="444" stroke="#475569" strokeWidth="3.8" strokeLinecap="round" />
              <line x1="282" y1="444" x2="266" y2="450" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
              <line x1="282" y1="444" x2="282" y2="453" stroke="#334155" strokeWidth="3.4" strokeLinecap="round" />
              <line x1="282" y1="444" x2="298" y2="449" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Right Leg (Standing Firm) */}
            <g>
              <line x1="330" y1="360" x2="334" y2="410" stroke="#94a3b8" strokeWidth="4.4" strokeLinecap="round" />
              <line x1="334" y1="410" x2="338" y2="444" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <line x1="338" y1="444" x2="322" y2="450" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
              <line x1="338" y1="444" x2="338" y2="453" stroke="#334155" strokeWidth="3.4" strokeLinecap="round" />
              <line x1="338" y1="444" x2="354" y2="449" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Flanking Wings Dropped at Sides for Balance */}
            {/* Left Wing */}
            <path
              d="M 275 310 C 245 315, 240 360, 260 385 C 275 375, 280 340, 275 310 Z"
              fill={`url(#${uid}-wing-stripes)`}
              stroke="#b45309"
              strokeWidth="1.2"
            />
            <path d="M 255 370 C 245 385, 250 400, 265 402 C 260 390, 258 380, 255 370 Z" fill="#b45309" />

            {/* Right Wing */}
            <path
              d="M 345 310 C 375 315, 380 360, 360 385 C 345 375, 340 340, 345 310 Z"
              fill={`url(#${uid}-wing-stripes)`}
              stroke="#b45309"
              strokeWidth="1.2"
            />
            <path d="M 365 370 C 375 385, 370 400, 355 402 C 360 390, 362 380, 365 370 Z" fill="#b45309" />

            {/* Symmetrical Muscular Breast & Abdomen */}
            <path
              d="M 310 280 C 275 280, 268 320, 272 365 C 276 385, 298 395, 310 395 C 322 395, 344 385, 348 365 C 352 320, 345 280, 310 280 Z"
              fill={`url(#${uid}-p-breast)`}
            />

            {/* Scalloped Iridescent Covert Scales across Chest */}
            <path d="M 298 305 Q 310 315 322 305" stroke="#00e5ff" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M 292 325 Q 310 337 328 325" stroke="#00e5ff" strokeWidth="1.5" fill="none" opacity="0.6" />
            <path d="M 290 345 Q 310 358 330 345" stroke="#00e5ff" strokeWidth="1.5" fill="none" opacity="0.5" />

            {/* Elegant Neck (Rising vertically from center breast) */}
            <path
              d="M 300 290 C 298 238, 302 190, 306 160 C 310 160, 314 160, 314 160 C 318 190, 322 238, 320 290 Z"
              fill={`url(#${uid}-p-neck)`}
            />

            {/* Head (Tilted slightly in proud display) */}
            <g transform="translate(310, 155)">
              <g className={!paused ? 'peacock-head-tilt' : undefined} style={{ transformOrigin: '0px 8px' }}>
                <path
                  d="M -14 0 C -20 -12, -10 -26, 4 -26 C 20 -26, 26 -14, 24 -2 C 22 10, 12 16, -2 16 C -12 16, -16 10, -14 0 Z"
                  fill="#0f38b8"
                />
                {/* White Eye Patches */}
                <path d="M 0 -18 C 8 -20, 16 -15, 18 -8 C 12 -11, 6 -11, 0 -8 Z" fill="#ffffff" />
                <path d="M 2 2 C 10 2, 16 4, 20 2 C 14 7, 8 7, 2 5 Z" fill="#ffffff" />
                {/* Eye */}
                <circle cx="10" cy="-5" r="4.2" fill="#f59e0b" />
                <circle cx="10.3" cy="-5" r="3.0" fill="#0b0f19" />
                <circle cx="9.4" cy="-6" r="0.9" fill="#ffffff" />
                {/* Beak */}
                <path d="M 22 -4 C 30 -2, 42 2, 46 6 C 38 8, 28 10, 20 7 Z" fill="#e2e8f0" />
                <path d="M 22 2 L 40 6" stroke="#64748b" strokeWidth="0.8" />
                <ellipse cx="26" cy="0" rx="1.2" ry="0.6" fill="#334155" />

                {/* Glorious Symmetrical Crown Crest (Kalgi) */}
                <g transform="translate(4, -26)">
                  <g className={!paused ? 'peacock-crest-sway' : undefined} style={{ transformOrigin: '0px 0px' }}>
                    <use href={`#${uid}-crest-pinna`} transform="rotate(-36)" />
                    <use href={`#${uid}-crest-pinna`} transform="rotate(-24)" />
                    <use href={`#${uid}-crest-pinna`} transform="rotate(-12)" />
                    <use href={`#${uid}-crest-pinna`} transform="rotate(0)" />
                    <use href={`#${uid}-crest-pinna`} transform="rotate(12)" />
                    <use href={`#${uid}-crest-pinna`} transform="rotate(24)" />
                    <use href={`#${uid}-crest-pinna`} transform="rotate(36)" />
                  </g>
                </g>
              </g>
            </g>
          </g>

          {/* ========================================================== */}
          {/* 3. PROFILE WALKING PEACOCK FIGURE                           -->
          {/* ========================================================== */}
          <g
            style={{
              transition: 'opacity 0.75s ease, transform 1s ease-in-out',
              transform: isDisplaying ? 'scaleX(0.12)' : 'scaleX(1)',
              opacity: !isDisplaying ? 1 : 0,
              pointerEvents: !isDisplaying ? 'auto' : 'none',
              transformOrigin: '310px 400px',
            }}
          >
            {/* Folded Trail Tail (Cascades Down & Behind) */}
            <g
              style={{ transformOrigin: '290px 340px' }}
              className={!isDisplaying && !paused ? 'peacock-walking-tail' : undefined}
            >
              <path
                d="M 290 320 C 225 330, 135 365, 55 420 C 40 430, 30 438, 42 440 C 68 444, 135 410, 220 368 C 268 344, 300 332, 306 322 Z"
                fill={`url(#${uid}-p-mantle)`}
              />
              <path
                d="M 285 328 C 230 342, 155 385, 85 442 C 110 442, 178 405, 260 358 Z"
                fill="#065f46"
                opacity="0.8"
              />
              {/* Cascading Ocelli on Folded Tail */}
              <use href={`#${uid}-ocellus-sm`} transform="translate(252, 340) rotate(-26) scale(1.1)" />
              <use href={`#${uid}-ocellus-sm`} transform="translate(208, 362) rotate(-28) scale(1.05)" />
              <use href={`#${uid}-ocellus-sm`} transform="translate(162, 388) rotate(-30) scale(1.0)" />
              <use href={`#${uid}-ocellus-sm`} transform="translate(118, 414) rotate(-32) scale(0.95)" />
              <use href={`#${uid}-ocellus-sm`} transform="translate(75, 436) rotate(-34) scale(0.9)" />
            </g>

            {/* Strutting Legs */}
            {/* Rear Leg */}
            <g
              style={{ transformOrigin: '295px 365px' }}
              className={!isDisplaying && !paused ? 'peacock-walking-leg2' : undefined}
            >
              <line x1="295" y1="365" x2="288" y2="410" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
              <line x1="288" y1="410" x2="282" y2="444" stroke="#475569" strokeWidth="3.4" strokeLinecap="round" />
              <path d="M 288 412 L 280 415" stroke="#334155" strokeWidth="2" strokeLinecap="round" />
              {/* Toes */}
              <line x1="282" y1="444" x2="266" y2="451" stroke="#334155" strokeWidth="2.8" strokeLinecap="round" />
              <line x1="282" y1="444" x2="282" y2="453" stroke="#334155" strokeWidth="3.2" strokeLinecap="round" />
              <line x1="282" y1="444" x2="297" y2="449" stroke="#334155" strokeWidth="2.8" strokeLinecap="round" />
            </g>

            {/* Foreground Leg */}
            <g
              style={{ transformOrigin: '318px 365px' }}
              className={!isDisplaying && !paused ? 'peacock-walking-leg1' : undefined}
            >
              <line x1="318" y1="365" x2="314" y2="410" stroke="#94a3b8" strokeWidth="4.4" strokeLinecap="round" />
              <line x1="314" y1="410" x2="310" y2="445" stroke="#64748b" strokeWidth="3.8" strokeLinecap="round" />
              <path d="M 314 412 L 306 416" stroke="#475569" strokeWidth="2.4" strokeLinecap="round" />
              {/* Toes */}
              <line x1="310" y1="445" x2="292" y2="452" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
              <line x1="310" y1="445" x2="311" y2="454" stroke="#334155" strokeWidth="3.4" strokeLinecap="round" />
              <line x1="310" y1="445" x2="327" y2="450" stroke="#334155" strokeWidth="3" strokeLinecap="round" />
            </g>

            {/* Body, Wing & Mantle in Profile */}
            <g style={{ transformOrigin: '310px 380px' }}>
              {/* Mantle */}
              <path
                d="M 282 304 C 275 280, 302 274, 334 286 C 328 314, 306 342, 282 346 Z"
                fill={`url(#${uid}-p-mantle)`}
              />

              {/* Zebra Wing */}
              <path
                d="M 286 308 C 296 292, 326 296, 340 318 C 346 340, 320 368, 292 358 C 282 352, 282 328, 286 308 Z"
                fill={`url(#${uid}-wing-stripes)`}
                stroke="#b45309"
                strokeWidth="1.2"
              />
              <path d="M 278 336 C 268 352, 274 370, 294 372 C 284 360, 280 348, 278 336 Z" fill="#b45309" />

              {/* Puffed Breast in Profile */}
              <path
                d="M 310 294 C 334 290, 368 305, 370 336 C 372 366, 342 384, 310 376 C 298 370, 288 354, 295 332 C 302 312, 304 296, 310 294 Z"
                fill={`url(#${uid}-p-breast)`}
              />

              {/* S-Curved Neck & Head in Profile (Bobbing cadence) */}
              <g transform="translate(320, 330)">
                <g
                  style={{ transformOrigin: '0px 0px' }}
                  className={!isDisplaying && !paused ? 'peacock-walking-neck' : undefined}
                >
                  {/* Elegant S-Neck */}
                  <path
                    d="M 0 0 C 18 -25, 34 -58, 30 -98 C 26 -132, 10 -150, 22 -180 C 30 -192, 44 -198, 60 -198 C 52 -184, 40 -168, 42 -136 C 44 -102, 60 -68, 50 -30 C 40 -8, 20 6, 0 0 Z"
                    fill={`url(#${uid}-p-neck)`}
                  />

                  {/* Head Profile */}
                  <g transform="translate(56, -196)">
                    <path
                      d="M -6 4 C -12 -6, -2 -18, 12 -18 C 28 -18, 38 -8, 40 2 C 42 14, 32 24, 18 24 C 2 24, -4 14, -6 4 Z"
                      fill="#0f38b8"
                    />
                    {/* White Eye Patches */}
                    <path d="M 8 -14 C 18 -16, 28 -11, 30 -3 C 24 -7, 16 -8, 8 -5 Z" fill="#ffffff" />
                    <path d="M 10 4 C 18 4, 26 7, 30 4 C 25 9, 17 9, 10 8 Z" fill="#ffffff" />
                    {/* Eye */}
                    <circle cx="20" cy="-3" r="4.2" fill="#f59e0b" />
                    <circle cx="20.3" cy="-3" r="3.0" fill="#0b0f19" />
                    <circle cx="19.4" cy="-4" r="0.9" fill="#ffffff" />
                    {/* Beak */}
                    <path d="M 34 -3 C 42 -1, 54 2, 58 7 C 50 9, 40 12, 32 10 Z" fill="#e2e8f0" />
                    <path d="M 34 3 L 52 7" stroke="#64748b" strokeWidth="0.8" />
                    <ellipse cx="38" cy="1.5" rx="1.3" ry="0.7" fill="#334155" />

                    {/* Crest */}
                    <g transform="translate(10, -18)">
                      <g className={!paused ? 'peacock-crest-sway' : undefined} style={{ transformOrigin: '0px 0px' }}>
                        <use href={`#${uid}-crest-pinna`} transform="rotate(-30)" />
                        <use href={`#${uid}-crest-pinna`} transform="rotate(-15)" />
                        <use href={`#${uid}-crest-pinna`} transform="rotate(0)" />
                        <use href={`#${uid}-crest-pinna`} transform="rotate(15)" />
                        <use href={`#${uid}-crest-pinna`} transform="rotate(30)" />
                      </g>
                    </g>
                  </g>
                </g>
              </g>
            </g>
          </g>
        </svg>
      </motion.div>
    </div>
  )
})
