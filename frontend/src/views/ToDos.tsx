import { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { M3_EXPRESSIVE_SPRING, M3_STANDARD_SPRING } from '../lib/motion'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { useData, todayISO, fmtDate } from '../lib/hooks'
import type { Task } from '../lib/types'
import Modal from '../components/Modal'

interface TasksResponse {
  today: string
  tasks: Task[]
}

interface Person {
  id: number
  name: string
  color: string
}

const SOURCE_BADGE: Record<string, string> = { icloud: ' iCloud', alexa: '🔵 Alexa', local: '' }

interface Draft {
  id?: number
  source: Task['source']
  title: string
  person: string
  due: string
}

function TaskRow({
  task,
  onToggle,
  onEdit,
}: {
  task: Task
  onToggle: (t: Task) => void
  onEdit: (t: Task) => void
}) {
  return (
    <motion.div
      layoutId={`task-${task.source}-${task.id}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: task.completed ? 0.6 : 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={M3_STANDARD_SPRING}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onToggle(task)}
      className="flex w-full cursor-pointer items-center gap-3 rounded-xl glass-inset p-2.5 text-left select-none"
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[3px] text-base font-bold transition-all duration-300 ${
          task.completed
            ? 'border-emerald-400 bg-emerald-400 text-white shadow-sm'
            : 'border-teal-300/40 text-transparent'
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">
        <span
          className={`block truncate text-base font-medium ${task.completed ? 'line-through text-ink-soft' : 'text-ink'}`}
        >
          {task.title}
        </span>
        <span className="text-[0.7rem] text-ink-soft">
          {task.list_name}
          {task.due_date ? ` · due ${fmtDate(task.due_date)}` : ''}
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
        className="btn-glass flex h-8 w-8 shrink-0 items-center justify-center !text-ink-soft cursor-pointer"
        title="Edit to-do"
      >
        <Icon name="edit" className="text-base" />
      </motion.button>
    </motion.div>
  )
}

export default function ToDos() {
  const [range, setRange] = useState<'week' | 'all'>('week')
  const { data, reload } = useData<TasksResponse>(`/api/tasks?range=${range}`, ['tasks'])
  const { data: people } = useData<Person[]>('/api/setup/people', ['tasks'])
  const [draft, setDraft] = useState<Draft | null>(null)

  const tasks = data?.tasks ?? []

  const toggle = async (task: Task) => {
    await api.patch(`/api/tasks/${task.id}`, { completed: !task.completed })
    reload()
  }

  const saveDraft = async () => {
    if (!draft) return
    const title = draft.title.trim()
    if (!title) return
    const body = {
      title,
      person_name: draft.person,
      due_date: draft.due,
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
    if (!confirm(`Delete "${draft.title}"?`)) return
    await api.del(`/api/tasks/${draft.id}`)
    setDraft(null)
    reload()
  }

  const synced = draft && draft.source !== 'local'

  // separate active and completed
  const activeTasks = tasks.filter((t) => !t.completed)
  const completedTasks = tasks.filter((t) => t.completed)

  // group active by person; tasks without a person go to "Family"
  const activeGroups = new Map<string, Task[]>()
  for (const t of activeTasks) {
    const key = t.person_name || 'Family'
    activeGroups.set(key, [...(activeGroups.get(key) ?? []), t])
  }
  const personColor = (name: string) =>
    people?.find((p) => p.name.toLowerCase() === name.toLowerCase())?.color ?? '#64748b'

  const open = activeTasks.length
  const done = completedTasks.length

  return (
    <div className="flex h-full flex-col px-4 lg:px-8">
      <div className="mb-4 lg:mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-6">
          <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight text-ink">To-Dos</h1>
          <div className="btn-glass flex rounded-full p-1">
            {(['week', 'all'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`rounded-full px-5 py-2 text-base font-medium capitalize transition-all duration-200 cursor-pointer ${
                  range === r 
                    ? 'bg-gradient-to-r from-teal-400 to-sky-500 text-white shadow-md' 
                    : 'text-ink-soft hover:text-ink'
                }`}
              >
                {r === 'week' ? 'This Week' : 'All'}
              </button>
            ))}
          </div>
          <span className="text-lg font-medium text-ink-soft">
            {open} to do{done ? ` · ${done} done 🎉` : ''}
          </span>
        </div>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={M3_EXPRESSIVE_SPRING}
          onClick={() => setDraft({ source: 'local', title: '', person: '', due: todayISO() })}
          className="btn-primary px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg cursor-pointer"
        >
          <Icon name="add" /> Add
        </motion.button>
      </div>

      {tasks.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={M3_STANDARD_SPRING}
          className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-soft"
        >
          <span className="text-7xl">🎉</span>
          <p className="text-2xl font-normal">All clear — no to-dos!</p>
        </motion.div>
      ) : (
        <LayoutGroup>
          <motion.div layout className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-x-4 gap-y-3 lg:gap-x-6 lg:gap-y-4 overflow-y-auto pb-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            <AnimatePresence initial={false}>
              {[...activeGroups.entries()].map(([person, list]) => (
                <motion.section key={person} layout className="mb-4">
                  <h2
                    className="mb-1.5 flex items-center gap-2 text-lg font-semibold"
                    style={{ color: personColor(person) }}
                  >
                    <span
                      className="h-4 w-4 rounded-full"
                      style={{ background: personColor(person) }}
                    />
                    {person}
                    <span className="text-sm font-medium text-ink-soft">
                      {list.length}
                    </span>
                  </h2>
                  <div className="flex flex-col gap-2">
                    {list.map((t) => (
                      <TaskRow
                        key={`${t.source}-${t.id}`}
                        task={t}
                        onToggle={toggle}
                        onEdit={(task) =>
                          setDraft({
                            id: task.id,
                            source: task.source,
                            title: task.title,
                            person: task.person_name,
                            due: task.due_date ? task.due_date.slice(0, 10) : '',
                          })
                        }
                      />
                    ))}
                  </div>
                </motion.section>
              ))}

              {completedTasks.length > 0 && (
                <motion.section layout className="col-span-full mt-4">
                  <h2 className="mb-4 text-lg font-semibold text-ink-soft">Recently Completed</h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
                    {completedTasks.map((t) => (
                      <TaskRow
                        key={`${t.source}-${t.id}`}
                        task={t}
                        onToggle={toggle}
                        onEdit={(task) =>
                          setDraft({
                            id: task.id,
                            source: task.source,
                            title: task.title,
                            person: task.person_name,
                            due: task.due_date ? task.due_date.slice(0, 10) : '',
                          })
                        }
                      />
                    ))}
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.div>
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
    </div>
  )
}
