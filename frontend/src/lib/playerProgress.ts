import { useSyncExternalStore } from 'react'

/**
 * Playback position lives outside React state on purpose.
 *
 * The backend broadcasts player_state every second while a song plays. Keeping
 * `elapsedSeconds` in App state re-rendered the entire dashboard (current view,
 * screensaver, timer overlay) once a second on the kiosk tablet. Only the
 * progress readouts subscribe here, so only they re-render.
 */
let elapsed = 0
const listeners = new Set<() => void>()

export function setPlayerElapsed(seconds: number) {
  const next = Number.isFinite(seconds) ? seconds : 0
  if (next === elapsed) return
  elapsed = next
  listeners.forEach((listener) => listener())
}

export function getPlayerElapsed() {
  return elapsed
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePlayerElapsed() {
  return useSyncExternalStore(subscribe, getPlayerElapsed, getPlayerElapsed)
}
