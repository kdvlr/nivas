import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, LayoutGroup, useMotionValue, useTransform } from 'framer-motion'
import { PRESS_SPRING, EXPRESSIVE_ENTER } from '../lib/motion'
import Avatar from '../components/Avatar'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { useData, todayISO, fmtDate } from '../lib/hooks'
import type { ChoreItem, CoinBalance, RewardStoreItem } from '../lib/types'
import { useCelebration } from '../components/celebrations/CelebrationContext'
import { useRewardCelebration } from '../components/celebrations/RewardCelebrationContext'
import Modal from '../components/Modal'
import ConfirmModal from '../components/ConfirmModal'

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
  const [confirmDelete, setConfirmDelete] = useState<{ id: number, title: string } | null>(null)
  const [filterPerson, setFilterPerson] = useState('')
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { data: chores, reload } = useData<ChoreItem[]>('/api/chores', ['chores'])
  const { data: people } = useData<Person[]>('/api/setup/people', ['chores'])
  const { data: balances, reload: reloadBalances } = useData<CoinBalance[]>('/api/rewards/balances', ['chores', 'rewards'])
  const { data: store } = useData<RewardStoreItem[]>('/api/rewards/store', ['rewards'])
  const { celebrate } = useCelebration()
  const { celebrateReward } = useRewardCelebration()
  const [redeemingId, setRedeemingId] = useState<string | null>(null)

  const redeem = async (personName: string, rewardItemId: number) => {
    const key = `${personName}-${rewardItemId}`
    setRedeemingId(key)
    try {
      await api.post('/api/rewards/redeem', { person_name: personName, reward_item_id: rewardItemId })
      celebrateReward()
      reloadBalances()
    } catch {
      // ignore
    } finally {
      setRedeemingId(null)
    }
  }

  const toggle = async (chore: ChoreItem) => {
    const completing = !chore.completed
    if (completing && typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(50)
    await api.patch(`/api/chores/${chore.id}`, { completed: completing })
    if (completing) celebrate()
    reload()
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
            <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Chores</h1>
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

      {/* Today's Progress / Streak */}
      {allChores.length > 0 && (
        <div className="mb-6 flex flex-col gap-2 rounded-xl bg-[var(--surface-tile)] p-4 shadow-sm border border-[var(--outline-var)]">
          <div className="flex justify-between items-end">
            <span className="text-sm font-semibold text-ink-soft uppercase tracking-wider">Weekly Progress</span>
            <span className="text-sm font-bold text-sky-600 dark:text-sky-400">
              🔥 3 Day Streak
            </span>
          </div>
          <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.round((allChores.filter(c => c.completed).length / allChores.length) * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="bg-gradient-to-r from-sky-400 to-emerald-400"
            />
          </div>
        </div>
      )}

      {/* Layout for Chores and Side Panel */}
      <div className="flex flex-1 min-h-0 gap-8">
        <div className="flex flex-1 flex-col min-w-0">
          {/* Leaderboard — tap a card to filter that person's chores */}
          {sortedBalances.length > 0 && (
            <div className="mb-5 grid grid-cols-4 gap-2 md:flex md:shrink-0 md:gap-4 md:overflow-x-auto pb-1">
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
              <motion.div layout className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-4 gap-y-3 lg:gap-x-6 lg:gap-y-4 overflow-y-auto pb-4 pr-1">
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
                      <div className="grid gap-2 grid-cols-[repeat(auto-fill,minmax(270px,1fr))]">
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
        </div>

        {/* Right side: Rewards panel on desktop */}
        {!isMobile && (
          <div className="hidden lg:flex w-80 shrink-0 flex-col overflow-hidden">
            <h2 className="mb-4 flex items-center gap-2 text-xl font-medium text-ink">
              <Icon name="storefront" className="text-[var(--primary)]" /> Quick Rewards
            </h2>
            <div className="flex-1 overflow-y-auto pb-6 flex flex-col gap-3 pr-1">
              {(store ?? []).length === 0 ? (
                <p className="text-sm text-ink-soft">No rewards set up yet.</p>
              ) : (
                (store ?? []).map((item, i) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, scale: 0.9, y: 16 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...EXPRESSIVE_ENTER, delay: i * 0.05 }}
                    className="flex flex-col items-center glass-inset p-4 hover:bg-[var(--surface-tile)] transition-colors"
                  >
                    <span className="mb-1 text-3xl">{item.emoji}</span>
                    <span className="mb-0.5 text-center text-base font-medium leading-tight">{item.title}</span>
                    <span className="mb-2 text-sm font-medium text-amber-500"><CoinIcon /> ×{item.coin_cost}</span>
                    <div className="flex flex-wrap justify-center gap-1.5">
                      {(balances ?? []).map((b) => {
                        const key = `${b.person_name}-${item.id}`
                        const canAfford = b.balance >= item.coin_cost
                        return (
                          <motion.button
                            key={b.person_name}
                            whileHover={canAfford ? { scale: 1.05 } : undefined}
                            whileTap={canAfford ? { scale: 0.95 } : undefined}
                            transition={PRESS_SPRING}
                            disabled={!canAfford || redeemingId === key}
                            onClick={() => redeem(b.person_name, item.id)}
                            className="rounded-full px-2 py-1 text-[10px] uppercase font-bold tracking-wide text-white transition-all disabled:opacity-30 cursor-pointer"
                            style={{ background: b.color }}
                            title={canAfford ? `Redeem for ${b.person_name}` : `${b.person_name} needs ${item.coin_cost - b.balance} more coins`}
                          >
                            {b.person_name}
                          </motion.button>
                        )
                      })}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        )}
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
