// Shared by canvas geese and DOM animals: one visitor, then a quiet interval.
export function createAutumnVisitGate(random: () => number = Math.random) {
  let nextVisit = 0
  return {
    defer(now: number, durationMs: number) {
      nextVisit = Math.max(nextVisit, now + durationMs)
    },
    claim(now: number, durationMs: number): boolean {
      if (now < nextVisit) return false
      nextVisit = now + durationMs + 45_000 + random() * 45_000
      return true
    },
  }
}

export const autumnVisits = createAutumnVisitGate()

export function autumnProgress(date: Date): number {
  return Math.max(0, Math.min(1, (date.getDate() - 1) / 29))
}
