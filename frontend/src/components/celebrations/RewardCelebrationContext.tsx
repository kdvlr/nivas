import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { REWARD_ANIMATIONS, type RewardAnimation, type RewardAnimationName } from './reward-animations'

const DURATION_MS = 4800

interface Ctx {
  /** Play a random (or specific) reward redemption animation. */
  celebrateReward: (name?: RewardAnimationName) => void
  /** Immediately halt any ongoing reward celebration and optionally suppress new ones. */
  stop: (suppressDurationMs?: number) => void
}

const RewardCelebrationContext = createContext<Ctx>({ celebrateReward: () => {}, stop: () => {} })

export const useRewardCelebration = () => useContext(RewardCelebrationContext)

export function RewardCelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<RewardAnimation | null>(null)
  const [praise, setPraise] = useState('')
  const [fading, setFading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastRef = useRef<RewardAnimationName | null>(null)
  const historyRef = useRef<Map<RewardAnimationName, number>>(new Map())
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
    setFading(false)
  }, [])

  const celebrateReward = useCallback(
    (name?: RewardAnimationName) => {
      if (Date.now() < suppressedUntilRef.current) {
        return
      }
      stop()
      const now = Date.now()
      let pool = REWARD_ANIMATIONS
      if (name) {
        pool = REWARD_ANIMATIONS.filter((a) => a.name === name)
      } else {
        // Exclude reward animations played within the last 2 minutes
        let eligible = REWARD_ANIMATIONS.filter(
          (a) => now - (historyRef.current.get(a.name) || 0) >= COOLDOWN_MS,
        )
        // Fallback if all were played within 2 minutes: avoid consecutive duplicate
        if (eligible.length === 0 && lastRef.current && REWARD_ANIMATIONS.length > 1) {
          eligible = REWARD_ANIMATIONS.filter((a) => a.name !== lastRef.current)
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

  return (
    <RewardCelebrationContext.Provider value={{ celebrateReward, stop }}>
      {children}
      {active && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
          style={{ background: active.backdrop }}
          onClick={() => stop()}
        >
          {active.iframeSrc ? (
            <iframe
              key={active.name}
              src={`${active.iframeSrc}${active.iframeSrc.includes('?') ? '&' : '?'}sound=${
                typeof window !== 'undefined' && localStorage.getItem('nivas_celebration_sound') === 'true' ? '1' : '0'
              }`}
              title={active.label}
              className="pointer-events-none h-full w-full border-0"
            />
          ) : (
            <canvas ref={canvasRef} className="h-full w-full" />
          )}
          {!active.hideHtmlPraise && (
            <div className="pointer-events-none absolute inset-x-0 top-[10%] text-center px-4">
              <span
                className="inline-block animate-bounce text-5xl sm:text-7xl font-black tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.65)]"
              >
                {praise}
              </span>
            </div>
          )}
        </div>
      )}
    </RewardCelebrationContext.Provider>
  )
}
