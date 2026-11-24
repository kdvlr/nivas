import { useEffect, useRef, useState } from 'react'

interface FullyKioskBridge {
  getSensorValue?: (type: number) => number
  getSensorInfo?: () => string
}

declare global {
  interface Window {
    fully?: FullyKioskBridge
  }
}

export interface WaveGestureFeedback {
  icon: 'skip_next' | 'pause' | 'play_arrow' | 'back_hand'
  label: string
}

interface UseWaveGestureOptions {
  /** Only actively poll & trigger when a track is loaded. */
  enabled: boolean
  /** Current playback state (used for hover hint label). */
  isPlaying: boolean
  /** Quick wave (100ms - 750ms dip + recover) -> Next Track. */
  onWave: () => void
  /** Sustained hover (1.0s - 2.8s dip + recover) -> Pause / Resume. */
  onHover: () => void
}

const LIGHT_SENSOR_TYPE = 5
const POLL_INTERVAL_MS = 100
const MIN_BASELINE_LUX = 4
const DIP_ENTER_RATIO = 0.55
const DIP_EXIT_RATIO = 0.72
const MIN_ABSOLUTE_DROP_LUX = 3
const WAVE_MIN_MS = 80
const WAVE_MAX_MS = 750
const HOVER_MIN_MS = 1000
const HOVER_MAX_MS = 2800
const WAVE_COOLDOWN_MS = 900
const HOVER_COOLDOWN_MS = 1200
const FEEDBACK_DURATION_MS = 1600

function readLightLux(): number | null {
  const fully = window.fully
  if (!fully) return null

  try {
    if (typeof fully.getSensorValue === 'function') {
      const val = Number(fully.getSensorValue(LIGHT_SENSOR_TYPE))
      if (Number.isFinite(val) && val >= 0) return val
    }
    if (typeof fully.getSensorInfo === 'function') {
      const raw = fully.getSensorInfo()
      if (raw) {
        const list = JSON.parse(raw)
        if (Array.isArray(list)) {
          const sensor = list.find((s: any) => s && s.type === LIGHT_SENSOR_TYPE)
          const firstVal = Array.isArray(sensor?.values) ? Number(sensor.values[0]) : NaN
          if (Number.isFinite(firstVal) && firstVal >= 0) return firstVal
        }
      }
    }
  } catch {
    // Sensor temporarily unavailable
  }
  return null
}

/**
 * Touchless light-sensor gesture detector for Fully Kiosk tablets.
 *
 * - Quick wave over bezel (80ms - 750ms shadow dip + recovery) -> onWave (Next Track)
 * - Sustained hover (1.0s - 2.8s shadow dip + release)         -> onHover (Pause / Resume)
 * - Sustained darkness (> 2.8s, e.g. room lights turned off)   -> ignored & re-baselined
 */
export function useWaveGesture({
  enabled,
  isPlaying,
  onWave,
  onHover,
}: UseWaveGestureOptions): WaveGestureFeedback | null {
  const [feedback, setFeedback] = useState<WaveGestureFeedback | null>(null)

  const onWaveRef = useRef(onWave)
  const onHoverRef = useRef(onHover)
  const isPlayingRef = useRef(isPlaying)
  onWaveRef.current = onWave
  onHoverRef.current = onHover
  isPlayingRef.current = isPlaying

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || !window.fully) {
      setFeedback(null)
      return
    }

    let baseline: number | null = null
    let dipStartMs: number | null = null
    let dipBaseline = 0
    let hoverArmed = false
    let cooldownUntil = 0
    let feedbackTimer: ReturnType<typeof setTimeout> | null = null

    const showFeedback = (next: WaveGestureFeedback, autoClear = true) => {
      if (feedbackTimer) {
        clearTimeout(feedbackTimer)
        feedbackTimer = null
      }
      setFeedback(next)
      if (autoClear) {
        feedbackTimer = setTimeout(() => {
          setFeedback(null)
          feedbackTimer = null
        }, FEEDBACK_DURATION_MS)
      }
    }

    const clearHoverHint = () => {
      if (hoverArmed) {
        hoverArmed = false
        setFeedback(null)
      }
    }

    const resetState = () => {
      dipStartMs = null
      clearHoverHint()
    }

    const tick = () => {
      if (document.hidden) {
        resetState()
        return
      }

      const lux = readLightLux()
      if (lux === null) return

      const now = Date.now()
      if (baseline === null) {
        baseline = lux
        return
      }

      if (now < cooldownUntil) {
        return
      }

      if (dipStartMs === null) {
        // Not currently in a shadow dip: check for sudden drop
        const drop = baseline - lux
        if (
          baseline >= MIN_BASELINE_LUX &&
          lux <= baseline * DIP_ENTER_RATIO &&
          drop >= MIN_ABSOLUTE_DROP_LUX
        ) {
          dipStartMs = now
          dipBaseline = baseline
          hoverArmed = false
        } else {
          // Smoothly track ambient room lighting changes
          baseline = baseline * 0.92 + lux * 0.08
        }
        return
      }

      // Currently inside a shadow dip
      const elapsed = now - dipStartMs
      const recovered = lux >= dipBaseline * DIP_EXIT_RATIO

      if (recovered) {
        dipStartMs = null
        if (elapsed >= WAVE_MIN_MS && elapsed <= WAVE_MAX_MS) {
          cooldownUntil = now + WAVE_COOLDOWN_MS
          hoverArmed = false
          showFeedback({ icon: 'skip_next', label: 'Next Track' })
          onWaveRef.current()
        } else if (elapsed >= HOVER_MIN_MS && elapsed <= HOVER_MAX_MS) {
          cooldownUntil = now + HOVER_COOLDOWN_MS
          hoverArmed = false
          const wasPlaying = isPlayingRef.current
          showFeedback({
            icon: wasPlaying ? 'pause' : 'play_arrow',
            label: wasPlaying ? 'Paused' : 'Resumed',
          })
          onHoverRef.current()
        } else {
          // Between 750ms and 1000ms (ambiguous) -> cancel quietly
          clearHoverHint()
        }
        return
      }

      // Still covered
      if (elapsed >= HOVER_MIN_MS && elapsed <= HOVER_MAX_MS && !hoverArmed) {
        hoverArmed = true
        showFeedback(
          {
            icon: 'back_hand',
            label: isPlayingRef.current ? 'Release to Pause' : 'Release to Resume',
          },
          false
        )
      } else if (elapsed > HOVER_MAX_MS) {
        // Room lights were likely turned off or blinds closed -> cancel & re-baseline
        dipStartMs = null
        clearHoverHint()
        baseline = lux
        cooldownUntil = now + 1000
      }
    }

    const intervalId = setInterval(tick, POLL_INTERVAL_MS)
    const onVisChange = () => {
      if (document.hidden) resetState()
    }
    document.addEventListener('visibilitychange', onVisChange)

    return () => {
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', onVisChange)
      if (feedbackTimer) clearTimeout(feedbackTimer)
    }
  }, [enabled])

  return feedback
}
