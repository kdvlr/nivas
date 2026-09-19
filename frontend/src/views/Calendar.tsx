import { useCallback, useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import timeGridPlugin from '@fullcalendar/timegrid'
import dayGridPlugin from '@fullcalendar/daygrid'
import multiMonthPlugin from '@fullcalendar/multimonth'
import interactionPlugin from '@fullcalendar/interaction'
import type { DateSelectArg, EventClickArg, EventDropArg, DatesSetArg } from '@fullcalendar/core'
import type { EventResizeDoneArg } from '@fullcalendar/interaction'
import listPlugin from '@fullcalendar/list'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import { onRefresh } from '../lib/ws'
import type { CalendarStatus, CalEvent, Selection, WeatherData } from '../lib/types'
import Modal from '../components/Modal'
import { useEffect } from 'react'
import Icon from '../components/Icon'
import TopClockHeader from '../components/TopClockHeader'
import { useSwipeNavigation } from '../lib/useSwipeNavigation'

const FAMILY_GRADIENT = 'linear-gradient(115deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7)'
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

const isoUtcDate = (d: Date) => {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`
}

type ViewMode = 'schedule' | 'day' | 'week' | 'month' | 'year'
type WeekSubMode = 'sun-sat' | 'rolling-7' | 'rolling-5'
type YearSubMode = 'calendar' | 'rolling-12'

export default function Calendar() {
  const { data: status } = useData<CalendarStatus>('/api/calendar/status', ['calendar'])
  const { data: weather } = useData<WeatherData>('/api/weather', [], 15 * 60 * 1000)
  const calRef = useRef<FullCalendar>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  const [currentViewMode, setCurrentViewMode] = useState<ViewMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'month' : 'week',
  )
  const [weekSubMode, setWeekSubMode] = useState<WeekSubMode>('sun-sat')
  const [yearSubMode, setYearSubMode] = useState<YearSubMode>('calendar')
  const [yearAnchorDate, setYearAnchorDate] = useState(() => new Date())
  const [yearEvents, setYearEvents] = useState<CalEvent[]>([])
  const [mobileStartDate, setMobileStartDate] = useState(() => new Date())
  const [mobileEvents, setMobileEvents] = useState<CalEvent[]>([])
  const [loadingMobileEvents, setLoadingMobileEvents] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [viewTitle, setViewTitle] = useState('')

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

  const refetch = useCallback(() => {
    calRef.current?.getApi()?.refetchEvents()
    setRefreshKey((k) => k + 1)
  }, [])
  useEffect(() => onRefresh(['calendar'], refetch), [refetch])

  const addDays = (d: Date, days: number) => {
    const res = new Date(d)
    res.setDate(res.getDate() + days)
    return res
  }

  const mobileDaysList = useMemo(() => {
    const list = []
    for (let i = 0; i < 30; i++) {
      list.push(isoDate(addDays(mobileStartDate, i)))
    }
    return list
  }, [mobileStartDate])

  const getDayLabel = (isoDateStr: string, _index: number) => {
    const todayStr = isoDate(new Date())
    const tomorrowStr = isoDate(addDays(new Date(), 1))
    const d = new Date(isoDateStr + 'T12:00:00')
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' })
    if (isoDateStr === todayStr) return `Today (${weekday})`
    if (isoDateStr === tomorrowStr) return `Tomorrow (${weekday})`
    return d.toLocaleDateString(undefined, { weekday: 'long' })
  }

  // Fetch events for custom mobile schedule view
  useEffect(() => {
    if (!isMobile || currentViewMode !== 'schedule') return
    let active = true
    setLoadingMobileEvents(true)
    const startStr = `${mobileDaysList[0]}T00:00:00`
    const endStr = `${mobileDaysList[mobileDaysList.length - 1]}T23:59:59`
    api.get<CalEvent[]>(`/api/calendar/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`)
      .then((data) => {
        if (active) {
          setMobileEvents(data)
          setLoadingMobileEvents(false)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err))
          setLoadingMobileEvents(false)
        }
      })
    return () => {
      active = false
    }
  }, [isMobile, currentViewMode, mobileDaysList, refreshKey])

  const mobileEventsByDay = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const d of mobileDaysList) {
      map.set(d, [])
    }
    const sorted = [...mobileEvents].sort((a, b) => a.start.localeCompare(b.start))
    for (const e of sorted) {
      const dateStr = getLocalDateString(e.start)
      if (map.has(dateStr)) {
        map.get(dateStr)!.push(e)
      }
    }
    return map
  }, [mobileEvents, mobileDaysList])

  const selectionColorMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const s of selections) {
      m.set(s.id, s.color)
    }
    return m
  }, [selections])

  const yearMonths = useMemo(() => {
    const months: Date[] = []
    const anchor = yearAnchorDate
    if (yearSubMode === 'calendar') {
      const y = anchor.getFullYear()
      for (let m = 0; m < 12; m++) {
        months.push(new Date(y, m, 1))
      }
    } else {
      const y = anchor.getFullYear()
      const startM = anchor.getMonth()
      for (let i = 0; i < 12; i++) {
        months.push(new Date(y, startM + i, 1))
      }
    }
    return months
  }, [yearAnchorDate, yearSubMode])

  useEffect(() => {
    if (currentViewMode !== 'year') return
    let active = true
    const startStr = `${isoDate(yearMonths[0])}T00:00:00`
    const lastMonthEnd = new Date(yearMonths[11].getFullYear(), yearMonths[11].getMonth() + 1, 0)
    const endStr = `${isoDate(lastMonthEnd)}T23:59:59`
    api.get<CalEvent[]>(`/api/calendar/events?start=${encodeURIComponent(startStr)}&end=${encodeURIComponent(endStr)}`)
      .then((data) => {
        if (active) {
          setYearEvents(data)
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : String(err))
        }
      })
    return () => {
      active = false
    }
  }, [currentViewMode, yearMonths, refreshKey])

  const yearEventsByDate = useMemo(() => {
    const map = new Map<string, CalEvent[]>()
    for (const e of yearEvents) {
      const sDate = getLocalDateString(e.start)
      const eDate = e.end ? getLocalDateString(e.end) : sDate
      if (sDate === eDate || !e.end) {
        const arr = map.get(sDate) ?? []
        arr.push(e)
        map.set(sDate, arr)
      } else {
        const cur = new Date(sDate + 'T12:00:00')
        const end = new Date(eDate + 'T12:00:00')
        const maxDays = 60
        let count = 0
        while (cur <= end && count < maxDays) {
          const dStr = isoDate(cur)
          if (e.all_day && dStr === eDate && count > 0) {
            break
          }
          const arr = map.get(dStr) ?? []
          arr.push(e)
          map.set(dStr, arr)
          cur.setDate(cur.getDate() + 1)
          count++
        }
      }
    }
    return map
  }, [yearEvents])

  const visibleDays = useMemo(() => {
    const todayStr = isoDate(new Date())
    return mobileDaysList.filter((dayIso) => {
      if (dayIso === todayStr) return true
      const dayEvents = mobileEventsByDay.get(dayIso) ?? []
      return dayEvents.length > 0
    })
  }, [mobileDaysList, mobileEventsByDay])

  const handlePrev = useCallback(() => {
    if (currentViewMode === 'schedule') {
      setMobileStartDate((d) => addDays(d, -30))
    } else if (currentViewMode === 'year') {
      setYearAnchorDate((d) => {
        const next = new Date(d)
        if (yearSubMode === 'calendar') {
          next.setFullYear(next.getFullYear() - 1)
        } else {
          next.setMonth(next.getMonth() - 12)
        }
        return next
      })
    } else {
      calRef.current?.getApi().prev()
    }
  }, [currentViewMode, yearSubMode])

  const handleNext = useCallback(() => {
    if (currentViewMode === 'schedule') {
      setMobileStartDate((d) => addDays(d, 30))
    } else if (currentViewMode === 'year') {
      setYearAnchorDate((d) => {
        const next = new Date(d)
        if (yearSubMode === 'calendar') {
          next.setFullYear(next.getFullYear() + 1)
        } else {
          next.setMonth(next.getMonth() + 12)
        }
        return next
      })
    } else {
      calRef.current?.getApi().next()
    }
  }, [currentViewMode, yearSubMode])

  const handleToday = useCallback(() => {
    if (currentViewMode === 'schedule') {
      setMobileStartDate(new Date())
    } else if (currentViewMode === 'year') {
      setYearAnchorDate(new Date())
    } else {
      calRef.current?.getApi().today()
    }
  }, [currentViewMode])

  const calendarSwipe = useSwipeNavigation({
    onSwipeLeft: handleNext,
    onSwipeRight: handlePrev,
    disabled: Boolean(draft),
  })

  // Press-and-hold state for touch event creation:
  // Requires stationary hold (<= 8px jitter) for 450ms before allowing selection.
  // Scrolling or swiping before 450ms cancels the hold so calendars can scroll smoothly without creating events.
  const isTouchInteractionRef = useRef(false)
  const isPressAndHoldActiveRef = useRef(false)
  const holdTimerRef = useRef<number | null>(null)
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        window.clearTimeout(holdTimerRef.current)
        holdTimerRef.current = null
      }
    }
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse') {
      isTouchInteractionRef.current = false
      isPressAndHoldActiveRef.current = true
      return
    }

    isTouchInteractionRef.current = true
    isPressAndHoldActiveRef.current = false
    touchStartPosRef.current = { x: e.clientX, y: e.clientY }

    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    const target = e.target as HTMLElement | null
    if (target?.closest('a, button, input, textarea, select, [role="button"], [data-swipe-ignore="true"], .fc-event, .fc-col-header-cell')) {
      return
    }

    holdTimerRef.current = window.setTimeout(() => {
      isPressAndHoldActiveRef.current = true
      holdTimerRef.current = null
      try {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          navigator.vibrate(40)
        }
      } catch {}
    }, 450)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTouchInteractionRef.current) return

    // If hold is active, user is dragging to select a time/date range
    if (isPressAndHoldActiveRef.current) return

    // If moved beyond jitter tolerance (> 8px) before hold timer fired, user is scrolling or swiping!
    if (touchStartPosRef.current) {
      const dx = e.clientX - touchStartPosRef.current.x
      const dy = e.clientY - touchStartPosRef.current.y
      if (dx * dx + dy * dy > 64) {
        if (holdTimerRef.current) {
          window.clearTimeout(holdTimerRef.current)
          holdTimerRef.current = null
        }
        isPressAndHoldActiveRef.current = false
        calRef.current?.getApi().unselect()
      }
    }
  }, [])

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }

    if (isTouchInteractionRef.current) {
      if (!isPressAndHoldActiveRef.current) {
        // Touch ended without holding -> unselect to prevent event creation, and pass to swipe handler
        calRef.current?.getApi().unselect()
        calendarSwipe.onPointerUp(e)
      } else {
        // Hold was completed -> selection is finalized by FullCalendar, suppress period swipe
        calendarSwipe.onPointerCancel(e)
        window.setTimeout(() => {
          isPressAndHoldActiveRef.current = false
        }, 100)
      }
    }
  }, [calendarSwipe])

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (holdTimerRef.current) {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    isPressAndHoldActiveRef.current = false
    calendarSwipe.onPointerCancel(e)
  }, [calendarSwipe])

  const onContainerPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    calendarSwipe.onPointerDown(e)
    handlePointerDown(e)
  }, [calendarSwipe, handlePointerDown])

  const checkSelectAllowed = useCallback(() => {
    if (isTouchInteractionRef.current && !isPressAndHoldActiveRef.current) {
      return false
    }
    return true
  }, [])

  const onSelectMobile = (dayIso: string) => {
    if (!selections.length) return
    const startStr = `${dayIso}T09:00`
    const endStr = `${dayIso}T10:00`
    setDraft({
      selection_id: selections[0].id,
      title: '',
      start: startStr,
      end: endStr,
      all_day: false,
      location: '',
      description: '',
    })
  }

  const onEventClickMobile = (e: CalEvent) => {
    setDraft({
      id: Number(e.id),
      selection_id: e.selection_id,
      title: e.title,
      start: toLocalInput(new Date(e.start)),
      end: e.end ? toLocalInput(new Date(e.end)) : toLocalInput(new Date(e.start)),
      all_day: e.all_day,
      location: e.location || '',
      description: e.description || '',
    })
  }

  const openNewEventModal = useCallback(() => {
    if (!selections.length) return
    const now = new Date()
    const start = new Date(now)
    start.setMinutes(start.getMinutes() >= 30 ? 60 : 30, 0, 0)
    const end = new Date(start.getTime() + 60 * 60 * 1000)
    setDraft({
      selection_id: selections[0].id,
      title: '',
      start: toLocalInput(start),
      end: toLocalInput(end),
      all_day: false,
      location: '',
      description: '',
    })
  }, [selections])

  const handleCloseDraft = useCallback(() => setDraft(null), [])

  useEffect(() => {
    const handleCreateItem = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.type === 'event') {
        openNewEventModal()
      }
    }
    window.addEventListener('nivas:create-item', handleCreateItem)

    if (location.hash.includes('action=new') && selections.length > 0) {
      openNewEventModal()
      history.replaceState(null, '', '#/calendar')
    }

    return () => {
      window.removeEventListener('nivas:create-item', handleCreateItem)
    }
  }, [openNewEventModal, selections])

  // Fit the visible hours to the events of the currently-shown days: the axis
  // shrinks to [earliest .. latest] (anchored near the top, min 6h) and each
  // slot's pixel height is computed so the whole window fits the pane without
  // Size each 30-min slot so the whole fitted window fills the scroller exactly
  // (expandRows only grows rows; this lets a wide window shrink to fit too).
  const wrapRef = useRef<HTMLDivElement>(null)
  const appliedRangeRef = useRef('')

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
    const minSlotH = isMobile ? 36 : 18
    const h = Math.max(minSlotH, Math.floor(avail / rows))
    wrap.style.setProperty('--fc-slot-h', `${h}px`)
  }, [isMobile])

  // FullCalendar's flex layout can take a couple of frames to settle after a
  // re-render, so measure across a few beats rather than a single rAF.
  const scheduleFit = useCallback(() => {
    requestAnimationFrame(fitHeights)
    setTimeout(fitHeights, 80)
    setTimeout(fitHeights, 250)
  }, [fitHeights])

  /** Fit slotMinTime / slotMaxTime responsively: 1h before earliest, 1h after latest */
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
      end = 17 * 60
    } else {
      // 1h before earliest, 1h after latest
      start = Math.max(0, Math.floor(earliest / 60) * 60 - 60)
      end = Math.min(24 * 60, Math.ceil(latest / 60) * 60 + 60)
      if (end <= start) {
        end = Math.min(24 * 60, start + 2 * 60)
      }
    }

    const key = `${start}-${end}`
    if (key !== appliedRangeRef.current) {
      appliedRangeRef.current = key
      const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:00:00`
      api.setOption('slotMinTime', fmt(start))
      api.setOption('slotMaxTime', fmt(end))
      scheduleFit()
    }
  }, [scheduleFit])

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
  const onDatesSet = useCallback(
    (arg: DatesSetArg) => {
      setViewTitle(arg.view.title)
      if (currentViewMode === 'year') {
        return
      }
      const viewType = arg.view.type
      if (viewType === 'timeGridDay') {
        setCurrentViewMode('day')
      } else if (viewType === 'timeGridWeek') {
        setCurrentViewMode('week')
        setWeekSubMode('sun-sat')
      } else if (viewType === 'timeGridRolling7') {
        setCurrentViewMode('week')
        setWeekSubMode('rolling-7')
      } else if (viewType === 'timeGridRolling5') {
        setCurrentViewMode('week')
        setWeekSubMode('rolling-5')
      } else if (viewType === 'dayGridMonth') {
        setCurrentViewMode('month')
      }
      appliedRangeRef.current = ''
      fitSlotRange()
      scheduleFit()
    },
    [currentViewMode, fitSlotRange, scheduleFit],
  )

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
          evs.map((e) => {
            const cardColor = e.color || 'var(--primary)'
            return {
              id: String(e.id),
              title: e.title,
              start: e.start,
              end: e.end,
              allDay: e.all_day,
              backgroundColor: `color-mix(in srgb, ${cardColor} 82%, transparent)`,
              borderColor: 'transparent',
              textColor: '#ffffff',
              extendedProps: {
                rawTitle: e.title,
                person: e.person_name,
                selection_id: e.selection_id,
                location: e.location || '',
                description: e.description || '',
                color: cardColor,
              },
            }
          }),
        )
      } catch (e) {
        fail(e as Error)
      }
    },
    [],
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

    // Require press-and-hold for touch devices; drop unintentional swipe/scroll selections
    if (isTouchInteractionRef.current && !isPressAndHoldActiveRef.current) {
      calRef.current?.getApi().unselect()
      return
    }

    if (isMobile && currentViewMode === 'month') {
      setCurrentViewMode('schedule')
      setMobileStartDate(arg.start)
    }

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
      title: ev.extendedProps.rawTitle || ev.title,
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

  const handleWeekClick = useCallback(() => {
    const calendarApi = calRef.current?.getApi()
    if (currentViewMode !== 'week') {
      setCurrentViewMode('week')
      setWeekSubMode('sun-sat')
      setTimeout(() => {
        const api = calRef.current?.getApi()
        if (api) {
          api.changeView('timeGridWeek', new Date())
          api.updateSize()
          refit()
        }
      }, 50)
    } else {
      if (weekSubMode === 'sun-sat') {
        setWeekSubMode('rolling-7')
        calendarApi?.changeView('timeGridRolling7', new Date())
      } else if (weekSubMode === 'rolling-7') {
        setWeekSubMode('rolling-5')
        calendarApi?.changeView('timeGridRolling5', new Date())
      } else {
        setWeekSubMode('sun-sat')
        calendarApi?.changeView('timeGridWeek', new Date())
      }
      refit()
    }
  }, [currentViewMode, weekSubMode, refit])

  const handleYearClick = useCallback(() => {
    if (currentViewMode !== 'year') {
      const curCalDate = calRef.current?.getApi()?.getDate()
      if (curCalDate) {
        setYearAnchorDate(curCalDate)
      }
      setCurrentViewMode('year')
      setYearSubMode('calendar')
    } else {
      if (yearSubMode === 'calendar') {
        setYearSubMode('rolling-12')
      } else {
        setYearSubMode('calendar')
      }
    }
  }, [currentViewMode, yearSubMode])

  const handleDayClick = useCallback(() => {
    setCurrentViewMode('day')
    setTimeout(() => {
      const api = calRef.current?.getApi()
      if (api) {
        api.changeView('timeGridDay', new Date())
        api.updateSize()
        refit()
      }
    }, 50)
  }, [refit])

  const handleDaySelect = useCallback(
    (date: Date) => {
      setCurrentViewMode('day')
      setTimeout(() => {
        const api = calRef.current?.getApi()
        if (api) {
          api.changeView('timeGridDay', date)
          api.updateSize()
          refit()
        }
      }, 50)
    },
    [refit],
  )

  const handleMonthClick = useCallback(() => {
    setCurrentViewMode('month')
    setTimeout(() => {
      const api = calRef.current?.getApi()
      if (api) {
        api.changeView('dayGridMonth', new Date())
        api.updateSize()
      }
    }, 50)
  }, [])

  const handleScheduleClick = useCallback(() => {
    setCurrentViewMode('schedule')
    setMobileStartDate(new Date())
  }, [])

  const renderHeader = () => {
    const startD = mobileStartDate
    const endD = addDays(mobileStartDate, 29)
    const fmtMonthDay = (date: Date) =>
      date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    const fmtYear = (date: Date) => date.getFullYear()

    let rangeText = ''
    if (startD.getFullYear() === endD.getFullYear()) {
      rangeText = `${fmtMonthDay(startD)} – ${fmtMonthDay(endD)}, ${fmtYear(startD)}`
    } else {
      rangeText = `${fmtMonthDay(startD)}, ${fmtYear(startD)} – ${fmtMonthDay(endD)}, ${fmtYear(endD)}`
    }

    const displayTitle =
      currentViewMode === 'schedule'
        ? rangeText
        : currentViewMode === 'year'
        ? yearSubMode === 'calendar'
          ? (yearMonths[0] ? String(yearMonths[0].getFullYear()) : '')
          : (yearMonths[0] && yearMonths[11]
              ? `${yearMonths[0].toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} – ${yearMonths[11].toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
              : '')
        : viewTitle

    const getWeekLabel = () => {
      if (currentViewMode !== 'week') return 'week'
      if (weekSubMode === 'rolling-7') return 'week (7d)'
      if (weekSubMode === 'rolling-5') return 'week (5d)'
      return 'week'
    }

    const getYearLabel = () => {
      if (currentViewMode !== 'year') return 'year'
      if (yearSubMode === 'rolling-12') return 'year (12m)'
      return 'year'
    }

    const viewButtons = isMobile
      ? [
          { key: 'schedule', label: 'schedule', onClick: handleScheduleClick, active: currentViewMode === 'schedule' },
          { key: 'week', label: getWeekLabel(), onClick: handleWeekClick, active: currentViewMode === 'week' },
          { key: 'month', label: 'month', onClick: handleMonthClick, active: currentViewMode === 'month' },
          { key: 'year', label: getYearLabel(), onClick: handleYearClick, active: currentViewMode === 'year' },
        ]
      : [
          { key: 'day', label: 'day', onClick: handleDayClick, active: currentViewMode === 'day' },
          { key: 'week', label: getWeekLabel(), onClick: handleWeekClick, active: currentViewMode === 'week' },
          { key: 'month', label: 'month', onClick: handleMonthClick, active: currentViewMode === 'month' },
          { key: 'year', label: getYearLabel(), onClick: handleYearClick, active: currentViewMode === 'year' },
        ]

    if (isMobile) {
      return (
        <div className="mb-3 flex flex-col items-center justify-center gap-2.5 shrink-0 w-full" data-swipe-ignore="true">
          {/* Title row */}
          <div className="flex items-center gap-3 justify-center w-full">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="btn-glass flex h-10 w-10 items-center justify-center rounded-full p-0 shrink-0 active:scale-95"
            >
              <Icon name="chevron_left" className="text-xl" />
            </button>
            <h2 className="text-base sm:text-lg font-bold text-ink truncate text-center max-w-[220px] sm:max-w-xs">
              {displayTitle}
            </h2>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="btn-glass flex h-10 w-10 items-center justify-center rounded-full p-0 shrink-0 active:scale-95"
            >
              <Icon name="chevron_right" className="text-xl" />
            </button>
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2 justify-center w-full flex-wrap">
            <button
              type="button"
              onClick={handleToday}
              className="btn-glass min-h-9 px-3.5 py-1.5 text-xs sm:text-sm font-semibold rounded-xl shrink-0 active:scale-95"
            >
              today
            </button>
            <div
              className="flex p-0.5 rounded-xl border shrink-0 overflow-x-auto max-w-full"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--secondary-container) 50%, transparent)',
                borderColor: 'var(--outline-var)',
              }}
            >
              {viewButtons.map((btn) => (
                <button
                  type="button"
                  key={btn.key}
                  onClick={btn.onClick}
                  className="min-h-9 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap"
                  style={
                    btn.active
                      ? {
                          backgroundColor: 'var(--primary)',
                          color: 'var(--on-primary)',
                          boxShadow: 'var(--shadow-1)',
                        }
                      : {
                          color: 'var(--on-secondary-container)',
                        }
                  }
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )
    }

    // Desktop Header
    return (
      <div className="mb-3 flex items-center justify-between gap-3 shrink-0 w-full flex-wrap" data-swipe-ignore="true">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handlePrev}
              aria-label="Previous period"
              className="btn-glass flex h-10 w-10 items-center justify-center rounded-xl p-0 shrink-0 active:scale-95"
            >
              <Icon name="chevron_left" className="text-xl" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              aria-label="Next period"
              className="btn-glass flex h-10 w-10 items-center justify-center rounded-xl p-0 shrink-0 active:scale-95"
            >
              <Icon name="chevron_right" className="text-xl" />
            </button>
          </div>
          <button
            type="button"
            onClick={handleToday}
            className="btn-glass h-10 px-4 text-sm font-semibold rounded-xl shrink-0 active:scale-95"
          >
            today
          </button>
          <h2 className="text-lg lg:text-xl font-bold text-ink ml-1 truncate">
            {displayTitle}
          </h2>
        </div>

        <div
          className="flex p-0.5 rounded-xl border shrink-0"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--secondary-container) 50%, transparent)',
            borderColor: 'var(--outline-var)',
          }}
        >
          {viewButtons.map((btn) => (
            <button
              type="button"
              key={btn.key}
              onClick={btn.onClick}
              className="min-h-10 px-4 py-2 text-sm font-semibold rounded-lg transition-all active:scale-95 whitespace-nowrap"
              style={
                btn.active
                  ? {
                      backgroundColor: 'var(--primary)',
                      color: 'var(--on-primary)',
                      boxShadow: 'var(--shadow-1)',
                    }
                  : {
                      color: 'var(--on-secondary-container)',
                    }
              }
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  const renderMobileSchedule = () => (
    <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pb-36">
      {mobileDaysList.map((dayIso, idx) => {
        const dayEvents = mobileEventsByDay.get(dayIso) ?? []
        const dayWeather = weather?.daily?.find((d) => d.date === dayIso)
        const isToday = dayIso === isoDate(new Date())
        const dayOfWeek = new Date(dayIso + 'T12:00:00').getDay()
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

        return (
          <div key={dayIso} className="flex flex-col gap-2">
            <h3 className="text-sm font-bold text-ink-soft uppercase tracking-wider border-b border-ink-faint pb-1 flex flex-wrap items-center gap-2">
              <span className={isToday ? 'text-[var(--primary)] font-extrabold' : ''}>
                {getDayLabel(dayIso, idx)}
              </span>
              <span className="text-[0.75rem] font-medium opacity-85">
                {new Date(dayIso + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>

              {dayWeather && (
                <span className="ml-auto flex items-center gap-1.5 text-[0.82rem] font-semibold normal-case">
                  <span className="text-base leading-none">{dayWeather.icon}</span>
                  <span>
                    {dayWeather.label} · {dayWeather.tmax}° / {dayWeather.tmin}°
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={() => onSelectMobile(dayIso)}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full p-0 active:scale-95 transition-transform shrink-0"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--on-primary)', boxShadow: 'var(--shadow-1)' }}
                title="Add event"
                aria-label="Add event"
              >
                <Icon name="add" className="text-xl font-bold" />
              </button>
            </h3>
            {dayEvents.length === 0 ? (
              <p className="text-sm text-ink-faint py-1 pl-1">No events</p>
            ) : (
              <div className="flex flex-col gap-2">
                {dayEvents.map((e) => {
                  const isFamily = !e.person_name || ['family', 'shared'].includes(e.person_name.toLowerCase())
                  const bgStyle = isFamily ? FAMILY_GRADIENT : e.color
                  return (
                    <div
                      key={e.id}
                      className="rounded-xl p-3.5 text-white shadow flex flex-col gap-1 transition-transform active:scale-[0.98] cursor-pointer"
                      style={{ background: bgStyle }}
                      onClick={() => onEventClickMobile(e)}
                    >
                      {e.all_day ? (
                        <div className="text-[0.7rem] font-bold uppercase tracking-wider opacity-90 flex items-center gap-1.5 mb-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                          <span>All Day</span>
                        </div>
                      ) : (
                        <div className="text-[0.7rem] font-bold leading-tight tracking-tight opacity-95 tabular-nums">
                          {fmtTime(e.start)} – {fmtTime(e.end)}
                        </div>
                      )}
                      <div className="text-base font-bold leading-snug tracking-tight">{e.title}</div>
                      {e.location && (
                        <div className="flex items-center gap-1.5 text-xs opacity-90 truncate mt-0.5">
                          <Icon name="location_on" className="text-sm shrink-0" />
                          <span className="truncate">{e.location}</span>
                        </div>
                      )}
                      <div className="mt-1 flex items-center gap-1.5 rounded-md bg-white/20 px-2 py-0.5 self-start text-[0.65rem] font-bold uppercase tracking-wider backdrop-blur-sm">
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
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  const renderYearView = () => {
    const todayKey = isoDate(new Date())

    return (
      <div className="flex-1 min-h-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-2.5 p-0.5 overflow-y-auto content-start auto-rows-max">
        {yearMonths.map((mDate) => {
          const year = mDate.getFullYear()
          const month = mDate.getMonth()
          const firstDayOfWeek = new Date(year, month, 1).getDay()
          const daysInMonth = new Date(year, month + 1, 0).getDate()
          const totalCells = 42

          return (
            <div
              key={mDate.toISOString()}
              className="flex flex-col rounded-xl p-2 border border-white/10 bg-white/[0.02] shadow-sm shrink-0"
            >
              <div className="text-center font-bold text-ink text-xs lg:text-sm tracking-tight mb-1 truncate">
                {mDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </div>

              <div className="grid grid-cols-7 text-center mb-0.5">
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((wd, i) => (
                  <div
                    key={i}
                    className={`text-[0.65rem] lg:text-[0.7rem] font-semibold ${
                      i === 0 || i === 6 ? 'text-ink-soft/70' : 'text-ink-soft'
                    }`}
                  >
                    {wd}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-y-0.5">
                {Array.from({ length: totalCells }, (_, idx) => {
                  if (idx < firstDayOfWeek || idx >= firstDayOfWeek + daysInMonth) {
                    return <div key={`empty-${idx}`} className="h-full min-h-[20px]" />
                  }

                  const dayNum = idx - firstDayOfWeek + 1
                  const colIdx = idx % 7
                  const isWeekend = colIdx === 0 || colIdx === 6
                  const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`
                  const isToday = dateKey === todayKey
                  const dayEvents = yearEventsByDate.get(dateKey) || []

                  const uniqueColors: string[] = []
                  for (const ev of dayEvents) {
                    const c = ev.color || selectionColorMap.get(ev.selection_id) || 'var(--primary)'
                    if (!uniqueColors.includes(c)) {
                      uniqueColors.push(c)
                    }
                  }

                  return (
                    <button
                      type="button"
                      key={dateKey}
                      onClick={() => handleDaySelect(new Date(year, month, dayNum))}
                      className="flex flex-col items-center justify-center rounded py-0.5 transition-all cursor-pointer hover:bg-white/10 active:scale-95 group relative min-h-[20px]"
                      style={{
                        backgroundColor: isToday
                          ? 'color-mix(in srgb, var(--primary) 22%, transparent)'
                          : isWeekend
                          ? 'color-mix(in srgb, var(--primary) 6%, transparent)'
                          : 'transparent',
                        border: isToday ? '1.5px solid var(--primary)' : '1.5px solid transparent',
                      }}
                      title={`${dayNum} ${mDate.toLocaleDateString(undefined, { month: 'short' })}: ${dayEvents.length} event${dayEvents.length === 1 ? '' : 's'}`}
                    >
                      <span
                        className={`text-[0.7rem] lg:text-[0.75rem] leading-none tabular-nums ${
                          isToday
                            ? 'font-bold text-[var(--primary)]'
                            : isWeekend
                            ? 'font-medium text-ink'
                            : 'text-ink-soft'
                        } group-hover:text-ink`}
                      >
                        {dayNum}
                      </span>
                      <div className="flex items-center justify-center gap-0.5 mt-0.5 h-1.5 w-full">
                        {uniqueColors.slice(0, 3).map((c, i) => (
                          <span
                            key={i}
                            className="h-1.5 w-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: c }}
                          />
                        ))}
                        {uniqueColors.length > 3 && (
                          <span className="h-1 w-1 rounded-full bg-ink-faint shrink-0" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const weatherByDate = new Map((weather?.daily ?? []).map((d) => [d.date, d]))

  return (
    <div className="flex h-full max-h-full flex-col px-4 lg:px-8 pb-2 lg:pb-3 min-h-0 overflow-hidden">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Calendar</h1>
          {!isMobile && selections.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {selections.map((s) => (
                <span
                  key={s.id}
                  className="btn-glass flex items-center gap-2 px-3.5 py-1 text-sm"
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: s.color }} />
                  {s.person_name || s.name}
                </span>
              ))}
            </div>
          )}
        </div>
        <TopClockHeader now={new Date()} />
      </div>
      {error && (
        <div className="mb-3 flex items-center">
          <span className="font-medium text-rose-500">{error}</span>
        </div>
      )}
      {isMobile && currentViewMode === 'schedule' ? (
        <div
          {...calendarSwipe}
          aria-label="Calendar schedule list; swipe left or right to change months"
          className="glass min-h-0 flex-1 p-3 lg:p-4 flex flex-col overflow-hidden"
        >
          {renderHeader()}
          {loadingMobileEvents ? (
            <div className="my-auto text-center text-lg text-ink-faint">Loading schedule...</div>
          ) : (
            renderMobileSchedule()
          )}
        </div>
      ) : (
        <div
          ref={wrapRef}
          onPointerDown={onContainerPointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={calendarSwipe.style}
          aria-label="Calendar view; swipe left or right to change period"
          className="glass min-h-0 flex-1 p-3 lg:p-4 flex flex-col overflow-hidden"
        >
          {renderHeader()}
          {currentViewMode === 'year' && renderYearView()}
          <div className={currentViewMode === 'year' ? 'hidden' : 'flex-1 min-h-0'}>
            <FullCalendar
              key={isMobile ? 'fc-mobile' : 'fc-desktop'}
              ref={calRef}
              plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin, listPlugin, multiMonthPlugin]}
              initialView={
                currentViewMode === 'day'
                  ? 'timeGridDay'
                  : currentViewMode === 'month'
                  ? 'dayGridMonth'
                  : currentViewMode === 'year'
                  ? (yearSubMode === 'rolling-12' ? 'multiMonthRolling12' : 'multiMonthYear')
                  : (weekSubMode === 'rolling-7' ? 'timeGridRolling7' : weekSubMode === 'rolling-5' ? 'timeGridRolling5' : 'timeGridWeek')
              }
              firstDay={0}
              multiMonthMaxColumns={isMobile ? 1 : 4}
              headerToolbar={false}
              views={{
                timeGridRolling7: {
                  type: 'timeGrid',
                  duration: { days: 7 },
                  dateAlignment: 'day',
                  dateIncrement: { days: 7 },
                },
                timeGridRolling5: {
                  type: 'timeGrid',
                  duration: { days: 5 },
                  dateAlignment: 'day',
                  dateIncrement: { days: 5 },
                },
                multiMonthYear: {
                  type: 'multiMonth',
                  duration: { years: 1 },
                  multiMonthMaxEvents: 2,
                },
                multiMonthRolling12: {
                  type: 'multiMonth',
                  duration: { months: 12 },
                  dateAlignment: 'month',
                  dateIncrement: { months: 12 },
                  multiMonthMaxEvents: 2,
                },
              }}
              height="100%"
              nowIndicator
              editable
              selectable
              selectMirror
              longPressDelay={500}
              selectLongPressDelay={500}
              eventLongPressDelay={500}
              selectAllow={checkSelectAllowed}
              slotMinTime="08:00:00"
              slotMaxTime="18:00:00"
              scrollTime="00:00:00"
              slotDuration="01:00:00"
              slotLabelInterval="01:00:00"
              snapDuration="00:15:00"
              datesSet={onDatesSet}
              eventsSet={onEventsSet}
              allDaySlot
              fixedWeekCount={false}
              eventMinHeight={38}
              eventContent={(eventInfo) => {
                const start = eventInfo.event.start
                const end = eventInfo.event.end
                const durationMin = start && end ? Math.round((end.getTime() - start.getTime()) / 60000) : 60
                const isShort = durationMin <= 35
                const isMonth = eventInfo.view.type === 'dayGridMonth' || eventInfo.view.type.startsWith('multiMonth')

                const timeStr = start && end
                  ? `${start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} – ${end.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
                  : start
                  ? start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                  : eventInfo.timeText
                const startStr = start
                  ? start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
                  : eventInfo.timeText

                if (eventInfo.event.allDay || isMonth) {
                  return (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 w-full min-w-0 overflow-hidden leading-tight text-white">
                      {!eventInfo.event.allDay && startStr && !eventInfo.view.type.startsWith('multiMonth') && (
                        <span className="text-[0.7rem] font-medium opacity-85 shrink-0 tabular-nums">{startStr}</span>
                      )}
                      {!eventInfo.event.allDay && startStr && !eventInfo.view.type.startsWith('multiMonth') && <span className="text-[0.7rem] opacity-60">•</span>}
                      <span className="text-xs font-medium truncate">{eventInfo.event.title}</span>
                    </div>
                  )
                }

                if (isShort) {
                  return (
                    <div className="flex items-center gap-1.5 px-2.5 py-0.5 w-full h-full min-w-0 overflow-hidden leading-tight text-white my-auto">
                      {startStr && (
                        <span className="text-[0.7rem] font-medium opacity-90 shrink-0 tabular-nums">{startStr}</span>
                      )}
                      {startStr && <span className="text-[0.7rem] opacity-60">•</span>}
                      <span className="text-sm font-medium truncate tracking-tight">{eventInfo.event.title}</span>
                    </div>
                  )
                }

                return (
                  <div className="flex flex-col gap-0.5 px-2.5 py-1 w-full h-full min-w-0 overflow-hidden leading-tight text-white">
                    {timeStr && (
                      <div className="text-[0.7rem] font-medium leading-tight tracking-tight opacity-90 tabular-nums">
                        {timeStr}
                      </div>
                    )}
                    <div className="truncate text-sm font-medium leading-snug tracking-tight">
                      {eventInfo.event.title}
                    </div>
                    {eventInfo.event.extendedProps.location && durationMin > 60 && (
                      <div className="flex items-center gap-1 truncate text-[0.7rem] opacity-80 mt-0.5">
                        <Icon name="location_on" className="text-[0.75rem] shrink-0" />
                        <span className="truncate">{eventInfo.event.extendedProps.location}</span>
                      </div>
                    )}
                  </div>
                )
              }}
              dayHeaderContent={(arg) => {
                if (arg.view.type.startsWith('multiMonth')) {
                  const narrowWeekday = arg.date.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'narrow' })
                  return (
                    <div className="flex flex-col items-center py-1">
                      <span className="text-[0.65rem] font-semibold text-ink-soft">
                        {narrowWeekday}
                      </span>
                    </div>
                  )
                }

                const dateStr = isoUtcDate(arg.date)
                const w = weatherByDate.get(dateStr)
                const weekday = arg.date.toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short' })
                const dayNum = arg.date.getUTCDate()
                const isDayView = arg.view.type === 'timeGridDay'
                const isMonthView = arg.view.type === 'dayGridMonth'

                const containerStyle = arg.isToday
                  ? {
                      border: '2px solid var(--primary)',
                      backgroundColor: 'color-mix(in srgb, var(--primary) 14%, transparent)',
                      borderRadius: '8px',
                      padding: '4px 2px',
                    }
                  : {
                      padding: '4px 2px',
                    }

                return (
                  <div 
                    className="flex flex-col items-center gap-0.5 w-full transition-all"
                    style={containerStyle}
                  >
                    <span className={`text-[0.65rem] sm:text-xs font-semibold uppercase tracking-wider ${
                      arg.isToday ? 'text-[var(--primary)] font-semibold' : 'text-ink-soft'
                    }`}>
                      {weekday}
                    </span>
                    {!isMonthView && (
                      <span className={`text-sm sm:text-base ${arg.isToday ? 'font-bold text-[var(--primary)]' : 'font-bold text-ink'}`}>
                        {dayNum}
                      </span>
                    )}
                    {w && !isMonthView && (
                      <span className={`flex flex-wrap justify-center items-center gap-x-1 gap-y-0 text-[0.6rem] sm:text-[0.7rem] font-semibold ${
                        arg.isToday ? 'text-ink' : 'text-ink-soft'
                      }`}>
                        <span className="text-xs sm:text-sm leading-none">{w.icon}</span>
                        <span className="hidden sm:inline">
                          {isDayView ? `${w.label} · ` : ''}{w.tmax}°<span className={arg.isToday ? 'text-[var(--primary)] opacity-70' : 'text-ink-faint'}>/{w.tmin}°</span>
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
        </div>
      )}

      {draft && (
        <Modal title={draft.id ? 'Edit event' : 'New event'} onClose={handleCloseDraft}>
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
            <label className="flex items-center gap-3 text-xl cursor-pointer">
              <input
                type="checkbox"
                checked={draft.all_day}
                onChange={(e) => {
                  const isAllDay = e.target.checked
                  let start = draft.start
                  let end = draft.end
                  if (isAllDay) {
                    start = start.slice(0, 10)
                    end = end.slice(0, 10)
                  } else {
                    if (!start.includes('T')) start = `${start.slice(0, 10)}T09:00`
                    if (!end.includes('T')) end = `${end.slice(0, 10)}T10:00`
                  }
                  setDraft({ ...draft, all_day: isAllDay, start, end })
                }}
                className="h-7 w-7 accent-teal-500 cursor-pointer"
              />
              All day
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1 text-lg font-medium text-ink-soft">
                Starts
                <input
                  type={draft.all_day ? 'date' : 'datetime-local'}
                  value={draft.all_day ? draft.start.slice(0, 10) : (draft.start.includes('T') ? draft.start : `${draft.start.slice(0, 10)}T09:00`)}
                  onChange={(e) => setDraft({ ...draft, start: e.target.value })}
                  className="input-glass px-4 py-3 text-lg font-normal"
                />
              </label>
              <label className="flex flex-col gap-1 text-lg font-medium text-ink-soft">
                Ends
                <input
                  type={draft.all_day ? 'date' : 'datetime-local'}
                  value={draft.all_day ? draft.end.slice(0, 10) : (draft.end.includes('T') ? draft.end : `${draft.end.slice(0, 10)}T10:00`)}
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
