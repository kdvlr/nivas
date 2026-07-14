import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useData, todayISO, addDaysISO, fmtDate } from '../lib/hooks'
import type { MealDay, MealSlot, Recipe } from '../lib/types'
import Modal from '../components/Modal'
import Icon from '../components/Icon'

const SLOTS = ['breakfast', 'lunch', 'dinner'] as const
const SLOT_ICON = { breakfast: '🥞', lunch: '🥪', dinner: '🍝' }

interface Editing {
  date: string
  slot: string
  text: string
  recipe_id: number | null
}

function getVisibleDays() {
  if (typeof window === 'undefined') return 5
  return window.innerWidth < 768 ? 3 : 5
}

export default function Meals() {
  const [visibleDays, setVisibleDays] = useState(getVisibleDays)
  const [weekStart, setWeekStart] = useState(todayISO())

  useEffect(() => {
    const handler = () => setVisibleDays(getVisibleDays())
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const { data: days, reload } = useData<MealDay[]>(
    `/api/meals?start=${weekStart}&days=${visibleDays}`,
    ['meals', 'recipes'],
  )
  const { data: recipes } = useData<Recipe[]>('/api/recipes', ['recipes'])
  const [editing, setEditing] = useState<Editing | null>(null)
  const today = todayISO()

  const save = async () => {
    if (!editing) return
    await api.put('/api/meals', editing)
    setEditing(null)
    reload()
  }

  const [dragging, setDragging] = useState<{ date: string; slot: string; data: MealSlot } | null>(null)

  const handleDragStart = (e: React.DragEvent, date: string, slot: string, data: MealSlot) => {
    setDragging({ date, slot, data })
    e.dataTransfer.effectAllowed = 'move'
    // Optional: semi-transparent preview image or just rely on CSS
  }

  const handleDrop = async (e: React.DragEvent, targetDate: string, targetSlot: string) => {
    e.preventDefault()
    if (!dragging) return

    // Don't do anything if dropped on itself
    if (dragging.date === targetDate && dragging.slot === targetSlot) {
      setDragging(null)
      return
    }

    // 1. Move dragging data to target
    await api.put('/api/meals', {
      date: targetDate,
      slot: targetSlot,
      text: dragging.data.text ?? '',
      recipe_id: dragging.data.recipe_id ?? null,
    })

    // 2. Clear source
    await api.put('/api/meals', {
      date: dragging.date,
      slot: dragging.slot,
      text: '',
      recipe_id: null,
    })

    setDragging(null)
    reload()
  }

  const slotLabel = (s: MealSlot | null) => s?.recipe_title || s?.text || ''

  return (
    <div className="flex h-full flex-col px-4 lg:px-8">
      <div className="mb-4 lg:mb-5 flex items-center gap-3 lg:gap-4">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Meal Plan</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setWeekStart(addDaysISO(weekStart, -visibleDays))}
            className="btn-glass px-6 py-3 text-lg"
          >
            ‹
          </button>
          <div className="relative">
            <input 
              type="date" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              value={weekStart} 
              onChange={(e) => {
                if (e.target.value) setWeekStart(e.target.value)
              }} 
            />
            <button className="btn-glass px-4 lg:px-6 py-3 text-base pointer-events-none whitespace-nowrap min-w-[120px]">
              {weekStart === today ? (visibleDays === 3 ? 'Today' : 'This week') : fmtDate(weekStart + 'T12:00:00')}
            </button>
          </div>
          <button
            onClick={() => setWeekStart(addDaysISO(weekStart, visibleDays))}
            className="btn-glass px-6 py-3 text-lg"
          >
            ›
          </button>
        </div>
      </div>

      <div className={`grid min-h-0 flex-1 gap-3 overflow-y-auto pb-4 ${
        visibleDays === 3 ? 'grid-cols-1' : 'grid-cols-5'
      }`}>
        {(days ?? []).map((day) => (
          <div
            key={day.date}
            className={`flex flex-col gap-3 rounded-xl p-3 ${
              day.date === today ? 'glass ring-2 ring-[var(--primary)] ring-inset shadow-md bg-[var(--primary)]/5 dark:bg-[var(--primary)]/10' : 'glass'
            }`}
          >
            <h2 className="text-center text-lg font-medium text-ink flex flex-col items-center justify-center gap-0.5 min-h-[3rem]">
              {day.date === today && <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[var(--primary)]">Today</span>}
              <span>{fmtDate(day.date + 'T12:00:00')}</span>
            </h2>
            {SLOTS.map((slot) => {
              const s = day.slots[slot]
              return (
                <button
                  key={slot}
                  draggable={!!slotLabel(s)}
                  onDragStart={(e) => s && handleDragStart(e, day.date, slot, s)}
                  onDragOver={(e) => {
                    e.preventDefault()
                    e.currentTarget.classList.add('ring-2', 'ring-sky-400')
                  }}
                  onDragLeave={(e) => {
                    e.currentTarget.classList.remove('ring-2', 'ring-sky-400')
                  }}
                  onDrop={(e) => {
                    e.currentTarget.classList.remove('ring-2', 'ring-sky-400')
                    handleDrop(e, day.date, slot)
                  }}
                  onClick={() =>
                    setEditing({
                      date: day.date,
                      slot,
                      text: s?.text ?? '',
                      recipe_id: s?.recipe_id ?? null,
                    })
                  }
                  className={`flex min-h-24 w-full flex-col items-start gap-1 glass-inset p-3 text-left transition-all active:surface-tile-high ${
                    dragging?.date === day.date && dragging?.slot === slot ? 'opacity-30 grayscale' : ''
                  }`}
                >
                  <span className="text-sm font-medium uppercase tracking-wide text-ink-soft">
                    {SLOT_ICON[slot]} {slot}
                  </span>
                  {slotLabel(s) ? (
                    <span className="line-clamp-5 whitespace-pre-line text-base font-medium leading-tight">
                      {slotLabel(s)}
                      {s?.recipe_id && (
                        <a
                          href={`#/recipes/${s.recipe_id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="ml-1 text-sky-600 dark:text-sky-400"
                        >
                          📖
                        </a>
                      )}
                    </span>
                  ) : (
                    <div className="flex h-full w-full items-center justify-center pt-2 pb-1">
                      <span className="flex items-center gap-1.5 rounded-xl border border-dashed border-[var(--outline)] px-3 py-1.5 text-sm font-medium text-ink-faint transition-colors group-hover:border-ink-soft group-hover:text-ink-soft">
                        <Icon name="add" className="text-base" /> Plan {slot}
                      </span>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {editing && (
        <Modal
          title={`${SLOT_ICON[editing.slot as keyof typeof SLOT_ICON]} ${editing.slot} · ${fmtDate(editing.date + 'T12:00:00')}`}
          onClose={() => setEditing(null)}
        >
          <div className="flex flex-col gap-5">
            <textarea
              autoFocus
              value={editing.text}
              rows={3}
              maxLength={400}
              onChange={(e) => {
                // free-form meal notes, up to 5 lines
                const lines = e.target.value.split('\n')
                setEditing({ ...editing, text: lines.slice(0, 5).join('\n') })
              }}
              placeholder={'What\'s cooking? One item per line (or pick a recipe below)'}
              className="input-glass resize-none px-5 py-4 text-xl"
            />
            {(recipes ?? []).length > 0 && (
              <div className="max-h-72 overflow-y-auto rounded-xl border-2 border-[var(--outline-var)] p-2">
                {(recipes ?? []).map((r) => (
                  <button
                    key={r.id}
                    onClick={() =>
                      setEditing({
                        ...editing,
                        recipe_id: editing.recipe_id === r.id ? null : r.id,
                      })
                    }
                    className={`flex w-full items-center gap-3 rounded-xl p-3 text-left text-lg font-medium ${
                      editing.recipe_id === r.id ? 'bg-sky-400/20 text-sky-700 dark:text-sky-300' : 'active:surface-tile-high'
                    }`}
                  >
                    {r.image_url ? (
                      <img src={r.image_url} className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <span className="flex h-12 w-12 items-center justify-center rounded-lg surface-tile text-2xl">
                        🍲
                      </span>
                    )}
                    {r.title}
                    {editing.recipe_id === r.id && <span className="ml-auto">✓</span>}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={save}
                className="flex-1 btn-primary py-4 text-xl"
              >
                Save
              </button>
              <button
                onClick={async () => {
                  await api.put('/api/meals', { ...editing, text: '', recipe_id: null })
                  setEditing(null)
                  reload()
                }}
                className="btn-glass px-8 py-4 text-lg"
              >
                Clear
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
