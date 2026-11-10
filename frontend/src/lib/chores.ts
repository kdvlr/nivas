export interface ChoreScheduleItem {
  id: number
  title: string
  coins: number
  due_date?: string
  completed: boolean
}

/** Manual parent-triggered penalty cards have negative coin values. */
export function isPenaltyChore(chore: Pick<ChoreScheduleItem, 'coins'>): boolean {
  return chore.coins < 0
}

/**
 * True when a chore or penalty card belongs on Today's board rather than Upcoming.
 * Future-dated items (`due_date > today`) stay in Upcoming until their scheduled day.
 */
export function isChoreActionableToday(
  chore: Pick<ChoreScheduleItem, 'due_date'>,
  today: string,
): boolean {
  return !chore.due_date || chore.due_date <= today
}

/**
 * True when a chore counts toward same-day completion progress (Home `X/Y done`,
 * Chores `N left` badge, and Ambient Calendar pending chores).
 * Excludes future chores and negative-coin manual penalty buttons.
 */
export function isDailyProgressChore(
  chore: Pick<ChoreScheduleItem, 'due_date' | 'coins'>,
  today: string,
): boolean {
  return isChoreActionableToday(chore, today) && !isPenaltyChore(chore)
}

/**
 * Order Today's items within a member's column:
 * 1. Same-day positive chores (`coins >= 0`), open before completed
 * 2. Manual parent penalty buttons (`coins < 0`), open before completed
 */
export function sortTodayChores<T extends Pick<ChoreScheduleItem, 'coins' | 'completed' | 'title'>>(
  items: readonly T[],
): T[] {
  return [...items].sort((a, b) => {
    const aPenalty = isPenaltyChore(a)
    const bPenalty = isPenaltyChore(b)
    if (aPenalty !== bPenalty) return aPenalty ? 1 : -1
    if (a.completed !== b.completed) return a.completed ? 1 : -1
    return 0
  })
}
