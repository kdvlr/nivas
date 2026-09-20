import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getTimerStage,
  getStageStyles,
  formatTimerDisplay,
  clampCustomTimer,
} from './timer.ts'

test('getTimerStage resolves exact threshold boundaries', () => {
  // > 15m: green
  assert.equal(getTimerStage(1200), 'green')
  assert.equal(getTimerStage(901), 'green')

  // <= 15m and > 10m: greenish-yellow
  assert.equal(getTimerStage(900), 'greenish-yellow')
  assert.equal(getTimerStage(750), 'greenish-yellow')
  assert.equal(getTimerStage(601), 'greenish-yellow')

  // <= 10m and > 5m: yellow
  assert.equal(getTimerStage(600), 'yellow')
  assert.equal(getTimerStage(450), 'yellow')
  assert.equal(getTimerStage(301), 'yellow')

  // <= 5m and > 1m: red
  assert.equal(getTimerStage(300), 'red')
  assert.equal(getTimerStage(180), 'red')
  assert.equal(getTimerStage(61), 'red')

  // <= 1m: flashing-red
  assert.equal(getTimerStage(60), 'flashing-red')
  assert.equal(getTimerStage(30), 'flashing-red')
  assert.equal(getTimerStage(1), 'flashing-red')
  assert.equal(getTimerStage(0), 'flashing-red')
})

test('getStageStyles returns correct styling and flashing attributes', () => {
  const green = getStageStyles('green')
  assert.equal(green.strokeColor, '#22c55e')
  assert.equal(green.isFlashing, false)

  const greenishYellow = getStageStyles('greenish-yellow')
  assert.equal(greenishYellow.strokeColor, '#84cc16')
  assert.equal(greenishYellow.isFlashing, false)

  const yellow = getStageStyles('yellow')
  assert.equal(yellow.strokeColor, '#eab308')
  assert.equal(yellow.isFlashing, false)

  const red = getStageStyles('red')
  assert.equal(red.strokeColor, '#ef4444')
  assert.equal(red.isFlashing, false)

  const flashingRed = getStageStyles('flashing-red')
  assert.equal(flashingRed.strokeColor, '#ef4444')
  assert.equal(flashingRed.isFlashing, true)
})

test('formatTimerDisplay handles under-hour and multi-hour durations', () => {
  assert.deepEqual(formatTimerDisplay(0), {
    formatted: '00:00',
    hasHours: false,
    hoursStr: '00',
    minutesStr: '00',
    secondsStr: '00',
  })

  assert.equal(formatTimerDisplay(45).formatted, '00:45')
  assert.equal(formatTimerDisplay(300).formatted, '05:00')
  assert.equal(formatTimerDisplay(900).formatted, '15:00')
  assert.equal(formatTimerDisplay(3661).formatted, '01:01:01')
  assert.equal(formatTimerDisplay(86340).formatted, '23:59:00')
})

test('clampCustomTimer enforces 23:59 ceiling and positive duration', () => {
  // 0 hours, 0 mins -> clamped to 1 sec minimum
  assert.equal(clampCustomTimer(0, 0), 1)

  // 5 mins -> 300s
  assert.equal(clampCustomTimer(0, 5), 300)

  // 45 mins -> 2700s
  assert.equal(clampCustomTimer(0, 45), 2700)

  // 1 hour 30 mins -> 5400s
  assert.equal(clampCustomTimer(1, 30), 5400)

  // Exactly 23:59 -> 86,340s
  assert.equal(clampCustomTimer(23, 59), 86340)

  // Out of bounds values clamped to 23:59
  assert.equal(clampCustomTimer(24, 0), 86340)
  assert.equal(clampCustomTimer(50, 99), 86340)
})
