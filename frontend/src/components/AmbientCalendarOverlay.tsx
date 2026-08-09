import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../lib/api'
import Icon from './Icon'

export interface ReminderPayload {
  title: string
  timeStr: string
  minutesLeft: number
  personName?: string
  personColor?: string
  type?: 'event' | 'task' | 'chore'
}

interface AgendaEvent {
  id: number
  title: string
  start: string
  end: string
  all_day: boolean
  person_name?: string
  color?: string
}

interface AgendaChore {
  id: number
  title: string
  completed: boolean
  person_name?: string
}

interface AmbientCalendarOverlayProps {
  visible: boolean
  onDismiss: () => void
  reminderPayload?: ReminderPayload | null
  onOpenDashboard?: () => void
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

export default function AmbientCalendarOverlay({
  visible,
  onDismiss,
  reminderPayload,
  onOpenDashboard,
}: AmbientCalendarOverlayProps) {
  const [events, setEvents] = useState<AgendaEvent[]>([])
  const [chores, setChores] = useState<AgendaChore[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    let active = true
    setLoading(true)

    const now = new Date()
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const endStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate() + 1).padStart(2, '0')}`

    Promise.all([
      api.get<AgendaEvent[]>(`/api/calendar/events?start=${todayStr}T00:00:00&end=${endStr}T23:59:59`).catch(() => []),
      api.get<AgendaChore[]>(`/api/chores`).catch(() => []),
    ]).then(([evRes, choreRes]) => {
      if (!active) return
      // Filter future/today events
      const validEvs = (evRes || [])
        .filter((e) => {
          if (e.all_day) return true
          return new Date(e.end).getTime() >= Date.now() - 30 * 60 * 1000
        })
        .slice(0, 4)

      setEvents(validEvs)
      setChores((choreRes || []).filter((c) => !c.completed).slice(0, 3))
      setLoading(false)
    })

    return () => {
      active = false
    }
  }, [visible])

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="fixed bottom-6 left-6 z-50 w-full max-w-md pointer-events-auto select-none"
        >
          <div className="bg-black/50 backdrop-blur-2xl border border-white/20 text-white rounded-3xl p-5 shadow-2xl overflow-hidden relative">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 mb-3.5 pb-2.5 border-b border-white/15">
              <div className="flex items-center gap-2.5 min-w-0">
                {reminderPayload ? (
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                    </span>
                    <span className="font-bold text-sm tracking-wide text-amber-300 flex items-center gap-1.5">
                      <Icon name="notifications_active" className="text-base" /> Upcoming Reminder
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Icon name="calendar_month" className="text-xl text-[var(--primary)] shrink-0" />
                    <h3 className="font-bold text-base tracking-wide text-white">Today's Schedule</h3>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {onOpenDashboard && (
                  <button
                    onClick={onOpenDashboard}
                    className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-xl bg-white/15 hover:bg-white/25 text-white transition-colors"
                  >
                    <span>Dashboard</span>
                    <Icon name="arrow_forward" className="text-sm" />
                  </button>
                )}
                <button
                  onClick={onDismiss}
                  className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-white/20 text-white/70 hover:text-white transition-colors"
                >
                  <Icon name="close" className="text-lg" />
                </button>
              </div>
            </div>

            {/* Reminder Alert Banner */}
            {reminderPayload && (
              <div className="mb-4 bg-amber-500/20 border border-amber-400/40 rounded-2xl p-3 flex items-center gap-3">
                <div className="h-10 w-10 rounded-2xl bg-amber-500/30 flex items-center justify-center shrink-0">
                  <Icon name="schedule" className="text-xl text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-400/30 text-amber-200 border border-amber-400/40">
                      In {reminderPayload.minutesLeft} min
                    </span>
                    {reminderPayload.personName && (
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full text-white/90"
                        style={{ backgroundColor: reminderPayload.personColor || 'rgba(255,255,255,0.2)' }}
                      >
                        {reminderPayload.personName}
                      </span>
                    )}
                  </div>
                  <h4 className="font-bold text-sm text-white truncate mt-1">{reminderPayload.title}</h4>
                </div>
              </div>
            )}

            {/* Content List */}
            {loading ? (
              <div className="py-6 text-center text-xs text-white/50 animate-pulse">Loading agenda...</div>
            ) : events.length === 0 && chores.length === 0 ? (
              <div className="py-4 text-center text-xs text-white/60">No upcoming events or chores for today ✨</div>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {/* Events */}
                {events.map((ev) => (
                  <div key={ev.id} className="flex items-center gap-3 bg-white/5 border border-white/10 p-2.5 rounded-2xl">
                    <div
                      className="h-3 w-3 rounded-full shrink-0 shadow-sm"
                      style={{ backgroundColor: ev.color || '#38bdf8' }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-xs text-white truncate">{ev.title}</div>
                      <div className="text-[11px] text-white/60">
                        {ev.all_day ? 'All Day' : `${formatTime(ev.start)} – ${formatTime(ev.end)}`}
                      </div>
                    </div>
                    {ev.person_name && (
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/80 bg-white/15 px-2 py-0.5 rounded-md shrink-0">
                        {ev.person_name}
                      </span>
                    )}
                  </div>
                ))}

                {/* Chores / Tasks */}
                {chores.length > 0 && (
                  <div className="pt-1 border-t border-white/10">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-1.5 px-1">
                      Pending Tasks
                    </div>
                    <div className="space-y-1.5">
                      {chores.map((c) => (
                        <div key={c.id} className="flex items-center gap-2 text-xs text-white/80 px-1 py-0.5">
                          <Icon name="check_box_outline_blank" className="text-sm text-white/40 shrink-0" />
                          <span className="truncate">{c.title}</span>
                          {c.person_name && (
                            <span className="ml-auto text-[10px] text-white/50 shrink-0">({c.person_name})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
