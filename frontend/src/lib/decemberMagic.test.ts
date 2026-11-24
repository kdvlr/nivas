import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  christmasPhotoYear,
  computeDailyChoresComplete,
  getAdventOrnamentCount,
  getDaysUntilChristmas,
  getSantaRouteStop,
  isChristmasDayActive,
  isChristmasEveEvening,
} from './decemberMagic.ts'

describe('December & Christmas slideshow helpers', () => {
  it('grows ornaments from 1 on Dec 1 to 24 on Dec 24 and Dec 25', () => {
    assert.equal(getAdventOrnamentCount(new Date(2026, 11, 1)), 1)
    assert.equal(getAdventOrnamentCount(new Date(2026, 11, 12)), 12)
    assert.equal(getAdventOrnamentCount(new Date(2026, 11, 24)), 24)
    assert.equal(getAdventOrnamentCount(new Date(2026, 11, 25)), 24)
    assert.equal(getDaysUntilChristmas(new Date(2026, 11, 1)), 24)
    assert.equal(getDaysUntilChristmas(new Date(2026, 11, 24)), 1)
    assert.equal(getDaysUntilChristmas(new Date(2026, 11, 25)), 0)
  })

  it('activates Christmas Eve evening after 5pm and Christmas Day on Dec 25', () => {
    assert.equal(isChristmasEveEvening(new Date(2026, 11, 24, 15, 0)), false)
    assert.equal(isChristmasEveEvening(new Date(2026, 11, 24, 17, 0)), true)
    assert.equal(isChristmasEveEvening(new Date(2026, 11, 25, 19, 0)), false)
    assert.equal(isChristmasDayActive(new Date(2026, 11, 25, 8, 0)), true)
    assert.equal(isChristmasEveEvening(new Date(2026, 11, 10, 10, 0), null, 'xmaseve'), true)
    assert.equal(isChristmasDayActive(new Date(2026, 11, 10, 10, 0), null, 'christmas'), true)
  })

  it('advances Santa route across the 7 evening hours on Christmas Eve', () => {
    assert.equal(getSantaRouteStop(new Date(2026, 11, 24, 17, 0)).idx, 0)
    assert.equal(getSantaRouteStop(new Date(2026, 11, 24, 20, 0)).label, 'Paris & London')
    assert.equal(getSantaRouteStop(new Date(2026, 11, 24, 23, 30)).idx, 6)
  })

  it('identifies past Christmas memories (Dec 15-31 of prior years)', () => {
    const now = new Date(2026, 11, 10)
    assert.equal(christmasPhotoYear('2024-12-25T10:00:00Z', now), 2024)
    assert.equal(christmasPhotoYear('2023-12-18T18:00:00Z', now), 2023)
    assert.equal(christmasPhotoYear('2024-12-05T10:00:00Z', now), null)
    assert.equal(christmasPhotoYear('2026-12-20T10:00:00Z', now), null)
  })

  it('triggers Eiffel Tower tree shimmer only when all same-day positive chores are complete', () => {
    const today = '2026-12-10'
    assert.deepEqual(computeDailyChoresComplete([], today), { total: 0, done: 0, allDone: false })
    assert.deepEqual(
      computeDailyChoresComplete(
        [
          { due_date: today, coins: 5, completed: true },
          { due_date: today, coins: 5, completed: false },
          { due_date: today, coins: -5, completed: false },
        ],
        today,
      ),
      { total: 2, done: 1, allDone: false },
    )
    assert.deepEqual(
      computeDailyChoresComplete(
        [
          { due_date: today, coins: 5, completed: true },
          { due_date: today, coins: 10, completed: true },
          { due_date: today, coins: -5, completed: false },
          { due_date: '2026-12-15', coins: 5, completed: false },
        ],
        today,
      ),
      { total: 2, done: 2, allDone: true },
    )
  })
})
