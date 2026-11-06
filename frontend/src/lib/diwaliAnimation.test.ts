import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiwaliLaunchGate } from './diwaliAnimation.ts'
import { isDiwaliSeason } from '../components/sky/queryParam.ts'

test('isDiwaliSeason active window starts Nov 6 at 6pm and ends when Nov 9 starts', () => {
  // Before Nov 6 6pm: false
  assert.equal(isDiwaliSeason(new Date(2026, 10, 5, 23, 59, 59)), false)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 6, 0, 0, 0)), false)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 6, 17, 59, 59)), false)

  // Starts Nov 6 at 6:00 PM (18:00): true
  assert.equal(isDiwaliSeason(new Date(2026, 10, 6, 18, 0, 0)), true)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 6, 23, 59, 59)), true)

  // Nov 7 and Nov 8 (all day): true
  assert.equal(isDiwaliSeason(new Date(2026, 10, 7, 0, 0, 0)), true)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 7, 12, 0, 0)), true)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 8, 0, 0, 0)), true)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 8, 23, 59, 59)), true)

  // Ends when Nov 9 starts (midnight 00:00:00): false
  assert.equal(isDiwaliSeason(new Date(2026, 10, 9, 0, 0, 0)), false)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 9, 12, 0, 0)), false)
  assert.equal(isDiwaliSeason(new Date(2026, 10, 10, 0, 0, 0)), false)

  // Other months: false
  assert.equal(isDiwaliSeason(new Date(2026, 9, 31, 20, 0, 0)), false) // Oct 31
  assert.equal(isDiwaliSeason(new Date(2026, 11, 7, 20, 0, 0)), false) // Dec 7
})

test('photo transitions defer fireworks without losing the launch', () => {
  const gate = createDiwaliLaunchGate(0, () => 0)
  assert.equal(gate.claim(2_999, false), false)
  assert.equal(gate.claim(3_000, true), false)
  assert.equal(gate.claim(9_000, true), false)
  assert.equal(gate.claim(10_000, false), true)
  assert.equal(gate.claim(12_999, false), false)
  assert.equal(gate.claim(13_000, false), true)
})

test('longest launch spacing is five seconds and wake does not create a backlog', () => {
  const gate = createDiwaliLaunchGate(0, () => 1)
  assert.equal(gate.claim(3_000, false), true)
  assert.equal(gate.claim(7_999, false), false)
  assert.equal(gate.claim(8_000, false), true)
  assert.equal(gate.claim(3600_000, false), true)
  assert.equal(gate.claim(3600_001, false), false)
})
