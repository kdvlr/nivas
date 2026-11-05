import test from 'node:test'
import assert from 'node:assert/strict'
import { createDiwaliLaunchGate } from './diwaliAnimation.ts'

test('photo transitions defer fireworks without losing the launch', () => {
  const gate = createDiwaliLaunchGate(0, () => 0)
  assert.equal(gate.claim(2_999, false), false)
  assert.equal(gate.claim(3_000, true), false)
  assert.equal(gate.claim(9_000, true), false)
  assert.equal(gate.claim(10_000, false), true)
  assert.equal(gate.claim(17_999, false), false)
  assert.equal(gate.claim(18_000, false), true)
})

test('longest launch spacing is fourteen seconds and wake does not create a backlog', () => {
  const gate = createDiwaliLaunchGate(0, () => 1)
  assert.equal(gate.claim(3_000, false), true)
  assert.equal(gate.claim(16_999, false), false)
  assert.equal(gate.claim(17_000, false), true)
  assert.equal(gate.claim(3600_000, false), true)
  assert.equal(gate.claim(3600_001, false), false)
})
