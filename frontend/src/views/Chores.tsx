import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion'
import { PRESS_SPRING, EXPRESSIVE_ENTER } from '../lib/motion'
import Avatar from '../components/Avatar'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { useData, todayISO, fmtDate } from '../lib/hooks'
import type { ChoreItem, CoinBalance } from '../lib/types'
import { useCelebration } from '../components/celebrations/CelebrationContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import TopClockHeader from '../components/TopClockHeader'

interface Person {
  id: number
  name: string
  color: string
  avatar?: string
  avatar_emoji?: string
  chores_enabled?: boolean
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatRecurrence(rec: string): string {
  if (!rec) return ''
  if (rec === 'daily') return '🔄 Daily'
  if (rec.startsWith('weekly:')) {
    const days = rec.replace('weekly:', '').split(',').map(Number)
    return '🔄 Weekly on ' + days.map((d) => WEEKDAY_LABELS[d]).join(', ')
  }
  if (rec.startsWith('biweekly:')) {
    const days = rec.replace('biweekly:', '').split(',').map(Number)
    return '🔄 Bi-weekly on ' + days.map((d) => WEEKDAY_LABELS[d]).join(', ')
  }
  if (rec === 'monthly:day') return '🔄 Monthly on same day'
  if (rec === 'monthly:weekday') return '🔄 Monthly on same weekday'
  return ''
}

function formatRelativeDueDate(dateStr: string): { label: string; subLabel: string } {
  const today = todayISO()
  if (dateStr === today) {
    return { label: 'Today', subLabel: fmtDate(dateStr) }
  }
  const t = new Date(today + 'T12:00:00').getTime()
  const d = new Date(dateStr + 'T12:00:00').getTime()
  const diffDays = Math.round((d - t) / (1000 * 60 * 60 * 24))

  if (diffDays === 1) {
    return { label: 'Tomorrow', subLabel: fmtDate(dateStr) }
  }
  if (diffDays > 1 && diffDays < 7) {
    return { label: `In ${diffDays} days`, subLabel: fmtDate(dateStr) }
  }
  if (diffDays === 7) {
    return { label: 'In 1 week', subLabel: fmtDate(dateStr) }
  }
  return { label: fmtDate(dateStr), subLabel: `in ${diffDays} days` }
}

interface Draft {
  id?: number
  title: string
  people: string[]
  coins: number
  due: string
  recurrence: '' | 'daily' | 'weekly' | 'biweekly' | 'monthly:day' | 'monthly:weekday'
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

const draftFrom = (c: ChoreItem): Draft => {
  let rec: Draft['recurrence'] = ''
  let weekDays: number[] = []
  if (c.recurrence === 'daily') {
    rec = 'daily'
  } else if (c.recurrence.startsWith('weekly:')) {
    rec = 'weekly'
    weekDays = c.recurrence.replace('weekly:', '').split(',').map(Number)
  } else if (c.recurrence.startsWith('biweekly:')) {
    rec = 'biweekly'
    weekDays = c.recurrence.replace('biweekly:', '').split(',').map(Number)
  } else if (c.recurrence === 'monthly:day') {
    rec = 'monthly:day'
  } else if (c.recurrence === 'monthly:weekday') {
    rec = 'monthly:weekday'
  }
  return {
    id: c.id,
    title: c.title,
    people: c.assigned_to ? [c.assigned_to] : [],
    coins: c.coins,
    due: c.due_date || todayISO(),
    recurrence: rec,
    weekDays,
  }
}

const SWIPE_THRESHOLD = 80

function ChoreCard({
  chore,
  isCompleting,
  onToggle,
  onEdit,
  onDelete,
  showPerson,
  personColor,
}: {
  chore: ChoreItem
  isCompleting?: boolean
  onToggle: (c: ChoreItem) => void
  onEdit: (c: ChoreItem) => void
  onDelete: (c: ChoreItem) => void
  showPerson?: boolean
  personColor?: string
}) {
  const x = useMotionValue(0)
  // action hints fade in as the card slides
  const editHint = useTransform(x, [0, 60], [0, 1])
  const deleteHint = useTransform(x, [-60, 0], [1, 0])
  const suppressClick = useRef(false)

  const isChecked = isCompleting || chore.completed

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{
        opacity: isCompleting ? 1 : chore.completed ? 0.6 : 1,
        scale: isCompleting ? 1.02 : 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={EXPRESSIVE_ENTER}
      className={`relative overflow-hidden rounded-xl transition-all duration-300 ${
        isCompleting
          ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/25 bg-emerald-500/10'
          : ''
      }`}
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

      {/* Floating reward celebration pill on completion */}
      <AnimatePresence>
        {isCompleting && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.7 }}
            animate={{ opacity: 1, y: -2, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 500, damping: 25 }}
            className="absolute right-12 top-2 z-10 flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-0.5 text-xs font-bold text-white shadow-md shadow-emerald-500/40 pointer-events-none"
          >
            <span>+{chore.coins}</span>
            <CoinIcon className="text-xs" />
            <span>DONE!</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        style={{ x }}
        drag={isCompleting ? false : 'x'}
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
        whileHover={isCompleting ? {} : { scale: 1.02, y: -2 }}
        whileTap={isCompleting ? {} : { scale: 0.98 }}
        transition={PRESS_SPRING}
        onClick={() => {
          if (!suppressClick.current && !isCompleting) onToggle(chore)
        }}
        className={`relative flex w-full cursor-pointer items-center gap-3 rounded-xl glass-inset p-2.5 text-left select-none shadow-sm transition-colors duration-300 ${
          isCompleting ? 'bg-emerald-500/10' : ''
        }`}
      >
        <motion.span
          animate={isCompleting ? { scale: [1, 1.3, 1] } : { scale: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 15 }}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] text-sm font-bold transition-all duration-300 ${
            isChecked
              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
              : 'border-teal-300/40 text-transparent'
          }`}
        >
          ✓
        </motion.span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate text-base font-medium transition-colors duration-200 ${
              isCompleting
                ? 'text-emerald-700 dark:text-emerald-300 font-semibold'
                : chore.completed
                  ? 'line-through text-ink-soft'
                  : 'text-ink'
            }`}
          >
            {chore.title}
          </span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.7rem] text-ink-soft mt-0.5">
            {showPerson && chore.assigned_to && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-white shadow-xs"
                style={{ backgroundColor: personColor || '#64748b' }}
              >
                {chore.assigned_to}
              </span>
            )}
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
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, title: string } | null>(null)
  const [filterPerson, setFilterPerson] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const openNewChoreModal = useCallback(() => {
    setDraft(emptyDraft())
  }, [])

  useEffect(() => {
    const handleCreateItem = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.type === 'chore') {
        openNewChoreModal()
      }
    }
    window.addEventListener('nivas:create-item', handleCreateItem)

    if (location.hash.includes('action=new')) {
      openNewChoreModal()
      history.replaceState(null, '', '#/chores')
    }

    return () => {
      window.removeEventListener('nivas:create-item', handleCreateItem)
    }
  }, [openNewChoreModal])

  const { data: chores, reload } = useData<ChoreItem[]>('/api/chores', ['chores'])
  const { data: people } = useData<Person[]>('/api/setup/people', ['chores'])
  const { data: balances } = useData<CoinBalance[]>('/api/rewards/balances', ['chores', 'rewards'])
  const { celebrate } = useCelebration()

  const [completingId, setCompletingId] = useState<number | null>(null)

  const toggle = async (chore: ChoreItem) => {
    if (completingId !== null) return
    const completing = !chore.completed
    if (completing) {
      setCompletingId(chore.id)
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 60, 40])
      }
      try {
        await api.patch(`/api/chores/${chore.id}`, { completed: true })
      } catch (err) {
        console.error('Failed to complete chore', err)
        setCompletingId(null)
        return
      }

      // Visual confirmation hold period on the card before celebration and list reorder
      await new Promise((resolve) => setTimeout(resolve, 650))
      celebrate()
      setCompletingId(null)
      reload()
    } else {
      await api.patch(`/api/chores/${chore.id}`, { completed: false })
      reload()
    }
  }

  const deleteChore = async (chore: ChoreItem) => {
    setConfirmDelete({ id: chore.id, title: chore.title })
  }

  const performDelete = async () => {
    if (!confirmDelete) return
    await api.del(`/api/chores/${confirmDelete.id}`)
    setConfirmDelete(null)
    setDraft(null)
    reload()
  }

  const saveDraft = async () => {
    if (!draft || !draft.title.trim()) return
    let recurrence: string = draft.recurrence
    if (recurrence === 'weekly') {
      recurrence = draft.weekDays.length > 0 ? `weekly:${[...draft.weekDays].sort().join(',')}` : ''
    } else if (recurrence === 'biweekly') {
      recurrence = draft.weekDays.length > 0 ? `biweekly:${[...draft.weekDays].sort().join(',')}` : ''
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
    setConfirmDelete({ id: draft.id, title: draft.title })
  }

  const personColor = useCallback(
    (name: string) =>
      people?.find((p) => p.name.toLowerCase() === name.toLowerCase())?.color ?? '#64748b',
    [people]
  )

  const orderedPeople = useMemo(() => {
    const list = (people ?? []).filter((p) => p.chores_enabled !== false).map((p) => p.name)
    return ['Family', ...list]
  }, [people])

  const [showUpcoming, setShowUpcoming] = useState(() => {
    try {
      const saved = localStorage.getItem('nivas:chores:show-upcoming')
      return saved !== null ? saved === 'true' : true
    } catch {
      return true
    }
  })

  const handleToggleUpcoming = () => {
    setShowUpcoming((prev) => {
      const next = !prev
      try {
        localStorage.setItem('nivas:chores:show-upcoming', String(next))
      } catch {}
      return next
    })
  }

  const allChores = chores ?? []
  const filtered = useMemo(() => {
    return filterPerson
      ? allChores.filter((c) => (c.assigned_to || 'Family') === filterPerson)
      : allChores
  }, [allChores, filterPerson])

  const today = todayISO()

  // Partition into Today vs Upcoming
  const { todayChores, upcomingChores } = useMemo(() => {
    const todayList: ChoreItem[] = []
    const upcomingList: ChoreItem[] = []
    for (const c of filtered) {
      if (!c.due_date || c.due_date <= today) {
        todayList.push(c)
      } else {
        upcomingList.push(c)
      }
    }
    return { todayChores: todayList, upcomingChores: upcomingList }
  }, [filtered, today])

  // Today's chores grouped by person
  const todayGroups = useMemo(() => {
    const map = new Map<string, ChoreItem[]>()
    for (const p of orderedPeople) {
      map.set(p, [])
    }
    for (const c of todayChores) {
      const key = c.assigned_to || 'Family'
      if (!map.has(key)) {
        map.set(key, [])
      }
      map.get(key)!.push(c)
    }
    const result = new Map<string, ChoreItem[]>()
    for (const [key, items] of map.entries()) {
      if (items.length > 0 || (filterPerson === key)) {
        result.set(key, items)
      }
    }
    return result
  }, [orderedPeople, todayChores, filterPerson])

  // Upcoming chores ordered by earliest to latest date, then title
  const sortedUpcoming = useMemo(() => {
    return [...upcomingChores].sort((a, b) => {
      if (a.due_date !== b.due_date) {
        return a.due_date.localeCompare(b.due_date)
      }
      if (a.completed !== b.completed) {
        return a.completed ? 1 : -1
      }
      return a.title.localeCompare(b.title)
    })
  }, [upcomingChores])

  // Group upcoming chores by date
  const upcomingByDate = useMemo(() => {
    const map = new Map<string, ChoreItem[]>()
    for (const c of sortedUpcoming) {
      const d = c.due_date
      if (!map.has(d)) {
        map.set(d, [])
      }
      map.get(d)!.push(c)
    }
    return [...map.entries()]
  }, [sortedUpcoming])

  const sortedBalances = [...(balances ?? [])].sort((a, b) => b.balance - a.balance)

  return (
    <div className="flex h-full flex-col px-4 lg:px-8">
      {/* Header */}
      <div className="mb-4 lg:mb-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Chores</h1>
            {filterPerson && (
              <motion.button
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={EXPRESSIVE_ENTER}
                onClick={() => setFilterPerson('')}
                className="btn-glass flex items-center gap-1 rounded-full px-3 py-1.5 text-sm cursor-pointer"
              >
                {filterPerson} <Icon name="close" className="text-base" />
              </motion.button>
            )}
            {upcomingChores.length > 0 && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                transition={PRESS_SPRING}
                onClick={handleToggleUpcoming}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs lg:text-sm font-medium transition-all cursor-pointer ${
                  showUpcoming
                    ? 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border border-sky-500/30 shadow-xs'
                    : 'btn-glass !text-ink-soft'
                }`}
                title={showUpcoming ? 'Hide upcoming chores' : 'Show upcoming chores'}
              >
                <Icon name={showUpcoming ? 'visibility' : 'visibility_off'} className="text-base" />
                <span>Upcoming ({upcomingChores.length})</span>
              </motion.button>
            )}
          </div>
          <div className="flex items-center gap-2 lg:gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={PRESS_SPRING}
              onClick={() => (location.hash = '#/rewards')}
              className="btn-sunny px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg cursor-pointer"
            >
              <Icon name="storefront" /> Rewards
            </motion.button>
            <TopClockHeader now={new Date()} />
          </div>
        </div>
      </div>

      {/* Layout for Chores */}
      <div className="flex flex-1 flex-col min-h-0 min-w-0">
        {/* Leaderboard — tap a card to filter that person's chores */}
        {sortedBalances.length > 0 && (
          <div className="mb-4 grid grid-cols-4 gap-2 md:flex md:shrink-0 md:gap-4 md:overflow-x-auto pb-1">
            {sortedBalances.map((b, i) => {
              const active = filterPerson === b.person_name
              return (
                <motion.button
                  key={b.person_name}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  transition={PRESS_SPRING}
                  onClick={() => setFilterPerson(active ? '' : b.person_name)}
                  className={`glass flex md:min-w-36 items-center gap-1 md:gap-2 p-1 md:p-1.5 text-left cursor-pointer transition-all duration-200 ${
                    active ? 'ring-2 ring-[var(--primary)] shadow-md' : ''
                  }`}
                  style={{ borderLeft: `${isMobile ? 3 : 4}px solid ${b.color}` }}
                >
                  <Avatar name={b.person_name} color={b.color} src={b.avatar} emoji={b.avatar_emoji} size={isMobile ? 22 : 36} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-xs md:text-base font-bold leading-tight" style={{ color: b.color }}>
                      {b.person_name}
                    </span>
                    <span className="flex items-center gap-0.5 md:gap-1 text-xs md:text-lg font-medium tabular-nums text-ink">
                      <CoinIcon className="text-xs md:text-lg" /> {b.balance}
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}

        {/* Scrollable chore area containing Today's tasks + Upcoming section */}
        <div className="flex-1 overflow-y-auto pr-1 pb-8 min-h-0">
          {/* Entirely Empty State */}
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={EXPRESSIVE_ENTER}
              className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-soft my-12"
            >
              <span className="text-7xl">✨</span>
              <p className="text-2xl font-medium">No chores here — time to assign some!</p>
            </motion.div>
          ) : (
            <>
              {/* Today's Chores Section */}
              {todayChores.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={EXPRESSIVE_ENTER}
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl glass-inset p-6 text-center text-ink-soft mb-6"
                >
                  <span className="text-4xl">🎉</span>
                  <p className="text-lg font-semibold text-ink">All caught up for today!</p>
                  <p className="text-sm text-ink-soft">
                    {upcomingChores.length > 0
                      ? 'No tasks due today. Check upcoming chores scheduled below!'
                      : 'No chores due today. Great job!'}
                  </p>
                </motion.div>
              ) : (
                <div className="grid auto-rows-min grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-4 gap-y-4 lg:gap-x-6 lg:gap-y-6 mb-6">
                  <AnimatePresence initial={false}>
                    {[...todayGroups.entries()].map(([person, list]) => (
                      <section key={person} className="flex flex-col">
                        <h2
                          className="mb-2 flex items-center justify-between text-lg font-semibold"
                          style={{ color: personColor(person) }}
                        >
                          <span className="flex items-center gap-2">
                            <span className="h-3.5 w-3.5 rounded-full" style={{ background: personColor(person) }} />
                            {person}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-variant text-ink-soft">
                            {list.filter((c) => !c.completed).length} left
                          </span>
                        </h2>
                        {list.length === 0 ? (
                          <div className="rounded-xl glass-inset p-4 text-center text-sm text-ink-soft">
                            All done for today! 🎉
                          </div>
                        ) : (
                          <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
                            {list.map((chore) => (
                              <ChoreCard
                                key={chore.id}
                                chore={chore}
                                isCompleting={completingId === chore.id}
                                onToggle={toggle}
                                onEdit={(c) => setDraft(draftFrom(c))}
                                onDelete={deleteChore}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    ))}
                  </AnimatePresence>
                </div>
              )}

              {/* Upcoming Chores Section */}
              {upcomingChores.length > 0 && (
                <div className="mt-4 pt-5 border-t border-slate-200/60 dark:border-slate-800/60">
                  {/* Upcoming Section Header with toggle */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                        <Icon name="event" className="text-lg" />
                      </span>
                      <h2 className="text-lg lg:text-xl font-bold tracking-tight text-ink flex items-center gap-2">
                        Upcoming
                        <span className="rounded-full bg-sky-500/15 px-2 py-0.2 text-xs font-bold text-sky-600 dark:text-sky-300">
                          {upcomingChores.length}
                        </span>
                      </h2>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      transition={PRESS_SPRING}
                      onClick={handleToggleUpcoming}
                      className="btn-glass flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium cursor-pointer"
                    >
                      <Icon name={showUpcoming ? 'visibility_off' : 'visibility'} className="text-base" />
                      <span>{showUpcoming ? 'Hide Upcoming' : 'Show Upcoming'}</span>
                      <Icon name={showUpcoming ? 'expand_less' : 'expand_more'} className="text-base" />
                    </motion.button>
                  </div>

                  {/* Collapsible Upcoming Chores by Date (Earliest to Latest) */}
                  <AnimatePresence>
                    {showUpcoming && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden flex flex-col gap-5"
                      >
                        {upcomingByDate.map(([dateStr, items]) => {
                          const rel = formatRelativeDueDate(dateStr)
                          return (
                            <div key={dateStr} className="flex flex-col">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-sm font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">
                                  {rel.label}
                                </span>
                                <span className="text-xs text-ink-soft">
                                  · {rel.subLabel}
                                </span>
                                <span className="rounded-full bg-slate-200/60 dark:bg-slate-800/60 px-2 py-0.2 text-[0.7rem] font-bold text-ink-soft">
                                  {items.length}
                                </span>
                              </div>
                              <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
                                {items.map((chore) => (
                                  <ChoreCard
                                    key={chore.id}
                                    chore={chore}
                                    isCompleting={completingId === chore.id}
                                    onToggle={toggle}
                                    onEdit={(c) => setDraft(draftFrom(c))}
                                    onDelete={deleteChore}
                                    showPerson={!filterPerson}
                                    personColor={personColor(chore.assigned_to || 'Family')}
                                  />
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Add / Edit Chore Modal */}
      {draft && (
        <Modal title={draft.id ? 'Edit chore' : 'New chore'} onClose={() => setDraft(null)}>
          <div className="flex flex-col gap-5">
            {!draft.id && (
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {[
                  { title: 'Do dishes', coins: 5, recurrence: 'daily' },
                  { title: 'Take out trash', coins: 10, recurrence: 'weekly', weekDays: [2] }, // Wed
                  { title: 'Clean room', coins: 15, recurrence: 'weekly', weekDays: [5] }, // Sat
                  { title: 'Feed pets', coins: 5, recurrence: 'daily' },
                ].map((tpl) => (
                  <button
                    key={tpl.title}
                    onClick={() => setDraft({ ...draft, title: tpl.title, coins: tpl.coins, recurrence: tpl.recurrence as any, weekDays: tpl.weekDays || [] })}
                    className="shrink-0 rounded-full bg-sky-50 dark:bg-sky-900/30 px-3 py-1 text-sm font-medium text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 transition-transform active:scale-95"
                  >
                    + {tpl.title}
                  </button>
                ))}
              </div>
            )}
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
              {(people ?? []).filter((p) => p.chores_enabled !== false).map((p) => {
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
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { label: 'One-time', value: '' },
                    { label: 'Daily', value: 'daily' },
                    { label: 'Weekly', value: 'weekly' },
                    { label: 'Bi-weekly', value: 'biweekly' },
                    { label: 'Monthly', value: 'monthly' },
                  ] as const
                ).map((opt) => {
                  const isSelected = opt.value === 'monthly'
                    ? (draft.recurrence === 'monthly:day' || draft.recurrence === 'monthly:weekday')
                    : draft.recurrence === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          recurrence: opt.value === 'monthly' ? 'monthly:day' : opt.value,
                          weekDays: (opt.value === 'weekly' || opt.value === 'biweekly') ? draft.weekDays : [],
                        })
                      }
                      className={`rounded-xl px-5 py-2.5 text-base font-medium transition-all ${
                        isSelected ? 'bg-sky-500 text-white' : 'surface-tile text-ink'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
              {(draft.recurrence === 'weekly' || draft.recurrence === 'biweekly') && (
                <div className="mt-1 flex flex-wrap gap-2">
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
              {(draft.recurrence === 'monthly:day' || draft.recurrence === 'monthly:weekday') && (
                <div className="mt-1 flex flex-col gap-2">
                  {(
                    [
                      {
                        label: (() => {
                          const d = new Date((draft.due || todayISO()) + 'T12:00:00')
                          return `Monthly on day ${d.getDate()}`
                        })(),
                        value: 'monthly:day'
                      },
                      {
                        label: (() => {
                          const d = new Date((draft.due || todayISO()) + 'T12:00:00')
                          const dayName = d.toLocaleDateString(undefined, { weekday: 'long' })
                          const occurrence = Math.floor((d.getDate() - 1) / 7) + 1
                          const ordinal = ['1st', '2nd', '3rd', '4th', '5th'][occurrence - 1]
                          return `Monthly on the ${ordinal} ${dayName}`
                        })(),
                        value: 'monthly:weekday'
                      }
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDraft({ ...draft, recurrence: opt.value })}
                      className={`rounded-xl px-4 py-2.5 text-left text-base font-normal transition-all ${
                        draft.recurrence === opt.value ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30' : 'surface-tile text-ink-soft'
                      }`}
                    >
                      {opt.label}
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

      {confirmDelete && (
        <ConfirmModal
          title="Delete Chore"
          message={`Are you sure you want to delete "${confirmDelete.title}"?`}
          onConfirm={performDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
