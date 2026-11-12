import test from 'node:test'
import assert from 'node:assert/strict'
import { computeCanopyDensity, computeHollowAcorns, computeWoodlandMood } from './woodlandMood.ts'

test('woodland creatures follow day and night routines on clear days', () => {
  const dawn = computeWoodlandMood('dawn', 'clear')
  assert.equal(dawn.owl, 'sleeping')
  assert.equal(dawn.fox, 'stretching')
  assert.equal(dawn.squirrel, 'foraging')
  assert.equal(dawn.lanternsLit, false)

  const day = computeWoodlandMood('day', 'clear')
  assert.equal(day.owl, 'sleeping')
  assert.equal(day.fox, 'watching')
  assert.equal(day.squirrel, 'foraging')
  assert.equal(day.lanternsLit, false)

  const dusk = computeWoodlandMood('dusk', 'clear')
  assert.equal(dusk.owl, 'awake')
  assert.equal(dusk.fox, 'curled')
  assert.equal(dusk.squirrel, 'foraging')
  assert.equal(dusk.lanternsLit, true)

  const night = computeWoodlandMood('night', 'clear')
  assert.equal(night.owl, 'awake')
  assert.equal(night.fox, 'curled')
  assert.equal(night.squirrel, 'sleeping')
  assert.equal(night.lanternsLit, true)
})

test('rainy and snowy weather shelter foxes, give squirrel leaf umbrella, and light lanterns', () => {
  const rainyDay = computeWoodlandMood('day', 'rainy')
  assert.equal(rainyDay.squirrel, 'umbrella')
  assert.equal(rainyDay.fox, 'curled')
  assert.equal(rainyDay.lanternsLit, true)
  assert.equal(rainyDay.wet, true)

  const snowyDay = computeWoodlandMood('day', 'snowy')
  assert.equal(snowyDay.squirrel, 'cozy')
  assert.equal(snowyDay.fox, 'curled')
  assert.equal(snowyDay.lanternsLit, true)
})

test('hollow acorn stash fills across November while canopy sheds in three tiers', () => {
  assert.equal(computeHollowAcorns(0), 4)
  assert.equal(computeHollowAcorns(0.5), 13)
  assert.equal(computeHollowAcorns(1), 22)

  assert.equal(computeCanopyDensity(0.1), 3)
  assert.equal(computeCanopyDensity(0.5), 2)
  assert.equal(computeCanopyDensity(0.9), 1)
})
