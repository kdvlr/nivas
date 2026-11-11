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
 * Sampling only runs while a downgrade is still possible (or the debug HUD is
 * showing): once at 'low' or forced via ?fx=, the loop stops and costs
 * nothing. fps/frameTime are only published as React state for the debug HUD,
 * so normal runs never re-render the screensaver from here. The chosen tier is remembered so the next run starts there
 * instead of janking through the discovery phase again.
 */
export interface QualityMetrics {
  quality: Quality
  fps: number
  frameTimeMs: number
  sampleCount: number
}

export function useQuality(active: boolean, debug = false): QualityMetrics {
  const forced = forcedTier()
  // Start Android kiosks conservatively instead of waiting for visible jank
  // before the first downgrade. Explicit overrides and measured tiers win.
  const [quality, setQuality] = useState<Quality>(() =>
    forced ?? stored() ?? (/Android/i.test(navigator.userAgent) ? 'medium' : 'high')
  )
  const [fps, setFps] = useState<number>(60)
  const [frameTimeMs, setFrameTimeMs] = useState<number>(16.7)
  const sampleCount = useRef(0)

  useEffect(() => {
    if (!active) return
    const canDowngrade = forced === null && quality !== 'low'
    if (!canDowngrade && !debug) return

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
        const roundedFrameTime = Math.round(median * 10) / 10
        if (debug) {
          setFps((prev) => (Math.abs(prev - calculatedFps) >= 5 ? calculatedFps : prev))
          setFrameTimeMs((prev) => (Math.abs(prev - roundedFrameTime) >= 2 ? roundedFrameTime : prev))
        }
        samples = []

        // If median frame time > 33ms (<30fps) and forced is null, drop tier to keep slideshow smooth
        if (canDowngrade) {
          if (median > 33) {
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
  }, [active, quality, forced, debug])

  return { quality, fps, frameTimeMs, sampleCount: sampleCount.current }
}
