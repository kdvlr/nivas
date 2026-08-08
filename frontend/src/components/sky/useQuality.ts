import { useEffect, useRef, useState } from 'react'

export type Quality = 'high' | 'medium' | 'low'

import { getQueryParam } from './queryParam'

// Dev/test override: ?fx=low forces a tier. Read hash-aware, so it works in
// "#/photos?sky=night&fx=high" just like the sky/skyfx overrides do.
const forcedTier = (): Quality | null => {
  const v = getQueryParam('fx')
  return v === 'high' || v === 'medium' || v === 'low' ? (v as Quality) : null
}

// v2: v1 latched devices to 'low' permanently, which silently removed every
// sky effect. Renaming the key discards those stale verdicts.
const STORAGE_KEY = 'nivas-sky-quality-v2'

function stored(): Quality | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'high' || v === 'medium' || v === 'low' ? v : null
  } catch {
    return null
  }
}

/**
 * Watches real frame pacing and steps the visual tier down when the device
 * can't keep up. The screensaver runs on everything from an M-series Mac to a
 * cheap Android tablet, so the effects budget is measured, not assumed.
 *
 * Sampling only runs while stepping down — once settled, the loop stops and
 * costs nothing. The chosen tier is remembered so the next run starts there
 * instead of janking through the discovery phase again.
 */
export interface QualityMetrics {
  quality: Quality
  fps: number
  frameTimeMs: number
  sampleCount: number
}

export function useQuality(active: boolean): QualityMetrics {
  const forced = forcedTier()
  const [quality, setQuality] = useState<Quality>(() => forced ?? stored() ?? 'high')
  const [fps, setFps] = useState<number>(60)
  const [frameTimeMs, setFrameTimeMs] = useState<number>(16.7)
  const sampleCount = useRef(0)

  useEffect(() => {
    if (!active) return

    let raf = 0
    let last = performance.now()
    let samples: number[] = []
    const warmupUntil = last + 1000

    const tick = (t: number) => {
      const dt = t - last
      last = t
      if (t > warmupUntil && dt < 500) {
        samples.push(dt)
        sampleCount.current++
      }

      if (samples.length >= 60) {
        const sorted = [...samples].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        const calculatedFps = Math.round(1000 / (median || 16.7))
        setFps(calculatedFps)
        setFrameTimeMs(Math.round(median * 10) / 10)
        samples = []

        // If median frame time > 33ms (<30fps) and forced is null, drop tier to keep slideshow smooth
        if (forced === null) {
          if (median > 33 && quality !== 'low') {
            const next: Quality = quality === 'high' ? 'medium' : 'low'
            try {
              localStorage.setItem(STORAGE_KEY, next)
            } catch {}
            setQuality(next)
            console.info(`[Nivas Telemetry] Framerate drop detected (${calculatedFps} FPS / ${median.toFixed(1)}ms). Auto-adjusting quality tier: ${quality} -> ${next}`)
          }
        }
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, quality, forced])

  return { quality, fps, frameTimeMs, sampleCount: sampleCount.current }
}
