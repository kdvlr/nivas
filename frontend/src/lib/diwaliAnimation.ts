// Small, frequent bursts with bounded particle counts. Quiet photo transitions defer, rather than lose,
// a launch. Resuming after sleep launches once without catching up a backlog.
export function createDiwaliLaunchGate(start: number, random = Math.random) {
  let next = start + 3_000
  return {
    claim(now: number, quiet: boolean): boolean {
      if (quiet || now < next) return false
      next = now + 3_000 + random() * 2_000
      return true
    },
  }
}
