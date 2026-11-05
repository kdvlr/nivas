// One small burst at a time. Quiet photo transitions defer, rather than lose,
// a launch. Resuming after sleep launches once without catching up a backlog.
export function createDiwaliLaunchGate(start: number, random = Math.random) {
  let next = start + 3_000
  return {
    claim(now: number, quiet: boolean): boolean {
      if (quiet || now < next) return false
      next = now + 8_000 + random() * 6_000
      return true
    },
  }
}
