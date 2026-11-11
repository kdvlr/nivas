import { useEffect, useState } from 'react'
import type { SkyKind, SkyPhase } from '../sky/skyEngine'
import { daysUntilThanksgiving, fallProgress, isThanksgivingDay } from './fallDates'

// Static-or-cheap SVG additions drawn inside the November horizon
// (viewBox 1920x176). Animations are CSS transform/opacity only, and are
// switched off by the horizon's data-static flag on medium/low tiers.

export const LEAF_PILE_X = 700
export const GRATITUDE_TREE_X = 1212
export const SIGN_X = 880
export const PIE_EVENT = 'fall-pie'

const LEAF_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#b45309', '#c2410c', '#eab308', '#991b1b']

function LeafPile({ progress, evening }: { progress: number; evening: boolean }) {
  // Grows from a handful of leaves on Nov 1 to a jumpable mound by month end.
  const rx = 16 + 34 * progress
  const ry = 6 + 14 * progress
  const n = 6 + Math.round(16 * progress)
  const dim = evening ? 0.55 : 1
  return (
    <g transform={`translate(${LEAF_PILE_X} 172)`} opacity={dim > 0.9 ? 1 : 0.85}>
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill={evening ? '#4a1f0b' : '#9a3412'} />
      <ellipse cx={-rx * 0.25} cy={-ry * 0.35} rx={rx * 0.7} ry={ry * 0.7} fill={evening ? '#5c2a10' : '#c2410c'} />
      {Array.from({ length: n }, (_, i) => {
        const a = (i * 137.5 * Math.PI) / 180
        const r = Math.sqrt((i + 0.5) / n)
        const x = Math.cos(a) * r * rx * 0.85
        const y = -Math.abs(Math.sin(a)) * r * ry * 1.1
        return (
          <use
            key={i}
            href={i % 3 === 0 ? '#autumn-leaf-maple' : i % 3 === 1 ? '#autumn-leaf-oak' : '#autumn-leaf-birch'}
            transform={`translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(0.55) rotate(${(i * 67) % 360})`}
            fill={LEAF_COLORS[i % LEAF_COLORS.length]}
            opacity={evening ? 0.6 : 1}
          />
        )
      })}
      {/* A rake leaning on the pile */}
      <g transform={`translate(${rx + 6} 0) rotate(-24)`}>
        <path d="M0 0V-44" stroke={evening ? '#3b2a1e' : '#8a5a32'} strokeWidth="2.4" strokeLinecap="round" />
        <path d="M-9 -44H9M-8 -44V-50M-4 -44V-51M0 -44V-51M4 -44V-51M8 -44V-50" stroke={evening ? '#444' : '#6b7280'} strokeWidth="1.4" />
      </g>
    </g>
  )
}

function Lantern({ x, y, lit }: { x: number; y: number; lit: boolean }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      {lit && <circle r="20" cy="10" fill="url(#fall-lantern-glow)" className="fall-anim" style={{ animation: 'fallLanternFlicker 3.4s ease-in-out infinite' }} />}
      <path d="M0 -6V-1" stroke="#3f3f46" strokeWidth="1.2" />
      <path d="M-4 0H4L5 3H-5Z" fill="#27272a" />
      <rect x="-4.5" y="3" width="9" height="11" rx="1.5" fill={lit ? '#fde68a' : '#57534e'} stroke="#27272a" strokeWidth="1.2" />
      {lit && <ellipse cx="0" cy="9" rx="1.6" ry="3" fill="#f97316" className="fall-anim" style={{ transformOrigin: '0 11px', animation: 'fallLanternFlame 1.1s ease-in-out infinite' }} />}
      <path d="M-5 14H5" stroke="#27272a" strokeWidth="1.6" />
    </g>
  )
}

function Frost() {
  // Melts over ~8 minutes after the dawn scene appears. Driven by a slow
  // timer rather than a CSS animation: the horizon toggles data-static on
  // every slide entrance, which would restart a keyframe melt.
  const [opacity, setOpacity] = useState(1)
  useEffect(() => {
    const start = Date.now()
    const timer = setInterval(() => {
      const next = Math.max(0, 1 - (Date.now() - start) / 480_000)
      setOpacity(next)
      if (next === 0) clearInterval(timer)
    }, 20_000)
    return () => clearInterval(timer)
  }, [])
  if (opacity === 0) return null
  const tips = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 211) % 1920
    const y = 132 + ((i * 53) % 42)
    return <path key={i} d={`M${x} ${y}l-2-5M${x} ${y}l2-6M${x} ${y}l0-5`} />
  })
  return (
    <g opacity={opacity.toFixed(2)}>
      <g stroke="#f1f5f9" strokeWidth="1.1" strokeLinecap="round" opacity="0.85">{tips}</g>
      {/* Frosted fence rails and basket rim */}
      <path d="M12 133L230 140M12 149L230 156M215 105L305 105M475 107L605 107M1255 107L1385 107M1675 105L1765 105" stroke="#f8fafc" strokeWidth="1.3" strokeDasharray="5 3" opacity="0.8" />
      <path d="M320 156H372" stroke="#f8fafc" strokeWidth="1.4" strokeDasharray="4 2" />
      {/* Rime on pumpkin tops */}
      {[[236, 124], [244, 125], [584, 123], [576, 124], [1320, 120], [1328, 121]].map(([x, y], i) => (
        <path key={i} d={`M${x - 5} ${y}Q${x} ${y - 3} ${x + 5} ${y}`} stroke="#f8fafc" strokeWidth="1.6" fill="none" />
      ))}
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <circle key={i} cx={180 + i * 310} cy={148 + (i % 3) * 7} r="1.4" fill="#fff" className="fall-anim" style={{ animation: `fallSparkle 2.6s ${i * 0.4}s ease-in-out infinite` }} />
      ))}
    </g>
  )
}

function Puddle() {
  return (
    <g transform="translate(1460 166)">
      <ellipse rx="46" ry="7" fill="#3b4f63" opacity="0.75" />
      <ellipse rx="40" ry="5" cy="-1" fill="#5b7186" opacity="0.6" />
      {[0, 1, 2].map((i) => (
        <ellipse
          key={i}
          cx={-22 + i * 21}
          rx="8"
          ry="1.8"
          fill="none"
          stroke="#cbd5e1"
          strokeWidth="0.9"
          className="fall-anim"
          style={{ transformOrigin: `${-22 + i * 21}px 0px`, transformBox: 'view-box', animation: `fallRipple 1.8s ${i * 0.6}s ease-out infinite` }}
        />
      ))}
    </g>
  )
}

function Pies({ count, hidden }: { count: number; hidden: boolean }) {
  // Window sits at (1660..1673, 112..127); a shelf extends the sill.
  return (
    <g>
      <rect x="1654" y="126" width={12 + count * 10} height="2.4" fill="#5b4334" />
      {!hidden &&
        Array.from({ length: count }, (_, i) => {
          const x = 1662 + i * 10
          return (
            <g key={i} transform={`translate(${x} 125)`}>
              <path d="M-5 0H5L4 -2.6H-4Z" fill="#c2803e" />
              <ellipse cy="-2.6" rx="4.2" ry="1.3" fill="#d39550" />
              <path d="M-3 -2.6H3M-1.5 -3.6V-1.6M1.5 -3.6V-1.6" stroke="#8a5424" strokeWidth="0.5" />
              <path
                d="M-1 -5C-3 -8 1 -9 -1 -12M2 -5C0 -8 4 -9 2 -12"
                stroke="#f1ece4"
                strokeWidth="0.9"
                fill="none"
                className="fall-anim"
                style={{ animation: `fallSteam 3.2s ${i * 0.7}s ease-out infinite` }}
              />
            </g>
          )
        })}
    </g>
  )
}

function TableSilhouettes() {
  // Family gathered at the table, seen through the farmhouse window.
  return (
    <g fill="#5a3a20" opacity="0.85">
      <circle cx="1663" cy="122" r="2" />
      <circle cx="1667" cy="121.4" r="2.3" />
      <circle cx="1671" cy="122" r="1.8" />
      <rect x="1660" y="124" width="13" height="3" />
    </g>
  )
}

function CountdownSign({ date, evening }: { date: Date; evening: boolean }) {
  const days = daysUntilThanksgiving(date)
  if (days < 0) return null
  const line1 = days === 0 ? 'Happy' : days === 1 ? 'Tomorrow is' : `${days} sleeps till`
  const line2 = 'Thanksgiving!'
  return (
    <g transform={`translate(${SIGN_X} 112)`}>
      <path d="M0 0V34" stroke={evening ? '#3b2a1e' : '#6e5139'} strokeWidth="3" />
      <rect x="-40" y="-20" width="80" height="27" rx="3" fill={evening ? '#4a2e1f' : '#7a4a31'} stroke={evening ? '#2c1a10' : '#5a3622'} />
      <text textAnchor="middle" y="-9" fill="#f5e9d4" fontSize="9.5" fontFamily="serif">{line1}</text>
      <text textAnchor="middle" y="2" fill="#fcd34d" fontSize="10" fontFamily="serif" fontWeight="bold">{line2}</text>
    </g>
  )
}

function GratitudeTree({ count, evening }: { count: number; evening: boolean }) {
  const tags = Math.min(count, 14)
  const spots = Array.from({ length: tags }, (_, i) => {
    const a = -Math.PI * (0.12 + (0.76 * (i + 0.5)) / Math.max(tags, 1))
    const r = 18 + (i % 3) * 7
    return { x: Math.cos(a) * r, y: -52 + Math.sin(a) * r * 0.9 + 14 }
  })
  return (
    <g transform={`translate(${GRATITUDE_TREE_X} 142)`}>
      <path d="M0 0C-1 -14 1 -30 0 -40M0 -26L-16 -44M0 -32L15 -50M0 -40L-4 -60M0 -38L8 -62" stroke={evening ? '#2d1c12' : '#5b3a24'} strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {spots.map((s, i) => (
        <g key={i} transform={`translate(${s.x.toFixed(1)} ${s.y.toFixed(1)}) rotate(${(i * 47) % 40 - 20})`}>
          <path d="M0 -4V0" stroke="#a16207" strokeWidth="0.6" />
          <use href={i % 2 ? '#autumn-leaf-maple' : '#autumn-leaf-oak'} transform="scale(0.8)" fill={LEAF_COLORS[(i + 2) % LEAF_COLORS.length]} opacity={evening ? 0.7 : 1} />
          <rect x="-3.2" y="1" width="6.4" height="4" rx="0.8" fill="#fbf4e4" opacity="0.95" />
        </g>
      ))}
      {count === 0 && <path d="M-8 -44l3 3M10 -50l-2 4" stroke="#a16207" strokeWidth="1" />}
      <ellipse cx="0" cy="1" rx="14" ry="3" fill={evening ? '#1c0f07' : '#5c2406'} opacity="0.6" />
    </g>
  )
}

export function FallHorizonExtras({
  phase,
  kind,
  date,
  thanksgiving,
  gratitudeCount,
}: {
  phase: SkyPhase
  kind: SkyKind
  date: Date
  thanksgiving: boolean
  gratitudeCount: number
}) {
  const evening = phase === 'dusk' || phase === 'night'
  const progress = fallProgress(date)
  const tgDay = isThanksgivingDay(date)
  const [pieHidden, setPieHidden] = useState(false)

  useEffect(() => {
    const onPie = (e: Event) => setPieHidden(Boolean((e as CustomEvent<{ hidden: boolean }>).detail?.hidden))
    window.addEventListener(PIE_EVENT, onPie)
    return () => window.removeEventListener(PIE_EVENT, onPie)
  }, [])

  const pies = tgDay ? 3 : progress >= 0.45 ? 1 : 0
  const rainy = kind === 'rainy' || kind === 'stormy'
  const frosty = phase === 'dawn' && progress >= 0.45 && !rainy

  return (
    <g aria-hidden="true">
      <defs>
        <radialGradient id="fall-lantern-glow">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <style>{`
        @keyframes fallLanternFlicker { 0%,100% { opacity: .85 } 40% { opacity: 1 } 55% { opacity: .7 } 70% { opacity: .95 } }
        @keyframes fallLanternFlame { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(1.25) } }
        @keyframes fallSparkle { 0%,100% { opacity: 0 } 50% { opacity: 1 } }
        @keyframes fallRipple { 0% { transform: scale(.2); opacity: .9 } 100% { transform: scale(1.6); opacity: 0 } }
        @keyframes fallSteam { 0% { opacity: 0; transform: translateY(0) } 30% { opacity: .8 } 100% { opacity: 0; transform: translateY(-6px) } }
        .autumn-harvest[data-static="true"] .fall-anim { animation: none !important; }
      `}</style>

      <LeafPile progress={progress} evening={evening} />
      <GratitudeTree count={gratitudeCount} evening={evening} />
      {progress >= 0.45 && <CountdownSign date={date} evening={evening} />}
      {pies > 0 && <Pies count={pies} hidden={pieHidden} />}
      {tgDay && evening && <TableSilhouettes />}
      {rainy && <Puddle />}
      {frosty && <Frost />}
      {[
        [32, 112],
        [202, 121],
        [1260, 94],
        [1380, 94],
      ].map(([x, y]) => (
        <Lantern key={x} x={x} y={y} lit={evening} />
      ))}
    </g>
  )
}
