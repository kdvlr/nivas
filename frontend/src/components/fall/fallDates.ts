import {
  computeCanopyDensity,
  computeHollowAcorns,
  computeWoodlandMood,
  type WoodlandMood,
} from '../../lib/woodlandMood'
import type { SkyKind, SkyPhase } from '../sky/skyEngine'
import { getHolidayOverride, getQueryParam, isDiwaliSeason, isNovember } from '../sky/queryParam'

/** US Thanksgiving: the fourth Thursday of November. */
export function thanksgivingDate(year: number): Date {
  const first = new Date(year, 10, 1)
  const firstThursday = 1 + ((4 - first.getDay() + 7) % 7)
  return new Date(year, 10, firstThursday + 21)
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

/** True on Thanksgiving Day itself (or with ?holiday=thanksgiving / ?tgday=1). */
export function isThanksgivingDay(d: Date): boolean {
  if (getQueryParam('tgday') === '1') return true
  const o = getHolidayOverride()?.toLowerCase()
  if (o === 'thanksgiving' || o === 'turkey') return true
  return sameDay(d, thanksgivingDate(d.getFullYear()))
}

/** Whole days until Thanksgiving (0 on the day, negative after). */
export function daysUntilThanksgiving(d: Date): number {
  const tg = thanksgivingDate(d.getFullYear())
  const today = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round((tg.getTime() - today.getTime()) / 86_400_000)
}

/** Day of November used for month progression; ?fallday=N overrides for previews. */
export function fallDayOfMonth(d: Date): number {
  const forced = Number(getQueryParam('fallday'))
  if (forced >= 1 && forced <= 30) return forced
  return d.getDate()
}

/** 0 on Nov 1 → 1 on Nov 30. */
export function fallProgress(d: Date): number {
  return Math.max(0, Math.min(1, (fallDayOfMonth(d) - 1) / 29))
}

/** Regular November woodland scenery (Diwali has its own horizon). */
export function isAutumnScene(d: Date): boolean {
  const horizon = getQueryParam('horizon')?.toLowerCase()
  if (horizon === 'autumn' || horizon === 'harvest' || horizon === 'woodland') return true
  return isNovember(d) && !isDiwaliSeason(d)
}

/** Was this photo taken around a past Thanksgiving (Mon before → Sun after)? Returns the year. */
export function thanksgivingPhotoYear(dateTaken: string | null | undefined, now: Date): number | null {
  if (!dateTaken) return null
  const t = new Date(dateTaken)
  if (Number.isNaN(t.getTime())) return null
  const year = t.getFullYear()
  if (year >= now.getFullYear() && t.getTime() > now.getTime() - 3 * 86_400_000) return null
  const tg = thanksgivingDate(year).getTime()
  const delta = (t.getTime() - tg) / 86_400_000
  return delta >= -3 && delta < 4 ? year : null
}

/** Stable per-day hash so subtle woodland details shift daily but not per render. */
export function dayHash(d: Date, salt = ''): number {
  const s = `${d.getFullYear()}-${d.getMonth()}-${fallDayOfMonth(d)}-${salt}`
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function todayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${fallDayOfMonth(d)}`
}

/** True on cold snaps (<=36°F), snow, late-Nov dawn/night frost, or ?frost=1. */
export function isFrostyWoodland(
  d: Date,
  phase: SkyPhase,
  kind: SkyKind,
  tempF: number | null,
  forcedFrost: string | null = getQueryParam('frost'),
): boolean {
  if (forcedFrost === '1') return true
  if (forcedFrost === '0') return false
  if (kind === 'snowy') return true
  if (tempF !== null && tempF <= 36) return true
  return fallDayOfMonth(d) >= 27 && (phase === 'dawn' || phase === 'night')
}

/** True during brisk autumn wind (>=18 km/h or mph from weather feed), storms, or ?windy=1. */
export function isWindyWoodland(
  kind: SkyKind,
  windSpeed: number,
  forcedWind: string | null = getQueryParam('windy'),
): boolean {
  if (forcedWind === '1') return true
  if (forcedWind === '0') return false
  return kind === 'stormy' || windSpeed >= 18
}

/** Number of acorns visibly stored in the left oak hollow (4 on Nov 1 → 22 on Nov 30). */
export function hollowAcornCount(d: Date): number {
  return computeHollowAcorns(fallProgress(d))
}

/** Canopy foliage fullness tier (3 = lush early Nov, 2 = mid-Nov, 1 = late-Nov bare twigs). */
export function canopyDensity(d: Date): 3 | 2 | 1 {
  return computeCanopyDensity(fallProgress(d))
}

export type { WoodlandMood }

/** Daily & weather routine for all woodland creatures. */
export function deriveWoodlandMood(phase: SkyPhase, kind: SkyKind): WoodlandMood {
  return computeWoodlandMood(phase, kind)
}
