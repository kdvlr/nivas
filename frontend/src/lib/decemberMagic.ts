import { isDailyProgressChore, type ChoreScheduleItem } from './chores.ts'

export interface SantaRouteStop {
  idx: number
  total: number
  label: string
  sublabel: string
  emoji: string
}

export const SANTA_ROUTE_STOPS: SantaRouteStop[] = [
  { idx: 0, total: 7, emoji: '🧊', label: 'North Pole Workshop', sublabel: 'Loading the sleigh with gifts' },
  { idx: 1, total: 7, emoji: '🗼', label: 'Tokyo & Sydney', sublabel: 'Gliding over Pacific rooftops' },
  { idx: 2, total: 7, emoji: '🏔️', label: 'India & Himalayas', sublabel: 'Soaring past snowy peaks' },
  { idx: 3, total: 7, emoji: '✨', label: 'Paris & London', sublabel: 'Passing the sparkling Eiffel Tower' },
  { idx: 4, total: 7, emoji: '🌊', label: 'Crossing the Atlantic', sublabel: 'Rudolph leading the way!' },
  { idx: 5, total: 7, emoji: '🗽', label: 'East Coast USA', sublabel: 'New York & New England' },
  { idx: 6, total: 7, emoji: '🤠', label: 'Approaching Texas!', sublabel: 'Time to tuck into bed!' },
]

export const CHRISTMAS_GIFT_NOTES: Array<{ emoji: string; title: string; text: string }> = [
  { emoji: '🦌', title: 'Reindeer Fact!', text: 'Reindeer eyes change from golden in summer to deep blue in winter so they can see better in the snowy dark!' },
  { emoji: '❄️', title: 'Snowflake Secret', text: 'Every snowflake has 6 sides because water molecules naturally link together in tiny hexagons when they freeze!' },
  { emoji: '🍪', title: 'Cookie Magic', text: 'Why did the cookie go to the doctor? Because it was feeling crumbly!' },
  { emoji: '🎄', title: 'Evergreen Wonder', text: 'Pine needles have a waxy coat like a tiny raincoat so the tree stays green even in freezing winter snow!' },
  { emoji: '⛄', title: 'Snowman Riddle', text: 'What do snowmen eat for breakfast? Frosted Flakes and Ice Krispies!' },
  { emoji: '⭐', title: 'North Star', text: 'Polaris stays in almost the exact same spot in the northern sky all night—like a real-life compass for Santa!' },
  { emoji: '🔔', title: 'Jingle Bells', text: 'Jingle Bells was the very first song ever played in outer space by astronauts in 1965!' },
  { emoji: '🎁', title: 'Family Wish', text: 'Give someone in the room a giant warm Christmas hug right now!' },
  { emoji: '🦊', title: 'Winter Coat', text: 'Arctic foxes turn pure white in December so they blend right into the snow like magic!' },
  { emoji: '🎅', title: 'Santa Joke', text: 'What do you call an elf who sings? A wrapper!' },
  { emoji: '✨', title: 'Sparkle Science', text: 'Fresh snow looks bright white because millions of tiny ice crystals bounce all colors of sunlight right back at your eyes!' },
  { emoji: '☕', title: 'Cozy Challenge', text: 'Name three things from this year that made you laugh out loud!' },
]

/** Day of December (1..25) used for Advent progression; ?decday=N overrides for previews. */
export function decemberDayOfMonth(d: Date, forcedDay?: number | null): number {
  if (typeof forcedDay === 'number' && Number.isFinite(forcedDay)) {
    return Math.max(1, Math.min(25, Math.floor(forcedDay)))
  }
  if (d.getMonth() === 11) {
    return Math.max(1, Math.min(25, d.getDate()))
  }
  return 1
}

/** 1 ornament on Dec 1 -> 24 ornaments on Dec 24 & Dec 25. */
export function getAdventOrnamentCount(d: Date, forcedDay?: number | null): number {
  const day = decemberDayOfMonth(d, forcedDay)
  return Math.min(24, Math.max(1, day))
}

/** Days remaining until Dec 25 (24 on Dec 1 -> 1 on Dec 24 -> 0 on Dec 25). */
export function getDaysUntilChristmas(d: Date, forcedDay?: number | null): number {
  return Math.max(0, 25 - decemberDayOfMonth(d, forcedDay))
}

/** True on Christmas Eve evening (Dec 24, 5:00 PM–11:59 PM) or explicit override. */
export function isChristmasEveEvening(
  d: Date,
  forcedDay?: number | null,
  forcedOverride?: string | null,
): boolean {
  const o = forcedOverride?.toLowerCase()
  if (o === 'xmaseve' || o === 'christmaseve') return true
  if (o === 'christmas' || o === 'santa' || o === 'dec25') return false
  const day = decemberDayOfMonth(d, forcedDay)
  return day === 24 && d.getHours() >= 17
}

/** True on Christmas Day (Dec 25) or explicit override. */
export function isChristmasDayActive(
  d: Date,
  forcedDay?: number | null,
  forcedOverride?: string | null,
): boolean {
  const o = forcedOverride?.toLowerCase()
  if (o === 'xmaseve' || o === 'christmaseve') return false
  if (o === 'christmas' || o === 'santa' || o === 'dec25') return true
  return decemberDayOfMonth(d, forcedDay) === 25
}

/** Maps local evening hour (17..23) on Christmas Eve to Santa's 7-stop world route. */
export function getSantaRouteStop(d: Date, forcedHour?: number | null): SantaRouteStop {
  const hour = typeof forcedHour === 'number' && Number.isFinite(forcedHour) ? forcedHour : d.getHours()
  const idx = Math.max(0, Math.min(SANTA_ROUTE_STOPS.length - 1, Math.floor(hour - 17)))
  return SANTA_ROUTE_STOPS[idx]
}

/** Was this photo taken during a past Christmas season (Dec 15–Dec 31 of a prior year)? */
export function christmasPhotoYear(dateTaken: string | null | undefined, now: Date): number | null {
  if (!dateTaken) return null
  const t = new Date(dateTaken)
  if (Number.isNaN(t.getTime())) return null
  const year = t.getFullYear()
  if (year >= now.getFullYear()) return null
  if (t.getMonth() === 11 && t.getDate() >= 15) return year
  return null
}

export interface DailyChoreCompletion {
  total: number
  done: number
  allDone: boolean
}

/** True when all same-day positive chores (excluding penalties & future chores) are completed. */
export function computeDailyChoresComplete(
  chores: Array<Pick<ChoreScheduleItem, 'due_date' | 'coins'> & { completed?: boolean }>,
  todayStr: string,
): DailyChoreCompletion {
  const todays = chores.filter((c) => isDailyProgressChore(c, todayStr))
  const total = todays.length
  const done = todays.filter((c) => Boolean(c.completed)).length
  return { total, done, allDone: total > 0 && done >= total }
}
