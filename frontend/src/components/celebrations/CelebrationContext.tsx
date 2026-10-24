import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { CELEBRATIONS, type Celebration, type CelebrationName } from './animations'
import { runSadAnimation, type SadAnimationOptions, type SadAnimationName } from './sad-animations'

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

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Celebration | null>(null)
  const [sadOptions, setSadOptions] = useState<SadAnimationOptions | null>(null)
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

  const stop = useCallback((suppressDurationMs = 0) => {
    if (suppressDurationMs > 0) {
      suppressedUntilRef.current = Date.now() + suppressDurationMs
    }
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    cleanupRef.current?.()
    cleanupRef.current = null
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
        // Exclude animations played within the last 2 minutes
        let eligible = CELEBRATIONS.filter(
          (c) => now - (historyRef.current.get(c.name) || 0) >= COOLDOWN_MS,
        )
        // If all or most animations were played recently, fallback to avoiding consecutive repeats
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
      const penaltyPool: SadAnimationName[] = ['icecream', 'balance-beam']
      let chosenAnim = options?.animation

      if (!chosenAnim) {
        // Exclude penalties played within the 2-minute cooldown window
        let eligible = penaltyPool.filter(
          (p) => now - (sadHistoryRef.current.get(p) || 0) >= COOLDOWN_MS,
        )
        // With only 2 animations, if both have been played in 2 mins, alternate (no back-to-back repeats)
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
  }, [active, stop])

  useEffect(() => {
    if (!sadOptions) return
    const isStorm = sadOptions.animation === 'storm'
    const isBeam = sadOptions.animation === 'balance-beam'
    const duration = isStorm ? 4400 : isBeam ? 9400 : 9800

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
  }, [sadOptions, stop])

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
          {active?.iframeSrc ? (
            <iframe
              key={active.name}
              src={`${active.iframeSrc}${active.iframeSrc.includes('?') ? '&' : '?'}sound=${
                typeof window !== 'undefined' && localStorage.getItem('nivas_celebration_sound') === 'true' ? '1' : '0'
              }`}
              title={active.label}
              className="pointer-events-none h-full w-full border-0"
            />
          ) : sadOptions && sadOptions.animation === 'balance-beam' ? (
            <iframe
              key={`sad-beam-${Date.now()}`}
              src={`/celebrations/balance_beam_oops.html?embed=1&title=${encodeURIComponent(
                sadOptions.title || 'Room Not Clean',
              )}&points=${Math.abs(sadOptions.coinsLost ?? 10)}&sound=${
                typeof window !== 'undefined' && localStorage.getItem('nivas_celebration_sound') === 'true' ? '1' : '0'
              }`}
              title="Balance Beam Oops"
              className="pointer-events-none h-full w-full border-0"
            />
          ) : sadOptions && sadOptions.animation !== 'storm' ? (
            <iframe
              key={`sad-icecream-${Date.now()}`}
              src={`/celebrations/ice_cream_tragedy.html?embed=1&title=${encodeURIComponent(
                sadOptions.title || 'Room Not Clean',
              )}&points=${Math.abs(sadOptions.coinsLost ?? 10)}&sound=${
                typeof window !== 'undefined' && localStorage.getItem('nivas_celebration_sound') === 'true' ? '1' : '0'
              }`}
              title="Ice Cream Tragedy"
              className="pointer-events-none h-full w-full border-0"
            />
          ) : (
            <canvas ref={canvasRef} className="h-full w-full" />
          )}
          {active && !active.durationMs && !active.hideHtmlPraise && (
            <div className="pointer-events-none absolute inset-x-0 top-[12%] text-center">
              <span
                className="inline-block animate-bounce text-7xl font-black tracking-tight text-white"
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
