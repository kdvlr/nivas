// Pure helpers for the "Great Woodland Feast" Thanksgiving-week storyline.
// Kept DOM-free so they run under `node --test`.

export type TgPhase = 'dawn' | 'day' | 'dusk' | 'night'
export type TgKind = 'clear' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | string

/** US Thanksgiving: the fourth Thursday of November. */
export function thanksgivingDate(year: number): Date {
  const first = new Date(year, 10, 1)
  const firstThursday = 1 + ((4 - first.getDay() + 7) % 7)
  return new Date(year, 10, firstThursday + 21)
}

/** Thanksgiving week runs from the Sunday before through the Sunday after Thanksgiving. */
export function isInThanksgivingWeek(d: Date): boolean {
  const tg = thanksgivingDate(d.getFullYear())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const start = new Date(tg.getFullYear(), tg.getMonth(), tg.getDate() - 4).getTime()
  const end = new Date(tg.getFullYear(), tg.getMonth(), tg.getDate() + 3).getTime()
  return day >= start && day <= end
}

/** Sleeps until the feast for a November day-of-month (0 on Thanksgiving, negative after). */
export function sleepsUntilFeast(year: number, novemberDay: number): number {
  return thanksgivingDate(year).getDate() - novemberDay
}

export type FeastStage = 1 | 2 | 3 | 4 | 5

/** How built-up the woodland feast table is: a lone stump on Sunday → full banquet on Thursday. */
export function feastStage(sleeps: number): FeastStage {
  if (sleeps >= 4) return 1
  if (sleeps === 3) return 2
  if (sleeps === 2) return 3
  if (sleeps === 1) return 4
  return 5
}

export type FeastGuest = 'squirrel' | 'bunny' | 'chipmunk' | 'hedgehog' | 'fox_kit' | 'turkey'

const GUEST_ORDER: FeastGuest[] = ['squirrel', 'bunny', 'chipmunk', 'hedgehog', 'fox_kit']

/** Guests seated at the table: one new friend arrives each morning, everyone is there on the day. */
export function feastGuests(sleeps: number): FeastGuest[] {
  const count = sleeps >= 4 ? 1 : sleeps === 3 ? 2 : sleeps === 2 ? 3 : sleeps === 1 ? 4 : 5
  const guests = GUEST_ORDER.slice(0, count)
  if (sleeps <= 0) guests.push('turkey')
  return guests
}

/** The guest who arrived today (gets a walk-in entrance), if any. */
export function newestGuest(sleeps: number): FeastGuest | null {
  if (sleeps < 0) return null
  if (sleeps === 0) return 'turkey'
  const list = feastGuests(sleeps)
  return list[list.length - 1] ?? null
}

export type TgDaySegment = 'parade' | 'game' | 'feast' | 'coma'

/** Thanksgiving Day schedule: parade morning, game midday, feast at dusk, food coma at night. */
export function tgDaySegment(hour: number): TgDaySegment {
  if (hour >= 7 && hour < 11) return 'parade'
  if (hour >= 11 && hour < 15) return 'game'
  if (hour >= 15 && hour < 19) return 'feast'
  return 'coma'
}

export type TgInterlude = 'parade' | 'leaf_tornado' | 'balloon' | 'pie_toss' | 'football' | 'turkey_dance'

export const TG_INTERLUDE_MS: Record<TgInterlude, number> = {
  parade: 10_500,
  leaf_tornado: 4_800,
  balloon: 16_000,
  pie_toss: 6_800,
  football: 7_200,
  turkey_dance: 5_200,
}

/** Show-time interludes that make sense for the current moment. */
export function eligibleTgInterludes(phase: TgPhase, kind: TgKind, segment: TgDaySegment | null): TgInterlude[] {
  if (kind === 'rainy' || kind === 'stormy' || kind === 'snowy') return []
  if (segment === 'parade') return ['parade', 'balloon']
  if (segment === 'game') return ['football', 'pie_toss']
  if (segment === 'feast') return ['pie_toss', 'parade', 'leaf_tornado']
  if (segment === 'coma') return []
  if (phase === 'night') return []
  if (phase === 'dusk') return ['parade', 'leaf_tornado', 'balloon']
  return ['parade', 'leaf_tornado', 'balloon', 'pie_toss', 'football']
}

/** Picks an interlude, avoiding an immediate repeat when alternatives exist. */
export function pickTgInterlude(
  pool: TgInterlude[],
  last: TgInterlude | null,
  random: () => number = Math.random,
): TgInterlude | null {
  if (!pool.length) return null
  const filtered = pool.length > 1 && last ? pool.filter((p) => p !== last) : pool
  return filtered[Math.min(filtered.length - 1, Math.floor(random() * filtered.length))]
}

/** Minimum gap between show-time interludes (parade morning is busier, low-power tablets calmer). */
export function interludeCooldownMs(lowQuality: boolean, segment: TgDaySegment | null): number {
  const base = segment === 'parade' ? 75_000 : segment === 'game' ? 90_000 : 120_000
  return lowQuality ? base * 2 : base
}

export const HIDE_SPOTS = ['trunk_left', 'trunk_right', 'owl_branch', 'leaf_pile', 'sign_top'] as const
export type HideSpot = (typeof HIDE_SPOTS)[number]

/** Where the turkey hides today; each time it is found it scurries to the next spot. */
export function hiddenTurkeySpot(daySeed: number, foundCount: number): HideSpot {
  const idx = (Math.abs(daySeed) + Math.max(0, foundCount)) % HIDE_SPOTS.length
  return HIDE_SPOTS[idx]
}

/** Acorns needed before the turkey does a happy dance. */
export const FEED_GOAL = 10

/** True when this acorn completes a full tummy (every 10 acorns). */
export function completesFeed(fedCount: number): boolean {
  return fedCount > 0 && fedCount % FEED_GOAL === 0
}

/** Main countdown sign text. */
export function countdownLabel(sleeps: number): { big: string; small: string } {
  if (sleeps > 1) return { big: `${sleeps} sleeps`, small: 'until the Feast!' }
  if (sleeps === 1) return { big: '1 sleep', small: 'until the Feast!' }
  if (sleeps === 0) return { big: 'Feast Day!', small: 'Happy Thanksgiving!' }
  return { big: 'Leftovers!', small: 'Thankful & full' }
}
