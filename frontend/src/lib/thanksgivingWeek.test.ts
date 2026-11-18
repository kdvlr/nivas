import test from 'node:test'
import assert from 'node:assert/strict'
import {
  completesFeed,
  countdownLabel,
  eligibleTgInterludes,
  feastGuests,
  feastStage,
  hiddenTurkeySpot,
  HIDE_SPOTS,
  interludeCooldownMs,
  isInThanksgivingWeek,
  newestGuest,
  pickTgInterlude,
  sleepsUntilFeast,
  tgDaySegment,
  thanksgivingDate,
} from './thanksgivingWeek.ts'

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

test('feast table and guest list grow one step per day', () => {
  assert.equal(sleepsUntilFeast(2026, 22), 4)
  assert.deepEqual([4, 3, 2, 1, 0, -1].map(feastStage), [1, 2, 3, 4, 5, 5])
  assert.deepEqual(feastGuests(4), ['squirrel'])
  assert.deepEqual(feastGuests(2), ['squirrel', 'bunny', 'chipmunk'])
  assert.deepEqual(feastGuests(0), ['squirrel', 'bunny', 'chipmunk', 'hedgehog', 'fox_kit', 'turkey'])
  assert.equal(newestGuest(3), 'bunny')
  assert.equal(newestGuest(0), 'turkey')
  assert.equal(newestGuest(-2), null)
})

test('thanksgiving day segments follow parade, game, feast and food coma', () => {
  assert.deepEqual([6, 7, 10, 11, 14, 15, 18, 19, 23].map(tgDaySegment), [
    'coma', 'parade', 'parade', 'game', 'game', 'feast', 'feast', 'coma', 'coma',
  ])
})

test('interludes respect weather, time of day and thanksgiving day segment', () => {
  assert.deepEqual(eligibleTgInterludes('day', 'rainy', null), [])
  assert.deepEqual(eligibleTgInterludes('night', 'clear', null), [])
  assert.deepEqual(eligibleTgInterludes('day', 'clear', 'parade'), ['parade', 'balloon'])
  assert.deepEqual(eligibleTgInterludes('day', 'clear', 'game'), ['football', 'pie_toss'])
  assert.equal(eligibleTgInterludes('day', 'clear', null).length, 5)
  assert.equal(pickTgInterlude(['parade', 'balloon'], 'parade', () => 0), 'balloon')
  assert.equal(pickTgInterlude([], null), null)
  assert.equal(interludeCooldownMs(false, null), 120_000)
  assert.equal(interludeCooldownMs(true, 'parade'), 150_000)
})

test('hidden turkey moves to a new spot each time it is found', () => {
  const first = hiddenTurkeySpot(7, 0)
  const second = hiddenTurkeySpot(7, 1)
  assert.notEqual(first, second)
  assert.equal(hiddenTurkeySpot(7, HIDE_SPOTS.length), first)
})

test('feed goal and countdown labels', () => {
  assert.equal(completesFeed(9), false)
  assert.equal(completesFeed(10), true)
  assert.equal(completesFeed(20), true)
  assert.deepEqual(countdownLabel(3), { big: '3 sleeps', small: 'until the Feast!' })
  assert.equal(countdownLabel(1).big, '1 sleep')
  assert.equal(countdownLabel(0).big, 'Feast Day!')
  assert.equal(countdownLabel(-1).big, 'Leftovers!')
})
