import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type React from 'react'
import { autumnVisits } from '../../lib/autumnAmbience'
import type { SkyKind, SkyPhase } from '../sky/skyEngine'
import type { Quality } from '../sky/useQuality'
import {
  Acorn,
  Cook,
  Crow,
  Deer,
  FALL_LEAF_COLORS,
  Football,
  Fox,
  Kid,
  LeafSvg,
  MiniTurkey,
  Raccoon,
  Scarecrow,
  Squirrel,
  TurkeyFigure,
} from './FallCritters'
import { GRATITUDE_TREE_X, LEAF_PILE_X, PIE_EVENT } from './FallHorizonExtras'
import { getQueryParam } from '../sky/queryParam'
import { dayHash, fallProgress, isThanksgivingDay, todayKey } from './fallDates'

// DOM layer for the November scene: scripted visitors, the scarecrow, the
// hidden acorn, Thanksgiving turkey spotting, gratitude cards, the tap-to-
// summon strip and the leaf-wipe slide transition.
//
// Kiosk rules: CSS transform/opacity keyframes only, no geometry reads,
// timers instead of rAF, one visitor at a time via the shared autumn gate,
// and the whole layer is unmounted while the slideshow is paused.

export const SUMMON_EVENT = 'fall-summon'

export interface GratitudeNote {
  text: string
  author?: string
}

type VisitorId = 'kids' | 'fox' | 'crow' | 'deer' | 'raccoon' | 'disguise' | 'football' | 'bonk' | 'chase'

interface Ctx {
  phase: SkyPhase
  kind: SkyKind
  progress: number
  tgWeek: boolean
  tgDay: boolean
}

const VISITORS: Record<VisitorId, { ms: number; ok: (c: Ctx) => boolean }> = {
  kids: { ms: 9_000, ok: (c) => (c.phase === 'day' || c.phase === 'dawn') && !isWet(c.kind) },
  fox: { ms: 10_000, ok: (c) => c.phase === 'dusk' || c.phase === 'dawn' },
  crow: { ms: 8_000, ok: (c) => c.phase === 'day' },
  deer: { ms: 12_000, ok: (c) => c.phase === 'dawn' || c.phase === 'dusk' },
  raccoon: { ms: 10_000, ok: (c) => c.phase === 'night' && (c.progress >= 0.45 || c.tgDay) },
  disguise: { ms: 12_000, ok: (c) => c.tgWeek && (c.phase === 'day' || c.phase === 'dawn') },
  football: { ms: 6_000, ok: (c) => c.tgDay && (c.phase === 'day' || c.phase === 'dawn') && !isWet(c.kind) },
  bonk: { ms: 8_000, ok: (c) => c.phase === 'day' || c.phase === 'dawn' },
  chase: { ms: 7_000, ok: (c) => c.phase === 'day' || c.phase === 'dawn' },
}

function isWet(kind: SkyKind) {
  return kind === 'rainy' || kind === 'stormy'
}

const vw = (x: number) => `${((x / 1920) * 100).toFixed(2)}vw`
const pctLeft = (x: number) => `${((x / 1920) * 100).toFixed(2)}%`
const SCARECROW_X = 1020

function readLS(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function writeLS(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage full / disabled */
  }
}

/** Advances through script beats on timers (no rAF). */
function useBeats(times: number[]): number {
  const [beat, setBeat] = useState(0)
  useEffect(() => {
    const ts = times.map((t, i) => setTimeout(() => setBeat(i + 1), t))
    return () => ts.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return beat
}

const anim = (name: string, ms: number, extra = '', delayMs = 0) => `${name} ${ms}ms ${extra || 'linear'} ${delayMs}ms both`
const mirror: React.CSSProperties = { transform: 'scaleX(-1)' }

function Bubble({ text, left, bottom }: { text: string; left: number; bottom: number }) {
  return (
    <div
      className="absolute rounded-full bg-white text-stone-900 font-black text-lg leading-none px-2 py-1 shadow"
      style={{ left, bottom, animation: 'fallPop 260ms ease-out both' }}
    >
      {text}
    </div>
  )
}

/* ─────────────── Visitors ─────────────── */

function KidsLeafJump({ burst }: { burst: boolean }) {
  const leaves = useMemo(
    () =>
      Array.from({ length: 15 }, (_, i) => ({
        dx: Math.round((Math.random() - 0.5) * 220),
        dy: -Math.round(60 + Math.random() * 90),
        r: Math.round((Math.random() - 0.5) * 540),
        c: FALL_LEAF_COLORS[i % FALL_LEAF_COLORS.length],
        d: Math.round(Math.random() * 200),
      })),
    [],
  )
  return (
    <>
      <div className="absolute left-0" style={{ bottom: 8, animation: anim('fallKidJump', 9_000) }}>
        <Kid variant="girl" />
      </div>
      <div className="absolute left-0" style={{ bottom: 6, marginLeft: -44, animation: anim('fallKidJump', 9_000, '', 350) }}>
        <Kid variant="boy" />
      </div>
      {burst &&
        leaves.map((l, i) => (
          <div
            key={i}
            className="absolute"
            style={
              {
                left: pctLeft(LEAF_PILE_X),
                bottom: 18,
                '--dx': `${l.dx}px`,
                '--dy': `${l.dy}px`,
                '--r': `${l.r}deg`,
                animation: `fallBurst 2400ms ease-out ${4_100 + l.d}ms both`,
              } as React.CSSProperties
            }
          >
            <LeafSvg color={l.c} size={16} />
          </div>
        ))}
    </>
  )
}

function FoxMousing() {
  const beat = useBeats([3_500, 7_200])
  return (
    <div className="absolute left-0" style={{ bottom: 10, animation: anim('fallFoxX', 10_000) }}>
      <div className={beat === 1 ? 'fall-still' : undefined} style={{ animation: anim('fallFoxPounce', 10_000) }}>
        <div style={mirror}>
          <Fox />
        </div>
      </div>
    </div>
  )
}

function CrowGag({ onTurn }: { onTurn: (turned: boolean) => void }) {
  const beat = useBeats([2_000, 4_600, 4_900, 7_000])
  useEffect(() => {
    if (beat === 2) onTurn(true)
    if (beat === 4) onTurn(false)
  }, [beat, onTurn])
  useEffect(() => () => onTurn(false), [onTurn])
  return (
    <div className="absolute left-0" style={{ bottom: 124, marginLeft: -16, animation: anim('fallCrowPath', 8_000, 'ease-in-out') }}>
      <div style={mirror}>
        <Crow flapping={beat === 0 || beat >= 3} />
      </div>
      {beat === 3 && <Bubble text="!" left={6} bottom={30} />}
    </div>
  )
}

function DeerPair() {
  const beat = useBeats([4_200, 7_400])
  const grazing = beat === 1 ? 'fall-grazing fall-still' : ''
  return (
    <>
      <div className="absolute left-0" style={{ bottom: 78, animation: anim('fallDeerX', 12_000) }}>
        <div className={grazing} style={{ transform: 'scale(-0.72, 0.72)', transformOrigin: 'bottom center' }}>
          <Deer />
        </div>
      </div>
      <div className="absolute left-0" style={{ bottom: 78, marginLeft: 46, animation: anim('fallDeerX', 12_000, '', 500) }}>
        <div className={grazing} style={{ transform: 'scale(-0.72, 0.72)', transformOrigin: 'bottom center' }}>
          <Deer fawn />
        </div>
      </div>
    </>
  )
}

function RaccoonPieHeist() {
  const beat = useBeats([3_800, 4_400, 5_600])
  useEffect(() => {
    if (beat === 2) window.dispatchEvent(new CustomEvent(PIE_EVENT, { detail: { hidden: true } }))
  }, [beat])
  return (
    <div className="absolute left-0" style={{ bottom: 34, animation: anim('fallRaccoonX', 10_000) }}>
      <div className={beat === 1 || beat === 2 ? 'fall-still' : undefined} style={{ animation: anim('fallRaccoonStretch', 10_000), transformOrigin: 'bottom center' }}>
        <div style={beat >= 3 ? undefined : mirror}>
          <Raccoon withPie={beat >= 2} />
        </div>
      </div>
    </div>
  )
}

function TurkeyDisguise() {
  // 3.0s arrive · 3.6 "!" · 4.4 disguise · 5.0 cook "?" · 8.2 cook leaves · 8.6 dance · 9.8 flee
  const beat = useBeats([3_000, 3_600, 4_400, 5_000, 8_200, 8_600, 9_800])
  const disguised = beat >= 3
  const still = beat >= 1 && beat < 7
  return (
    <>
      <div className="absolute left-0" style={{ bottom: 32, animation: anim('fallCookX', 12_000) }}>
        <div className={beat >= 1 && beat < 5 ? 'fall-still' : undefined} style={beat >= 5 ? undefined : mirror}>
          <Cook />
        </div>
        {beat >= 4 && beat < 5 && <Bubble text="?" left={10} bottom={78} />}
      </div>
      <div className="absolute left-0" style={{ bottom: 22, animation: anim('fallTurkeyDisguiseX', 12_000) }}>
        <div className={still ? 'fall-still' : undefined}>
          <div style={{ animation: beat === 6 ? 'fallDance 400ms ease-in-out infinite' : undefined, transformOrigin: 'bottom center' }}>
            <div style={beat >= 7 ? mirror : undefined}>
              <TurkeyFigure disguise={disguised} />
            </div>
          </div>
        </div>
        {beat === 2 && <Bubble text="!" left={40} bottom={70} />}
      </div>
    </>
  )
}

function FootballToss({ intercept }: { intercept: boolean }) {
  const beat = useBeats([3_600])
  if (!intercept) {
    return (
      <div className="absolute left-0" style={{ bottom: 70, animation: anim('fallBallX', 6_000) }}>
        <div style={{ animation: 'fallBallY 6000ms both' }}>
          <div style={{ animation: 'fallSpin 450ms linear infinite' }}>
            <Football />
          </div>
        </div>
      </div>
    )
  }
  return (
    <>
      {beat === 0 && (
        <div className="absolute left-0" style={{ bottom: 70, animation: anim('fallBallXShort', 3_600) }}>
          <div style={{ animation: 'fallBallYShort 3600ms both' }}>
            <div style={{ animation: 'fallSpin 450ms linear infinite' }}>
              <Football />
            </div>
          </div>
        </div>
      )}
      <div className="absolute left-0" style={{ bottom: 12, animation: anim('fallTurkeyCatch', 6_000) }}>
        <div className={beat === 0 ? 'fall-still' : undefined} style={beat === 0 ? mirror : undefined}>
          <TurkeyFigure />
        </div>
        {beat === 1 && (
          <div className="absolute" style={{ left: 18, bottom: 22 }}>
            <Football />
          </div>
        )}
      </div>
    </>
  )
}

function SquirrelBonk() {
  const beat = useBeats([3_200, 4_000, 5_800])
  return (
    <>
      <div className="absolute left-0" style={{ bottom: 18, animation: anim('fallBonkX', 8_000) }}>
        <div className={beat === 1 || beat === 2 ? 'fall-still' : undefined} style={{ animation: beat === 2 ? 'fallDizzy 500ms ease-in-out infinite' : undefined, transformOrigin: 'bottom center' }}>
          <Squirrel />
        </div>
        {beat === 2 && (
          <div className="absolute text-amber-200 font-black text-sm" style={{ left: 22, bottom: 40, animation: 'fallSpin 900ms linear infinite' }}>
            ✦ ✧
          </div>
        )}
      </div>
      {beat < 3 && (
        <div className="absolute" style={{ left: `calc(${pctLeft(1530)} + 30px)`, bottom: 50, animation: 'fallAcornDrop 8000ms both' }}>
          <Acorn size={14} />
        </div>
      )}
    </>
  )
}

function SquirrelChase() {
  return (
    <>
      <div className="absolute left-0" style={{ bottom: 18, animation: anim('fallChaseX', 7_000) }}>
        <div style={{ animation: 'fallSpin 700ms linear infinite' }}>
          <Acorn size={14} />
        </div>
      </div>
      <div className="absolute left-0" style={{ bottom: 16, marginLeft: -70, animation: anim('fallChaseX', 7_000, '', 500) }}>
        <div style={{ animation: 'fallHop 380ms ease-in-out infinite' }}>
          <Squirrel />
        </div>
      </div>
    </>
  )
}

/* ─────────────── Interactives ─────────────── */

const ACORN_SPOTS: Array<[number, number]> = [
  [160, 160], [392, 166], [640, 166], [905, 164], [1172, 166], [1468, 150], [1596, 164], [1790, 166], [520, 150], [1290, 160],
]
const TURKEY_SPOTS: Array<[number, number]> = [
  [300, 150], [612, 152], [860, 156], [1180, 150], [1440, 146], [1720, 152],
]

function ToastPill({ text }: { text: string }) {
  return (
    <div
      className="absolute left-1/2 z-[32] rounded-full bg-[#fbf4e4] text-[#5b2a0a] px-6 py-3 text-2xl font-semibold shadow-xl pointer-events-none"
      style={{ bottom: 196, fontFamily: "'Caveat', cursive", animation: 'fallToast 2800ms ease-out both' }}
    >
      {text}
    </div>
  )
}

function GratitudeCard({ note }: { note: GratitudeNote }) {
  return (
    <>
      <div className="absolute left-1/2 z-[32] pointer-events-none" style={{ top: '18%', animation: 'fallLeafDrift 1800ms ease-in both' }}>
        <LeafSvg color="#ea580c" size={40} />
      </div>
      <div
        className="absolute left-1/2 z-[32] max-w-[640px] w-[min(640px,80vw)] rounded-[28px] bg-[#fbf4e4] px-9 py-6 text-center shadow-2xl pointer-events-none"
        style={{ bottom: 200, animation: 'fallCard 8800ms ease-out 1600ms both', border: '1px solid rgba(161,98,7,0.25)' }}
      >
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-[#a16207]">🍂 We're thankful for</div>
        <div className="mt-2 text-[44px] leading-tight text-[#5b2a0a]" style={{ fontFamily: "'Caveat', cursive" }}>
          {note.text}
        </div>
        {note.author && (
          <div className="mt-1 text-2xl text-[#92400e]" style={{ fontFamily: "'Caveat', cursive" }}>
            — {note.author}
          </div>
        )}
      </div>
    </>
  )
}

function LeafWipe() {
  const leaves = useMemo(
    () =>
      Array.from({ length: 24 }, (_, i) => ({
        top: Math.round(Math.random() * 92),
        delay: Math.round((i / 24) * 900 + Math.random() * 300),
        dur: Math.round(1300 + Math.random() * 600),
        size: Math.round(18 + Math.random() * 22),
        c: FALL_LEAF_COLORS[i % FALL_LEAF_COLORS.length],
        r: Math.round(360 + Math.random() * 540),
      })),
    [],
  )
  return (
    <div className="absolute inset-0 z-[22] pointer-events-none overflow-hidden" aria-hidden="true">
      {leaves.map((l, i) => (
        <div
          key={i}
          className="absolute left-0"
          style={{ top: `${l.top}%`, '--r': `${l.r}deg`, animation: `fallWipe ${l.dur}ms ease-in ${l.delay}ms both` } as React.CSSProperties}
        >
          <LeafSvg color={l.c} size={l.size} />
        </div>
      ))}
    </div>
  )
}

/* ─────────────── Overlay ─────────────── */

export function FallOverlay({
  phase,
  kind,
  date,
  quality,
  thanksgivingWeek,
  slideKey,
  onPop,
  notes,
}: {
  phase: SkyPhase
  kind: SkyKind
  date: Date
  quality: Quality
  thanksgivingWeek: boolean
  slideKey: number
  onPop: () => void
  notes: GratitudeNote[]
}) {
  const tgDay = isThanksgivingDay(date)
  const progress = fallProgress(date)
  const key = todayKey(date)
  const ctxRef = useRef<Ctx>({ phase, kind, progress, tgWeek: thanksgivingWeek, tgDay })
  ctxRef.current = { phase, kind, progress, tgWeek: thanksgivingWeek, tgDay }

  /* Visitor scheduler */
  const [visitor, setVisitor] = useState<{ id: VisitorId; run: number; intercept: boolean } | null>(null)
  const bagRef = useRef<VisitorId[]>([])
  const runRef = useRef(0)
  const endTimer = useRef<ReturnType<typeof setTimeout>>()
  const pieTimer = useRef<ReturnType<typeof setTimeout>>()

  const pick = useCallback((): VisitorId | null => {
    const ctx = ctxRef.current
    const eligible = (Object.keys(VISITORS) as VisitorId[]).filter((id) => VISITORS[id].ok(ctx))
    if (!eligible.length) return null
    bagRef.current = bagRef.current.filter((id) => eligible.includes(id))
    if (!bagRef.current.length) {
      bagRef.current = [...eligible].sort(() => Math.random() - 0.5)
    }
    return bagRef.current.shift() ?? null
  }, [])

  const start = useCallback((id: VisitorId) => {
    clearTimeout(endTimer.current)
    setVisitor({ id, run: ++runRef.current, intercept: Math.random() < 0.3 })
    if (id === 'raccoon') {
      clearTimeout(pieTimer.current)
      pieTimer.current = setTimeout(() => window.dispatchEvent(new CustomEvent(PIE_EVENT, { detail: { hidden: false } })), 24_000)
    }
    endTimer.current = setTimeout(() => setVisitor(null), VISITORS[id].ms + 200)
  }, [])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>
    const attempt = () => {
      timer = setTimeout(attempt, 5_000)
      if (document.hidden) return
      const ctx = ctxRef.current
      if (!(Object.keys(VISITORS) as VisitorId[]).some((id) => VISITORS[id].ok(ctx))) return
      const id = pick()
      if (id && autumnVisits.claim(performance.now(), VISITORS[id].ms)) start(id)
    }
    timer = setTimeout(attempt, 15_000)
    const onSummon = () => {
      const id = pick()
      if (id && autumnVisits.force(performance.now(), VISITORS[id].ms)) start(id)
    }
    window.addEventListener(SUMMON_EVENT, onSummon)
    // Preview hook: ?fallvisitor=fox (or kids, crow, deer, raccoon, disguise, football, bonk, chase).
    const forced = getQueryParam('fallvisitor') as VisitorId | null
    const forcedTimer = forced && forced in VISITORS ? setTimeout(() => start(forced), 1_500) : undefined
    return () => {
      clearTimeout(forcedTimer)
      clearTimeout(timer)
      clearTimeout(endTimer.current)
      clearTimeout(pieTimer.current)
      window.removeEventListener(SUMMON_EVENT, onSummon)
      window.dispatchEvent(new CustomEvent(PIE_EVENT, { detail: { hidden: false } }))
    }
  }, [pick, start])

  const [scarecrowTurned, setScarecrowTurned] = useState(false)

  /* Toasts */
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>()
  const showToast = useCallback((text: string) => {
    clearTimeout(toastTimer.current)
    setToast({ text, id: Date.now() })
    toastTimer.current = setTimeout(() => setToast(null), 2_900)
  }, [])
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  /* D1: hidden acorn */
  const [acornFound, setAcornFound] = useState(() => readLS('nivas_acorn_found') === key)
  useEffect(() => setAcornFound(readLS('nivas_acorn_found') === key), [key])
  const acornSpot = ACORN_SPOTS[dayHash(date, 'acorn') % ACORN_SPOTS.length]

  /* D3: turkey spotting */
  const turkeyKey = `nivas_turkeys_${key}`
  const [turkeyCount, setTurkeyCount] = useState(() => Number(readLS(turkeyKey)) || 0)
  useEffect(() => setTurkeyCount(Number(readLS(turkeyKey)) || 0), [turkeyKey])
  const [peek, setPeek] = useState<{ spot: [number, number]; id: number } | null>(null)
  const turkeysOn = thanksgivingWeek && (phase === 'day' || phase === 'dawn')
  useEffect(() => {
    if (!turkeysOn) {
      setPeek(null)
      return
    }
    let hide: ReturnType<typeof setTimeout>
    const show = () => {
      if (document.hidden) return
      setPeek({ spot: TURKEY_SPOTS[Math.floor(Math.random() * TURKEY_SPOTS.length)], id: Date.now() })
      clearTimeout(hide)
      hide = setTimeout(() => setPeek(null), 7_000)
    }
    const first = setTimeout(show, 20_000)
    const every = setInterval(show, 90_000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
      clearTimeout(hide)
    }
  }, [turkeysOn])

  /* C5: gratitude cards */
  const [card, setCard] = useState<{ note: GratitudeNote; id: number } | null>(null)
  const cardTimer = useRef<ReturnType<typeof setTimeout>>()
  const notesRef = useRef(notes)
  notesRef.current = notes
  const showGratitude = useCallback(() => {
    const list = notesRef.current
    if (!list.length || document.hidden) return
    const idx = (Number(readLS('nivas_gratitude_idx')) || 0) % list.length
    writeLS('nivas_gratitude_idx', String(idx + 1))
    clearTimeout(cardTimer.current)
    setCard({ note: list[idx], id: Date.now() })
    cardTimer.current = setTimeout(() => setCard(null), 10_600)
  }, [])
  useEffect(() => {
    if (!notes.length) return
    const first = setTimeout(showGratitude, 40_000)
    const every = setInterval(showGratitude, 150_000)
    return () => {
      clearTimeout(first)
      clearInterval(every)
      clearTimeout(cardTimer.current)
    }
  }, [notes.length, showGratitude])

  /* D2: tap-to-summon strip */
  const lastSummon = useRef(-Infinity)
  const [ripple, setRipple] = useState<{ x: number; id: number } | null>(null)
  const onStripTap = (e: React.MouseEvent) => {
    e.stopPropagation()
    onPop()
    setRipple({ x: e.clientX, id: Date.now() })
    const now = performance.now()
    if (now - lastSummon.current >= 20_000) {
      lastSummon.current = now
      window.dispatchEvent(new CustomEvent(SUMMON_EVENT))
    }
  }

  /* E1: leaf wipe between slides (skip the first slide) */
  const [wipe, setWipe] = useState<number | null>(null)
  const firstSlide = useRef(true)
  useEffect(() => {
    if (firstSlide.current) {
      firstSlide.current = false
      return
    }
    if (quality !== 'high') return
    setWipe(slideKey + Date.now())
    const t = setTimeout(() => setWipe(null), 2_600)
    return () => clearTimeout(t)
  }, [slideKey, quality])

  const tap = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onPop()
    fn()
  }

  const evening = phase === 'dusk' || phase === 'night'
  const v = visitor

  return (
    <>
      <style>{FALL_CSS}</style>
      {wipe !== null && <LeafWipe key={wipe} />}

      {/* Tap strip (lower horizon) — taps here summon a visitor instead of exiting */}
      <div className="absolute inset-x-0 bottom-0 h-28 z-[26] pointer-events-auto" onClick={onStripTap} aria-hidden="true">
        {ripple && (
          <span
            key={ripple.id}
            className="absolute bottom-6 h-14 w-14 -ml-7 rounded-full border-2 border-amber-100/80 pointer-events-none"
            style={{ left: ripple.x, animation: 'fallRipple 650ms ease-out both' }}
          />
        )}
      </div>

      {/* Stage: scarecrow, visitors, count board */}
      <div className={`absolute inset-0 z-[27] pointer-events-none overflow-hidden ${quality === 'low' ? 'fall-lowfx' : ''}`} aria-hidden="true">
        <div className="absolute" style={{ left: `calc(${pctLeft(SCARECROW_X)} - 30px)`, bottom: 42, filter: evening ? 'brightness(0.55)' : undefined }}>
          <Scarecrow turned={scarecrowTurned} />
        </div>

        {turkeyCount > 0 && evening && thanksgivingWeek && (
          <div
            className="absolute rounded-md border-[3px] border-[#7c4a21] bg-[#1f2a24] px-3 py-1.5 text-center text-amber-50 leading-tight shadow-lg"
            style={{ left: `calc(${pctLeft(1100)} - 70px)`, bottom: 30, width: 140, fontFamily: "'Caveat', cursive" }}
          >
            <div className="text-lg">You spotted</div>
            <div className="text-2xl font-bold">
              {turkeyCount} turkey{turkeyCount === 1 ? '' : 's'} 🦃
            </div>
            <div className="text-lg">today!</div>
          </div>
        )}

        {v?.id === 'kids' && <KidsLeafJump key={v.run} burst={quality === 'high'} />}
        {v?.id === 'fox' && <FoxMousing key={v.run} />}
        {v?.id === 'crow' && <CrowGag key={v.run} onTurn={setScarecrowTurned} />}
        {v?.id === 'deer' && <DeerPair key={v.run} />}
        {v?.id === 'raccoon' && <RaccoonPieHeist key={v.run} />}
        {v?.id === 'disguise' && <TurkeyDisguise key={v.run} />}
        {v?.id === 'football' && <FootballToss key={v.run} intercept={v.intercept} />}
        {v?.id === 'bonk' && <SquirrelBonk key={v.run} />}
        {v?.id === 'chase' && <SquirrelChase key={v.run} />}
      </div>

      {/* Tappable finds (above the tap strip) */}
      <div className="absolute inset-x-0 bottom-0 h-44 z-[28] pointer-events-none">
        {!acornFound && (
          <button
            type="button"
            aria-label="Hidden acorn"
            className="absolute flex h-12 w-12 -ml-6 items-center justify-center pointer-events-auto cursor-pointer"
            style={{ left: pctLeft(acornSpot[0]), bottom: 176 - acornSpot[1] - 14, filter: evening ? 'brightness(0.7)' : undefined }}
            onClick={tap(() => {
              writeLS('nivas_acorn_found', key)
              setAcornFound(true)
              showToast("You found today's acorn! 🐿️")
            })}
          >
            <Acorn size={17} />
          </button>
        )}

        {peek && (
          <button
            key={peek.id}
            type="button"
            aria-label="Peeking turkey"
            className="absolute flex h-14 w-14 -ml-7 items-end justify-center pointer-events-auto cursor-pointer"
            style={{ left: pctLeft(peek.spot[0]), bottom: 176 - peek.spot[1] - 10, animation: 'fallPeek 7000ms ease-in-out both' }}
            onClick={tap(() => {
              const next = turkeyCount + 1
              writeLS(turkeyKey, String(next))
              setTurkeyCount(next)
              setPeek(null)
              showToast(next === 1 ? '+1 🦃  You spotted a turkey!' : `+1 🦃  ${next} turkeys today!`)
            })}
          >
            <MiniTurkey />
          </button>
        )}

        {notes.length > 0 && (
          <button
            type="button"
            aria-label="Gratitude tree"
            className="absolute h-16 w-16 -ml-8 pointer-events-auto cursor-pointer"
            style={{ left: pctLeft(GRATITUDE_TREE_X), bottom: 40 }}
            onClick={tap(() => {
              if (!card) showGratitude()
            })}
          />
        )}
      </div>

      {card && <GratitudeCard key={card.id} note={card.note} />}
      {toast && <ToastPill key={toast.id} text={toast.text} />}
    </>
  )
}

const FALL_CSS = `
.fall-leg-a { animation: fallLegA 320ms ease-in-out infinite alternate; }
.fall-leg-b { animation: fallLegA 320ms ease-in-out infinite alternate-reverse; }
.fall-tail { animation: fallTail 900ms ease-in-out infinite alternate; }
.fall-ponytail { animation: fallTail 320ms ease-in-out infinite alternate; }
.fall-flap { animation: fallFlap 180ms ease-in-out infinite alternate; }
.fall-graze { transition: transform 600ms ease-in-out; }
.fall-grazing .fall-graze { transform: rotate(58deg); }
.fall-still .fall-leg-a, .fall-still .fall-leg-b { animation: none; }
.fall-lowfx .fall-tail, .fall-lowfx .fall-ponytail { animation: none; }

@keyframes fallLegA { from { transform: rotate(-24deg) } to { transform: rotate(24deg) } }
@keyframes fallTail { from { transform: rotate(-8deg) } to { transform: rotate(8deg) } }
@keyframes fallFlap { from { transform: scaleY(1) } to { transform: scaleY(-0.6) } }
@keyframes fallPop { from { transform: scale(0.3); opacity: 0 } to { transform: scale(1); opacity: 1 } }
@keyframes fallSpin { to { transform: rotate(360deg) } }
@keyframes fallHop { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-8px) } }
@keyframes fallDance { 0%,100% { transform: rotate(-10deg) translateY(0) } 50% { transform: rotate(10deg) translateY(-6px) } }
@keyframes fallDizzy { 0%,100% { transform: rotate(-7deg) } 50% { transform: rotate(7deg) } }
@keyframes fallRipple { from { transform: scale(0.3); opacity: 1 } to { transform: scale(1.8); opacity: 0 } }

@keyframes fallKidJump {
  0% { transform: translate(-6vw, 0) }
  30% { transform: translate(${vw(LEAF_PILE_X - 70)}, 0) }
  37% { transform: translate(${vw(LEAF_PILE_X - 30)}, -54px) }
  45% { transform: translate(${vw(LEAF_PILE_X - 10)}, 22px); opacity: 1 }
  47%, 63% { transform: translate(${vw(LEAF_PILE_X - 10)}, 22px); opacity: 0 }
  66% { transform: translate(${vw(LEAF_PILE_X)}, 0); opacity: 1 }
  72% { transform: translate(${vw(LEAF_PILE_X + 40)}, -34px) }
  78% { transform: translate(${vw(LEAF_PILE_X + 90)}, 0) }
  100% { transform: translate(110vw, 0) }
}
@keyframes fallBurst {
  0% { transform: translate(0, 0) rotate(0); opacity: 0 }
  8% { opacity: 1 }
  45% { transform: translate(var(--dx), var(--dy)) rotate(var(--r)) }
  100% { transform: translate(calc(var(--dx) * 1.5), 8px) rotate(calc(var(--r) * 2)); opacity: 0 }
}
@keyframes fallFoxX {
  0% { transform: translateX(104vw) }
  35% { transform: translateX(58vw) }
  46% { transform: translateX(58vw) }
  56% { transform: translateX(54vw) }
  72% { transform: translateX(54vw) }
  100% { transform: translateX(-8vw) }
}
@keyframes fallFoxPounce {
  0%, 38% { transform: translateY(0) rotate(0) }
  45% { transform: translateY(5px) rotate(0) }
  51% { transform: translateY(-52px) rotate(18deg) }
  57%, 66% { transform: translateY(14px) rotate(-62deg) }
  72%, 100% { transform: translateY(0) rotate(0) }
}
@keyframes fallCrowPath {
  0% { transform: translate(108vw, -42vh) }
  25%, 61% { transform: translate(${vw(SCARECROW_X)}, 0) }
  100% { transform: translate(28vw, -55vh) }
}
@keyframes fallDeerX {
  0% { transform: translateX(102vw); opacity: 1 }
  35%, 62% { transform: translateX(63vw); opacity: 1 }
  90% { opacity: 1 }
  100% { transform: translateX(46vw); opacity: 0 }
}
@keyframes fallRaccoonX {
  0% { transform: translateX(103vw) }
  38%, 56% { transform: translateX(${vw(1650)}) }
  100% { transform: translateX(105vw) }
}
@keyframes fallRaccoonStretch {
  0%, 40% { transform: scale(1, 1) translateY(0) }
  44%, 50% { transform: scale(0.92, 1.3) translateY(-4px) }
  54%, 100% { transform: scale(1, 1) translateY(0) }
}
@keyframes fallCookX {
  0%, 24% { transform: translateX(${vw(1645)}); opacity: 0 }
  31%, 68% { transform: translateX(${vw(1600)}); opacity: 1 }
  76% { transform: translateX(${vw(1645)}); opacity: 1 }
  80%, 100% { transform: translateX(${vw(1645)}); opacity: 0 }
}
@keyframes fallTurkeyDisguiseX {
  0% { transform: translateX(-8vw) }
  25%, 82% { transform: translateX(${vw(1490)}) }
  100% { transform: translateX(-8vw) }
}
@keyframes fallBallX { from { transform: translateX(-4vw) } to { transform: translateX(104vw) } }
@keyframes fallBallY {
  0% { transform: translateY(0); animation-timing-function: ease-out }
  50% { transform: translateY(-40vh); animation-timing-function: ease-in }
  100% { transform: translateY(0) }
}
@keyframes fallBallXShort { from { transform: translateX(-4vw) } to { transform: translateX(67vw) } }
@keyframes fallBallYShort {
  0% { transform: translateY(0); animation-timing-function: ease-out }
  55% { transform: translateY(-40vh); animation-timing-function: ease-in }
  100% { transform: translateY(-36px) }
}
@keyframes fallTurkeyCatch {
  0% { transform: translate(104vw, 0) }
  40%, 52% { transform: translate(65vw, 0) }
  58% { transform: translate(65vw, -46px) }
  64% { transform: translate(66vw, 0) }
  100% { transform: translate(110vw, 0) }
}
@keyframes fallBonkX {
  0% { transform: translateX(-6vw) }
  40%, 72% { transform: translateX(${vw(1530)}) }
  100% { transform: translateX(108vw) }
}
@keyframes fallAcornDrop {
  0%, 42% { transform: translate(0, -110px); opacity: 0 }
  43% { opacity: 1 }
  50% { transform: translate(0, 0) }
  56% { transform: translate(16px, -18px) }
  63%, 71% { transform: translate(26px, 30px); opacity: 1 }
  72%, 100% { transform: translate(26px, 30px); opacity: 0 }
}
@keyframes fallChaseX { from { transform: translateX(-4vw) } to { transform: translateX(108vw) } }
@keyframes fallPeek {
  0% { transform: translateY(34px); opacity: 0 }
  10%, 86% { transform: translateY(0); opacity: 1 }
  100% { transform: translateY(34px); opacity: 0 }
}
@keyframes fallToast {
  0% { transform: translate(-50%, 16px); opacity: 0 }
  10%, 82% { transform: translate(-50%, 0); opacity: 1 }
  100% { transform: translate(-50%, -8px); opacity: 0 }
}
@keyframes fallLeafDrift {
  0% { transform: translate(-50%, -12vh) rotate(0); opacity: 0 }
  20% { opacity: 1 }
  50% { transform: translate(calc(-50% + 60px), 10vh) rotate(160deg) }
  100% { transform: translate(-50%, 34vh) rotate(320deg); opacity: 0 }
}
@keyframes fallCard {
  0% { transform: translate(-50%, 24px) scale(0.96); opacity: 0 }
  8%, 88% { transform: translate(-50%, 0) scale(1); opacity: 1 }
  100% { transform: translate(-50%, -10px) scale(0.98); opacity: 0 }
}
@keyframes fallWipe {
  from { transform: translateX(-6vw) rotate(0) }
  to { transform: translateX(106vw) rotate(var(--r)) }
}
`
