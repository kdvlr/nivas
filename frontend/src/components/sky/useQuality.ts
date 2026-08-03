import { useEffect, useRef, useState } from 'react'

export type Quality = 'high' | 'medium' | 'low'

// Dev/test override: ?fx=low forces a tier.
const FORCED = (() => {
  const v = new URLSearchParams(window.location.search).get('fx')
  return v === 'high' || v === 'medium' || v === 'low' ? (v as Quality) : null
})()

const STORAGE_KEY = 'nivas-sky-quality'

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
export function useQuality(active: boolean): Quality {
  const [quality, setQuality] = useState<Quality>(() => FORCED ?? stored() ?? 'high')
  const settled = useRef(FORCED !== null)

  useEffect(() => {
    if (!active || settled.current) return

    let raf = 0
    let last = performance.now()
    let samples: number[] = []
    // Ignore the first stretch: mount, image decode and the entrance animation
    // are not representative of steady state.
    const warmupUntil = last + 1500

    const tick = (t: number) => {
      const dt = t - last
      last = t
      if (t > warmupUntil && dt < 500) samples.push(dt)

      if (samples.length >= 90) {
        const sorted = samples.sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        samples = []
        // 60fps = 16.7ms. Below ~40fps (25ms) the drift animations visibly
        // stutter, so drop a tier and re-measure.
        if (median > 25 && quality !== 'low') {
          const next: Quality = quality === 'high' ? 'medium' : 'low'
          if (next === 'low') settled.current = true
          try {
            localStorage.setItem(STORAGE_KEY, next)
          } catch {
            /* private mode */
          }
          setQuality(next)
          return // effect re-runs on the new tier and re-measures
        }
        settled.current = true
        return
      }
      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, quality])

  return quality
}
