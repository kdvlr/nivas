import { useEffect, useMemo, useRef } from 'react'
import { Alignment, Fit, Layout, useRive } from '@rive-app/react-webgl2'
import { fireTabletConfetti, getOptimalDpr } from '../../lib/confettiEngine'
import { fetchAndCacheRiv, getCachedRivBuffer } from './riveRuntime'

export interface RiveSceneConfig {
  src: string
  artboard?: string
  stateMachine?: string
  animations?: string | string[]
  fit?: 'contain' | 'cover' | 'fitHeight'
  /** Optional max-size classes for centered stage framing on 1920x1080 landscapes. */
  stageClassName?: string
  /** Optional glowing radial halo CSS behind centered character rigs (compositor-only, zero blur filter). */
  haloBackground?: string
  initialInputs?: Record<string, boolean | number>
  periodicTriggers?: { inputName: string; intervalMs: number; initialDelayMs?: number }[]
  tapTriggerInput?: string
  /** Timestamps (ms) at which to fire OffscreenCanvas worker confetti bursts. */
  confettiBursts?: { delayMs: number; colors?: string[]; count?: number }[]
  onStartSound?: () => void
}

function resolveFit(fit?: RiveSceneConfig['fit']): Fit {
  if (fit === 'cover') return Fit.Cover
  if (fit === 'fitHeight') return Fit.FitHeight
  return Fit.Contain
}

export default function RiveCelebrationStage({ config }: { config: RiveSceneConfig }) {
  const timersRef = useRef<number[]>([])
  const intervalsRef = useRef<number[]>([])

  const cachedBuffer = useMemo(() => getCachedRivBuffer(config.src), [config.src])

  useEffect(() => {
    if (!cachedBuffer) {
      fetchAndCacheRiv(config.src)
    }
  }, [cachedBuffer, config.src])

  const layout = useMemo(
    () =>
      new Layout({
        fit: resolveFit(config.fit),
        alignment: Alignment.Center,
      }),
    [config.fit],
  )

  const { rive, RiveComponent } = useRive(
    {
      ...(cachedBuffer ? { buffer: cachedBuffer } : { src: config.src }),
      artboard: config.artboard,
      stateMachines: config.stateMachine ? [config.stateMachine] : undefined,
      animations: config.animations,
      autoplay: true,
      layout,
    },
    {
      useDevicePixelRatio: true,
      customDevicePixelRatio: getOptimalDpr(),
      shouldResizeCanvasToContainer: true,
      useOffscreenRenderer: true,
    },
  )

  // Apply state-machine inputs, periodic triggers, sound cues, and worker confetti bursts
  useEffect(() => {
    if (!rive) return

    timersRef.current.forEach(window.clearTimeout)
    intervalsRef.current.forEach(window.clearInterval)
    timersRef.current = []
    intervalsRef.current = []

    if (config.stateMachine) {
      const inputs = rive.stateMachineInputs(config.stateMachine) || []

      if (config.initialInputs) {
        for (const [name, value] of Object.entries(config.initialInputs)) {
          const input = inputs.find((i) => i.name === name)
          if (input) {
            input.value = value
          }
        }
      }

      if (config.periodicTriggers) {
        for (const trig of config.periodicTriggers) {
          const fire = () => {
            try {
              const liveInputs = rive.stateMachineInputs(config.stateMachine!) || []
              const target = liveInputs.find((i) => i.name === trig.inputName)
              target?.fire()
            } catch {}
          }
          const startId = window.setTimeout(() => {
            fire()
            const intId = window.setInterval(fire, trig.intervalMs)
            intervalsRef.current.push(intId)
          }, trig.initialDelayMs ?? 450)
          timersRef.current.push(startId)
        }
      }
    }

    const handleVisibility = () => {
      try {
        if (document.hidden) {
          rive.pause()
        } else {
          rive.play()
        }
      } catch {}
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      timersRef.current.forEach(window.clearTimeout)
      intervalsRef.current.forEach(window.clearInterval)
      timersRef.current = []
      intervalsRef.current = []
    }
  }, [rive, config])

  // Sound + worker confetti bursts tied to scene mount
  useEffect(() => {
    config.onStartSound?.()
    const burstTimers: number[] = []
    if (config.confettiBursts) {
      for (const b of config.confettiBursts) {
        const id = window.setTimeout(() => {
          fireTabletConfetti({
            particleCount: b.count ?? 70,
            spread: 85,
            origin: { x: 0.18, y: 0.78 },
            colors: b.colors,
          })
          fireTabletConfetti({
            particleCount: b.count ?? 70,
            spread: 85,
            origin: { x: 0.82, y: 0.78 },
            colors: b.colors,
          })
        }, b.delayMs)
        burstTimers.push(id)
      }
    }
    return () => {
      burstTimers.forEach(window.clearTimeout)
    }
  }, [config])

  const isFullscreenCover = config.fit === 'cover' && !config.stageClassName

  const handleInteractiveTap = (e: React.MouseEvent) => {
    if (!config.tapTriggerInput || !rive || !config.stateMachine) return
    e.stopPropagation()
    try {
      const inputs = rive.stateMachineInputs(config.stateMachine) || []
      const target = inputs.find((i) => i.name === config.tapTriggerInput)
      target?.fire()
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const x = (e.clientX || rect.left + rect.width / 2) / window.innerWidth
      const y = (e.clientY || rect.top + rect.height / 2) / window.innerHeight
      fireTabletConfetti({
        particleCount: 45,
        spread: 70,
        origin: { x, y },
      })
    } catch {}
  }

  if (isFullscreenCover) {
    return (
      <div className="relative h-full w-full pointer-events-none select-none overflow-hidden">
        <RiveComponent className="h-full w-full block" />
      </div>
    )
  }

  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden select-none">
      {config.haloBackground && (
        <div
          className="pointer-events-none absolute h-[74vmin] w-[74vmin] rounded-full opacity-85"
          style={{ background: config.haloBackground }}
        />
      )}
      <div
        className={
          config.stageClassName ||
          'relative z-10 h-[76vh] w-[86vw] max-w-[960px] max-h-[820px] flex items-center justify-center'
        }
        onClick={config.tapTriggerInput ? handleInteractiveTap : undefined}
      >
        <RiveComponent className="h-full w-full block" />
      </div>
    </div>
  )
}
