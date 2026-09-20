import test from 'node:test'
import assert from 'node:assert/strict'
import { toLocalDateStr, isEventComplete } from './calendar.ts'

test('toLocalDateStr formats date in YYYY-MM-DD', () => {
  const d = new Date(2026, 8, 19, 14, 30) // month index 8 is September
  assert.equal(toLocalDateStr(d), '2026-09-19')
})

test('isEventComplete - timed events', () => {
  const now = new Date('2026-09-19T15:00:00')

  // Ended 1 hour ago -> complete
  assert.equal(
    isEventComplete({ start: '2026-09-19T13:00:00', end: '2026-09-19T14:00:00', allDay: false }, now),
    true,
  )

  // Ongoing (ends in 1 hour) -> not complete
  assert.equal(
    isEventComplete({ start: '2026-09-19T14:30:00', end: '2026-09-19T16:00:00', allDay: false }, now),
    false,
  )

  // Starts and ends in future -> not complete
  assert.equal(
    isEventComplete({ start: '2026-09-19T17:00:00', end: '2026-09-19T18:00:00', allDay: false }, now),
    false,
  )

  // Ended yesterday -> complete
  assert.equal(
    isEventComplete({ start: '2026-09-18T10:00:00', end: '2026-09-18T11:00:00', allDay: false }, now),
    true,
  )

  // Tomorrow event -> not complete
  assert.equal(
    isEventComplete({ start: '2026-09-20T10:00:00', end: '2026-09-20T11:00:00', allDay: false }, now),
    false,
  )
})

test('isEventComplete - all-day events', () => {
  const now = new Date('2026-09-19T15:00:00')

  // Google Calendar format: 1-day event today has start=2026-09-19, end=2026-09-20 -> not complete today
  assert.equal(
    isEventComplete({ start: '2026-09-19', end: '2026-09-20', allDay: true }, now),
    false,
  )

  // Inclusive format: start=2026-09-19, end=2026-09-19 -> not complete today
  assert.equal(
    isEventComplete({ start: '2026-09-19', end: '2026-09-19', allDay: true }, now),
    false,
  )

  // Yesterday all-day (Google exclusive end format) -> complete
  assert.equal(
    isEventComplete({ start: '2026-09-18', end: '2026-09-19', allDay: true }, now),
    true,
  )

  // Yesterday all-day (inclusive format) -> complete
  assert.equal(
    isEventComplete({ start: '2026-09-18', end: '2026-09-18', allDay: true }, now),
    true,
  )

  // Multi-day ending tomorrow -> not complete
  assert.equal(
    isEventComplete({ start: '2026-09-18', end: '2026-09-21', allDay: true }, now),
    false,
  )

  // Multi-day ended yesterday -> complete
  assert.equal(
    isEventComplete({ start: '2026-09-16', end: '2026-09-19', allDay: true }, now),
    true,
  )
})

test('isEventComplete - Date object and CalEvent property compatibility', () => {
  const now = new Date('2026-09-19T15:00:00')

  // CalEvent using all_day
  assert.equal(
    isEventComplete({ start: '2026-09-19T13:00:00', end: '2026-09-19T14:00:00', all_day: false } as any, now),
    true,
  )

  // Event with Date objects
  assert.equal(
    isEventComplete({ start: new Date('2026-09-19T13:00:00'), end: new Date('2026-09-19T14:00:00'), allDay: false }, now),
    true,
  )
})
