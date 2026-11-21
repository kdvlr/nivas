// Pure date helpers for US Thanksgiving and Thanksgiving week.
// Kept DOM-free so they run under `node --test`.

/** US Thanksgiving: the fourth Thursday of November. */
export function thanksgivingDate(year: number): Date {
  const first = new Date(year, 10, 1)
  const firstThursday = 1 + ((4 - first.getDay() + 7) % 7)
  return new Date(year, 10, firstThursday + 21)
}

/** Thanksgiving week runs from the Sunday before through the Sunday after Thanksgiving. */
export function isInThanksgivingWeek(d: Date): boolean {
  const tg = thanksgivingDate(d.getFullYear())
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const start = new Date(tg.getFullYear(), tg.getMonth(), tg.getDate() - 4).getTime()
  const end = new Date(tg.getFullYear(), tg.getMonth(), tg.getDate() + 3).getTime()
  return day >= start && day <= end
}
