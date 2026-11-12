import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { resetTabletConfetti } from '../../lib/confettiEngine'
import { CELEBRATIONS, type Celebration, type CelebrationName } from './animations'
import RiveCelebrationStage from './RiveCelebrationStage'
import { prewarmRiveRuntime } from './riveRuntime'
import { runSadAnimation, type SadAnimationName, type SadAnimationOptions } from './sad-animations'
import StoryboardStage, { prewarmStoryboards } from './StoryboardStage'

const DURATION_MS = 3800

interface Ctx {
  /** Play a random (or specific) fullscreen celebration. */
  celebrate: (name?: CelebrationName) => void
  /** Play a fullscreen sad/penalty animation for negative chores. */
  celebrateSad: (options?: SadAnimationOptions) => void
  /** Immediately halt any ongoing fullscreen celebration and optionally suppress new ones. */
  stop: (suppressDurationMs?: number) => void
}

const CelebrationContext = createContext<Ctx>({ celebrate: () => {}, celebrateSad: () => {}, stop: () => {} })

export const useCelebration = () => useContext(CelebrationContext)

function getSoundFlag(): '1' | '0' {
  try {
    return typeof window !== 'undefined' && localStorage.getItem('nivas_celebration_sound') === 'true'
      ? '1'
      : '0'
  } catch {
    return '0'
  }
}

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Celebration | null>(null)
  const [sadOptions, setSadOptions] = useState<SadAnimationOptions | null>(null)
  const [runId, setRunId] = useState(0)
  const [praise, setPraise] = useState('')
  const [fading, setFading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastRef = useRef<CelebrationName | null>(null)
  const historyRef = useRef<Map<CelebrationName, number>>(new Map())
  const lastSadRef = useRef<SadAnimationName | null>(null)
  const sadHistoryRef = useRef<Map<SadAnimationName, number>>(new Map())
  const suppressedUntilRef = useRef<number>(0)

  const COOLDOWN_MS = 2 * 60 * 1000 // 2-minute non-repeat cooldown

  useEffect(() => {
    prewarmRiveRuntime()
    prewarmStoryboards()
  }, [])

  const stop = useCallback((suppressDurationMs = 0) => {
    if (suppressDurationMs > 0) {
      suppressedUntilRef.current = Date.now() + suppressDurationMs
    }
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    cleanupRef.current?.()
    cleanupRef.current = null
    resetTabletConfetti()
    setActive(null)
    setSadOptions(null)
    setFading(false)
  }, [])

  const celebrate = useCallback(
    (name?: CelebrationName) => {
      if (Date.now() < suppressedUntilRef.current) {
        return
      }
      stop()
      const now = Date.now()
      let pool = CELEBRATIONS
      if (name) {
        pool = CELEBRATIONS.filter((c) => c.name === name)
      } else {
        let eligible = CELEBRATIONS.filter(
          (c) => now - (historyRef.current.get(c.name) || 0) >= COOLDOWN_MS,
        )
        if (eligible.length === 0 && lastRef.current && CELEBRATIONS.length > 1) {
          eligible = CELEBRATIONS.filter((c) => c.name !== lastRef.current)
        }
        if (eligible.length > 0) {
          pool = eligible
        }
      }
      const chosen = pool[Math.floor(Math.random() * pool.length)]
      lastRef.current = chosen.name
      historyRef.current.set(chosen.name, now)
      setRunId((id) => id + 1)
      setPraise(chosen.praise[Math.floor(Math.random() * chosen.praise.length)])
      setActive(chosen)
    },
    [stop],
  )

  const celebrateSad = useCallback(
    (options?: SadAnimationOptions) => {
      if (Date.now() < suppressedUntilRef.current) {
        return
      }
      stop()
      const now = Date.now()
      const penaltyPool: SadAnimationName[] = [
        'icecream',
        'balance-beam',
        'bicycle-rain',
        'trick-or-treat',
        'banana-monkey',
      ]
      let chosenAnim = options?.animation

      if (!chosenAnim) {
        let eligible = penaltyPool.filter(
          (p) => now - (sadHistoryRef.current.get(p) || 0) >= COOLDOWN_MS,
        )
        if (eligible.length === 0 && lastSadRef.current && penaltyPool.length > 1) {
          eligible = penaltyPool.filter((p) => p !== lastSadRef.current)
        }
        if (eligible.length === 0) {
          eligible = penaltyPool
        }
        chosenAnim = eligible[Math.floor(Math.random() * eligible.length)]
      }

      lastSadRef.current = chosenAnim
      sadHistoryRef.current.set(chosenAnim, now)
      setRunId((id) => id + 1)

      setSadOptions({
        ...options,
        animation: chosenAnim,
      })
    },
    [stop],
  )

  useEffect(() => {
    const handleStop = (e: any) => {
      const suppress = typeof e?.detail?.suppressDurationMs === 'number' ? e.detail.suppressDurationMs : 8000
      stop(suppress)
    }
    window.addEventListener('nivas:stop-celebration', handleStop)
    return () => window.removeEventListener('nivas:stop-celebration', handleStop)
  }, [stop])

  useEffect(() => {
    if (!active) return
    if (active.run && canvasRef.current) {
      cleanupRef.current = active.run(canvasRef.current)
    }
    const duration = active.durationMs || DURATION_MS
    timersRef.current = [
      setTimeout(() => setFading(true), Math.max(duration - 600, 0)),
      setTimeout(() => stop(), duration),
    ]
    return () => {
      timersRef.current.forEach(clearTimeout)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [active, runId, stop])

  useEffect(() => {
    if (!sadOptions) return
    const isStorm = sadOptions.animation === 'storm'
    const isBeam = sadOptions.animation === 'balance-beam'
    const isBike = sadOptions.animation === 'bicycle-rain'
    const isHalloween = sadOptions.animation === 'trick-or-treat'
    const isBanana = sadOptions.animation === 'banana-monkey'
    const duration = isStorm ? 4400 : isBeam ? 9400 : isBike ? 13000 : isHalloween ? 19000 : isBanana ? 12000 : 9800

    if (isStorm && canvasRef.current) {
      const runner = runSadAnimation(canvasRef.current, sadOptions)
      cleanupRef.current = runner.cleanup
    }

    timersRef.current = [
      setTimeout(() => setFading(true), Math.max(duration - 650, 0)),
      setTimeout(() => stop(), duration),
    ]
    return () => {
      timersRef.current.forEach(clearTimeout)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [sadOptions, runId, stop])

  const soundFlag = active || sadOptions ? getSoundFlag() : '0'

  return (
    <CelebrationContext.Provider value={{ celebrate, celebrateSad, stop }}>
      {children}
      {(active || sadOptions) && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
          style={{
            background: sadOptions
              ? 'radial-gradient(circle at 50% 30%, #334155 0%, #1e293b 60%, #0f172a 100%)'
              : active?.backdrop,
          }}
          onClick={() => stop()}
        >
          {active?.riveConfig ? (
            <RiveCelebrationStage key={`rive-${active.name}-${runId}`} config={active.riveConfig} />
          ) : active?.iframeSrc ? (
            <StoryboardStage
              key={`story-${active.name}-${runId}`}
              url={`${active.iframeSrc}${active.iframeSrc.includes('?') ? '&' : '?'}sound=${soundFlag}`}
              title={active.label}
            />
          ) : sadOptions && sadOptions.animation === 'balance-beam' ? (
            <StoryboardStage
              key={`sad-beam-${runId}`}
              url={`/celebrations/balance_beam_oops.html?embed=1&points=${Math.abs(sadOptions.coinsLost ?? 10)}&sound=${soundFlag}`}
              title="Balance Beam Oops"
            />
          ) : sadOptions && sadOptions.animation === 'bicycle-rain' ? (
            <StoryboardStage
              key={`sad-bike-${runId}`}
              url={`/celebrations/bicycle_park_rain.html?embed=1&points=${Math.abs(sadOptions.coinsLost ?? 10)}&sound=${soundFlag}`}
              title="Bicycle Rain Tragedy"
            />
          ) : sadOptions && sadOptions.animation === 'trick-or-treat' ? (
            <StoryboardStage
              key={`sad-halloween-${runId}`}
              url={`/celebrations/trick_or_treat_penalty.html?embed=1&coins=${Math.abs(sadOptions.coinsLost ?? 25)}&points=${Math.abs(sadOptions.coinsLost ?? 25)}&sound=${soundFlag}`}
              title="Trick or Treat Fright"
            />
          ) : sadOptions && sadOptions.animation === 'banana-monkey' ? (
            <StoryboardStage
              key={`sad-banana-${runId}`}
              url={`/celebrations/banana_peel_monkey.html?embed=1&points=${Math.abs(sadOptions.coinsLost ?? 10)}&sound=${soundFlag}`}
              title="Banana Peel & Cheeky Monkey"
            />
          ) : sadOptions && sadOptions.animation !== 'storm' ? (
            <StoryboardStage
              key={`sad-icecream-${runId}`}
              url={`/celebrations/ice_cream_tragedy.html?embed=1&points=${Math.abs(sadOptions.coinsLost ?? 10)}&sound=${soundFlag}`}
              title="Ice Cream Tragedy"
            />
          ) : (
            <canvas ref={canvasRef} className="h-full w-full" />
          )}
          {active && !active.hideHtmlPraise && (
            <div className="pointer-events-none absolute inset-x-0 top-[9%] z-20 px-4 text-center">
              <span
                className="inline-block animate-bounce text-5xl sm:text-7xl font-black tracking-tight text-white"
                style={{ textShadow: '0 4px 24px rgba(0,0,0,0.45)' }}
              >
                {praise}
              </span>
            </div>
          )}
        </div>
      )}
    </CelebrationContext.Provider>
  )
}
