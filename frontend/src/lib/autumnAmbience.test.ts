import test from 'node:test'
import assert from 'node:assert/strict'
import { createAutumnVisitGate } from './autumnAmbience.ts'

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
