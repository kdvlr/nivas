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
    if (o === 'october' || o === 'oct' || o === 'halloween' || o === 'spooky') {
      return new Date(2026, 9, 15)
    }
    if (o === 'december' || o === 'dec' || o === 'elves' || o === 'elf') {
      return new Date(2026, 11, 15)
    }
    if (o === 'christmas' || o === 'dec25' || o === 'santa') {
      return new Date(2026, 11, 25)
    }
    if (o === 'newyear' || o === 'jan1' || o === 'fireworks') {
      return new Date(2026, 0, 1)
    }
  }
  return now
}

export function isOctober(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 9
}

export function isDecember(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
  return date.getMonth() === 11
}

export function isElfSeason(d?: Date): boolean {
  const date = d ?? getSeasonalDate()
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
