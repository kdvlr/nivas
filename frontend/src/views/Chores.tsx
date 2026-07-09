import { useRef, useState } from 'react'
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform } from 'framer-motion'
import { PRESS_SPRING, EXPRESSIVE_ENTER } from '../lib/motion'
import Avatar from '../components/Avatar'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { useData, todayISO, fmtDate } from '../lib/hooks'
import type { ChoreItem, CoinBalance } from '../lib/types'
import { useCelebration } from '../components/celebrations/CelebrationContext'
import Modal from '../components/Modal'

interface Person {
  id: number
  name: string
  color: string
  avatar?: string
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatRecurrence(rec: string): string {
  if (!rec) return ''
  if (rec === 'daily') return '🔄 Daily'
  if (rec.startsWith('weekly:')) {
    const days = rec.replace('weekly:', '').split(',').map(Number)
    return '🔄 ' + days.map((d) => WEEKDAY_LABELS[d]).join(', ')
  }
  return ''
}

interface Draft {
  id?: number
  title: string
  people: string[]
  coins: number
  due: string
  recurrence: '' | 'daily' | 'weekly'
  weekDays: number[]
}

const emptyDraft = (): Draft => ({
  title: '',
  people: [],
  coins: 1,
  due: todayISO(),
  recurrence: '',
  weekDays: [],
})

const draftFrom = (c: ChoreItem): Draft => ({
  id: c.id,
  title: c.title,
  people: c.assigned_to ? [c.assigned_to] : [],
  coins: c.coins,
  due: c.due_date || todayISO(),
  recurrence: c.recurrence === 'daily' ? 'daily' : c.recurrence.startsWith('weekly:') ? 'weekly' : '',
  weekDays: c.recurrence.startsWith('weekly:')
    ? c.recurrence.replace('weekly:', '').split(',').map(Number)
    : [],
})

const SWIPE_THRESHOLD = 80

function ChoreCard({
  chore,
  onToggle,
  onEdit,
  onDelete,
}: {
  chore: ChoreItem
  onToggle: (c: ChoreItem) => void
  onEdit: (c: ChoreItem) => void
  onDelete: (c: ChoreItem) => void
}) {
  const x = useMotionValue(0)
  // action hints fade in as the card slides
  const editHint = useTransform(x, [0, 60], [0, 1])
  const deleteHint = useTransform(x, [-60, 0], [1, 0])
  const suppressClick = useRef(false)

  return (
    <motion.div
      layoutId={`chore-${chore.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: chore.completed ? 0.6 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={EXPRESSIVE_ENTER}
      className="relative overflow-hidden rounded-xl"
    >
      <motion.div
        style={{ opacity: editHint }}
        className="absolute inset-0 flex items-center justify-start rounded-xl bg-sky-500/25 pl-4 text-sky-600 dark:text-sky-300"
      >
        <Icon name="edit" className="text-2xl" />
      </motion.div>
      <motion.div
        style={{ opacity: deleteHint }}
        className="absolute inset-0 flex items-center justify-end rounded-xl bg-rose-500/25 pr-4 text-rose-600 dark:text-rose-300"
      >
        <Icon name="delete" className="text-2xl" />
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0.5, right: 0.5 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 10) {
            suppressClick.current = true
            setTimeout(() => (suppressClick.current = false), 250)
          }
          if (info.offset.x > SWIPE_THRESHOLD) onEdit(chore)
          else if (info.offset.x < -SWIPE_THRESHOLD) onDelete(chore)
        }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        transition={PRESS_SPRING}
        onClick={() => {
          if (!suppressClick.current) onToggle(chore)
        }}
        className="relative flex w-full cursor-pointer items-center gap-3 rounded-xl glass-inset p-2.5 text-left select-none shadow-sm"
      >
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] text-sm font-bold transition-all duration-300 ${
            chore.completed
              ? 'border-emerald-400 bg-emerald-400 text-white shadow-sm'
              : 'border-teal-300/40 text-transparent'
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-base font-medium ${chore.completed ? 'line-through text-ink-soft' : 'text-ink'}`}
          >
            {chore.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 text-[0.7rem] text-ink-soft">
            {chore.due_date && <span>due {fmtDate(chore.due_date)}</span>}
            {chore.recurrence && (
              <span className="font-medium text-sky-600 dark:text-sky-400">
                {formatRecurrence(chore.recurrence)}
              </span>
            )}
          </span>
        </span>
        <span className="flex shrink-0 items-center text-base font-semibold text-amber-500">
          <CoinIcon className="text-base" /> ×{chore.coins}
        </span>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(chore)
          }}
          className="btn-glass flex h-8 w-8 shrink-0 items-center justify-center !text-ink-soft cursor-pointer"
          title="Edit chore"
        >
          <Icon name="edit" className="text-base" />
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

export default function Chores() {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [filterPerson, setFilterPerson] = useState('')

  const { data: chores, reload } = useData<ChoreItem[]>('/api/chores', ['chores'])
  const { data: people } = useData<Person[]>('/api/setup/people', ['chores'])
  const { data: balances } = useData<CoinBalance[]>('/api/rewards/balances', ['chores', 'rewards'])
  const { celebrate } = useCelebration()

  const toggle = async (chore: ChoreItem) => {
    const completing = !chore.completed
    await api.patch(`/api/chores/${chore.id}`, { completed: completing })
    if (completing) celebrate()
    reload()
  }

  const deleteChore = async (chore: ChoreItem) => {
    if (!confirm(`Delete "${chore.title}"?`)) return
    await api.del(`/api/chores/${chore.id}`)
    reload()
  }

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return
    let recurrence: string = draft.recurrence
    if (recurrence === 'weekly') {
      recurrence = draft.weekDays.length > 0 ? `weekly:${[...draft.weekDays].sort().join(',')}` : ''
    }
    
    // If we're editing an existing chore, just update it for the first person (or as is)
    if (draft.id) {
      const body = {
        title: draft.title.trim(),
        assigned_to: draft.people[0] || '',
        coins: draft.coins,
        due_date: draft.due,
        recurrence,
      }
      await api.patch(`/api/chores/${draft.id}`, body)
    } else {
      // If we're creating new chores, create one for EACH selected person
      // If no person selected, create one with "" (Family)
      const peopleToAssign = draft.people.length > 0 ? draft.people : ['']
      
      for (const person of peopleToAssign) {
        await api.post('/api/chores', {
          title: draft.title.trim(),
          assigned_to: person,
          coins: draft.coins,
          due_date: draft.due,
          recurrence,
        })
      }
    }
    
    setDraft(null)
    reload()
  }

  const deleteDraft = async () => {
    if (!draft?.id) return
    if (!confirm(`Delete "${draft.title}"?`)) return
    await api.del(`/api/chores/${draft.id}`)
    setDraft(null)
    reload()
  }

  const personColor = (name: string) =>
    people?.find((p) => p.name.toLowerCase() === name.toLowerCase())?.color ?? '#64748b'

  const allChores = chores ?? []
  const filtered = filterPerson
    ? allChores.filter((c) => (c.assigned_to || 'Family') === filterPerson)
    : allChores

  const groups = new Map<string, ChoreItem[]>()
  for (const c of filtered) {
    const key = c.assigned_to || 'Family'
    groups.set(key, [...(groups.get(key) ?? []), c])
  }

  const sortedBalances = [...(balances ?? [])].sort((a, b) => b.balance - a.balance)

  return (
    <div className="flex h-full flex-col px-4 lg:px-8">
      {/* Header */}
      <div className="mb-4 lg:mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-ink">Chores</h1>
            {filterPerson && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={EXPRESSIVE_ENTER}
                onClick={() => setFilterPerson('')}
                className="btn-glass flex items-center gap-1 rounded-full px-4 py-2 text-base cursor-pointer"
              >
                {filterPerson} <Icon name="close" className="text-lg" />
              </motion.button>
            )}
          </div>
          <div className="flex gap-2 lg:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={PRESS_SPRING}
              onClick={() => setDraft(emptyDraft())}
              className="btn-primary px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg cursor-pointer"
            >
              <Icon name="add" /> Add
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={PRESS_SPRING}
              onClick={() => (location.hash = '#/rewards')}
              className="btn-sunny px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg cursor-pointer"
            >
              <Icon name="storefront" /> Rewards
            </motion.button>
          </div>
        </div>
      </div>

      {/* Leaderboard — tap a card to filter that person's chores */}
      {sortedBalances.length > 0 && (
        <div className="mb-5 flex shrink-0 gap-4 overflow-x-auto pb-1">
          {sortedBalances.map((b, i) => {
            const active = filterPerson === b.person_name
            return (
              <motion.button
                key={b.person_name}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                transition={PRESS_SPRING}
                onClick={() => setFilterPerson(active ? '' : b.person_name)}
                className={`glass flex min-w-36 items-center gap-2 p-1.5 text-left cursor-pointer transition-all duration-200 ${
                  active ? 'ring-2 ring-[var(--primary)] shadow-md' : ''
                }`}
                style={{ borderLeft: `4px solid ${b.color}` }}
              >
                <Avatar name={b.person_name} color={b.color} src={b.avatar} size={36} />
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-semibold leading-tight" style={{ color: b.color }}>
                    {b.person_name}
                  </span>
                  <span className="flex items-center gap-1 text-lg font-medium tabular-nums text-ink">
                    <CoinIcon className="text-lg" /> {b.balance}
                  </span>
                </div>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Chore cards */}
      {filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={EXPRESSIVE_ENTER}
          className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-soft"
        >
          <span className="text-7xl">✨</span>
          <p className="text-2xl font-medium">No chores here — time to assign some!</p>
        </motion.div>
      ) : (
        <LayoutGroup>
          <motion.div layout className="grid min-h-0 flex-1 auto-rows-min grid-cols-1 gap-x-4 gap-y-3 lg:gap-x-6 lg:gap-y-4 overflow-y-auto pb-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence initial={false}>
              {[...groups.entries()].map(([person, list]) => (
                <motion.section key={person} layout className="mb-4">
                  <h2
                    className="mb-1.5 flex items-center gap-2 text-lg font-semibold"
                    style={{ color: personColor(person) }}
                  >
                    <span className="h-4 w-4 rounded-full" style={{ background: personColor(person) }} />
                    {person}
                    <span className="text-sm font-medium text-ink-soft">
                      {list.filter((c) => !c.completed).length}
                    </span>
                  </h2>
                  <div className="flex flex-col gap-2">
                    {list.map((chore) => (
                      <ChoreCard
                        key={chore.id}
                        chore={chore}
                        onToggle={toggle}
                        onEdit={(c) => setDraft(draftFrom(c))}
                        onDelete={deleteChore}
                      />
                    ))}
                  </div>
                </motion.section>
              ))}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>
      )}

      {/* Add / Edit Chore Modal */}
      {draft && (
        <Modal title={draft.id ? 'Edit chore' : 'New chore'} onClose={() => setDraft(null)}>
          <div className="flex flex-col gap-5">
            <input
              autoFocus
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveDraft()}
              placeholder="What needs doing?"
              className="input-glass px-5 py-4 text-xl"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDraft({ ...draft, people: [] })}
                className={`rounded-full px-5 py-2.5 text-lg font-medium ${
                  draft.people.length === 0
                    ? 'bg-[var(--primary)] text-[var(--on-primary)]'
                    : 'glass-inset text-ink-soft'
                }`}
              >
                Family
              </button>
              {(people ?? []).map((p) => {
                const isSelected = draft.people.includes(p.name)
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      const next = isSelected 
                        ? draft.people.filter(n => n !== p.name)
                        : [...draft.people, p.name]
                      setDraft({ ...draft, people: next })
                    }}
                    className={`rounded-full px-5 py-2.5 text-lg font-medium text-white transition-all ${
                      isSelected
                        ? 'scale-110 ring-4 ring-slate-700/40 dark:ring-slate-200/60 shadow-lg'
                        : 'opacity-40 grayscale-[0.5]'
                    }`}
                    style={{ background: p.color }}
                  >
                    {p.name}
                  </button>
                )
              })}
            </div>
            {/* Coins */}
            <label className="flex items-center gap-3 text-lg font-medium text-ink-soft">
              Coins <CoinIcon />
              <input
                type="number"
                min={1}
                max={50}
                value={draft.coins}
                onChange={(e) =>
                  setDraft({ ...draft, coins: Math.max(1, Math.min(50, Number(e.target.value))) })
                }
                className="w-24 input-glass px-4 py-3 text-lg font-normal"
              />
            </label>
            {/* Recurrence */}
            <label className="flex flex-col gap-2 text-lg font-medium text-ink-soft">
              Repeat
              <div className="flex gap-2">
                {(
                  [
                    { label: 'One-time', value: '' },
                    { label: 'Daily', value: 'daily' },
                    { label: 'Weekly', value: 'weekly' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        recurrence: opt.value,
                        weekDays: opt.value === 'weekly' ? draft.weekDays : [],
                      })
                    }
                    className={`rounded-xl px-5 py-2.5 text-base font-medium transition-all ${
                      draft.recurrence === opt.value ? 'bg-sky-500 text-white' : 'surface-tile text-ink'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              {draft.recurrence === 'weekly' && (
                <div className="mt-1 flex gap-2">
                  {WEEKDAY_LABELS.map((day, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          weekDays: draft.weekDays.includes(i)
                            ? draft.weekDays.filter((d) => d !== i)
                            : [...draft.weekDays, i],
                        })
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                        draft.weekDays.includes(i) ? 'bg-sky-500 text-white' : 'surface-tile text-ink-soft'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
              )}
            </label>
            {/* Due date */}
            <label className="flex flex-col gap-1 text-lg font-medium text-ink-soft">
              Due
              <input
                type="date"
                value={draft.due}
                onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                className="input-glass px-4 py-3 text-lg font-normal"
              />
            </label>
            {/* Actions */}
            <div className="flex gap-3">
              <button
                disabled={!draft.title.trim()}
                onClick={saveDraft}
                className="btn-primary flex-1 py-2.5 lg:py-4 text-base lg:text-xl disabled:opacity-40"
              >
                {draft.id ? 'Save changes' : 'Add chore'}
              </button>
              {draft.id && (
                <button onClick={deleteDraft} className="btn-glass px-5 lg:px-8 py-2.5 lg:py-4 text-base lg:text-lg !text-rose-500">
                  <Icon name="delete" /> Delete
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
