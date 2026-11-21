import test from 'node:test'
import assert from 'node:assert/strict'
import { isInThanksgivingWeek, thanksgivingDate } from './thanksgivingWeek.ts'

test('thanksgiving week spans the Sunday before through the Sunday after the fourth Thursday', () => {
  assert.equal(thanksgivingDate(2026).getDate(), 26)
  assert.equal(isInThanksgivingWeek(new Date(2026, 10, 21)), false)
  assert.equal(isInThanksgivingWeek(new Date(2026, 10, 22)), true)
  assert.equal(isInThanksgivingWeek(new Date(2026, 10, 29)), true)
  assert.equal(isInThanksgivingWeek(new Date(2026, 10, 30)), false)
  // 2029: Thanksgiving falls on Nov 22, so the week starts Nov 18.
  assert.equal(thanksgivingDate(2029).getDate(), 22)
  assert.equal(isInThanksgivingWeek(new Date(2029, 10, 18)), true)
  assert.equal(isInThanksgivingWeek(new Date(2029, 10, 27)), false)
})
