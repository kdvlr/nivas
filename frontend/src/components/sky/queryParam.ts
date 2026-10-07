/**
 * Read a query param from anywhere in the URL.
 *
 * The app is hash-routed, so overrides normally arrive inside the fragment
 * ("#/photos?sky=night&fx=high") where `location.search` is empty. Check the
 * real query string first, then fall back to whatever follows the first "?".
 */
export const getQueryParam = (key: string): string | null => {
  const searchQP = new URLSearchParams(window.location.search)
  if (searchQP.has(key)) return searchQP.get(key)
  const qIdx = window.location.href.indexOf('?')
  if (qIdx !== -1) {
    const qp = new URLSearchParams(window.location.href.substring(qIdx))
    if (qp.has(key)) return qp.get(key)
  }
  return null
}

let cachedHolidayOverride: string | null = null

export const getHolidayOverride = (): string | null => {
  const current = getQueryParam('holiday') || getQueryParam('season')
  if (current) {
    cachedHolidayOverride = current
    return current
  }
  return cachedHolidayOverride
}

export function getSeasonalDate(now: Date = new Date()): Date {
  const override = getHolidayOverride()
  if (override) {
    const o = override.toLowerCase()
    if (o === 'october' || o === 'oct' || o === 'halloween' || o === 'spooky' || o === 'skeleton') {
      return new Date(2026, 9, 15)
    }
    if (o === 'november' || o === 'nov' || o === 'autumn') {
      return new Date(2026, 10, 15)
    }
    if (o === 'diwali') {
      return new Date(2026, 10, 8)
    }
    if (o === 'thanksgiving' || o === 'turkey') {
      return new Date(2026, 10, 26)
    }
    if (o === 'december' || o === 'dec' || o === 'elves' || o === 'elf') {
      return new Date(2026, 11, 15)
    }
    if (o === 'christmas' || o === 'dec25' || o === 'santa') {
      return new Date(2026, 11, 25)
    }
    if (o === 'newyear' || o === 'jan1' || o === 'fireworks' || o === 'balldrop' || o === 'nye') {
      return new Date(2026, 11, 31)
    }
  }
  return now
}

export function isOctober(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 9
}

export function isNovember(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 10
}

export function isDiwaliSeason(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  const override = getHolidayOverride()?.toLowerCase()
  if (override === 'diwali') return true
  // In November, celebrate Diwali festival window (Nov 1 - Nov 12)
  return date.getMonth() === 10 && date.getDate() >= 1 && date.getDate() <= 12
}

export function isThanksgivingWeek(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  const override = getHolidayOverride()?.toLowerCase()
  if (override === 'thanksgiving' || override === 'turkey') return true
  if (date.getMonth() !== 10) return false
  return date.getDate() >= 22 && date.getDate() <= 30
}

export function isDecember(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 11
}

export function isChristmasSeason(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  const override = getHolidayOverride()?.toLowerCase()
  if (override === 'christmas' || override === 'santa') return true
  // Christmas season with string lights runs Dec 1 through Dec 25 (removed on Dec 26)
  return date.getMonth() === 11 && date.getDate() >= 1 && date.getDate() <= 25
}

export function isElfSeason(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  const override = getHolidayOverride()?.toLowerCase()
  if (override === 'elves' || override === 'elf') return true
  // Elves run Dec 1 through Dec 24, strictly removed on Dec 25/26
  return date.getMonth() === 11 && date.getDate() >= 1 && date.getDate() <= 24
}

export function isChristmasDay(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 11 && date.getDate() === 25
}

export function isNewYearsDay(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 0 && date.getDate() === 1
}

export function isNewYearSeason(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  const override = getHolidayOverride()?.toLowerCase()
  if (override === 'newyear' || override === 'balldrop' || override === 'nye' || override === 'jan1') return true
  const m = date.getMonth()
  const day = date.getDate()
  // Dec 26 through Jan 2: New Year celebrations and Ball Drop
  return (m === 11 && day >= 26) || (m === 0 && day <= 2)
}
