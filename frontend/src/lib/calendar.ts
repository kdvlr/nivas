import type { CalEvent } from './types'

/**
 * Format a Date object to YYYY-MM-DD in local time.
 */
export const toLocalDateStr = (d: Date): string => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export interface EventTimeInfo {
  start: Date | string | null | undefined
  end?: Date | string | null | undefined
  allDay?: boolean
  all_day?: boolean
}

/**
 * Returns true if a calendar event has finished/completed.
 * - For timed events: end time <= now
 * - For all-day events: event concluded before today
 */
export function isEventComplete(event: EventTimeInfo | CalEvent, now: Date = new Date()): boolean {
  const isAllDay = Boolean(
    'allDay' in event ? event.allDay : 'all_day' in event ? event.all_day : false,
  )

  if (isAllDay) {
    const todayStr = toLocalDateStr(now)
    const startStr =
      typeof event.start === 'string'
        ? event.start.slice(0, 10)
        : event.start instanceof Date
        ? toLocalDateStr(event.start)
        : ''
    const endRaw = event.end ?? event.start
    const endStr =
      typeof endRaw === 'string'
        ? endRaw.slice(0, 10)
        : endRaw instanceof Date
        ? toLocalDateStr(endRaw)
        : startStr

    // Single-day all-day event from Google Calendar has exclusive end = start + 1 day
    if (endStr > startStr) {
      return endStr <= todayStr
    }
    // Inclusive or single-day identical string (e.g. created locally)
    return endStr < todayStr
  }

  const endVal = event.end ?? event.start
  if (!endVal) return false
  const endDate = endVal instanceof Date ? endVal : new Date(endVal)
  return !isNaN(endDate.getTime()) && endDate.getTime() <= now.getTime()
}
