// Shared by canvas geese and DOM animals: one visitor, then a quiet interval.
export function createAutumnVisitGate(random: () => number = Math.random) {
  let nextVisit = 0
  return {
    claim(now: number, durationMs: number): boolean {
      if (now < nextVisit) return false
      nextVisit = now + durationMs + 45_000 + random() * 45_000
      return true
    },
  }
}

export const autumnVisits = createAutumnVisitGate()
