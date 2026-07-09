import { useMemo } from 'react'
import { api } from '../lib/api'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import { useCelebration } from '../components/celebrations/CelebrationContext'
import { useClock, useData, todayISO, addDaysISO } from '../lib/hooks'
import type { CalEvent, ChoreItem, MealDay, ShoppingItem, Task, WeatherData } from '../lib/types'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })

const getLocalDateString = (iso: string) => {
  if (!iso.includes('T')) {
    return iso.slice(0, 10)
  }
  const d = new Date(iso)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const getDayLabel = (isoDate: string, index: number) => {
  if (index === 0) return 'Today'
  if (index === 1) return 'Tomorrow'
  const d = new Date(isoDate + 'T12:00:00')
  return d.toLocaleDateString(undefined, { weekday: 'long' })
}

export default function Home() {
  const now = useClock()
  const today = todayISO()
  const { data: events, loading: loadingEvents } = useData<CalEvent[]>(
    `/api/calendar/events?start=${today}T00:00:00&end=${addDaysISO(today, 3)}T00:00:00`,
    ['calendar'],
  )
  const { data: taskData, loading: loadingTasks, reload: reloadTasks } = useData<{ tasks: Task[] }>(
    '/api/tasks?range=today',
    ['tasks'],
  )
  const { data: chores, loading: loadingChores, reload: reloadChores } = useData<ChoreItem[]>('/api/chores', ['chores'])
  const { data: shopping, loading: loadingShopping, reload: reloadShopping } = useData<ShoppingItem[]>('/api/shopping', ['shopping'])
  const { data: meals, loading: loadingMeals } = useData<MealDay[]>(`/api/meals?start=${today}&days=1`, ['meals'])
  const { data: weather } = useData<WeatherData>('/api/weather', [], 15 * 60 * 1000)
  const { data: config } = useData<{ family_name: string; secondary_tz: string; secondary_tz_emoji: string }>(
    '/api/setup/config',
    ['setup'],
  )
  const { celebrate } = useCelebration()

  const tasks = taskData?.tasks ?? []
  const openTasks = useMemo(() => tasks.filter((t) => !t.completed), [tasks])
  const shoppingOpen = useMemo(() => (shopping ?? []).filter((i) => !i.completed), [shopping])
  const shoppingCount = shoppingOpen.length
  const shoppingPeek = shoppingOpen.slice(0, 5)
  const todayMeals = meals?.[0]?.slots

  // chores relevant today (one-offs due/overdue + recurring scheduled today)
  const dow = (now.getDay() + 6) % 7 // Monday = 0, matches backend recurrence encoding
  const choreDueToday = (c: ChoreItem) => {
    if (c.recurrence === 'daily') return true
    if (c.recurrence.startsWith('weekly:'))
      return c.recurrence.slice(7).split(',').map(Number).includes(dow)
    return !c.due_date || c.due_date <= today
  }
  const todayChores = useMemo(() => (chores ?? []).filter(choreDueToday), [chores, dow, today])
  const openChores = useMemo(() => todayChores.filter((c) => !c.completed), [todayChores])
  const todayWeather = weather?.daily.find((d) => d.date === today)

  const day0 = today
  const day1 = addDaysISO(today, 1)
  const day2 = addDaysISO(today, 2)
  const daysList = [day0, day1, day2]

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    map.set(day0, [])
    map.set(day1, [])
    map.set(day2, [])

    const sortedEvents = [...(events ?? [])].sort((a, b) => a.start.localeCompare(b.start))
    for (const e of sortedEvents) {
      const dateStr = getLocalDateString(e.start)
      if (map.has(dateStr)) {
        map.get(dateStr)!.push(e)
      }
    }
    return map
  }, [events, day0, day1, day2])

  const completeChore = async (c: ChoreItem) => {
    await api.patch(`/api/chores/${c.id}`, { completed: true })
    celebrate()
    reloadChores()
  }
  // no celebration for to-dos on the home screen — they're grown-up chores
  const completeTask = async (t: Task) => {
    await api.patch(`/api/tasks/${t.id}`, { completed: true })
    reloadTasks()
  }
  const buyItem = async (i: ShoppingItem) => {
    await api.patch(`/api/shopping/${i.id}`, { completed: true })
    reloadShopping()
  }

  const getTzDateString = (date: Date, timeZone: string) => {
    try {
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
      const parts = formatter.formatToParts(date)
      const year = parts.find((p) => p.type === 'year')?.value
      const month = parts.find((p) => p.type === 'month')?.value
      const day = parts.find((p) => p.type === 'day')?.value
      return `${year}-${month}-${day}`
    } catch (e) {
      return ''
    }
  }

  return (
    <div className="flex h-full flex-col gap-3 lg:gap-4">
      {/* header */}
      <header className="glass flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 lg:px-8 lg:py-2.5">
        <div>
          <p className="text-xs font-medium tracking-widest text-rose-400 uppercase">
            {config?.family_name ? `${config.family_name} Nivas` : 'Nivas'}
          </p>
          <h1 className="text-lg font-medium tracking-tight text-ink lg:text-2xl">
            {now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
          </h1>
        </div>
        {weather?.current && (
          <div className="flex items-center gap-2 rounded-xl px-2 lg:px-3">
            <span className="text-3xl lg:text-4xl">{weather.current.icon}</span>
            <div>
              <div className="text-lg font-normal text-ink lg:text-xl leading-none">
                {weather.current.temp}°
              </div>
              <div className="text-[0.7rem] font-medium text-ink-soft lg:text-xs mt-0.5">
                {weather.current.label}
                {todayWeather && (
                  <span className="text-ink-faint">
                    {' '}
                    · H {todayWeather.tmax}° L {todayWeather.tmin}°
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="ml-auto flex flex-col items-end">
          <div className="text-3xl font-normal tabular-nums tracking-tight text-[var(--primary)] lg:text-4xl leading-none">
            {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </div>
          {(() => {
            const secondaryTz = config?.secondary_tz || 'Asia/Kolkata'
            const secondaryEmoji = config?.secondary_tz_emoji || '🇮🇳'
            const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
            const localDateStr = getTzDateString(now, localTz)
            const secondaryDateStr = getTzDateString(now, secondaryTz)
            const hasDateDiff = localDateStr !== secondaryDateStr && secondaryDateStr !== ''

            let secondaryDateFormatted = ''
            if (hasDateDiff) {
              try {
                secondaryDateFormatted = new Intl.DateTimeFormat('en-US', {
                  timeZone: secondaryTz,
                  month: 'short',
                  day: 'numeric',
                }).format(now)
              } catch (e) {}
            }

            let secondaryTimeFormatted = ''
            try {
              secondaryTimeFormatted = now.toLocaleTimeString(undefined, {
                timeZone: secondaryTz,
                hour: 'numeric',
                minute: '2-digit',
              })
            } catch (e) {
              secondaryTimeFormatted = now.toLocaleTimeString()
            }

            return (
              <div className="mt-1 flex gap-3 text-sm lg:text-base font-semibold text-ink-soft">
                <span>
                  {secondaryEmoji} {secondaryTimeFormatted}
                  {hasDateDiff && secondaryDateFormatted && (
                    <span className="ml-1 text-xs opacity-85">
                      ({secondaryDateFormatted})
                    </span>
                  )}
                </span>
              </div>
            )
          })()}
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-3 lg:gap-4">
        {/* Today, Tomorrow, Day after schedule */}
        <section className={`glass flex min-h-64 flex-col p-5 lg:col-span-2 lg:min-h-0 ${loadingEvents ? 'shimmer-loading' : ''}`}>
          <a href="#/calendar" className="mb-4 flex items-center gap-3 text-xl font-normal text-ink">
            <Icon name="calendar_month" className="text-2xl" /> Schedule
            <span className="ml-auto text-sm font-medium text-sky-600 dark:text-sky-400">full calendar ›</span>
          </a>
          {!events || events.length === 0 ? (
            <p className="my-auto text-center text-lg text-ink-faint">Nothing scheduled 🎈</p>
          ) : (
            <div className="grid min-h-0 flex-1 grid-cols-3 gap-4 overflow-y-auto">
              {daysList.map((dayIso, idx) => {
                const dayEvents = eventsByDay.get(dayIso) ?? []
                const label = getDayLabel(dayIso, idx)
                return (
                  <div key={dayIso} className="flex flex-col min-h-0">
                    <h3 className="mb-3 flex items-baseline gap-2 border-b pb-1.5 border-ink-faint">
                      <span className="text-base font-semibold text-ink">{label}</span>
                      <span className="text-[0.7rem] font-medium text-ink-soft opacity-85">
                        {new Date(dayIso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </h3>
                    <div className="flex flex-col gap-2 overflow-y-auto pr-1 flex-1">
                      {dayEvents.length === 0 ? (
                        <p className="my-auto text-center text-xs text-ink-faint py-8">No events</p>
                      ) : (
                        dayEvents.map((e) => {
                          const isFamily = !e.person_name || e.person_name.toLowerCase() === 'family' || e.person_name.toLowerCase() === 'shared'
                          const bgStyle = isFamily
                            ? 'linear-gradient(135deg, #f43f5e, #ec4899, #8b5cf6, #3b82f6, #10b981)'
                            : e.color
                          return (
                            <div
                              key={e.id}
                              className="rounded-xl p-3 text-white shadow-md flex flex-col gap-1 transition-transform hover:scale-[1.02]"
                              style={{ background: bgStyle }}
                            >
                              <div className="text-sm font-semibold leading-snug tracking-tight">{e.title}</div>
                              <div className="text-xs opacity-90 font-medium">
                                {e.all_day ? 'All day' : `${fmtTime(e.start)} – ${fmtTime(e.end)}`}
                              </div>
                              {e.location && (
                                <div className="flex items-center gap-1 text-[0.7rem] opacity-85 truncate">
                                  <Icon name="location_on" className="text-[0.75rem] shrink-0" />
                                  <span className="truncate">{e.location}</span>
                                </div>
                              )}
                              <div className="mt-1 flex items-center gap-1.5 rounded-md bg-white/20 px-2 py-0.5 self-start text-[0.65rem] font-semibold uppercase tracking-wider backdrop-blur-sm">
                                {isFamily ? (
                                  <>
                                    <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                                    <span>Family</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
                                    <span>{e.person_name}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <div className="flex min-h-0 flex-col gap-3 lg:gap-4">
          {/* chores (coins) — grows in proportion to how much it has to show */}
          <section
            className={`glass flex min-h-28 flex-col p-4 ${loadingChores ? 'shimmer-loading' : ''}`}
            style={{ flexGrow: Math.max(openChores.length, 1) }}
          >
            <a href="#/chores" className="mb-2 flex items-center gap-3 text-lg font-normal text-ink">
              <Icon name="family_star" className="text-2xl" /> Chores
              <span className="ml-auto text-sm font-medium text-ink-soft">
                {todayChores.length - openChores.length}/{todayChores.length} done
              </span>
            </a>
            {openChores.length === 0 ? (
              <p className="my-auto text-center text-lg text-ink-faint">All done! 🎉</p>
            ) : (
              <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
                {openChores.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => completeChore(c)}
                    className="glass-inset flex shrink-0 items-center gap-2.5 px-2.5 py-1.5 text-left active:surface-tile-high"
                  >
                    <span className="h-6 w-6 shrink-0 rounded-full border-[2.5px] border-amber-300" />
                    <span className="min-w-0 flex-1 truncate text-[0.95rem] font-normal text-ink">
                      {c.title}
                    </span>
                    {c.assigned_to && (
                      <span className="text-xs font-medium text-ink-soft">{c.assigned_to}</span>
                    )}
                    <span className="flex items-center text-xs font-medium text-amber-500">
                      <CoinIcon />
                      {c.coins}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* to-dos — same content-proportional sizing */}
          <section
            className={`glass flex min-h-28 flex-col p-4 ${loadingTasks ? 'shimmer-loading' : ''}`}
            style={{ flexGrow: Math.max(openTasks.length, 1) }}
          >
            <a href="#/todos" className="mb-2 flex items-center gap-3 text-lg font-normal text-ink">
              <Icon name="task_alt" className="text-2xl" /> To-Dos
              <span className="ml-auto text-sm font-medium text-ink-soft">
                {openTasks.length} open
              </span>
            </a>
            {openTasks.length === 0 ? (
              <p className="my-auto text-center text-lg text-ink-faint">Nothing to do 🎉</p>
            ) : (
              <div className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
                {openTasks.map((t) => (
                  <button
                    key={`${t.source}-${t.id}`}
                    onClick={() => completeTask(t)}
                    className="glass-inset flex shrink-0 items-center gap-2.5 px-2.5 py-1.5 text-left active:surface-tile-high"
                  >
                    <span className="h-6 w-6 shrink-0 rounded-full border-[2.5px] border-emerald-300" />
                    <span className="min-w-0 flex-1 truncate text-[0.95rem] font-normal text-ink">
                      {t.title}
                    </span>
                    {t.due_date && (
                      <span className="text-xs font-medium text-ink-soft">
                        {new Date(t.due_date).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* meals + shopping */}
          <section className={`glass p-5 ${loadingMeals ? 'shimmer-loading' : ''}`}>
            <a href="#/meals" className="mb-3 flex items-center gap-3 text-xl font-normal text-ink">
              <Icon name="restaurant" className="text-2xl" /> Today's Meals
              <span className="ml-auto text-sm font-medium text-sky-600 dark:text-sky-400">plan ›</span>
            </a>
            <div className="grid grid-cols-3 gap-2">
              {(['breakfast', 'lunch', 'dinner'] as const).map((slot) => {
                const s = todayMeals?.[slot]
                const label = s?.recipe_title || s?.text
                return (
                  <a
                    key={slot}
                    href={s?.recipe_id ? `#/recipes/${s.recipe_id}` : '#/meals'}
                    className="glass-inset p-2.5 active:surface-tile-high"
                  >
                    <div className="text-[0.65rem] font-medium uppercase tracking-wide text-ink-faint">
                      {slot}
                    </div>
                    <div className="mt-0.5 whitespace-pre-line text-sm font-medium leading-tight text-ink">
                      {label || <span className="text-ink-faint">—</span>}
                    </div>
                  </a>
                )
              })}
            </div>
          </section>

          {/* shopping — a peek at the top of the list (max 5), badge shows the rest */}
          <section className={`glass flex flex-col p-4 ${loadingShopping ? 'shimmer-loading' : ''}`}>
            <a href="#/shopping" className="flex items-center gap-3 text-lg font-normal text-ink">
              <Icon name="shopping_cart" className="text-2xl" /> Shopping
              <span className="ml-auto rounded-full bg-gradient-to-r from-teal-400 to-sky-500 px-3.5 py-0.5 text-base font-medium text-white shadow-md shadow-teal-400/30">
                {shoppingCount}
              </span>
            </a>
            {shoppingPeek.length > 0 && (
              <div className="mt-2 flex flex-col gap-1.5">
                {shoppingPeek.map((i) => (
                  <button
                    key={i.id}
                    onClick={() => buyItem(i)}
                    className="glass-inset flex items-center gap-2.5 px-2.5 py-1.5 text-left active:surface-tile-high"
                  >
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-sky-300" />
                    <span className="min-w-0 flex-1 truncate text-[0.95rem] font-normal text-ink">
                      {i.title}
                    </span>
                  </button>
                ))}
                {shoppingCount > shoppingPeek.length && (
                  <a href="#/shopping" className="text-center text-xs font-medium text-sky-600 dark:text-sky-400">
                    +{shoppingCount - shoppingPeek.length} more on the list
                  </a>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
