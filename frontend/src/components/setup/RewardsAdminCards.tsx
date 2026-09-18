import { ReactNode, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { api } from '../../lib/api'
import { useData } from '../../lib/hooks'
import Icon from '../Icon'
import ConfirmModal from '../ConfirmModal'
import CoinIcon from '../CoinIcon'
import { STANDARD_ENTER, PRESS_SPRING } from '../../lib/motion'

interface Balance {
  person_name: string
  color: string
  avatar_emoji: string
  avatar: string
  earned: number
  lost: number
  spent: number
  adjusted: number
  balance: number
}

interface StoreItem {
  id: number
  title: string
  coin_cost: number
  emoji: string
}

function Card({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={STANDARD_ENTER}
      className="glass p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-medium">{title}</h2>
      </div>
      {children}
    </motion.section>
  )
}

const QUICK = [-5, -1, 1, 5]

/** Grant or remove coins by hand, and reset a balance to zero. */
export function PointsAdminCard() {
  const { data: balances, reload } = useData<Balance[]>('/api/rewards/balances', ['rewards', 'chores'])
  const [busy, setBusy] = useState<string | null>(null)
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [resetting, setResetting] = useState<Balance | null>(null)
  const [resetAll, setResetAll] = useState(false)
  const [clearHistory, setClearHistory] = useState(false)

  const adjust = async (name: string, amount: number) => {
    if (!amount) return
    setBusy(name)
    try {
      await api.post('/api/rewards/adjust', { person_name: name, amount })
      setCustom((c) => ({ ...c, [name]: '' }))
      reload()
    } finally {
      setBusy(null)
    }
  }

  const doReset = async (name: string | null) => {
    setBusy(name ?? '__all__')
    try {
      await api.post('/api/rewards/reset', {
        person_name: name,
        clear_history: clearHistory,
      })
      reload()
    } finally {
      setBusy(null)
      setResetting(null)
      setResetAll(false)
      setClearHistory(false)
    }
  }

  const rows = balances ?? []

  return (
    <Card title={<><CoinIcon /> Points</>}>
      <p className="mb-4 text-sm text-ink-soft">
        Add or remove coins by hand. Every change is written to the ledger, so the running
        totals below always add up.
      </p>

      <div className="flex flex-col gap-3">
        {rows.map((b) => {
          const pending = busy === b.person_name
          const typed = custom[b.person_name] ?? ''
          return (
            <div key={b.person_name} className="glass-inset flex flex-col gap-3 rounded-2xl p-3.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
                  style={{ background: `${b.color}33` }}
                >
                  {b.avatar_emoji || b.person_name.slice(0, 1)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">{b.person_name}</p>
                  <p className="text-xs text-ink-faint">
                    earned {b.earned} · spent {Math.abs(b.spent)} · missed {Math.abs(b.lost)}
                    {b.adjusted !== 0 && ` · adjusted ${b.adjusted > 0 ? '+' : ''}${b.adjusted}`}
                  </p>
                </div>
                <span className="ml-auto flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-base font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                  <CoinIcon /> {b.balance}
                </span>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {QUICK.map((n) => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.94 }}
                    transition={PRESS_SPRING}
                    disabled={pending}
                    onClick={() => adjust(b.person_name, n)}
                    className={`h-9 w-9 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${
                      n < 0
                        ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200'
                        : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                    }`}
                  >
                    {n > 0 ? `+${n}` : n}
                  </motion.button>
                ))}
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="±"
                  value={typed}
                  onChange={(e) => setCustom((c) => ({ ...c, [b.person_name]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') adjust(b.person_name, parseInt(typed, 10) || 0)
                  }}
                  className="input-glass h-9 w-16 text-center text-sm"
                />
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={PRESS_SPRING}
                  disabled={pending || !parseInt(typed, 10)}
                  onClick={() => adjust(b.person_name, parseInt(typed, 10) || 0)}
                  className="btn-glass h-9 px-3 text-sm disabled:opacity-40"
                >
                  Apply
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.94 }}
                  transition={PRESS_SPRING}
                  disabled={pending}
                  onClick={() => setResetting(b)}
                  title={`Reset ${b.person_name} to zero`}
                  className="h-9 w-9 rounded-xl text-ink-soft transition-colors hover:bg-slate-300/20 disabled:opacity-40 dark:hover:bg-slate-700/30"
                >
                  <Icon name="restart_alt" className="text-lg" />
                </motion.button>
              </div>
            </div>
          )
        })}
        {rows.length === 0 && <p className="text-sm text-ink-faint">No family members yet.</p>}
      </div>

      {rows.length > 0 && (
        <button
          onClick={() => setResetAll(true)}
          className="mt-4 text-sm font-medium text-rose-600 hover:underline dark:text-rose-400"
        >
          Reset everyone to zero
        </button>
      )}

      <AnimatePresence>
        {(resetting || resetAll) && (
          <ConfirmModal
            title={resetAll ? 'Reset everyone?' : `Reset ${resetting?.person_name}?`}
            confirmText="Reset"
            message={
              <div className="flex flex-col gap-3">
                <p>
                  {resetAll
                    ? 'This sets every family member’s coin balance to zero.'
                    : `This sets ${resetting?.person_name}’s balance (${resetting?.balance} coins) to zero.`}
                </p>
                <label className="flex items-start gap-2.5 text-sm text-ink-soft">
                  <input
                    type="checkbox"
                    checked={clearHistory}
                    onChange={(e) => setClearHistory(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    Also erase the history of coins earned and spent. Leave this unchecked to
                    keep the record and just zero the balance.
                  </span>
                </label>
              </div>
            }
            onConfirm={() => doReset(resetAll ? null : resetting?.person_name ?? null)}
            onCancel={() => {
              setResetting(null)
              setResetAll(false)
              setClearHistory(false)
            }}
          />
        )}
      </AnimatePresence>
    </Card>
  )
}

const EMOJI_CHOICES = ['🎁', '🍦', '🎮', '🍿', '🎬', '🧸', '🚲', '🏊', '🎨', '📚', '🍪', '🧁', '⚽', '🎡', '🛴', '💤']

/** Add, edit and remove the things coins can be spent on. */
export function RewardStoreCard() {
  const { data: store, reload } = useData<StoreItem[]>('/api/rewards/store', ['rewards'])
  const [editing, setEditing] = useState<number | 'new' | null>(null)
  const [title, setTitle] = useState('')
  const [cost, setCost] = useState('5')
  const [emoji, setEmoji] = useState('🎁')
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<StoreItem | null>(null)

  const items = store ?? []

  const startNew = () => {
    setEditing('new')
    setTitle('')
    setCost('5')
    setEmoji('🎁')
  }

  const startEdit = (it: StoreItem) => {
    setEditing(it.id)
    setTitle(it.title)
    setCost(String(it.coin_cost))
    setEmoji(it.emoji || '🎁')
  }

  const save = async () => {
    const coin_cost = Math.max(1, parseInt(cost, 10) || 1)
    if (!title.trim()) return
    setBusy(true)
    try {
      if (editing === 'new') {
        await api.post('/api/rewards/store', { title: title.trim(), coin_cost, emoji })
      } else if (typeof editing === 'number') {
        await api.patch(`/api/rewards/store/${editing}`, { title: title.trim(), coin_cost, emoji })
      }
      setEditing(null)
      reload()
    } finally {
      setBusy(false)
    }
  }

  const remove = async (it: StoreItem) => {
    setBusy(true)
    try {
      await api.del(`/api/rewards/store/${it.id}`)
      setDeleting(null)
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card title={<><Icon name="storefront" /> Reward store</>}>
      <p className="mb-4 text-sm text-ink-soft">What the kids can spend their coins on.</p>

      <div className="flex flex-col gap-2">
        {items.map((it) => (
          <div key={it.id} className="glass-inset flex items-center gap-3 rounded-2xl p-3">
            <span className="text-2xl">{it.emoji}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-ink">{it.title}</span>
            <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
              <CoinIcon /> {it.coin_cost}
            </span>
            <button
              onClick={() => startEdit(it)}
              className="h-9 w-9 rounded-xl text-ink-soft transition-colors hover:bg-slate-300/20 dark:hover:bg-slate-700/30"
              title={`Edit ${it.title}`}
            >
              <Icon name="edit" className="text-lg" />
            </button>
            <button
              onClick={() => setDeleting(it)}
              className="h-9 w-9 rounded-xl text-rose-600 transition-colors hover:bg-rose-500/10 dark:text-rose-400"
              title={`Remove ${it.title}`}
            >
              <Icon name="delete" className="text-lg" />
            </button>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-ink-faint">Nothing in the store yet.</p>}
      </div>

      {editing === null ? (
        <button onClick={startNew} className="btn-primary mt-4 flex items-center gap-2 px-4 py-2.5 text-sm">
          <Icon name="add" /> Add reward
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={STANDARD_ENTER}
          className="glass-inset mt-4 flex flex-col gap-3 rounded-2xl p-4"
        >
          <div className="flex flex-wrap gap-1.5">
            {EMOJI_CHOICES.map((e) => (
              <button
                key={e}
                onClick={() => setEmoji(e)}
                className={`h-9 w-9 rounded-xl text-xl transition-colors ${
                  emoji === e ? 'bg-[var(--primary)]/20 ring-2 ring-[var(--primary)]' : 'hover:bg-slate-300/20 dark:hover:bg-slate-700/30'
                }`}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') save()
                if (e.key === 'Escape') setEditing(null)
              }}
              placeholder="Ice cream trip"
              className="input-glass min-w-0 flex-1 px-3 py-2.5"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className="input-glass w-20 px-3 py-2.5 text-center"
              />
              <span className="text-sm text-ink-soft">coins</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={save} disabled={busy || !title.trim()} className="btn-primary px-4 py-2.5 text-sm disabled:opacity-40">
              {editing === 'new' ? 'Add' : 'Save'}
            </button>
            <button onClick={() => setEditing(null)} className="btn-glass px-4 py-2.5 text-sm">
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      <AnimatePresence>
        {deleting && (
          <ConfirmModal
            title={`Remove ${deleting.title}?`}
            message="It disappears from the store. Coins already spent on it stay in the history."
            onConfirm={() => remove(deleting)}
            onCancel={() => setDeleting(null)}
          />
        )}
      </AnimatePresence>
    </Card>
  )
}

interface ChoreItemSummary {
  id: number
  title: string
  assigned_to: string
  due_date: string
  recurrence: string
  completed: boolean
}

/** Reset chore dates to today and upcoming future dates. */
export function ChoresAdminCard() {
  const { data: chores, reload } = useData<ChoreItemSummary[]>('/api/chores', ['chores'])
  const [busy, setBusy] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetCompleted, setResetCompleted] = useState(true)
  const [includeOneOff, setIncludeOneOff] = useState(true)
  const [resultMsg, setResultMsg] = useState<string | null>(null)

  const todayStr = new Date().toISOString().slice(0, 10)
  const allChores = chores ?? []
  const pastDueCount = allChores.filter((c) => c.due_date && c.due_date < todayStr).length

  const handleResetDates = async () => {
    setBusy(true)
    setResultMsg(null)
    try {
      const res = await api.post<{ updated_count: number; total_chores: number }>('/api/chores/reset-dates', {
        reset_completed: resetCompleted,
        include_one_off: includeOneOff,
      })
      reload()
      setResultMsg(`Successfully updated ${res.updated_count} chore${res.updated_count === 1 ? '' : 's'} to today and upcoming dates.`)
    } catch (e) {
      console.error('Failed to reset chore dates', e)
    } finally {
      setBusy(false)
      setConfirmReset(false)
    }
  }

  return (
    <Card title={<><Icon name="checklist" /> Chore Dates & Scheduling</>}>
      <p className="mb-4 text-sm text-ink-soft">
        Advance past due dates for recurring and overdue chores to today and upcoming dates according to each chore's recurrence pattern (daily, weekly, bi-weekly, or monthly).
      </p>

      <div className="glass-inset mb-4 flex flex-col gap-2.5 rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Total Chores</span>
          <span className="text-sm font-semibold text-ink">{allChores.length}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-ink">Chores with Past Due Dates</span>
          <span className={`text-sm font-semibold ${pastDueCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
            {pastDueCount}
          </span>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-2">
        <label className="flex items-center gap-2.5 text-sm text-ink-soft cursor-pointer">
          <input
            type="checkbox"
            checked={resetCompleted}
            onChange={(e) => setResetCompleted(e.target.checked)}
            className="rounded border-[var(--outline)]"
          />
          <span>Reset completion status for upcoming recurring chores</span>
        </label>
        <label className="flex items-center gap-2.5 text-sm text-ink-soft cursor-pointer">
          <input
            type="checkbox"
            checked={includeOneOff}
            onChange={(e) => setIncludeOneOff(e.target.checked)}
            className="rounded border-[var(--outline)]"
          />
          <span>Advance overdue one-off chores to today</span>
        </label>
      </div>

      {resultMsg && (
        <div className="mb-4 rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
          {resultMsg}
        </div>
      )}

      <button
        onClick={() => setConfirmReset(true)}
        disabled={busy}
        className="btn-primary flex items-center gap-2 px-4 py-2.5 text-sm font-medium cursor-pointer disabled:opacity-40"
      >
        <Icon name="event_repeat" /> Reset Chore Dates
      </button>

      <AnimatePresence>
        {confirmReset && (
          <ConfirmModal
            title="Reset Chore Dates?"
            confirmText="Reset Dates"
            message={
              <div className="flex flex-col gap-2 text-sm">
                <p>
                  This will update all chore due dates that are in the past. Daily chores will be set to today, weekly and bi-weekly chores will advance to their next scheduled occurrence, and overdue one-off chores will be brought forward.
                </p>
                {resetCompleted && (
                  <p className="text-amber-600 dark:text-amber-400">
                    Recurring chores scheduled for today or upcoming dates will be set to open/uncompleted so they can be completed anew.
                  </p>
                )}
              </div>
            }
            onConfirm={handleResetDates}
            onCancel={() => setConfirmReset(false)}
          />
        )}
      </AnimatePresence>
    </Card>
  )
}
