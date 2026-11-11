// Shared by canvas geese and DOM animals: one visitor, then a quiet interval.
export function createAutumnVisitGate(random: () => number = Math.random) {
  let nextVisit = 0
  let activeUntil = 0
  return {
    defer(now: number, durationMs: number) {
      nextVisit = Math.max(nextVisit, now + durationMs)
    },
    claim(now: number, durationMs: number): boolean {
      if (now < nextVisit) return false
      activeUntil = now + durationMs
      nextVisit = activeUntil + 45_000 + random() * 45_000
      return true
    },
    /** Tap-to-summon: skips the quiet interval but never overlaps a visitor on stage. */
    force(now: number, durationMs: number): boolean {
      if (now < activeUntil) return false
      activeUntil = now + durationMs
      nextVisit = Math.max(nextVisit, activeUntil + 45_000 + random() * 45_000)
      return true
    },
  }
}

export const autumnVisits = createAutumnVisitGate()

export function autumnProgress(date: Date): number {
  return Math.max(0, Math.min(1, (date.getDate() - 1) / 29))
}
