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

const DURATION_MS = 4500

interface Ctx {
  /** Play a random (or specific) reward redemption animation. */
  celebrateReward: (name?: RewardAnimationName) => void
}

const RewardCelebrationContext = createContext<Ctx>({ celebrateReward: () => {} })

export const useRewardCelebration = () => useContext(RewardCelebrationContext)

export function RewardCelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<RewardAnimation | null>(null)
  const [praise, setPraise] = useState('')
  const [fading, setFading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastRef = useRef<RewardAnimationName | null>(null)

  const stop = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    cleanupRef.current?.()
    cleanupRef.current = null
    setActive(null)
    setFading(false)
  }, [])

  const celebrateReward = useCallback(
    (name?: RewardAnimationName) => {
      stop()
      let pool = REWARD_ANIMATIONS
      if (name) {
        pool = REWARD_ANIMATIONS.filter((a) => a.name === name)
      } else if (REWARD_ANIMATIONS.length > 1 && lastRef.current) {
        pool = REWARD_ANIMATIONS.filter((a) => a.name !== lastRef.current)
      }
      const chosen = pool[Math.floor(Math.random() * pool.length)]
      lastRef.current = chosen.name
      setPraise(chosen.praise[Math.floor(Math.random() * chosen.praise.length)])
      setActive(chosen)
    },
    [stop],
  )

  useEffect(() => {
    if (!active || !canvasRef.current) return
    cleanupRef.current = active.run(canvasRef.current)
    timersRef.current = [
      setTimeout(() => setFading(true), DURATION_MS - 600),
      setTimeout(stop, DURATION_MS),
    ]
    return () => {
      timersRef.current.forEach(clearTimeout)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [active, stop])

  return (
    <RewardCelebrationContext.Provider value={{ celebrateReward }}>
      {children}
      {active && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
          style={{ background: active.backdrop }}
          onClick={stop}
        >
          <canvas ref={canvasRef} className="h-full w-full" />
          {active.name !== 'fairy' && (
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
    </RewardCelebrationContext.Provider>
  )
}
