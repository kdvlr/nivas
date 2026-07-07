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

const DURATION_MS = 3800

interface Ctx {
  /** Play a random (or specific) fullscreen celebration. */
  celebrate: (name?: CelebrationName) => void
}

const CelebrationContext = createContext<Ctx>({ celebrate: () => {} })

export const useCelebration = () => useContext(CelebrationContext)

export function CelebrationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<Celebration | null>(null)
  const [praise, setPraise] = useState('')
  const [fading, setFading] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const lastRef = useRef<CelebrationName | null>(null)

  const stop = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []
    cleanupRef.current?.()
    cleanupRef.current = null
    setActive(null)
    setFading(false)
  }, [])

  const celebrate = useCallback(
    (name?: CelebrationName) => {
      stop()
      let pool = CELEBRATIONS
      if (name) {
        pool = CELEBRATIONS.filter((c) => c.name === name)
      } else if (CELEBRATIONS.length > 1 && lastRef.current) {
        // random, but never the same one twice in a row
        pool = CELEBRATIONS.filter((c) => c.name !== lastRef.current)
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
      setTimeout(() => setFading(true), DURATION_MS - 500),
      setTimeout(stop, DURATION_MS),
    ]
    return () => {
      timersRef.current.forEach(clearTimeout)
      cleanupRef.current?.()
      cleanupRef.current = null
    }
  }, [active, stop])

  return (
    <CelebrationContext.Provider value={{ celebrate }}>
      {children}
      {active && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'}`}
          style={{ background: active.backdrop }}
          onClick={stop}
        >
          <canvas ref={canvasRef} className="h-full w-full" />
          <div className="pointer-events-none absolute inset-x-0 top-[12%] text-center">
            <span
              className="inline-block animate-bounce text-7xl font-black tracking-tight text-white"
              style={{ textShadow: '0 4px 24px rgba(0,0,0,0.45)' }}
            >
              {praise}
            </span>
          </div>
        </div>
      )}
    </CelebrationContext.Provider>
  )
}
