export type TimerStage = 'green' | 'greenish-yellow' | 'yellow' | 'red' | 'flashing-red'

export interface StageStyleConfig {
  strokeColor: string
  textColor: string
  bgGlow: string
  badgeText: string
  isFlashing: boolean
}

/**
 * Determines the visual stage of the timer based on remaining seconds.
 * - > 15 mins (900s): green
 * - 10m - 15m (601s - 900s): greenish-yellow
 * - 5m - 10m (301s - 600s): yellow
 * - 1m - 5m (61s - 300s): red
 * - <= 1m (<= 60s): flashing red
 */
export function getTimerStage(remainingSeconds: number): TimerStage {
  if (remainingSeconds > 15 * 60) {
    return 'green'
  }
  if (remainingSeconds > 10 * 60) {
    return 'greenish-yellow'
  }
  if (remainingSeconds > 5 * 60) {
    return 'yellow'
  }
  if (remainingSeconds > 60) {
    return 'red'
  }
  return 'flashing-red'
}

export function getStageStyles(stage: TimerStage): StageStyleConfig {
  switch (stage) {
    case 'green':
      return {
        strokeColor: '#22c55e',
        textColor: 'text-emerald-500 dark:text-emerald-400',
        bgGlow: 'rgba(34, 197, 94, 0.10)',
        badgeText: 'More than 15 mins',
        isFlashing: false,
      }
    case 'greenish-yellow':
      return {
        strokeColor: '#84cc16',
        textColor: 'text-lime-500 dark:text-lime-400',
        bgGlow: 'rgba(132, 204, 22, 0.11)',
        badgeText: 'Under 15 mins',
        isFlashing: false,
      }
    case 'yellow':
      return {
        strokeColor: '#eab308',
        textColor: 'text-amber-500 dark:text-yellow-400',
        bgGlow: 'rgba(234, 179, 8, 0.12)',
        badgeText: 'Under 10 mins',
        isFlashing: false,
      }
    case 'red':
      return {
        strokeColor: '#ef4444',
        textColor: 'text-red-500 dark:text-red-400',
        bgGlow: 'rgba(239, 68, 68, 0.14)',
        badgeText: 'Under 5 mins',
        isFlashing: false,
      }
    case 'flashing-red':
      return {
        strokeColor: '#ef4444',
        textColor: 'text-red-500 dark:text-red-400',
        bgGlow: 'rgba(239, 68, 68, 0.22)',
        badgeText: 'Final minute!',
        isFlashing: true,
      }
  }
}

/**
 * Formats seconds into human-readable digital countdown string.
 * If >= 1 hour: "HH:MM:SS" (e.g. "01:23:45")
 * If < 1 hour: "MM:SS" (e.g. "14:59")
 */
export function formatTimerDisplay(seconds: number): {
  formatted: string
  hasHours: boolean
  hoursStr: string
  minutesStr: string
  secondsStr: string
} {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const h = Math.floor(safeSeconds / 3600)
  const m = Math.floor((safeSeconds % 3600) / 60)
  const s = safeSeconds % 60

  const hoursStr = String(h).padStart(2, '0')
  const minutesStr = String(m).padStart(2, '0')
  const secondsStr = String(s).padStart(2, '0')

  const formatted = h > 0 ? `${hoursStr}:${minutesStr}:${secondsStr}` : `${minutesStr}:${secondsStr}`

  return {
    formatted,
    hasHours: h > 0,
    hoursStr,
    minutesStr,
    secondsStr,
  }
}

/**
 * Clamps hours and minutes for custom timer.
 * Maximum duration: 23 hours and 59 minutes (86,340 seconds).
 * Minimum duration: 1 second.
 */
export function clampCustomTimer(hours: number, minutes: number, seconds = 0): number {
  const safeHours = Math.max(0, isNaN(hours) ? 0 : Math.floor(hours))
  const safeMinutes = Math.max(0, isNaN(minutes) ? 0 : Math.floor(minutes))
  const safeSeconds = Math.max(0, isNaN(seconds) ? 0 : Math.floor(seconds))

  const total = safeHours * 3600 + safeMinutes * 60 + safeSeconds
  const MAX_SECONDS = 23 * 3600 + 59 * 60 // 23:59:00 = 86,340s
  return Math.max(1, Math.min(MAX_SECONDS, total))
}
