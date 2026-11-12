import assert from 'node:assert/strict'
import test from 'node:test'
import {
  eligibleWoodlandVignettes,
  pickWoodlandVignette,
  VIGNETTE_DURATIONS_MS,
} from './woodlandVignettes.ts'

test('daytime clear weather enables fox chase, squirrel sortie, bunny, woodpecker, and acorn drop', () => {
  const day = eligibleWoodlandVignettes('day', 'clear')
  assert.ok(day.includes('chase'))
  assert.ok(day.includes('sortie'))
  assert.ok(day.includes('bunny'))
  assert.ok(day.includes('peck'))
  assert.ok(day.includes('acorn_drop'))
  assert.ok(!day.includes('fireflies'))
})

test('night and dusk feature fireflies while rainy and snowy weather pause outdoor vignettes', () => {
  assert.deepEqual(eligibleWoodlandVignettes('night', 'clear'), ['fireflies'])
  assert.ok(eligibleWoodlandVignettes('dusk', 'cloudy').includes('fireflies'))
  assert.deepEqual(eligibleWoodlandVignettes('day', 'rainy'), [])
  assert.deepEqual(eligibleWoodlandVignettes('day', 'snowy'), [])
  assert.deepEqual(eligibleWoodlandVignettes('night', 'stormy'), [])
})

test('pickWoodlandVignette avoids immediate repeats when multiple vignettes are eligible', () => {
  for (let i = 0; i < 10; i++) {
    const picked = pickWoodlandVignette('day', 'clear', 'chase', () => i / 10)
    assert.notEqual(picked, 'chase')
    assert.ok(picked && VIGNETTE_DURATIONS_MS[picked] > 0)
  }
})
