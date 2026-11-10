import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  isChoreActionableToday,
  isDailyProgressChore,
  isPenaltyChore,
  sortTodayChores,
} from './chores.ts'

describe('Same-day chores & penalty helpers', () => {
  const today = '2026-11-10'

  it('distinguishes positive chores from manual penalty buttons', () => {
    assert.equal(isPenaltyChore({ coins: 5 }), false)
    assert.equal(isPenaltyChore({ coins: 0 }), false)
    assert.equal(isPenaltyChore({ coins: -10 }), true)
  })

  it('treats undated or today-dated items as actionable today and future items as upcoming', () => {
    assert.equal(isChoreActionableToday({ due_date: '' }, today), true)
    assert.equal(isChoreActionableToday({ due_date: '2026-11-10' }, today), true)
    assert.equal(isChoreActionableToday({ due_date: '2026-11-11' }, today), false)
  })

  it('excludes manual penalty buttons and upcoming chores from daily progress counts', () => {
    const sample = [
      { id: 1, title: 'Do dishes', coins: 5, due_date: '2026-11-10', completed: true },
      { id: 2, title: 'Feed pets', coins: 5, due_date: '2026-11-10', completed: false },
      { id: 3, title: 'Room Not Clean', coins: -10, due_date: '2026-11-10', completed: false },
      { id: 4, title: 'Clean garage', coins: 15, due_date: '2026-11-14', completed: false },
    ]

    const progressItems = sample.filter((c) => isDailyProgressChore(c, today))
    assert.deepEqual(
      progressItems.map((c) => c.id),
      [1, 2],
    )

    const openProgressItems = progressItems.filter((c) => !c.completed)
    assert.deepEqual(
      openProgressItems.map((c) => c.id),
      [2],
    )
  })

  it('orders same-day positive chores above manual penalty buttons', () => {
    const items = [
      { id: 1, title: 'Room Not Clean', coins: -10, completed: false },
      { id: 2, title: 'Do dishes', coins: 5, completed: true },
      { id: 3, title: 'Make bed', coins: 3, completed: false },
    ]

    const sorted = sortTodayChores(items)
    assert.deepEqual(
      sorted.map((c) => c.id),
      [3, 2, 1],
    )
  })
})
