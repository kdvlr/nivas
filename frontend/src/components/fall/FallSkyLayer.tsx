import { useEffect, useRef, useState } from 'react'
import { autumnVisits } from '../../lib/autumnAmbience'
import type { SkyKind, SkyPhase } from '../sky/skyEngine'
import type { Quality } from '../sky/useQuality'
import { Kid } from './FallCritters'

// Sky-side November additions: a harvest moon (replaces the generic night
// moon), a few dusk stars, and a Thanksgiving-week parade balloon. The
// balloon column sits behind photos (z 8); its handlers walk in front of the
// horizon (z 27) using the same animation, and the ropes are vertical so the
// two halves line up without measuring anything.

const PARADE_MS = 80_000
const PARADE_GAP_MS = 6 * 60_000
let paradeCast = Math.floor(Math.random() * 3)

const DUSK_STARS = [
  [22, 6], [31, 14], [44, 5], [52, 19], [61, 9], [70, 16], [38, 24], [27, 27], [57, 28],
]

function HarvestMoon({ phase, kind, quality }: { phase: SkyPhase; kind: SkyKind; quality: Quality }) {
  const night = phase === 'night'
  const dim = kind === 'clear' ? 1 : kind === 'cloudy' ? 0.55 : 0.22
  const size = night ? 112 : 132
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ opacity: dim }} aria-hidden="true">
      {!night &&
        DUSK_STARS.map(([l, t], i) => (
          <span
            key={i}
            className="absolute rounded-full bg-amber-50"
            style={{
              left: `${l}%`,
              top: `${t}%`,
              width: i % 3 === 0 ? 3 : 2,
              height: i % 3 === 0 ? 3 : 2,
              animation: quality === 'high' ? `fallTwinkle ${2.6 + (i % 4) * 0.7}s ease-in-out ${i * 0.4}s infinite` : undefined,
              opacity: 0.8,
            }}
          />
        ))}
      <div
        className="absolute rounded-full"
        style={{
          left: '9%',
          top: night ? '11%' : '40%',
          width: size,
          height: size,
          background: night
            ? 'radial-gradient(circle at 40% 38%, #fff8e7 0%, #f8dfa6 58%, #e8b866 100%)'
            : 'radial-gradient(circle at 40% 38%, #ffe7b8 0%, #f9b867 55%, #e88a2c 100%)',
          boxShadow: night ? '0 0 80px 24px rgba(248,214,150,0.32)' : '0 0 90px 30px rgba(249,160,80,0.38)',
          animation: !night && quality !== 'low' ? 'fallMoonRise 900s ease-out both' : undefined,
        }}
      >
        <span className="absolute rounded-full" style={{ left: '26%', top: '30%', width: '18%', height: '16%', background: 'rgba(160,100,40,0.16)' }} />
        <span className="absolute rounded-full" style={{ left: '55%', top: '52%', width: '22%', height: '19%', background: 'rgba(160,100,40,0.13)' }} />
        <span className="absolute rounded-full" style={{ left: '40%', top: '68%', width: '11%', height: '10%', background: 'rgba(160,100,40,0.15)' }} />
      </div>
    </div>
  )
}

function TurkeyBalloon() {
  return (
    <svg viewBox="0 0 160 140" width="170" height="149" aria-hidden="true">
      {['#b45309', '#dc2626', '#f59e0b', '#ea580c', '#dc2626', '#f59e0b', '#b45309'].map((c, i) => (
        <ellipse key={i} cx="80" cy="34" rx="15" ry="38" fill={c} stroke="#7c2d12" strokeWidth="1" transform={`rotate(${-66 + i * 22} 80 86)`} />
      ))}
      <ellipse cx="80" cy="92" rx="40" ry="36" fill="#92400e" stroke="#5b2a0a" strokeWidth="1.4" />
      <ellipse cx="68" cy="80" rx="12" ry="8" fill="#b45309" opacity="0.5" />
      <circle cx="80" cy="66" r="18" fill="#a16207" stroke="#5b2a0a" strokeWidth="1.2" />
      <circle cx="73" cy="62" r="4" fill="#fff" /><circle cx="87" cy="62" r="4" fill="#fff" />
      <circle cx="74" cy="63" r="2" fill="#111827" /><circle cx="86" cy="63" r="2" fill="#111827" />
      <path d="M74 70L80 80L86 70Z" fill="#f59e0b" />
      <path d="M83 74Q88 84 82 88" stroke="#dc2626" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

function PumpkinBalloon() {
  return (
    <svg viewBox="0 0 160 140" width="170" height="149" aria-hidden="true">
      <path d="M78 22Q76 8 88 4" stroke="#166534" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M90 14Q108 8 112 20Q100 22 90 14Z" fill="#16a34a" />
      {[-42, -22, 0, 22, 42].map((dx, i) => (
        <ellipse key={i} cx={80 + dx} cy="78" rx={i === 2 ? 34 : 28} ry="54" fill={i % 2 ? '#ea580c' : '#f97316'} stroke="#9a3412" strokeWidth="1.2" />
      ))}
      <path d="M58 66L68 58L72 70ZM102 66L92 58L88 70Z" fill="#7c2d12" />
      <path d="M56 92Q80 112 104 92Q92 100 80 98Q68 100 56 92Z" fill="#7c2d12" />
      <circle cx="62" cy="86" r="5" fill="#fb923c" /><circle cx="98" cy="86" r="5" fill="#fb923c" />
    </svg>
  )
}

function PilgrimHatBalloon() {
  return (
    <svg viewBox="0 0 160 140" width="170" height="149" aria-hidden="true">
      <ellipse cx="80" cy="112" rx="76" ry="18" fill="#1f2937" stroke="#030712" strokeWidth="1.4" />
      <path d="M38 110L48 22Q80 12 112 22L122 110Q80 122 38 110Z" fill="#111827" stroke="#030712" strokeWidth="1.4" />
      <path d="M44 84Q80 94 116 84L118 100Q80 110 42 100Z" fill="#78350f" />
      <rect x="66" y="80" width="28" height="24" rx="2" fill="none" stroke="#facc15" strokeWidth="5" />
      <path d="M58 36Q66 30 74 34" stroke="#374151" strokeWidth="3" fill="none" strokeLinecap="round" />
    </svg>
  )
}

const CAST = [TurkeyBalloon, PumpkinBalloon, PilgrimHatBalloon]

function Parade({ run }: { run: number }) {
  const Balloon = CAST[run % CAST.length]
  const column = { animation: `fallParade ${PARADE_MS}ms linear both`, width: 200, left: 0 } as const
  const ropes = [52, 148]
  return (
    <>
      <div className="absolute top-0 bottom-0 z-[8] pointer-events-none" style={column} aria-hidden="true">
        <div className="absolute left-[15px]" style={{ top: '12%', animation: 'fallBob 5s ease-in-out infinite' }}>
          <Balloon />
        </div>
        {ropes.map((x) => (
          <span key={x} className="absolute w-[2px] bg-stone-700/70" style={{ left: x, top: 'calc(12% + 120px)', bottom: 40 }} />
        ))}
      </div>
      <div className="absolute bottom-0 h-56 z-[27] pointer-events-none" style={column} aria-hidden="true">
        {ropes.map((x) => (
          <span key={x} className="absolute w-[2px] bg-stone-700/80" style={{ left: x, top: 0, bottom: 52 }} />
        ))}
        {ropes.map((x, i) => (
          <div key={`h${x}`} className="absolute" style={{ left: x - 19, bottom: 4, transform: 'scale(0.82)', transformOrigin: 'bottom center' }}>
            <Kid variant={i ? 'girl' : 'boy'} />
          </div>
        ))}
      </div>
    </>
  )
}

export function FallSkyLayer({
  phase,
  kind,
  quality,
  paused,
  thanksgivingWeek,
}: {
  phase: SkyPhase
  kind: SkyKind
  quality: Quality
  paused: boolean
  thanksgivingWeek: boolean
}) {
  const [parade, setParade] = useState<number | null>(null)
  const lastParade = useRef(-Infinity)
  const daylight = phase === 'day' || phase === 'dawn'
  const paradeEligible = thanksgivingWeek && daylight && quality !== 'low' && !paused && kind !== 'stormy'

  useEffect(() => {
    if (!paradeEligible) {
      setParade(null)
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      const now = performance.now()
      if (!document.hidden && now - lastParade.current > PARADE_GAP_MS && autumnVisits.claim(now, PARADE_MS)) {
        lastParade.current = now
        setParade(paradeCast++)
        timer = setTimeout(() => {
          setParade(null)
          timer = setTimeout(attempt, 5_000)
        }, PARADE_MS)
        return
      }
      timer = setTimeout(attempt, 5_000)
    }
    timer = setTimeout(attempt, 25_000)
    return () => clearTimeout(timer)
  }, [paradeEligible])

  return (
    <>
      <style>{`
        @keyframes fallTwinkle { 0%,100% { opacity: .25 } 50% { opacity: 1 } }
        @keyframes fallMoonRise { from { transform: translateY(22vh) } to { transform: translateY(0) } }
        @keyframes fallParade { from { transform: translateX(-220px) } to { transform: translateX(calc(100vw + 20px)) } }
        @keyframes fallBob { 0%,100% { transform: translateY(0) rotate(-2deg) } 50% { transform: translateY(-10px) rotate(2deg) } }
      `}</style>
      {(phase === 'dusk' || phase === 'night') && <HarvestMoon phase={phase} kind={kind} quality={quality} />}
      {parade !== null && <Parade key={parade} run={parade} />}
    </>
  )
}
