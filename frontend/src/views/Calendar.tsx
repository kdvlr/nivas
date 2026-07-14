import { useCallback, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import { onRefresh } from '../lib/ws'
import type { CalendarStatus, CalEvent, Selection, WeatherData } from '../lib/types'
import Modal from '../components/Modal'
import { useEffect } from 'react'

interface Draft {
  id?: number
  selection_id: number
  title: string
  start: string
  end: string
  all_day: boolean
  location: string
  description: string
}

const toLocalInput = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const isoDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function Calendar() {
  const { data: status } = useData<CalendarStatus>('/api/calendar/status', ['calendar'])
  const { data: weather } = useData<WeatherData>('/api/weather', [], 15 * 60 * 1000)
  const calRef = useRef<FullCalendar>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const selections: Selection[] = useMemo(
    () =>
      (status?.accounts ?? [])
        .flatMap((a) => a.selections)
        .filter((s) => s.enabled),
    [status],
  )

  const refetch = useCallback(() => calRef.current?.getApi().refetchEvents(), [])
  useEffect(() => onRefresh(['calendar'], refetch), [refetch])

  // Fit the visible hours to the events of the currently-shown days: the axis
  // shrinks to [earliest .. latest] (anchored near the top, min 6h) and each
  // slot's pixel height is computed so the whole window fits the pane without
  // scrolling — on any screen size. Falls back to a daytime band when empty.
  const MIN_SPAN = 12 * 60
  const wrapRef = useRef<HTMLDivElement>(null)
  const appliedRangeRef = useRef('')

  const fitSlotRange = useCallback(() => {
    const api = calRef.current?.getApi()
    if (!api || !api.view.type.startsWith('timeGrid')) return
    const { activeStart, activeEnd } = api.view
    let earliest = Infinity
    let latest = -Infinity
    for (const e of api.getEvents()) {
      if (e.allDay || !e.start || e.start < activeStart || e.start >= activeEnd) continue
      const s = e.start.getHours() * 60 + e.start.getMinutes()
      let en = e.end ? e.end.getHours() * 60 + e.end.getMinutes() : s + 60
      if (en <= s) en = 24 * 60 // spills past midnight
      earliest = Math.min(earliest, s)
      latest = Math.max(latest, en)
    }

    let start: number
    let end: number
    if (earliest === Infinity) {
      start = 8 * 60 // no events → sensible daytime band
      end = 18 * 60
    } else {
      // ~1h of breathing room around the events
      start = Math.max(0, Math.floor(earliest / 60) * 60 - 60)
      end = Math.min(24 * 60, Math.ceil(latest / 60) * 60 + 60)
      // reach the minimum span by extending toward the far end of the day, so a
      // morning event sits near the top and an evening event near the bottom
      if (end - start < MIN_SPAN) {
        if (earliest < 12 * 60) {
          // morning: keep the top edge, grow downward
          end = Math.min(24 * 60, start + MIN_SPAN)
          if (end - start < MIN_SPAN) start = Math.max(0, end - MIN_SPAN)
        } else {
          // afternoon / evening: keep the bottom edge, grow upward
          start = Math.max(0, end - MIN_SPAN)
          if (end - start < MIN_SPAN) end = Math.min(24 * 60, start + MIN_SPAN)
        }
      }
    }

    const key = `${start}-${end}`
    if (key !== appliedRangeRef.current) {
      appliedRangeRef.current = key
      const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:00:00`
      api.setOption('slotMinTime', fmt(start))
      api.setOption('slotMaxTime', fmt(end))
    }
  }, [MIN_SPAN])

  // Size each 30-min slot so the whole fitted window fills the scroller exactly
  // (expandRows only grows rows; this lets a wide window shrink to fit too).
  const fitHeights = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const slotTable = wrap.querySelector('.fc-timegrid-slots')
    const scroller = slotTable?.closest('.fc-scroller') as HTMLElement | null
    const rows = wrap.querySelectorAll('.fc-timegrid-slots tr').length
    if (!scroller || !rows) return
    const avail = scroller.clientHeight
    if (avail < 40) return
    // Size each slot so all rows fill the scroller exactly (floor => the total is
    // never taller than the pane, so it never scrolls; the few leftover px are a
    // negligible gap at the bottom). No expandRows, so this height is authoritative.
    const h = Math.max(7, Math.floor(avail / rows))
    wrap.style.setProperty('--fc-slot-h', `${h}px`)
  }, [])

  // FullCalendar's flex layout can take a couple of frames to settle after a
  // re-render, so measure across a few beats rather than a single rAF.
  const scheduleFit = useCallback(() => {
    requestAnimationFrame(fitHeights)
    setTimeout(fitHeights, 80)
    setTimeout(fitHeights, 250)
  }, [fitHeights])

  const refit = useCallback(() => {
    fitSlotRange()
    scheduleFit()
  }, [fitSlotRange, scheduleFit])

  // keep it fitted as the container resizes (screen rotates, pane changes)
  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const ro = new ResizeObserver(() => fitHeights())
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [fitHeights])

  // reset so navigating to a new week/day re-fits even if the event set matches
  const onDatesSet = useCallback(() => {
    appliedRangeRef.current = ''
    scheduleFit()
  }, [scheduleFit])

  const onEventsSet = useCallback(() => {
    refit()
  }, [refit])

  const fetchEvents = useCallback(
    async (info: { startStr: string; endStr: string }, ok: (evs: object[]) => void, fail: (e: Error) => void) => {
      try {
        const evs = await api.get<CalEvent[]>(
          `/api/calendar/events?start=${encodeURIComponent(info.startStr)}&end=${encodeURIComponent(info.endStr)}`,
        )
        ok(
          evs.map((e) => ({
            id: String(e.id),
            title: isMobile && e.person_name ? `${e.person_name}: ${e.title}` : e.title,
            start: e.start,
            end: e.end,
            allDay: e.all_day,
            backgroundColor: e.color,
            extendedProps: {
              person: e.person_name,
              selection_id: e.selection_id,
              location: e.location || '',
              description: e.description || '',
            },
          })),
        )
      } catch (e) {
        fail(e as Error)
      }
    },
    [isMobile],
  )

  const moveEvent = async (arg: EventDropArg | EventResizeDoneArg) => {
    const ev = arg.event
    try {
      await api.patch(`/api/calendar/events/${ev.id}`, {
        start: ev.allDay ? ev.startStr : ev.start?.toISOString(),
        end: ev.allDay ? ev.endStr || ev.startStr : ev.end?.toISOString(),
        all_day: ev.allDay,
      })
    } catch (e) {
      arg.revert()
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const onSelect = (arg: DateSelectArg) => {
    if (!selections.length) return
    setDraft({
      selection_id: selections[0].id,
      title: '',
      start: toLocalInput(arg.start),
      end: toLocalInput(arg.end),
      all_day: arg.allDay,
      location: '',
      description: '',
    })
    calRef.current?.getApi().unselect()
  }

  const onEventClick = (arg: EventClickArg) => {
    const ev = arg.event
    setDraft({
      id: Number(ev.id),
      selection_id: ev.extendedProps.selection_id,
      title: ev.title,
      start: ev.start ? toLocalInput(ev.start) : '',
      end: ev.end ? toLocalInput(ev.end) : (ev.start ? toLocalInput(ev.start) : ''),
      all_day: ev.allDay,
      location: ev.extendedProps.location || '',
      description: ev.extendedProps.description || '',
    })
  }

  const save = async () => {
    if (!draft || !draft.title.trim()) return
    setBusy(true)
    setError('')
    const body = {
      title: draft.title.trim(),
      start: draft.all_day ? draft.start.slice(0, 10) : new Date(draft.start).toISOString(),
      end: draft.all_day ? draft.end.slice(0, 10) : new Date(draft.end).toISOString(),
      all_day: draft.all_day,
      location: draft.location.trim(),
      description: draft.description.trim(),
    }
    try {
      if (draft.id) await api.patch(`/api/calendar/events/${draft.id}`, body)
      else await api.post('/api/calendar/events', { ...body, selection_id: draft.selection_id })
      setDraft(null)
      refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!draft?.id) return
    setBusy(true)
    try {
      await api.del(`/api/calendar/events/${draft.id}`)
      setDraft(null)
      refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (status && !status.accounts.length) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
        <span className="text-7xl">📅</span>
        <p className="text-2xl font-medium text-ink-soft">No Google account connected yet.</p>
        <a href="#/setup" className="btn-primary px-5 py-2.5 lg:px-8 lg:py-4 text-base lg:text-xl">
          Go to Setup
        </a>
      </div>
    )
  }

  const weatherByDate = new Map((weather?.daily ?? []).map((d) => [d.date, d]))

  return (
    <div className="flex h-full flex-col px-4 lg:px-8">
      {!isMobile && selections.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {selections.map((s) => (
            <span
              key={s.id}
              className="btn-glass flex items-center gap-2 px-4 py-1.5 text-sm"
            >
              <span className="h-3.5 w-3.5 rounded-full" style={{ background: s.color }} />
              {s.person_name || s.name}
            </span>
          ))}
        </div>
      )}
      {error && (
        <div className="mb-3 flex items-center">
          <span className="font-medium text-rose-500">{error}</span>
        </div>
      )}
      <div ref={wrapRef} className="glass min-h-0 flex-1 p-3 lg:p-4">
        <FullCalendar
          key={isMobile ? 'mobile' : 'desktop'}
          ref={calRef}
          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, listPlugin]}
          initialView={isMobile ? 'listDay' : 'listWeek'}
          headerToolbar={
            isMobile
              ? {
                  left: 'prev,next',
                  center: 'title',
                  right: 'today dayGridMonth,listDay',
                }
              : {
                  left: 'prev,next today',
                  center: 'title',
                  right: 'listDay,listWeek,dayGridMonth',
                }
          }
          height="100%"
          nowIndicator
          editable
          selectable
          selectMirror
          longPressDelay={200}
          selectLongPressDelay={300}
          eventLongPressDelay={200}
          slotMinTime="08:00:00"
          slotMaxTime="18:00:00"
          scrollTime="00:00:00"
          slotDuration="01:00:00"
          slotLabelInterval="01:00:00"
          snapDuration="00:15:00"
          datesSet={onDatesSet}
          eventsSet={onEventsSet}
          allDaySlot
          dayHeaderContent={(arg) => {
            const w = weatherByDate.get(isoDate(arg.date))
            const weekday = arg.date.toLocaleDateString(undefined, { weekday: 'short' })
            const dayNum = arg.date.getDate()
            const isDayView = arg.view.type === 'timeGridDay'
            return (
              <div className="flex flex-col items-center gap-0.5 py-0.5">
                <span className="text-sm font-medium">
                  {weekday} {arg.view.type !== 'dayGridMonth' ? dayNum : ''}
                </span>
                {w && arg.view.type !== 'dayGridMonth' && (
                  <span className="flex flex-wrap justify-center items-center gap-x-1 gap-y-0 text-[0.7rem] font-semibold text-ink-soft">
                    <span className="text-sm leading-none">{w.icon}</span>
                    <span>
                      {isDayView ? `${w.label} · ` : ''}{w.tmax}°<span className="text-ink-faint">/{w.tmin}°</span>
                    </span>
                  </span>
                )}
              </div>
            )
          }}
          events={fetchEvents}
          eventDrop={moveEvent}
          eventResize={moveEvent}
          select={onSelect}
          eventClick={onEventClick}
        />
      </div>

      {draft && (
        <Modal title={draft.id ? 'Edit event' : 'New event'} onClose={() => setDraft(null)}>
          <div className="flex flex-col gap-5">
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              placeholder="What's happening?"
              className="input-glass px-5 py-4 text-xl"
            />
            <input
              value={draft.location}
              onChange={(e) => setDraft({ ...draft, location: e.target.value })}
              placeholder="Add location"
              className="input-glass px-5 py-3.5 text-base"
            />
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              placeholder="Add description"
              rows={3}
              className="input-glass px-5 py-3.5 text-base resize-none"
            />
            {!draft.id && (
              <div className="flex flex-wrap gap-2">
                {selections.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setDraft({ ...draft, selection_id: s.id })}
                    className={`rounded-full px-5 py-2.5 text-lg font-medium text-white ${draft.selection_id === s.id ? 'ring-4 ring-slate-700/40 dark:ring-slate-200/60' : 'opacity-50'
                      }`}
                    style={{ background: s.color }}
                  >
                    {s.person_name || s.name}
                  </button>
                ))}
              </div>
            )}
            <label className="flex items-center gap-3 text-xl">
              <input
                type="checkbox"
                checked={draft.all_day}
                onChange={(e) => setDraft({ ...draft, all_day: e.target.checked })}
                className="h-7 w-7 accent-teal-500"
              />
              All day
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-lg font-medium text-ink-soft">
                Starts
                <input
                  type={draft.all_day ? 'date' : 'datetime-local'}
                  value={draft.all_day ? draft.start.slice(0, 10) : draft.start}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  className="input-glass px-4 py-3 text-lg font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-lg font-medium text-ink-soft">
                Ends
                <input
                  type={draft.all_day ? 'date' : 'datetime-local'}
                  value={draft.all_day ? draft.end.slice(0, 10) : draft.end}
                  onChange={(e) => setDraft({ ...draft, end: e.target.value })}
                  className="input-glass px-4 py-3 text-lg font-normal"
                />
              </label>
            </div>
            {error && <p className="font-medium text-rose-600">{error}</p>}
            <div className="flex gap-3">
              <button
                disabled={busy || !draft.title.trim()}
                onClick={save}
                className="flex-1 btn-primary py-2.5 lg:py-4 text-base lg:text-xl disabled:opacity-40"
              >
                {busy ? 'Saving…' : 'Save'}
              </button>
              {draft.id && (
                <button
                  disabled={busy}
                  onClick={remove}
                  className="btn-glass px-5 lg:px-8 py-2.5 lg:py-4 text-base lg:text-lg !text-rose-500"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
