import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform } from 'framer-motion'
import { PRESS_SPRING, EXPRESSIVE_ENTER } from '../lib/motion'
import Icon from '../components/Icon'
import Avatar from '../components/Avatar'
import { api } from '../lib/api'
import { useData, todayISO, fmtDate } from '../lib/hooks'
import type { Task } from '../lib/types'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'
import TopClockHeader from '../components/TopClockHeader'

interface TasksResponse {
  today: string
  tasks: Task[]
}

interface Person {
  id: number
  name: string
  color: string
  avatar?: string
  avatar_emoji?: string
}

const SOURCE_BADGE: Record<string, string> = { icloud: ' iCloud', alexa: '🔵 Alexa', local: '' }
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

export interface DensityConfig {
  cardPadding: string
  checkSize: string
  titleSize: string
  subSize: string
  btnSize: string
  iconSize: string
  gap: string
}

export function getDensity(count: number, isShortScreen = false): DensityConfig {
  const thresholdDense = isShortScreen ? 6 : 8
  const thresholdCompact = isShortScreen ? 3 : 5

  if (count >= thresholdDense) {
    return {
      cardPadding: 'px-2.5 py-1.5 gap-2',
      checkSize: 'h-5 w-5 border-[2px] text-[10px]',
      titleSize: 'text-xs font-semibold',
      subSize: 'text-[0.65rem]',
      btnSize: 'h-6 w-6',
      iconSize: 'text-xs',
      gap: 'gap-1.5',
    }
  }
  if (count >= thresholdCompact) {
    return {
      cardPadding: 'px-3 py-2 gap-2.5',
      checkSize: 'h-6 w-6 border-[2px] text-xs',
      titleSize: 'text-sm font-medium',
      subSize: 'text-[0.7rem]',
      btnSize: 'h-7 w-7',
      iconSize: 'text-sm',
      gap: 'gap-2',
    }
  }
  return {
    cardPadding: 'px-3 py-2.5 gap-3',
    checkSize: 'h-7 w-7 border-[2.5px] text-sm',
    titleSize: 'text-base font-medium',
    subSize: 'text-xs',
    btnSize: 'h-8 w-8',
    iconSize: 'text-base',
    gap: 'gap-2.5',
  }
}

interface Draft {
  id?: number
  source: Task['source']
  title: string
  person: string
  due: string
  recurrence: '' | 'daily' | 'weekly' | 'biweekly' | 'monthly:day' | 'monthly:weekday'
  weekDays: number[]
}

const SWIPE_THRESHOLD = 80

function TaskRow({
  task,
  density,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task
  density?: DensityConfig
  onToggle: (t: Task) => void
  onEdit: (t: Task) => void
  onDelete: (t: Task) => void
}) {
  const d = density ?? getDensity(1)
  const canDelete = task.source === 'local'
  const isOverdue = task.due_date && task.due_date < todayISO() && !task.completed
  const x = useMotionValue(0)
  // action hints fade in as the card slides
  const editHint = useTransform(x, [0, 60], [0, 1])
  const deleteHint = useTransform(x, [-60, 0], [1, 0])
  const suppressClick = useRef(false)

  return (
    <motion.div
      layoutId={`task-${task.source}-${task.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: task.completed ? 0.6 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={EXPRESSIVE_ENTER}
      className="relative overflow-hidden rounded-xl"
    >
      <motion.div
        style={{ opacity: editHint }}
        className="absolute inset-0 flex items-center justify-start rounded-xl bg-sky-500/25 pl-3 text-sky-600 dark:text-sky-300"
      >
        <Icon name="edit" className={d.iconSize} />
      </motion.div>
      <motion.div
        style={{ opacity: deleteHint }}
        className="absolute inset-0 flex items-center justify-end rounded-xl bg-rose-500/25 pr-3 text-rose-600 dark:text-rose-300"
      >
        <Icon name={canDelete ? 'delete' : 'block'} className={d.iconSize} />
      </motion.div>

      <motion.div
        style={{ x }}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: canDelete ? 0.5 : 0.15, right: 0.5 }}
        onDragEnd={(_, info) => {
          if (Math.abs(info.offset.x) > 10) {
            suppressClick.current = true
            setTimeout(() => (suppressClick.current = false), 250)
          }
          if (info.offset.x > SWIPE_THRESHOLD) onEdit(task)
          else if (info.offset.x < -SWIPE_THRESHOLD && canDelete) onDelete(task)
        }}
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
        transition={PRESS_SPRING}
        onClick={() => {
          if (!suppressClick.current) onEdit(task)
        }}
        className={`relative flex w-full cursor-pointer items-center rounded-xl glass-inset text-left select-none shadow-xs transition-all ${d.cardPadding}`}
      >
        <span
          onClick={(e) => {
            e.stopPropagation()
            if (!suppressClick.current) onToggle(task)
          }}
          className={`flex shrink-0 items-center justify-center rounded-full font-bold transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer ${d.checkSize} ${
            task.completed
              ? 'border-emerald-400 bg-emerald-400 text-white shadow-sm'
              : isOverdue
              ? 'border-rose-400 bg-rose-50 dark:bg-rose-900/20 text-transparent'
              : 'border-teal-300/40 text-transparent'
          }`}
        >
          ✓
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={`block truncate font-medium ${d.titleSize} ${
              task.completed
                ? 'line-through text-ink-soft'
                : isOverdue
                ? 'text-rose-600 dark:text-rose-400 font-semibold'
                : 'text-ink'
            }`}
          >
            {task.title}
          </span>
          <span
            className={`block truncate ${d.subSize} ${
              isOverdue ? 'text-rose-500/80 dark:text-rose-400/80 font-medium' : 'text-ink-soft'
            }`}
          >
            {task.list_name}
            {task.due_date ? ` · due ${fmtDate(task.due_date)}` : ''}
            {task.recurrence && (
              <span
                className={`font-medium ${
                  isOverdue ? 'text-rose-600 dark:text-rose-400' : 'text-sky-600 dark:text-sky-400'
                }`}
              >
                {` · ${formatRecurrence(task.recurrence)}`}
              </span>
            )}
            {SOURCE_BADGE[task.source] ? ` · ${SOURCE_BADGE[task.source]}` : ''}
          </span>
        </span>
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(task)
          }}
          className={`btn-glass flex shrink-0 items-center justify-center !text-ink-soft cursor-pointer ${d.btnSize}`}
          title="Edit to-do"
        >
          <Icon name="edit" className={d.iconSize} />
        </motion.button>
      </motion.div>
    </motion.div>
  )
}

function sortTasks(tasks: Task[]): Task[] {
  const today = todayISO()
  return [...tasks].sort((a, b) => {
    // 1. Overdue tasks first
    const aOverdue = a.due_date && a.due_date < today
    const bOverdue = b.due_date && b.due_date < today
    if (aOverdue && !bOverdue) return -1
    if (!aOverdue && bOverdue) return 1

    // 2. Chronological by due date
    if (a.due_date && b.due_date) {
      if (a.due_date !== b.due_date) return a.due_date.localeCompare(b.due_date)
    } else if (a.due_date && !b.due_date) {
      return -1
    } else if (!a.due_date && b.due_date) {
      return 1
    }

    // 3. Alphabetical by title
    return a.title.localeCompare(b.title)
  })
}

export default function ToDos() {
  const [range, setRange] = useState<'week' | 'all'>('week')
  const { data, reload } = useData<TasksResponse>(`/api/tasks?range=${range}`, ['tasks'])
  const { data: people } = useData<Person[]>('/api/setup/people', ['tasks'])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, title: string } | null>(null)
  const [filterPerson, setFilterPerson] = useState('')
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768)
  const [isShortScreen, setIsShortScreen] = useState(() => typeof window !== 'undefined' && window.innerHeight < 900)

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
      setIsShortScreen(window.innerHeight < 900)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const tasks = data?.tasks ?? []

  const toggle = async (task: Task) => {
    const completing = !task.completed
    if (completing && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
    await api.patch(`/api/tasks/${task.id}`, { completed: completing })
    reload()
  }

  const deleteTask = async (task: Task) => {
    if (task.source !== 'local') return
    setConfirmDelete({ id: task.id, title: task.title })
  }

  const performDelete = async () => {
    if (!confirmDelete) return
    await api.del(`/api/tasks/${confirmDelete.id}`)
    setConfirmDelete(null)
    setDraft(null)
    reload()
  }

  const openNewTodoModal = useCallback(() => {
    setDraft({ source: 'local', title: '', person: '', due: todayISO(), recurrence: '', weekDays: [] })
  }, [])

  const handleEditTask = useCallback((task: Task) => {
    const isWeekly = task.recurrence.startsWith('weekly:')
    const isBiweekly = task.recurrence.startsWith('biweekly:')
    setDraft({
      id: task.id,
      source: task.source,
      title: task.title,
      person: task.person_name,
      due: task.due_date ? task.due_date.slice(0, 10) : '',
      recurrence: task.recurrence === 'daily' ? 'daily' :
                  isWeekly ? 'weekly' :
                  isBiweekly ? 'biweekly' :
                  task.recurrence === 'monthly:day' ? 'monthly:day' :
                  task.recurrence === 'monthly:weekday' ? 'monthly:weekday' : '',
      weekDays: isWeekly
        ? task.recurrence.replace('weekly:', '').split(',').map(Number)
        : isBiweekly
        ? task.recurrence.replace('biweekly:', '').split(',').map(Number)
        : [],
    })
  }, [])

  useEffect(() => {
    const handleCreateItem = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.type === 'todo') {
        openNewTodoModal()
      }
    }
    window.addEventListener('nivas:create-item', handleCreateItem)

    if (location.hash.includes('action=new')) {
      openNewTodoModal()
      history.replaceState(null, '', '#/todos')
    }

    return () => {
      window.removeEventListener('nivas:create-item', handleCreateItem)
    }
  }, [openNewTodoModal])

  const saveDraft = async () => {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) return
    let recurrence: string = draft.recurrence
    if (recurrence === 'weekly') {
      recurrence = draft.weekDays.length > 0 ? `weekly:${[...draft.weekDays].sort().join(',')}` : ''
    } else if (recurrence === 'biweekly') {
      recurrence = draft.weekDays.length > 0 ? `biweekly:${[...draft.weekDays].sort().join(',')}` : ''
    }
    const body = {
      title,
      person_name: draft.person,
      due_date: draft.due,
      recurrence,
    }
    if (draft.id) {
      await api.patch(`/api/tasks/${draft.id}`, body)
    } else {
      await api.post('/api/tasks', body)
    }
    setDraft(null)
    reload()
  }

  const deleteDraft = async () => {
    if (!draft?.id) return
    setConfirmDelete({ id: draft.id, title: draft.title })
  }

  const synced = draft && draft.source !== 'local'

  // separate active and completed
  const activeTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  const orderedPeople = useMemo(() => {
    const list = (people ?? []).map((p) => p.name)
    return ['Family', ...list]
  }, [people])

  const personColor = useCallback(
    (name: string) => {
      if (name === 'Family') return '#38bdf8'
      return people?.find((p) => p.name.toLowerCase() === name.toLowerCase())?.color ?? '#64748b'
    },
    [people]
  )

  // group active by person; tasks without a person go to "Family"
  const activeGroups = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const p of orderedPeople) {
      map.set(p, [])
    }
    for (const t of activeTasks) {
      const key = t.person_name || 'Family'
      const arr = map.get(key) ?? []
      arr.push(t)
      map.set(key, arr)
    }
    for (const [key, list] of map.entries()) {
      map.set(key, sortTasks(list))
    }
    return map
  }, [activeTasks, orderedPeople])

  const visibleGroups = useMemo(() => {
    const result: Array<{ person: string; list: Task[] }> = []
    for (const person of orderedPeople) {
      if (filterPerson && filterPerson !== person) continue
      const list = activeGroups.get(person) ?? []
      if (list.length > 0 || filterPerson === person) {
        result.push({ person, list })
      }
    }
    return result
  }, [orderedPeople, activeGroups, filterPerson])

  const open = activeTasks.length
  const done = completedTasks.length

  return (
    <div className="flex h-full flex-col px-4 lg:px-8 overflow-hidden min-h-0">
      <div className="mb-3 lg:mb-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex flex-wrap items-center gap-4 lg:gap-6">
          <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">To-Dos</h1>
          <div className="btn-glass flex rounded-full p-1">
            {(['week', 'all'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-4 lg:px-5 py-1.5 lg:py-2 text-sm lg:text-base font-medium capitalize transition-all duration-200 cursor-pointer ${
                  range === r 
                    ? 'bg-gradient-to-r from-teal-400 to-sky-500 text-white shadow-md' 
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {r === 'week' ? 'This Week' : 'All'}
              </button>
            ))}
          </div>
          <span className="text-sm lg:text-base font-medium text-ink-soft">
            {open} to do{done ? ` · ${done} done 🎉` : ''}
          </span>
        </div>
        <TopClockHeader now={new Date()} />
      </div>

      {/* Member Filter Bar like Chores */}
      <div className="mb-3 lg:mb-4 flex items-center gap-2 overflow-x-auto pb-1 shrink-0 [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => setFilterPerson('')}
          className={`glass flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${
            filterPerson === ''
              ? 'ring-2 ring-[var(--primary)] shadow-md text-ink'
              : 'text-ink-soft hover:text-ink opacity-80 hover:opacity-100'
          }`}
        >
          <span>All</span>
          <span className="rounded-full bg-surface-variant px-2 py-0.5 text-xs text-ink-soft">
            {open}
          </span>
        </button>
        {orderedPeople.map((name) => {
          const count = (activeGroups.get(name) ?? []).length
          const active = filterPerson === name
          const color = personColor(name)
          const personObj = people?.find((p) => p.name.toLowerCase() === name.toLowerCase())
          return (
            <button
              key={name}
              type="button"
              onClick={() => setFilterPerson(active ? '' : name)}
              className={`glass flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-all cursor-pointer shrink-0 ${
                active
                  ? 'ring-2 ring-[var(--primary)] shadow-md'
                  : 'text-ink-soft hover:text-ink opacity-80 hover:opacity-100'
              }`}
              style={{ borderLeft: `3.5px solid ${color}` }}
            >
              {personObj?.avatar || personObj?.avatar_emoji ? (
                <Avatar
                  name={name}
                  color={color}
                  src={personObj?.avatar}
                  emoji={personObj?.avatar_emoji}
                  size={20}
                />
              ) : (
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
              )}
              <span style={{ color: active ? color : undefined }}>{name}</span>
              {count > 0 && (
                <span
                  className="rounded-full px-1.5 py-0.2 text-[11px] font-bold text-white shadow-xs"
                  style={{ background: color }}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tasks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={EXPRESSIVE_ENTER}
          className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-soft my-12"
        >
          <span className="text-7xl">🎉</span>
          <p className="text-2xl font-normal">All clear — no to-dos!</p>
        </motion.div>
      ) : (
        <LayoutGroup>
          <div className="flex-1 overflow-y-auto pb-8 min-h-0 pr-1">
            {filterPerson && visibleGroups[0]?.list.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={EXPRESSIVE_ENTER}
                className="flex flex-col items-center justify-center gap-4 text-ink-soft my-16 glass rounded-2xl p-8 max-w-md mx-auto text-center"
              >
                <span className="text-5xl">✨</span>
                <p className="text-xl font-medium text-ink">All clear for {filterPerson}! 🎉</p>
                <p className="text-sm text-ink-soft">No active to-dos assigned right now.</p>
                <button
                  type="button"
                  onClick={() =>
                    setDraft({
                      source: 'local',
                      title: '',
                      person: filterPerson === 'Family' ? '' : filterPerson,
                      due: todayISO(),
                      recurrence: '',
                      weekDays: [],
                    })
                  }
                  className="btn-glass px-4 py-2.5 text-sm font-semibold rounded-xl text-ink cursor-pointer hover:scale-105 active:scale-95 transition-transform"
                >
                  + Add to-do for {filterPerson}
                </button>
              </motion.div>
            ) : (
              <motion.div
                layout
                className={`grid auto-rows-min gap-4 lg:gap-6 ${
                  visibleGroups.length === 1
                    ? 'grid-cols-1 max-w-xl'
                    : visibleGroups.length === 2
                    ? 'grid-cols-1 md:grid-cols-2 max-w-4xl'
                    : visibleGroups.length === 3
                    ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
                }`}
              >
                <AnimatePresence initial={false}>
                  {visibleGroups.map(({ person, list }) => {
                    const density = getDensity(list.length, isShortScreen)
                    return (
                      <motion.section
                        key={person}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={EXPRESSIVE_ENTER}
                        className="flex flex-col min-w-0"
                      >
                        <h2
                          className="mb-2 flex items-center justify-between text-base lg:text-lg font-semibold select-none"
                          style={{ color: personColor(person) }}
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span
                              className="h-3.5 w-3.5 rounded-full shrink-0 shadow-xs"
                              style={{ background: personColor(person) }}
                            />
                            <span className="truncate">{person}</span>
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-variant text-ink-soft shrink-0">
                            {list.length} left
                          </span>
                        </h2>

                        <div className={`flex flex-col ${density.gap}`}>
                          {list.map((t) => (
                            <TaskRow
                              key={`${t.source}-${t.id}`}
                              task={t}
                              density={density}
                              onToggle={toggle}
                              onDelete={deleteTask}
                              onEdit={handleEditTask}
                            />
                          ))}
                        </div>
                      </motion.section>
                    )
                  })}
                </AnimatePresence>
              </motion.div>
            )}

            {completedTasks.length > 0 && (
              <motion.section layout className="mt-8 pt-6 border-t border-ink-faint">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-semibold text-ink-soft flex items-center gap-2">
                    <Icon name="check_circle" className="text-emerald-500" />
                    Recently Completed
                  </h2>
                  <span className="text-xs font-medium text-ink-faint">{completedTasks.length} done</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                  {completedTasks.map((t) => (
                    <TaskRow
                      key={`${t.source}-${t.id}`}
                      task={t}
                      density={getDensity(completedTasks.length, isShortScreen)}
                      onToggle={toggle}
                      onDelete={deleteTask}
                      onEdit={handleEditTask}
                    />
                  ))}
                </div>
              </motion.section>
            )}
          </div>
        </LayoutGroup>
      )}

      {draft && (
        <Modal title={draft.id ? 'Edit to-do' : 'New to-do'} onClose={() => setDraft(null)}>
          <div className="flex flex-col gap-5">
            {synced && (
              <p className="rounded-xl bg-amber-50 p-3 text-base text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                This to-do syncs from {draft.source === 'icloud' ? 'Apple Reminders' : 'Alexa'} —
                edit its title or date there. You can still assign it to a family member here.
              </p>
            )}
            <input
              autoFocus={!synced}
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && saveDraft()}
              placeholder="What needs doing?"
              disabled={!!synced}
              className="input-glass px-5 py-4 text-xl disabled:opacity-50 focus:outline-none"
            />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setDraft({ ...draft, person: '' })}
                className={`rounded-full px-5 py-2.5 text-lg font-medium cursor-pointer ${
                  draft.person === '' ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'glass-inset text-ink-soft'
                }`}
              >
                Family
              </button>
              {(people ?? []).map((p) => (
                <button
                  key={p.id}
                  onClick={() => setDraft({ ...draft, person: p.name })}
                  className={`rounded-full px-5 py-2.5 text-lg font-medium text-white cursor-pointer ${
                    draft.person === p.name ? 'ring-4 ring-slate-700/40 dark:ring-slate-200/60' : 'opacity-60'
                  }`}
                  style={{ background: p.color }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            {/* Recurrence */}
            {!synced && (
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
                        className={`rounded-xl px-5 py-2.5 text-base font-medium transition-all cursor-pointer ${
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
                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-all cursor-pointer ${
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
                        className={`rounded-xl px-4 py-2.5 text-left text-base font-normal transition-all cursor-pointer ${
                          draft.recurrence === opt.value ? 'bg-sky-500/20 text-sky-600 dark:text-sky-300 border border-sky-500/30' : 'surface-tile text-ink-soft'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </label>
            )}
            <label className="flex flex-col gap-1 text-lg font-medium text-ink-soft">
              Due
              <input
                type="date"
                value={draft.due}
                onChange={(e) => setDraft({ ...draft, due: e.target.value })}
                disabled={!!synced}
                className="input-glass px-4 py-3 text-lg font-normal disabled:opacity-50 focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <button
                disabled={!draft.title.trim()}
                onClick={saveDraft}
                className="btn-primary flex-1 py-2.5 lg:py-4 text-base lg:text-xl disabled:opacity-40 cursor-pointer"
              >
                {draft.id ? 'Save changes' : 'Add to-do'}
              </button>
              {draft.id && !synced && (
                <button onClick={deleteDraft} className="btn-glass px-5 lg:px-8 py-2.5 lg:py-4 text-base lg:text-lg !text-rose-500 cursor-pointer">
                  <Icon name="delete" /> Delete
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete To-Do"
          message={`Are you sure you want to delete "${confirmDelete.title}"?`}
          onConfirm={performDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
