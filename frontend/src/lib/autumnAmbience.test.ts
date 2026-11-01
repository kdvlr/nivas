import test from 'node:test'
import assert from 'node:assert/strict'
import { autumnProgress, createAutumnVisitGate } from './autumnAmbience.ts'

test('visitors cannot overlap and must leave a full quiet interval', () => {
  const gate = createAutumnVisitGate(() => 0)
  assert.equal(gate.claim(0, 9_400), true)
  assert.equal(gate.claim(8_000, 12_000), false)
  assert.equal(gate.claim(54_399, 12_000), false)
  assert.equal(gate.claim(54_400, 12_000), true)
})

test('longest quiet interval is 90 seconds after the visit ends', () => {
  const gate = createAutumnVisitGate(() => 1)
  assert.equal(gate.claim(5_000, 12_000), true)
  assert.equal(gate.claim(106_999, 8_500), false)
  assert.equal(gate.claim(107_000, 8_500), true)
})

test('photo entrances defer new visitors without shortening an existing quiet interval', () => {
  const gate = createAutumnVisitGate(() => 0)
  gate.defer(0, 2_000)
  assert.equal(gate.claim(1_999, 8_500), false)
  assert.equal(gate.claim(2_000, 8_500), true)
  gate.defer(3_000, 2_000)
  assert.equal(gate.claim(55_499, 8_500), false)
  assert.equal(gate.claim(55_500, 8_500), true)
})

test('November canopy thins steadily from the first to the last day', () => {
  assert.equal(autumnProgress(new Date(2026, 10, 1)), 0)
  assert.ok(autumnProgress(new Date(2026, 10, 15)) > 0.4)
  assert.equal(autumnProgress(new Date(2026, 10, 30)), 1)
})
