// "The Great Woodland Feast" — Thanksgiving-week storyline drawn into the WoodlandStage SVG
// (viewBox 1920x1080). Tablet rules: transform/opacity animations only, no filters/blur, and
// animated <g> elements never carry an SVG `transform` attribute (outer <g> positions, inner animates).
import React from 'react'
import type { FeastGuest, FeastStage, HideSpot, TgDaySegment } from '../../lib/thanksgivingWeek'
import { countdownLabel } from '../../lib/thanksgivingWeek'
import { CuteSquirrelSprite } from './WoodlandCritters'

export const TG_CSS = `
@keyframes tgSpin { to { transform: rotate(360deg); } }
@keyframes tgSignSway { 0%, 100% { transform: rotate(-1.2deg); } 50% { transform: rotate(1.2deg); } }
@keyframes tgFlip { 0% { transform: scaleY(0); } 60% { transform: scaleY(1.18); } 100% { transform: scaleY(1); } }
@keyframes tgArrive {
  0% { transform: translate(560px, 0); opacity: 0; }
  8% { opacity: 1; }
  18% { transform: translate(450px, -14px); }
  28% { transform: translate(340px, 0); }
  38% { transform: translate(230px, -14px); }
  48% { transform: translate(130px, 0); }
  58% { transform: translate(50px, -14px); }
  70% { transform: translate(0, 0); }
  82% { transform: translate(0, -20px); }
  100% { transform: translate(0, 0); opacity: 1; }
}
@keyframes tgZzz { 0% { transform: translate(0, 0); opacity: 0; } 30% { opacity: 1; } 100% { transform: translate(12px, -28px); opacity: 0; } }
@keyframes tgCup { 0%, 3% { transform: translateY(0); } 6%, 11% { transform: translateY(-16px); } 14%, 100% { transform: translateY(0); } }
@keyframes tgCandle { from { transform: scaleY(0.82); } to { transform: scaleY(1.12); } }
@keyframes tgGlow { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.95; } }
@keyframes tgHop { from { transform: translateY(0); } to { transform: translateY(-13px); } }
@keyframes tgMarch { from { transform: translateY(0); } to { transform: translateY(-6px); } }
@keyframes tgParade { from { transform: translateX(-120px); } to { transform: translateX(2900px); } }
@keyframes tgSwirl { from { transform: translateX(2080px); } to { transform: translateX(-200px); } }
@keyframes tgWave { from { transform: translateY(-55px); } to { transform: translateY(55px); } }
@keyframes tgBalloon {
  0% { transform: translate(-280px, 135px); }
  50% { transform: translate(940px, 88px); }
  100% { transform: translate(2180px, 125px); }
}
@keyframes tgBob { from { transform: translateY(-9px); } to { transform: translateY(9px); } }
@keyframes tgPieSquirrel {
  0% { transform: translate(-130px, 0); opacity: 0; }
  10%, 24% { transform: translate(0, 0); opacity: 1; }
  28% { transform: translate(8px, -18px); }
  32%, 60% { transform: translate(0, 0); }
  64% { transform: translate(0, -24px); }
  68% { transform: translate(0, 0); }
  72% { transform: translate(0, -24px); }
  76%, 88% { transform: translate(0, 0); opacity: 1; }
  100% { transform: translate(-150px, 0); opacity: 0; }
}
@keyframes tgPieArc {
  0%, 27% { transform: translate(590px, 1032px); opacity: 0; }
  28% { transform: translate(590px, 1032px); opacity: 1; }
  34% { transform: translate(800px, 880px); }
  40% { transform: translate(1060px, 792px); }
  46% { transform: translate(1330px, 792px); }
  52% { transform: translate(1560px, 860px); }
  56% { transform: translate(1712px, 922px); opacity: 1; }
  57%, 100% { transform: translate(1712px, 922px); opacity: 0; }
}
@keyframes tgPeekFox {
  0%, 30% { transform: translateY(70px); opacity: 0; }
  40%, 55% { transform: translateY(0); opacity: 1; }
  58% { transform: translate(8px, 4px) rotate(7deg); }
  62%, 86% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  96%, 100% { transform: translateY(70px); opacity: 0; }
}
@keyframes tgSplat {
  0%, 55% { transform: scale(0); opacity: 0; }
  59% { transform: scale(1.25); opacity: 1; }
  63%, 84% { transform: scale(1); opacity: 1; }
  92%, 100% { transform: scale(1); opacity: 0; }
}
@keyframes tgFbFox {
  0% { transform: translateY(70px); opacity: 0; }
  10%, 22% { transform: translateY(0); opacity: 1; }
  25% { transform: translate(-8px, -8px); }
  28%, 72% { transform: translate(0, 0); opacity: 1; }
  84%, 100% { transform: translateY(70px); opacity: 0; }
}
@keyframes tgFbBall {
  0%, 24% { transform: translate(1712px, 922px); opacity: 0; }
  25% { transform: translate(1712px, 922px); opacity: 1; }
  32% { transform: translate(1500px, 780px); }
  40% { transform: translate(1220px, 702px); }
  48% { transform: translate(960px, 760px); }
  56% { transform: translate(764px, 900px); }
  61% { transform: translate(700px, 990px); opacity: 1; }
  62%, 100% { transform: translate(700px, 990px); opacity: 0; }
}
@keyframes tgFbSquirrel {
  0%, 30% { transform: translate(380px, 1062px); opacity: 0; }
  34% { transform: translate(420px, 1062px); opacity: 1; }
  50% { transform: translate(600px, 1062px); }
  57% { transform: translate(660px, 1012px) rotate(-25deg); }
  62% { transform: translate(700px, 996px) rotate(-30deg); }
  68% { transform: translate(740px, 1062px) rotate(0deg); }
  74% { transform: translate(740px, 1038px); }
  78% { transform: translate(740px, 1062px); }
  82% { transform: translate(740px, 1038px); }
  88% { transform: translate(740px, 1062px); opacity: 1; }
  100% { transform: translate(520px, 1062px); opacity: 0; }
}
@keyframes tgFbHeld { 0%, 61% { opacity: 0; } 62%, 92% { opacity: 1; } 100% { opacity: 0; } }
@keyframes tgPop {
  0%, 62% { transform: scale(0); opacity: 0; }
  67% { transform: scale(1.2); opacity: 1; }
  71%, 90% { transform: scale(1); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}
@keyframes tgConfetti {
  0% { transform: translate(0, 0) rotate(0deg); opacity: 1; }
  100% { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)); opacity: 0; }
}
@keyframes tgDance {
  0%, 50%, 100% { transform: translate(0, 0) rotate(0deg); }
  25% { transform: translate(-12px, -20px) rotate(-12deg); }
  75% { transform: translate(12px, -20px) rotate(12deg); }
}
@keyframes tgFadeStage {
  0% { opacity: 0; transform: scale(0.6); }
  8%, 90% { opacity: 1; transform: scale(1); }
  100% { opacity: 0; transform: scale(1); }
}
@keyframes tgNote { 0% { transform: translate(0, 0); opacity: 0; } 20% { opacity: 1; } 100% { transform: translate(var(--dx), -70px); opacity: 0; } }
@keyframes tgAcornFall {
  0% { transform: translateY(-940px) rotate(0deg); }
  80% { transform: translateY(0) rotate(300deg); }
  88% { transform: translateY(-14px) rotate(330deg); }
  100% { transform: translateY(0) rotate(360deg); }
}
@keyframes tgFound {
  0% { transform: translateY(0) scale(1); }
  30% { transform: translateY(-34px) scale(1.18); }
  60% { transform: translateY(0) scale(1); }
  78% { transform: translateY(-12px) scale(1.06); }
  100% { transform: translateY(0) scale(1); }
}
@keyframes tgPeek { 0%, 82%, 100% { transform: rotate(0deg); } 86% { transform: rotate(-9deg); } 90% { transform: rotate(7deg); } 94% { transform: rotate(-4deg); } }

.tg-sign-sway { transform-origin: 300px 214px; animation: tgSignSway 6s ease-in-out infinite; }
.tg-flip { transform-box: fill-box; transform-origin: center; animation: tgFlip 1.1s cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both; }
.tg-arrive { animation: tgArrive 3.4s ease-out 1.6s both; }
.tg-zzz { animation: tgZzz 3.6s ease-out infinite; }
.tg-cup { animation: tgCup 24s ease-in-out infinite; }
.tg-candle { transform-box: fill-box; transform-origin: 50% 100%; animation: tgCandle 1.3s ease-in-out infinite alternate; }
.tg-glow { animation: tgGlow 3.4s ease-in-out infinite; }
.tg-hop { animation: tgHop 0.42s ease-in-out infinite alternate; }
.tg-march { animation: tgMarch 0.36s ease-in-out infinite alternate; }
.tg-twirl { transform-box: fill-box; transform-origin: center; animation: tgSpin 0.8s linear infinite; }
.tg-parade { animation: tgParade 10.5s linear both; }
.tg-swirl { animation: tgSwirl 2.6s cubic-bezier(0.45, 0.05, 0.55, 0.95) both; }
.tg-wave { animation: tgWave 1.3s ease-in-out infinite alternate; }
.tg-spin { transform-box: fill-box; transform-origin: center; animation: tgSpin 0.9s linear infinite; }
.tg-balloon { animation: tgBalloon 16s linear both; }
.tg-bob { animation: tgBob 2.8s ease-in-out infinite alternate; }
.tg-pie-squirrel { animation: tgPieSquirrel 6.8s ease-in-out both; }
.tg-pie-arc { animation: tgPieArc 6.8s linear both; }
.tg-pie-fox { transform-box: fill-box; transform-origin: center; animation: tgPeekFox 6.8s ease-in-out both; }
.tg-splat { transform-box: fill-box; transform-origin: center; animation: tgSplat 6.8s ease-out both; }
.tg-fb-fox { animation: tgFbFox 7.2s ease-in-out both; }
.tg-fb-ball { animation: tgFbBall 7.2s linear both; }
.tg-fb-squirrel { animation: tgFbSquirrel 7.2s ease-in-out both; }
.tg-fb-held { animation: tgFbHeld 7.2s linear both; }
.tg-fb-banner { transform-box: fill-box; transform-origin: center; animation: tgPop 7.2s ease-out both; }
.tg-confetti { animation: tgConfetti 1.9s ease-out both; }
.tg-dance { animation: tgDance 0.9s ease-in-out infinite; }
.tg-fade-stage { transform-box: fill-box; transform-origin: 50% 100%; animation: tgFadeStage 5.2s ease-in-out both; }
.tg-note { animation: tgNote 1.8s ease-out infinite; }
.tg-acorn-fall { animation: tgAcornFall 1.5s cubic-bezier(0.5, 0, 1, 1) both; }
.tg-found { animation: tgFound 1.2s ease-out both; }
.tg-peek { transform-box: fill-box; transform-origin: 50% 100%; animation: tgPeek 6.5s ease-in-out infinite; }
`

const CAVEAT = "'Caveat', Georgia, cursive"
const LEAF_COLORS = ['#dc2626', '#ea580c', '#f59e0b', '#b91c1c', '#d97706', '#facc15']

/* ───────────────────────────── Sprites (centered at 0,0, feet near +y) ───────────────────────────── */

/** Plump pilgrim-hat turkey; faces left by default. */
export function TurkeySprite({ facing = 'left', sleepy = false, hat = true }: { facing?: 'left' | 'right'; sleepy?: boolean; hat?: boolean }) {
  return (
    <g transform={facing === 'right' ? 'scale(-1, 1)' : undefined}>
      {[-50, -30, -10, 10, 30, 50].map((deg, idx) => (
        <ellipse
          key={idx}
          cx="0"
          cy="-18"
          rx="8.5"
          ry="24"
          transform={`rotate(${deg} 0 8)`}
          fill={idx % 2 === 0 ? '#b91c1c' : '#d97706'}
          stroke="#fde68a"
          strokeWidth="0.9"
        />
      ))}
      <ellipse cx="0" cy="8" rx="18" ry="16" fill="#6b3a19" />
      <circle cx="-6" cy="-8" r="10" fill="#7c431e" />
      <path d="M-13,-6 C-17,-2 -15,4 -11,2 Z" fill="#dc2626" />
      <polygon points="-14,-9 -22,-6 -14,-4" fill="#f59e0b" />
      {sleepy ? (
        <path d="M-12,-10 Q-9,-7.5 -6,-10" stroke="#1c1917" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      ) : (
        <>
          <circle cx="-9" cy="-10" r="2" fill="#1c1917" />
          <circle cx="-8.4" cy="-10.6" r="0.7" fill="#fff" />
        </>
      )}
      <path d="M-6,22 L-8,28 M4,22 L6,28" stroke="#f59e0b" strokeWidth="2.4" strokeLinecap="round" />
      {hat && (
        <g transform="translate(-5, -18) rotate(-8)">
          <ellipse cx="0" cy="2" rx="13" ry="3.2" fill="#3f2211" />
          <path d="M-8,2 L-6,-9 L6,-9 L8,2 Z" fill="#4a2b16" />
          <rect x="-7" y="-2" width="14" height="3" fill="#eab308" />
        </g>
      )}
    </g>
  )
}

function Eye({ x, y, sleepy, r = 1.9 }: { x: number; y: number; sleepy?: boolean; r?: number }) {
  return sleepy ? (
    <path d={`M${x - 2.4},${y} Q${x},${y + 2.2} ${x + 2.4},${y}`} stroke="#1c1917" strokeWidth="1.4" fill="none" strokeLinecap="round" />
  ) : (
    <>
      <circle cx={x} cy={y} r={r} fill="#1c1917" />
      <circle cx={x + 0.6} cy={y - 0.6} r={r * 0.36} fill="#fff" />
    </>
  )
}

/** Cottontail bunny facing right. */
export function BunnySprite({ sleepy = false }: { sleepy?: boolean }) {
  return (
    <g>
      <circle cx="-13" cy="-6" r="5.5" fill="#fafaf9" />
      <ellipse cx="0" cy="-8" rx="14" ry="11.5" fill="#cdb79e" />
      <ellipse cx="9" cy="-36" rx="3.4" ry="11" fill="#cdb79e" transform="rotate(-8 9 -36)" />
      <ellipse cx="16" cy="-35" rx="3.4" ry="11" fill="#cdb79e" transform="rotate(12 16 -35)" />
      <ellipse cx="16" cy="-35" rx="1.6" ry="7.5" fill="#f9a8d4" transform="rotate(12 16 -35)" />
      <circle cx="12" cy="-21" r="9.5" fill="#d6c3ab" />
      <Eye x={15} y={-23} sleepy={sleepy} />
      <circle cx="21" cy="-19" r="1.5" fill="#f472b6" />
      <ellipse cx="6" cy="2" rx="5" ry="2.4" fill="#b7a088" />
    </g>
  )
}

/** Striped chipmunk facing right. */
export function ChipmunkSprite({ sleepy = false }: { sleepy?: boolean }) {
  return (
    <g>
      <path d="M-8,0 C-22,-6 -22,-22 -12,-24 C-5,-25 -5,-10 -7,-3" fill="#92400e" />
      <ellipse cx="1" cy="-5" rx="10" ry="8.5" fill="#b45309" />
      <path d="M-6,-11 Q1,-14 8,-10" stroke="#451a03" strokeWidth="1.6" fill="none" />
      <path d="M-7,-7 Q1,-10 9,-6" stroke="#fef3c7" strokeWidth="1.3" fill="none" />
      <circle cx="10" cy="-14" r="7" fill="#b45309" />
      <circle cx="13" cy="-11" r="3.4" fill="#fde68a" />
      <polygon points="7,-19 9,-25 12,-19" fill="#78350f" />
      <Eye x={12} y={-15.5} sleepy={sleepy} r={1.6} />
    </g>
  )
}

/** Round hedgehog facing right. */
export function HedgehogSprite({ sleepy = false, chefHat = false }: { sleepy?: boolean; chefHat?: boolean }) {
  return (
    <g>
      <path
        d="M-20,2 L-24,-6 L-18,-9 L-21,-17 L-13,-17 L-13,-25 L-5,-22 L-1,-29 L4,-22 L11,-24 L10,-16 L17,-12 Z"
        fill="#57361f"
      />
      <ellipse cx="-2" cy="-6" rx="17" ry="11" fill="#6b4423" />
      <ellipse cx="13" cy="-5" rx="9" ry="7.5" fill="#e7c9a0" />
      <circle cx="22" cy="-4" r="2" fill="#1c1917" />
      <Eye x={14} y={-8} sleepy={sleepy} r={1.5} />
      {chefHat && (
        <g transform="translate(8, -22)">
          <rect x="-6" y="0" width="12" height="5" fill="#f8fafc" />
          <circle cx="-4" cy="-2" r="4.5" fill="#f8fafc" />
          <circle cx="4" cy="-2" r="4.5" fill="#f8fafc" />
          <circle cx="0" cy="-5" r="4.5" fill="#f8fafc" />
        </g>
      )}
    </g>
  )
}

/** Red fox (kit-sized when small) facing right. */
export function FoxSprite({ sleepy = false, scale = 1 }: { sleepy?: boolean; scale?: number }) {
  return (
    <g transform={scale !== 1 ? `scale(${scale})` : undefined}>
      <path d="M-16,-4 C-34,-4 -40,-20 -30,-26 C-24,-18 -16,-14 -12,-10 Z" fill="#ea580c" />
      <path d="M-34,-21 C-36,-25 -32,-28 -29,-26 Z" fill="#fff7ed" />
      <ellipse cx="0" cy="-7" rx="17" ry="10" fill="#ea580c" />
      <ellipse cx="4" cy="-4" rx="8" ry="5" fill="#fff7ed" />
      <circle cx="16" cy="-17" r="9.5" fill="#f97316" />
      <polygon points="9,-24 11,-35 17,-25" fill="#c2410c" />
      <polygon points="17,-25 23,-34 24,-22" fill="#c2410c" />
      <path d="M22,-19 L33,-14 L22,-11 Z" fill="#fff7ed" />
      <circle cx="33" cy="-14" r="1.8" fill="#1c1917" />
      <Eye x={18} y={-19} sleepy={sleepy} />
    </g>
  )
}

function Guest({ kind, sleepy, flip }: { kind: FeastGuest; sleepy: boolean; flip?: boolean }) {
  const inner =
    kind === 'squirrel' ? (
      <CuteSquirrelSprite />
    ) : kind === 'bunny' ? (
      <BunnySprite sleepy={sleepy} />
    ) : kind === 'chipmunk' ? (
      <ChipmunkSprite sleepy={sleepy} />
    ) : kind === 'hedgehog' ? (
      <HedgehogSprite sleepy={sleepy} chefHat />
    ) : kind === 'fox_kit' ? (
      <FoxSprite sleepy={sleepy} scale={0.78} />
    ) : (
      <TurkeySprite sleepy={sleepy} />
    )
  return <g transform={flip ? 'scale(-1, 1)' : undefined}>{inner}</g>
}

function Acorn({ r = 1 }: { r?: number }) {
  return (
    <g transform={r !== 1 ? `scale(${r})` : undefined}>
      <ellipse cx="0" cy="2" rx="6" ry="7.5" fill="#92400e" />
      <path d="M-7,-1 C-7,-7 7,-7 7,-1 Z" fill="#3f2211" />
      <path d="M0,-6 L1,-10" stroke="#3f2211" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  )
}

function Pie({ half = false }: { half?: boolean }) {
  return half ? (
    <g>
      <path d="M0,0 L-15,-2 A15,6 0 0 1 0,-6 Z" fill="#d97706" />
      <path d="M0,-1 L-12,-2.5 A12,4 0 0 1 0,-5 Z" fill="#c2410c" />
      <circle cx="10" cy="-1" r="1.4" fill="#d97706" />
      <circle cx="14" cy="1" r="1" fill="#d97706" />
    </g>
  ) : (
    <g>
      <ellipse cx="0" cy="0" rx="16" ry="6.5" fill="#d97706" />
      <ellipse cx="0" cy="-2" rx="12.5" ry="4.5" fill="#c2410c" />
      <path d="M-7,-3 L7,-1 M-4,-5 L4,1" stroke="#fbbf24" strokeWidth="1.2" />
    </g>
  )
}

/* ───────────────────────────── Countdown sign (hangs from owl bough) ───────────────────────────── */

export function CountdownSign({ sleeps, found, fed, animate }: { sleeps: number; found: number; fed: number; animate: boolean }) {
  const label = countdownLabel(sleeps)
  return (
    <g className="tg-sign-sway">
      {/* Twine ropes from the owl bough */}
      <path d="M206,212 L214,262 M286,222 L388,262" stroke="#c8a26b" strokeWidth="2.4" strokeLinecap="round" />
      <rect x="176" y="258" width="250" height="98" rx="10" fill="#6b4226" stroke="#c08a50" strokeWidth="3" />
      <rect x="184" y="265" width="234" height="84" rx="7" fill="none" stroke="#8a5a32" strokeWidth="1.5" strokeDasharray="5 4" />
      <g key={sleeps} className={animate ? 'tg-flip' : undefined}>
        <text x="301" y="306" textAnchor="middle" fill="#fef3c7" fontFamily={CAVEAT} fontSize="44" fontWeight="700">
          {sleeps > 0 ? '🦃 ' : ''}
          {label.big}
        </text>
      </g>
      <text x="301" y="339" textAnchor="middle" fill="#fcd34d" fontFamily={CAVEAT} fontSize="27" fontWeight="700">
        {label.small}
      </text>
      {(found > 0 || fed > 0) && (
        <g>
          <rect x="206" y="360" width="190" height="28" rx="14" fill="rgba(34, 20, 12, 0.82)" stroke="#c08a50" strokeWidth="1.2" />
          <text x="301" y="380" textAnchor="middle" fill="#fef3c7" fontFamily={CAVEAT} fontSize="20" fontWeight="700">
            {`🔍 found ${found}×   🌰 ${fed % 10}/10`}
          </text>
        </g>
      )}
    </g>
  )
}

/* ───────────────────────────── Growing feast table ───────────────────────────── */

const TABLE_CX = 1110
const TABLE_TOP = 1026
const HALF_W: Record<FeastStage, number> = { 1: 0, 2: 150, 3: 230, 4: 300, 5: 330 }

/** The whole feast is drawn ~1.35x, anchored at the bottom-centre of the table, so kids can see it across the room. */
const FEAST_SCALE = 1.35
const FEAST_ZOOM = `translate(${TABLE_CX}, 1080) scale(${FEAST_SCALE}) translate(${-TABLE_CX}, -1080)`

/** Where the guest-of-honour turkey stands at the head of the table (for its tap zone, in stage units). */
export function tableTurkeyPos(stage: FeastStage): { x: number; y: number } {
  return { x: TABLE_CX - (HALF_W[stage] + 48) * FEAST_SCALE, y: 1080 - (1080 - 1028) * FEAST_SCALE }
}

export function FeastTable({
  stage,
  guests,
  arriving,
  sleepy,
  segment,
  leftovers,
  frosty,
  snowy,
  hideTurkey,
}: {
  stage: FeastStage
  guests: FeastGuest[]
  arriving: FeastGuest | null
  sleepy: boolean
  segment: TgDaySegment | null
  leftovers: boolean
  frosty: boolean
  snowy: boolean
  hideTurkey: boolean
}) {
  const hw = HALF_W[stage]
  const seated = guests.filter((g) => g !== 'turkey')
  const hasTurkey = guests.includes('turkey') && !hideTurkey
  const toasting = segment === 'feast'

  const wrapGuest = (g: FeastGuest, node: React.ReactNode) =>
    g === arriving ? <g className="tg-arrive">{node}</g> : node

  // Stage 1: a lone stump with the first guest waiting beside it.
  if (stage === 1) {
    return (
      <g transform={FEAST_ZOOM}>
        <g transform={`translate(${TABLE_CX - 74}, 1060) scale(1.25)`}>
          {seated[0] && wrapGuest(seated[0], <Guest kind={seated[0]} sleepy={sleepy} />)}
        </g>
        <g transform={`translate(${TABLE_CX}, 1040)`}>
          <path d="M-40,34 L-30,-6 L30,-6 L40,34 Z" fill="#4a2d1b" />
          <ellipse cx="0" cy="-6" rx="32" ry="8" fill="#c7955d" stroke="#6b4226" strokeWidth="1.5" />
          <ellipse cx="0" cy="-6" rx="18" ry="4" fill="none" stroke="#8a5a32" strokeWidth="1" />
          <ellipse cx="-8" cy="-14" rx="11" ry="8" fill="#ea580c" />
          <path d="M-8,-21 L-6,-26" stroke="#3f6212" strokeWidth="2.4" strokeLinecap="round" />
          <g transform="translate(14, -10)">
            <Acorn r={0.8} />
          </g>
        </g>
      </g>
    )
  }

  const seatX = (i: number) =>
    seated.length === 1 ? TABLE_CX : TABLE_CX - hw * 0.8 + (i * (hw * 1.6)) / (seated.length - 1)

  return (
    <g transform={FEAST_ZOOM}>
      {/* Warm banquet glow on the big day */}
      {stage === 5 && (
        <ellipse
          cx={TABLE_CX}
          cy={TABLE_TOP}
          rx={hw + 90}
          ry="70"
          fill="url(#wdWarmOrb)"
          className={toasting || sleepy ? 'tg-glow' : undefined}
          opacity="0.6"
        />
      )}

      {/* Seated guests peek over the table top */}
      {seated.map((g, i) => (
        <g key={g} transform={`translate(${seatX(i)}, ${TABLE_TOP + 10}) scale(1.35)`}>
          {wrapGuest(
            g,
            <g>
              <Guest kind={g} sleepy={sleepy} flip={seatX(i) > TABLE_CX + 4} />
              {toasting && !sleepy && (
                <g className="tg-cup" style={{ animationDelay: `${i * 0.12}s` }}>
                  <g transform={`translate(${seatX(i) > TABLE_CX + 4 ? -16 : 16}, -10)`}>
                    <rect x="-3.5" y="-5" width="7" height="8" rx="1.5" fill="#92400e" />
                    <ellipse cx="0" cy="-5" rx="4.5" ry="1.6" fill="#fde68a" />
                  </g>
                </g>
              )}
              {sleepy && (
                <text
                  className="tg-zzz"
                  x="10"
                  y="-36"
                  fill="#e0f2fe"
                  fontFamily={CAVEAT}
                  fontSize="16"
                  fontWeight="700"
                  style={{ animationDelay: `${i * 0.6}s` }}
                >
                  z
                </text>
              )}
            </g>,
          )}
        </g>
      ))}

      {/* Table top, front edge and stump legs */}
      <rect x={TABLE_CX - hw - 10} y={TABLE_TOP} width={hw * 2 + 20} height="12" rx="4" fill="#a0703f" stroke="#5c3820" strokeWidth="1.5" />
      <rect x={TABLE_CX - hw - 6} y={TABLE_TOP + 12} width={hw * 2 + 12} height="8" rx="2" fill="#6b4226" />
      {[TABLE_CX - hw + 14, TABLE_CX + hw - 14].map((lx) => (
        <path key={lx} d={`M${lx - 15},1080 L${lx - 11},${TABLE_TOP + 20} L${lx + 11},${TABLE_TOP + 20} L${lx + 15},1080 Z`} fill="#4a2d1b" />
      ))}

      {/* Linen runner */}
      {stage >= 3 && (
        <path
          d={`M${TABLE_CX - hw * 0.78},${TABLE_TOP - 1} L${TABLE_CX + hw * 0.78},${TABLE_TOP - 1} L${TABLE_CX + hw * 0.78},${TABLE_TOP + 22} L${TABLE_CX + hw * 0.6},${TABLE_TOP + 17} L${TABLE_CX},${TABLE_TOP + 22} L${TABLE_CX - hw * 0.6},${TABLE_TOP + 17} L${TABLE_CX - hw * 0.78},${TABLE_TOP + 22} Z`}
          fill="#f3e3c3"
          opacity="0.8"
        />
      )}

      {/* Leaf garland on the front edge */}
      {stage >= 4 &&
        Array.from({ length: Math.floor(hw / 18) }, (_, i) => {
          const x = TABLE_CX - hw + 10 + i * 36
          return (
            <ellipse
              key={i}
              cx={x}
              cy={TABLE_TOP + 18 + (i % 2) * 3}
              rx="7"
              ry="4"
              fill={LEAF_COLORS[i % LEAF_COLORS.length]}
              transform={`rotate(${i % 2 ? 25 : -25} ${x} ${TABLE_TOP + 18})`}
            />
          )
        })}

      {/* Food arrives as the week goes on */}
      <g transform={`translate(${TABLE_CX - 100}, ${TABLE_TOP - 8})`}>
        <ellipse cx="0" cy="0" rx="14" ry="10" fill="#ea580c" />
        <path d="M-5,-9 Q0,0 -5,9 M5,-9 Q0,0 5,9" stroke="#c2410c" strokeWidth="1.2" fill="none" />
        <path d="M0,-10 L2,-15" stroke="#3f6212" strokeWidth="2.6" strokeLinecap="round" />
      </g>
      <g transform={`translate(${TABLE_CX + 92}, ${TABLE_TOP - 6})`}>
        <path d="M-16,-4 L16,-4 L12,6 L-12,6 Z" fill="#a16207" />
        <ellipse cx="-6" cy="-7" rx="7" ry="5" fill="#fbbf24" />
        <ellipse cx="6" cy="-8" rx="7" ry="5" fill="#f59e0b" />
      </g>
      {stage >= 3 && (
        <>
          <g transform={`translate(${TABLE_CX - 30}, ${TABLE_TOP - 4})`}>
            <Pie half={leftovers} />
          </g>
          <g transform={`translate(${TABLE_CX + 30}, ${TABLE_TOP - 5})`}>
            <path d="M-10,-4 Q0,8 10,-4 Z" fill="#f8fafc" />
            {!leftovers && <ellipse cx="0" cy="-4" rx="10" ry="3" fill="#b91c1c" />}
          </g>
          <g transform={`translate(${TABLE_CX + 168}, ${TABLE_TOP - 6}) rotate(-12)`}>
            <ellipse cx="0" cy="0" rx="14" ry="5" fill="#facc15" />
            <path d="M-14,0 C-20,-6 -22,4 -14,2" fill="#65a30d" />
          </g>
        </>
      )}
      {stage >= 4 &&
        [TABLE_CX - 200, TABLE_CX + 220].map((x) => (
          <g key={x} transform={`translate(${x}, ${TABLE_TOP - 2})`}>
            <rect x="-3" y="-18" width="6" height="18" fill="#fef3c7" />
            <circle cx="0" cy="-26" r="12" fill="url(#wdWarmOrb)" opacity="0.8" />
            <path className="tg-candle" d="M0,-30 C4,-24 3,-20 0,-19 C-3,-20 -4,-24 0,-30 Z" fill="#fbbf24" />
          </g>
        ))}
      {stage >= 4 && (
        <g transform={`translate(${TABLE_CX - 160}, ${TABLE_TOP - 5})`}>
          <path d="M-12,-2 L12,-2 L9,6 L-9,6 Z" fill="#78350f" />
          <circle cx="-5" cy="-6" r="5" fill="#dc2626" />
          <circle cx="5" cy="-6" r="5" fill="#b91c1c" />
          <circle cx="0" cy="-11" r="5" fill="#ef4444" />
        </g>
      )}
      {stage === 5 && (
        <g transform={`translate(${TABLE_CX + 252}, ${TABLE_TOP - 8})`}>
          {/* Cornucopia */}
          <path d="M22,4 C10,-18 -16,-16 -22,0 C-14,-6 0,-6 8,6 Z" fill="#a16207" />
          <circle cx="-18" cy="-2" r="5" fill="#ea580c" />
          <circle cx="-12" cy="-8" r="4.5" fill="#dc2626" />
          <circle cx="-22" cy="-9" r="4" fill="#facc15" />
        </g>
      )}

      {(frosty || snowy) && (
        <path
          d={`M${TABLE_CX - hw - 10},${TABLE_TOP + 1} L${TABLE_CX + hw + 10},${TABLE_TOP + 1}`}
          stroke={snowy ? '#f8fafc' : 'rgba(219, 238, 255, 0.6)'}
          strokeWidth={snowy ? '4' : '1.8'}
        />
      )}

      {/* Guest of honour: the turkey stands at the head of the table (it's a friend, not dinner!) */}
      {hasTurkey && (
        <g transform={`translate(${TABLE_CX - hw - 48}, 1046) scale(1.35)`}>
          {wrapGuest(
            'turkey',
            <g className={sleepy ? undefined : 'wd-breathe'} style={{ transformOrigin: '0px 16px' }}>
              <TurkeySprite sleepy={sleepy} facing="right" />
              {sleepy && (
                <text className="tg-zzz" x="-4" y="-36" fill="#e0f2fe" fontFamily={CAVEAT} fontSize="18" fontWeight="700">
                  Zzz
                </text>
              )}
            </g>,
          )}
        </g>
      )}
    </g>
  )
}

/* ───────────────────────────── Thankful Tree ───────────────────────────── */

const TREE_X = 1592
const TREE_LEAVES: Array<[number, number]> = [
  [-42, -40], [-26, -62], [-6, -74], [16, -70], [36, -56], [48, -34],
  [-50, -16], [-30, -30], [-10, -48], [12, -46], [30, -30], [40, -10],
  [-22, -8], [20, -12],
]
export const THANKFUL_TREE_SLOTS = TREE_LEAVES.length

export function ThankfulTree({ filled, glowing, frosty }: { filled: number; glowing: boolean; frosty: boolean }) {
  const base = 1060
  const cy = 966
  return (
    <g>
      {glowing && <circle cx={TREE_X} cy={cy - 36} r="92" fill="url(#wdWarmOrb)" className="tg-glow" />}
      {filled > 0 && !glowing && <circle cx={TREE_X} cy={cy - 36} r="70" fill="url(#wdWarmOrb)" opacity="0.4" />}
      <g stroke="#4a2d1b" strokeLinecap="round" fill="none">
        <path d={`M${TREE_X},${base} C${TREE_X - 3},${cy + 40} ${TREE_X + 4},${cy + 10} ${TREE_X},${cy - 20}`} strokeWidth="9" />
        <path d={`M${TREE_X},${cy + 6} C${TREE_X - 18},${cy - 6} ${TREE_X - 34},${cy - 20} ${TREE_X - 44},${cy - 40}`} strokeWidth="5" />
        <path d={`M${TREE_X},${cy - 2} C${TREE_X + 16},${cy - 12} ${TREE_X + 32},${cy - 22} ${TREE_X + 44},${cy - 34}`} strokeWidth="5" />
        <path d={`M${TREE_X},${cy - 18} C${TREE_X - 6},${cy - 40} ${TREE_X - 6},${cy - 56} ${TREE_X - 4},${cy - 72}`} strokeWidth="4" />
        <path d={`M${TREE_X - 24},${cy - 20} L${TREE_X - 28},${cy - 58}`} strokeWidth="3" />
        <path d={`M${TREE_X + 22},${cy - 16} L${TREE_X + 30},${cy - 52}`} strokeWidth="3" />
      </g>
      {frosty && <path d={`M${TREE_X - 44},${cy - 42} L${TREE_X + 44},${cy - 36}`} stroke="rgba(224,242,254,0.5)" strokeWidth="1.4" />}
      {TREE_LEAVES.map(([dx, dy], i) => {
        const on = glowing || i < filled
        const x = TREE_X + dx
        const y = cy + dy
        return on ? (
          <ellipse
            key={i}
            cx={x}
            cy={y}
            rx="10"
            ry="6.5"
            transform={`rotate(${(i * 47) % 360} ${x} ${y})`}
            fill={glowing && i >= filled ? '#facc15' : LEAF_COLORS[i % LEAF_COLORS.length]}
            stroke="#fde68a"
            strokeWidth="0.8"
          />
        ) : (
          <circle key={i} cx={x} cy={y} r="2.6" fill="#86efac" opacity="0.55" />
        )
      })}
      {/* Little name tag */}
      <g transform={`translate(${TREE_X}, ${base - 12})`}>
        <rect x="-30" y="-9" width="60" height="16" rx="4" fill="#faf1dc" stroke="#b47b2a" strokeWidth="1" />
        <text x="0" y="3" textAnchor="middle" fill="#78350f" fontFamily={CAVEAT} fontSize="13" fontWeight="700">
          Thankful Tree
        </text>
      </g>
    </g>
  )
}

/* ───────────────────────────── Hide-and-seek turkey ───────────────────────────── */

export const HIDE_SPOT_GEOMETRY: Record<HideSpot, { x: number; y: number; s: number; facing: 'left' | 'right'; layer: 'back' | 'front' }> = {
  trunk_left: { x: 196, y: 790, s: 0.95, facing: 'right', layer: 'back' },
  trunk_right: { x: 1732, y: 790, s: 0.95, facing: 'left', layer: 'back' },
  owl_branch: { x: 296, y: 196, s: 0.72, facing: 'left', layer: 'front' },
  leaf_pile: { x: 650, y: 1060, s: 0.9, facing: 'right', layer: 'front' },
  sign_top: { x: 384, y: 242, s: 0.62, facing: 'left', layer: 'front' },
}

export function HiddenTurkey({ spot, foundRun }: { spot: HideSpot; foundRun: number | null }) {
  const g = HIDE_SPOT_GEOMETRY[spot]
  return (
    <g transform={`translate(${g.x}, ${g.y}) scale(${g.s})`}>
      <g key={foundRun ?? 'idle'} className={foundRun ? 'tg-found' : 'tg-peek'}>
        <TurkeySprite facing={g.facing} />
      </g>
      {spot === 'leaf_pile' && (
        <g>
          {Array.from({ length: 11 }, (_, i) => {
            const x = -44 + i * 9
            const y = 14 - Math.abs(i - 5) * 3.2
            return (
              <ellipse
                key={i}
                cx={x}
                cy={y + 8}
                rx="14"
                ry="8"
                fill={LEAF_COLORS[(i * 2) % LEAF_COLORS.length]}
                transform={`rotate(${(i * 37) % 80 - 40} ${x} ${y + 8})`}
              />
            )
          })}
        </g>
      )}
    </g>
  )
}

/* ───────────────────────────── Confetti ───────────────────────────── */

export function ConfettiBurst({ x, y, count = 16, delay = 0 }: { x: number; y: number; count?: number; delay?: number }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      {Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2
        const d = 70 + (i % 3) * 28
        const style = {
          '--dx': `${Math.cos(a) * d}px`,
          '--dy': `${Math.sin(a) * d - 30}px`,
          '--rot': `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
          animationDelay: `${delay}s`,
        } as React.CSSProperties
        return (
          <rect
            key={i}
            className="tg-confetti"
            x="-3"
            y="-5"
            width="6"
            height="10"
            rx="1.5"
            fill={['#f59e0b', '#dc2626', '#16a34a', '#facc15', '#ea580c', '#f8fafc'][i % 6]}
            style={style}
          />
        )
      })}
    </g>
  )
}

/* ───────────────────────────── Feed-the-turkey acorns ───────────────────────────── */

export interface FallingAcorn {
  id: number
  x: number
  delay: number
}

export function FeedAcorns({ acorns }: { acorns: FallingAcorn[] }) {
  return (
    <g>
      {acorns.map((a) => (
        <g key={a.id} transform={`translate(${a.x}, 1058)`}>
          <circle cx="0" cy="0" r="20" fill="url(#wdWarmOrb)" className="tg-glow" />
          <g className="tg-acorn-fall" style={{ animationDelay: `${a.delay}s` }}>
            <Acorn r={1.5} />
          </g>
        </g>
      ))}
    </g>
  )
}

/* ───────────────────────────── Show-time interludes ───────────────────────────── */

/** 🦃 Turkey Trot Parade marching across the forest floor. */
export function TurkeyTrotParade() {
  const member = (x: number, node: React.ReactNode, cls = 'tg-march', delay = 0) => (
    <g transform={`translate(${x}, 1070) scale(1.7)`}>
      <g className={cls} style={{ animationDelay: `${delay}s` }}>
        {node}
      </g>
    </g>
  )
  return (
    <g className="tg-parade">
      {/* Drum-major turkey with twirling baton */}
      {member(
        0,
        <g>
          <TurkeySprite facing="right" />
          <g transform="translate(22, -16)">
            <g className="tg-twirl">
              <rect x="-15" y="-1.5" width="30" height="3" rx="1.5" fill="#fde68a" />
              <circle cx="-15" cy="0" r="3" fill="#dc2626" />
              <circle cx="15" cy="0" r="3" fill="#dc2626" />
            </g>
          </g>
        </g>,
      )}
      {/* Squirrel with a corn flag */}
      {member(
        -160,
        <g>
          <path d="M14,-4 L14,-58" stroke="#78350f" strokeWidth="2.4" />
          <path d="M14,-58 L44,-50 L14,-40 Z" fill="#facc15" stroke="#ca8a04" strokeWidth="1" />
          <text x="22" y="-45" fontSize="10">🌽</text>
          <CuteSquirrelSprite />
        </g>,
        'tg-march',
        0.1,
      )}
      {/* Fox carrying a pie */}
      {member(
        -330,
        <g>
          <FoxSprite />
          <g transform="translate(30, -28)">
            <Pie />
          </g>
        </g>,
        'tg-march',
        0.2,
      )}
      {member(-480, <BunnySprite />, 'tg-hop', 0)}
      {member(-590, <BunnySprite />, 'tg-hop', 0.2)}
      {/* Hedgehog drummer */}
      {member(
        -730,
        <g>
          <HedgehogSprite />
          <g transform="translate(20, 2)">
            <rect x="-9" y="-10" width="18" height="12" rx="2" fill="#dc2626" stroke="#fde68a" strokeWidth="1.2" />
            <path d="M-9,-10 L9,2 M9,-10 L-9,2" stroke="#fde68a" strokeWidth="0.8" />
          </g>
        </g>,
        'tg-march',
        0.15,
      )}
    </g>
  )
}

/** 🍂 Leaf tornado that sweeps across as the next photo arrives. */
export function LeafTornado({ count }: { count: number }) {
  return (
    <g>
      {Array.from({ length: count }, (_, i) => {
        const y = 90 + ((i * 137) % 900)
        const delay = (i / count) * 2.0
        const scale = 0.8 + ((i * 7) % 5) * 0.18
        return (
          <g key={i} transform={`translate(0, ${y})`}>
            <g className="tg-swirl" style={{ animationDelay: `${delay}s` }}>
              <g className="tg-wave" style={{ animationDelay: `${-(i % 4) * 0.3}s` }}>
                <path
                  className="tg-spin"
                  d={`M0,${-20 * scale} C${15 * scale},${-10 * scale} ${15 * scale},${10 * scale} 0,${20 * scale} C${-15 * scale},${10 * scale} ${-15 * scale},${-10 * scale} 0,${-20 * scale} Z`}
                  fill={LEAF_COLORS[i % LEAF_COLORS.length]}
                  style={{ animationDuration: `${0.6 + (i % 3) * 0.25}s` }}
                />
              </g>
            </g>
          </g>
        )
      })}
    </g>
  )
}

/** 🎈 Pumpkin (or giant turkey) parade balloon drifting across the sky. */
export function ParadeBalloon({ variant }: { variant: 'pumpkin' | 'turkey' }) {
  return (
    <g className="tg-balloon">
      <g className="tg-bob">
        {variant === 'pumpkin' ? (
          <g>
            <ellipse cx="-34" cy="0" rx="34" ry="52" fill="#c2410c" />
            <ellipse cx="34" cy="0" rx="34" ry="52" fill="#c2410c" />
            <ellipse cx="0" cy="0" rx="40" ry="56" fill="#ea580c" />
            <path d="M-16,-54 Q-22,0 -16,54 M16,-54 Q22,0 16,54" stroke="#9a3412" strokeWidth="2" fill="none" />
            <path d="M0,-56 C-2,-66 4,-72 10,-72" stroke="#3f6212" strokeWidth="6" strokeLinecap="round" fill="none" />
            <path d="M-18,-12 L-8,-22 L2,-12 Z M8,-12 L18,-22 L28,-12 Z" fill="#fde68a" opacity="0.9" />
            <path d="M-22,14 Q4,34 30,14 Q4,24 -22,14 Z" fill="#fde68a" opacity="0.9" />
          </g>
        ) : (
          <g transform="scale(2.6)">
            <TurkeySprite facing="right" />
          </g>
        )}
        <path d="M-30,48 L-14,86 M30,48 L14,86" stroke="#78350f" strokeWidth="1.6" />
        <rect x="-18" y="86" width="36" height="22" rx="3" fill="#a16207" stroke="#78350f" strokeWidth="1.4" />
        <path d="M-18,94 L18,94" stroke="#78350f" strokeWidth="1" />
        <g transform="translate(2, 92) scale(0.9)">
          <CuteSquirrelSprite />
        </g>
      </g>
    </g>
  )
}

/** 🥧 Squirrel tosses a pie — fox pops out of the den and gets it right in the face. */
export function PieToss() {
  return (
    <g>
      <g transform="translate(560, 1062) scale(1.3)">
        <g className="tg-pie-squirrel">
          <CuteSquirrelSprite />
        </g>
      </g>
      <g className="tg-pie-arc">
        <g className="tg-spin" style={{ animationDuration: '0.7s' }}>
          <Pie />
        </g>
      </g>
      <g transform="translate(1738, 952) scale(1.45)">
        <g className="tg-pie-fox">
          <g transform="scale(-1, 1)">
            <FoxSprite />
          </g>
        </g>
      </g>
      <g transform="translate(1706, 924)">
        <g className="tg-splat">
          <circle cx="0" cy="0" r="13" fill="#fef3c7" />
          <circle cx="-14" cy="6" r="7" fill="#fef3c7" />
          <circle cx="12" cy="9" r="6" fill="#fef3c7" />
          <circle cx="4" cy="-12" r="5" fill="#fde68a" />
          <circle cx="-8" cy="-4" r="3" fill="#d97706" />
          <circle cx="7" cy="2" r="2.5" fill="#d97706" />
          <text x="-120" y="-36" fill="#fff7ed" stroke="#7c2d12" strokeWidth="1.2" fontFamily={CAVEAT} fontSize="42" fontWeight="700">
            Splat! 🥧
          </text>
        </g>
      </g>
    </g>
  )
}

/** 🏈 Fox throws an acorn football — squirrel dives for the catch — TOUCHDOWN! */
export function AcornFootball() {
  return (
    <g>
      <g transform="translate(1738, 952) scale(1.45)">
        <g className="tg-fb-fox">
          <g transform="scale(-1, 1)">
            <FoxSprite />
          </g>
        </g>
      </g>
      <g className="tg-fb-ball">
        <g className="tg-spin" style={{ animationDuration: '0.5s' }}>
          <g transform="rotate(90)">
            <Acorn r={1.5} />
          </g>
        </g>
      </g>
      <g className="tg-fb-squirrel">
        <g transform="scale(1.35)">
          <CuteSquirrelSprite />
          <g className="tg-fb-held">
            <g transform="translate(18, -8) rotate(90)">
              <Acorn r={1} />
            </g>
          </g>
        </g>
      </g>
      <g transform="translate(960, 940)">
        <g className="tg-fb-banner">
          <rect x="-200" y="-40" width="400" height="74" rx="18" fill="#15803d" stroke="#fde68a" strokeWidth="4" />
          <text x="0" y="12" textAnchor="middle" fill="#fff" fontFamily={CAVEAT} fontSize="50" fontWeight="700">
            🏈 TOUCHDOWN! 🏈
          </text>
        </g>
      </g>
      <ConfettiBurst x={960} y={930} count={18} delay={4.8} />
    </g>
  )
}

/** 💃 Full turkey does a happy dance after 10 acorns. */
export function TurkeyDance() {
  return (
    <g>
      <g transform={`translate(${TABLE_CX}, 1050)`}>
        <g className="tg-fade-stage">
          <g transform="scale(1.7)">
            <g className="tg-dance">
              <TurkeySprite />
            </g>
          </g>
          {[-60, 50, -20, 70].map((dx, i) => (
            <text
              key={i}
              className="tg-note"
              x={dx}
              y="-60"
              fill="#fde68a"
              fontSize="28"
              style={{ animationDelay: `${i * 0.45}s`, '--dx': `${dx > 0 ? 20 : -20}px` } as React.CSSProperties}
            >
              {i % 2 ? '♫' : '♪'}
            </text>
          ))}
        </g>
      </g>
      <ConfettiBurst x={TABLE_CX} y={980} count={20} delay={0.3} />
    </g>
  )
}
