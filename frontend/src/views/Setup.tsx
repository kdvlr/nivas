import { useEffect, useRef, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SPATIAL_STANDARD_DEFAULT, STANDARD_ENTER, PRESS_SPRING } from '../lib/motion'
import Avatar from '../components/Avatar'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import TopClockHeader from '../components/TopClockHeader'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import type { CalendarStatus, SetupStatus, RewardStoreItem, WeatherData, KidsDailyAdminResponse } from '../lib/types'
import { useCelebration } from '../components/celebrations/CelebrationContext'
import {
  FONTS,
  getAppearance,
  getFont,
  getStyle,
  setAppearance,
  setFont,
  setStyle,
  setAccentColor,
  type Appearance,
  type FontChoice,
  type ThemeStyle,
} from '../lib/theme'
import { CELEBRATIONS } from '../components/celebrations/animations'
import { useRewardCelebration } from '../components/celebrations/RewardCelebrationContext'
import { REWARD_ANIMATIONS } from '../components/celebrations/reward-animations'
import { PIN_FAIL_ANIMATIONS, type PinFailAnimation } from '../components/celebrations/pin-fail-animations'
import PinFailOverlay from '../components/celebrations/PinFailOverlay'
import ConfirmModal from '../components/ConfirmModal'
import { PointsAdminCard, RewardStoreCard } from '../components/setup/RewardsAdminCards'

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf',
  '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#c084fc', '#e879f9', '#f472b6', '#fb7185',
]

interface Person {
  id: number
  name: string
  color: string
  avatar?: string
  avatar_emoji?: string
  chores_enabled?: boolean
}

// Kid-friendly display-picture options.
const AVATAR_EMOJIS = [
  '🦄', '🐶', '🐱', '🦊', '🐰', '🐼', '🐨', '🐯', '🦁', '🐸',
  '🐵', '🐧', '🐤', '🦉', '🦋', '🐢', '🐙', '🦖', '🦕', '🐝',
  '🐬', '🦈', '🐴', '🐷', '🐮', '🐳', '🦩', '🦜', '🐞', '🦦',
  '⚽', '🏀', '🎨', '🎸', '🎮', '🚀', '🌈', '⭐', '🌸', '🍀',
  '🍦', '🍕', '🍩', '🎈', '👑', '🦸', '🧚', '🤖', '👽', '🐲',
]

const SECTIONS = [
  { id: 'integrations', icon: 'cloud_sync', label: 'Integrations' },
  { id: 'family', icon: 'groups', label: 'Family' },
  { id: 'rewards', icon: 'stars', label: 'Rewards' },
  { id: 'kids', icon: 'wb_sunny', label: 'Kids Hub' },
  { id: 'looks', icon: 'palette', label: 'Look & Feel' },
  { id: 'general', icon: 'tune', label: 'General' },
] as const

type SectionId = (typeof SECTIONS)[number]['id']

function Card({ title, badge, children }: { title: ReactNode; badge?: ReactNode; children: ReactNode }) {
  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ scale: 1.01, y: -2 }}
      transition={STANDARD_ENTER}
      className="glass p-5 shadow-sm"
    >
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-xl font-medium">{title}</h2>
        {badge}
      </div>
      {children}
    </motion.section>
  )
}

function Badge({ ok, label, error, title }: { ok: boolean; label: string; error?: boolean; title?: string }) {
  return (
    <span
      title={title}
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        error
          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200 border border-rose-300 dark:border-rose-800'
          : ok
          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      }`}
    >
      {label}
    </span>
  )
}

function PinPad({ onUnlock }: { onUnlock: () => void }) {
  const [entered, setEntered] = useState('')
  const [wrong, setWrong] = useState(false)
  const [fail, setFail] = useState<PinFailAnimation | null>(null)
  const lastFailRef = useRef<string | null>(null)
  const unlockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const failTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (unlockTimeoutRef.current) {
        clearTimeout(unlockTimeoutRef.current)
      }
      if (failTimeoutRef.current) {
        clearTimeout(failTimeoutRef.current)
      }
    }
  }, [])

  const triggerFailure = () => {
    if (failTimeoutRef.current) {
      clearTimeout(failTimeoutRef.current)
      failTimeoutRef.current = null
    }
    setWrong(true)
    const pool = PIN_FAIL_ANIMATIONS.filter((a) => a.name !== lastFailRef.current)
    const chosen = pool[Math.floor(Math.random() * pool.length)]
    lastFailRef.current = chosen.name
    setFail(chosen)
    setTimeout(() => {
      setEntered('')
      setWrong(false)
    }, 500)
  }

  const press = async (next: string) => {
    // Clear any pending timers
    if (unlockTimeoutRef.current) {
      clearTimeout(unlockTimeoutRef.current)
      unlockTimeoutRef.current = null
    }
    if (failTimeoutRef.current) {
      clearTimeout(failTimeoutRef.current)
      failTimeoutRef.current = null
    }

    setEntered(next)

    if (next === '') return

    const r = await api.post<{ ok: boolean }>('/api/setup/pin/verify', { pin: next })
    if (r.ok) {
      // Debounce unlock by 1 second to allow typing decoy digits at the end
      unlockTimeoutRef.current = setTimeout(() => {
        onUnlock()
      }, 1000)
    } else {
      if (next.length >= 24) {
        triggerFailure()
      } else if (next.length >= 4) {
        // Debounce wrong PIN feedback by 1.5s to let the user finish entering decoy numbers
        failTimeoutRef.current = setTimeout(() => {
          triggerFailure()
        }, 1500)
      }
    }
  }

  return (
    <div className={`flex h-full flex-col items-center justify-center gap-6 ${wrong ? 'animate-shake' : ''}`}>
      <Icon name="lock" className="text-6xl text-ink-soft" />
      <p className="text-xl font-medium text-ink-soft">Enter the Setup PIN</p>
      <div className="flex h-8 items-center gap-3.5">
        {[0, 1, 2, 3].map((index) => {
          const filled = entered.length > index
          return (
            <span
              key={index}
              className={`h-4 w-4 rounded-full border-2 transition-all duration-200 ${
                filled
                  ? wrong
                    ? 'bg-rose-400 border-rose-400 scale-110'
                    : 'bg-emerald-500 border-emerald-500 scale-110 shadow-sm'
                  : 'bg-transparent border-[var(--outline)] opacity-40'
              }`}
            />
          )
        })}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
          d === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => press(d === '⌫' ? entered.slice(0, -1) : entered + d)}
              className="btn-glass h-20 w-20 text-3xl"
            >
              {d}
            </button>
          ),
        )}
      </div>
      <p className="max-w-sm text-center text-sm text-ink-faint">
        Forgot the PIN? Edit <code>SETUP_PIN</code> in the server's <code>.env</code> and restart
        the dashboard.
      </p>
      {fail && <PinFailOverlay key={fail.name} anim={fail} onDone={() => setFail(null)} />}
    </div>
  )
}

export default function Setup() {
  const [pinState, setPinState] = useState<'checking' | 'locked' | 'open'>('checking')

  useEffect(() => {
    api
      .get<{ required: boolean }>('/api/setup/pin')
      .then((r) => {
        if (!r.required) setPinState('open')
        else setPinState('locked')
      })
      .catch(() => setPinState('open'))
  }, [])

  if (pinState === 'checking') return null
  if (pinState === 'locked') {
    return (
      <PinPad
        onUnlock={() => {
          setPinState('open')
        }}
      />
    )
  }
  return <SetupInner />
}

function SetupInner() {
  const { data: status, reload } = useData<SetupStatus>('/api/setup/status', ['setup'], 30000)
  const { data: cal, reload: reloadCal } = useData<CalendarStatus>('/api/calendar/status', ['calendar'])
  const { data: people, reload: reloadPeople } = useData<Person[]>('/api/setup/people', [])
  const { celebrate } = useCelebration()
  const { celebrateReward } = useRewardCelebration()

  const [icUser, setIcUser] = useState('')
  const [icPass, setIcPass] = useState('')
  const [icCode, setIcCode] = useState('')
  const [icMsg, setIcMsg] = useState('')
  const [busy, setBusy] = useState('')
  const [ytHeadersText, setYtHeadersText] = useState('')
  const [ytMsg, setYtMsg] = useState('')
  const [ytAuthStatus, setYtAuthStatus] = useState<{ authenticated: boolean }>({ authenticated: false })
  const [newPersonName, setNewPersonName] = useState('')
  const [newRewardEmoji, setNewRewardEmoji] = useState('🎁')
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardCost, setNewRewardCost] = useState(5)
  const [expandedAccounts, setExpandedAccounts] = useState<Record<number, boolean>>({})
  const [calendarColorEditing, setCalendarColorEditing] = useState<number | null>(null)
  const [section, setSection] = useState<SectionId>('integrations')
  const [colorEditing, setColorEditing] = useState<number | null>(null)
  const [accentColor, setAccentColorState] = useState(localStorage.getItem('accentColor') || '')
  
  const [confirmDisconnectGoogle, setConfirmDisconnectGoogle] = useState<{ id: number; email: string } | null>(null)
  const [confirmRemovePerson, setConfirmRemovePerson] = useState<Person | null>(null)

  useEffect(() => {
    api.get<any>('/api/ytmusic/auth').then((res) => setYtAuthStatus(res)).catch(() => {})
  }, [])

  const saveYtAuth = async () => {
    if (!ytHeadersText.trim()) return
    setBusy('ytmusic')
    setYtMsg('')
    try {
      const res = await api.post<any>('/api/ytmusic/auth', { headers: ytHeadersText })
      setYtAuthStatus(res)
      setYtMsg('YouTube Music authentication updated successfully!')
      setYtHeadersText('')
    } catch (e: any) {
      setYtMsg(e.message || 'Failed to save YouTube Music headers.')
    } finally {
      setBusy('')
    }
  }

  const clearYtAuth = async () => {
    setBusy('ytmusic')
    try {
      const res = await api.del<any>('/api/ytmusic/auth')
      setYtAuthStatus(res)
      setYtMsg('Reverted to guest mode.')
    } catch (e: any) {
      setYtMsg('Failed to clear credentials.')
    } finally {
      setBusy('')
    }
  }

  const renderLastUpdated = (integrationName: string) => {
    const s = status?.sync?.[integrationName]
    if (!s) return null
    try {
      const when = new Date(s.at)
      const time = when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
      // include the date when the last sync wasn't today, so a stale sync
      // (e.g. a broken integration) doesn't masquerade as fresh
      const isToday = when.toDateString() === new Date().toDateString()
      const label = isToday
        ? time
        : `${when.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`
      return (
        <span
          className={`ml-2 text-xs font-semibold opacity-75 ${isToday ? 'text-ink-soft' : 'text-amber-600 dark:text-amber-400'}`}
        >
          (updated {label})
        </span>
      )
    } catch (e) {
      return null
    }
  }

  const icloudLogin = async () => {
    setBusy('icloud')
    setIcMsg('')
    try {
      const r = await api.post<SetupStatus['icloud']>('/api/setup/icloud/login', {
        username: icUser,
        password: icPass,
      })
      setIcMsg(r.connected ? 'Connected!' : r.needs_2fa ? 'Enter the 2FA code from your Apple device' : r.error)
    } finally {
      setBusy('')
      reload()
    }
  }

  const icloud2fa = async () => {
    setBusy('icloud')
    try {
      const r = await api.post<SetupStatus['icloud']>('/api/setup/icloud/2fa', { code: icCode })
      setIcMsg(r.connected ? 'Connected!' : r.error || 'Try again')
      setIcCode('')
    } finally {
      setBusy('')
      reload()
    }
  }



  const updateSelection = async (id: number, patch: object) => {
    await api.put('/api/calendar/selections', [{ id, ...patch }])
    reloadCal()
  }

  const savePeople = async (list: Person[]) => {
    await api.put(
      '/api/setup/people',
      list.map((p) => ({
        name: p.name,
        color: p.color,
        avatar_emoji: p.avatar_emoji ?? '',
        chores_enabled: p.chores_enabled !== false,
      })),
    )
    reloadPeople()
  }

  // Rewards store
  const { data: rewardItems, reload: reloadRewards } = useData<RewardStoreItem[]>('/api/rewards/store', ['rewards'])

  const addReward = async () => {
    if (!newRewardTitle.trim()) return
    await api.post('/api/rewards/store', {
      emoji: newRewardEmoji,
      title: newRewardTitle.trim(),
      coin_cost: newRewardCost,
    })
    setNewRewardEmoji('🎁')
    setNewRewardTitle('')
    setNewRewardCost(5)
    reloadRewards()
  }

  const deleteReward = async (id: number) => {
    await api.del(`/api/rewards/store/${id}`)
    reloadRewards()
  }

  return (
    <div className="flex h-full flex-col p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between gap-3 lg:gap-4">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Setup</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => api.post('/api/setup/sync')}
            className="btn-primary px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg cursor-pointer"
          >
            <Icon name="sync" /> Sync everything now
          </button>
          <TopClockHeader now={new Date()} />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:gap-6">
        {/* section rail — vertical on wide screens, chips on narrow */}
        <nav className="flex shrink-0 gap-2 overflow-x-auto pb-1 lg:w-52 lg:flex-col lg:justify-start lg:overflow-visible lg:pb-0">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2.5 rounded-xl px-4 py-2.5 text-base font-medium transition-colors lg:w-full lg:px-4 lg:py-3 ${
                section === s.id
                  ? 'bg-[var(--primary)] text-[var(--on-primary)] shadow-sm'
                  : 'glass-inset text-ink-soft active:surface-tile-high'
              }`}
            >
              <Icon name={s.icon} className="text-xl" filled={section === s.id} />
              {s.label}
            </button>
          ))}
        </nav>

        {/* section content */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={STANDARD_ENTER}
              className="flex max-w-4xl flex-col gap-4 pb-8"
            >
        {/* Integration Panel */}
        {section === 'integrations' && (
        <Card title={<><Icon name="cloud_sync" /> Integration</>}>
          <div className="flex flex-col gap-6">
            {/* YouTube Music Integration */}
            <div className="rounded-2xl border border-[var(--outline-var)] p-4 bg-slate-50/50 dark:bg-slate-900/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-semibold text-ink flex items-center gap-2">
                  <Icon name="graphic_eq" className="text-lg text-rose-500" />
                  YouTube Music & Personal Account
                </h3>
                <Badge
                  ok={ytAuthStatus.authenticated}
                  label={ytAuthStatus.authenticated ? 'authenticated' : 'guest mode'}
                />
              </div>

              <p className="text-sm text-ink-soft mb-3 leading-relaxed">
                Paste your YouTube Music browser request headers or cookie JSON to sync your personal library, history, and custom mixes. Public search and charts work out-of-the-box in Guest Mode.
              </p>

              {ytMsg && (
                <p className="mb-3 rounded-xl bg-sky-50 p-2.5 dark:bg-sky-950/60 text-xs font-semibold text-sky-700 dark:text-sky-300">
                  {ytMsg}
                </p>
              )}

              <div className="flex flex-col gap-3">
                <textarea
                  rows={3}
                  value={ytHeadersText}
                  onChange={(e) => setYtHeadersText(e.target.value)}
                  placeholder="Paste headers or cookie JSON string here..."
                  className="w-full rounded-xl border border-[var(--outline-var)] bg-white dark:bg-slate-800 p-3 text-xs font-mono text-ink focus:outline-none focus:border-[var(--primary)]"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={saveYtAuth}
                    disabled={busy === 'ytmusic' || !ytHeadersText.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition shadow-sm disabled:opacity-50"
                  >
                    <Icon name="save" className="text-sm" /> Save Credentials
                  </button>

                  {ytAuthStatus.authenticated && (
                    <button
                      onClick={clearYtAuth}
                      disabled={busy === 'ytmusic'}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-ink font-semibold text-xs transition"
                    >
                      <Icon name="delete" className="text-sm" /> Clear Credentials
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Google Calendar */}
            <div>
              <h3 className="text-base font-semibold text-ink mb-3 flex items-center gap-2">
                <Icon name="calendar_month" className="text-lg text-[var(--primary)]" />
                Google Calendar
              </h3>
              {!cal?.client_config && (
                <p className="mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/60 text-sm text-amber-700 dark:text-amber-300 leading-relaxed">
                  Install your Google OAuth client file first: drop{' '}
                  <code className="font-medium">google_client_secret.json</code> into the server's{' '}
                  <code className="font-medium">data/credentials/</code> folder, and add{' '}
                  <code className="break-all font-medium">{cal?.redirect_uri}</code> as a redirect URI.
                </p>
              )}
              {(cal?.accounts ?? []).map((a) => {
                const expanded = !!expandedAccounts[a.id]
                const googleHealth = cal?.sync_health || status?.sync?.google
                const syncOk = googleHealth ? googleHealth.ok : true
                const errorDetail = googleHealth && !googleHealth.ok ? googleHealth.detail : ''

                return (
                  <div key={a.id} className="rounded-xl border border-[var(--outline-var)] overflow-hidden mb-3">
                    <div
                      onClick={() => setExpandedAccounts({
                        ...expandedAccounts,
                        [a.id]: !expanded
                      })}
                      className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/40 px-3 py-2 cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-800/80 flex-wrap"
                    >
                      <Icon
                        name={expanded ? 'expand_less' : 'expand_more'}
                        className="text-ink-soft shrink-0"
                      />
                      <span className="font-semibold text-sm text-ink truncate max-w-40 md:max-w-xs shrink-0">{a.email}</span>
                      {syncOk ? (
                        <Badge ok={true} label="connected" />
                      ) : (
                        <Badge ok={false} error={true} label="sync error" title={errorDetail} />
                      )}
                      {renderLastUpdated('google')}
                      <a
                        href="/api/calendar/auth/start"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-500 hover:bg-sky-600 text-white transition-colors shadow-sm"
                        title="Re-authorize this account with Google"
                      >
                        <Icon name="sync" className="text-sm" /> Reconnect
                      </a>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          setConfirmDisconnectGoogle({ id: a.id, email: a.email })
                        }}
                        className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-400 hover:text-rose-500 transition-colors shrink-0"
                      >
                        <Icon name="delete" className="text-lg" />
                      </button>
                    </div>
                    {errorDetail && (
                      <div className="mx-3 my-2 text-xs font-medium text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 p-2.5 rounded-lg border border-rose-200 dark:border-rose-800 flex items-center justify-between gap-2 leading-snug">
                        <div className="flex items-start gap-1.5 min-w-0">
                          <Icon name="error_outline" className="text-base shrink-0 text-rose-500 mt-0.5" />
                          <span className="break-words">Google Sync Error: {errorDetail}</span>
                        </div>
                        <a
                          href="/api/calendar/auth/start"
                          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors"
                        >
                          <Icon name="sync" className="text-sm" /> Reconnect Now
                        </a>
                      </div>
                    )}
                    {expanded && (
                      <div className="px-4 pb-3 flex flex-col gap-2 bg-transparent">
                        {a.selections.map((s) => {
                          const linkedPerson = (people ?? []).find(
                            (p) => p.name.toLowerCase() === s.person_name.toLowerCase(),
                          )
                          return (
                            <div key={s.id} className="flex items-center gap-3 border-t border-[var(--outline-var)] py-2.5">
                              <input
                                type="checkbox"
                                checked={s.enabled}
                                onChange={(e) => updateSelection(s.id, { enabled: e.target.checked })}
                                className="h-7 w-7 accent-teal-500 shrink-0"
                              />
                              {!linkedPerson && (
                                <span
                                  className="h-4 w-4 shrink-0 rounded-full"
                                  style={{ background: s.color }}
                                  title="event color"
                                />
                              )}
                              <span className="min-w-0 flex-1 truncate text-base font-medium">{s.name}</span>
                              {!linkedPerson && (
                                <div className="relative shrink-0">
                                  <button
                                    onClick={() => setCalendarColorEditing(calendarColorEditing === s.id ? null : s.id)}
                                    className="btn-glass flex items-center gap-2 px-3 py-1.5 text-sm"
                                  >
                                    <span className="h-4 w-4 rounded-full" style={{ background: s.color }} />
                                    Color
                                    <Icon name={calendarColorEditing === s.id ? 'expand_less' : 'expand_more'} className="text-base" />
                                  </button>
                                  <AnimatePresence>
                                    {calendarColorEditing === s.id && (
                                      <>
                                        <div
                                          className="fixed inset-0 z-40"
                                          onClick={() => setCalendarColorEditing(null)}
                                        />
                                        <motion.div
                                          initial={{ opacity: 0, y: 8, scale: 0.95 }}
                                          animate={{ opacity: 1, y: 0, scale: 1 }}
                                          exit={{ opacity: 0, y: 8, scale: 0.95 }}
                                          transition={SPATIAL_STANDARD_DEFAULT}
                                          className="absolute right-0 top-full mt-1.5 z-50 rounded-2xl glass p-3 shadow-xl w-60 flex flex-wrap gap-1.5"
                                        >
                                          {COLORS.map((c) => {
                                            const active = s.color === c
                                            return (
                                              <button
                                                key={c}
                                                onClick={() => {
                                                  updateSelection(s.id, { color: c })
                                                  setCalendarColorEditing(null)
                                                }}
                                                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 ${
                                                  active ? 'scale-110 shadow-md ring-2 ring-white' : 'opacity-80 hover:opacity-100 hover:scale-105'
                                                }`}
                                                style={{ background: c }}
                                              >
                                                {active && (
                                                  <Icon name="check" className="text-lg text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                                                )}
                                              </button>
                                            )
                                          })}
                                        </motion.div>
                                      </>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )}
                              <select
                                value={linkedPerson ? linkedPerson.name : ''}
                                onChange={(e) => updateSelection(s.id, { person_name: e.target.value })}
                                className="input-glass w-36 px-2 py-1.5 text-base shrink-0"
                              >
                                <option value="">— no person —</option>
                                {(people ?? []).map((p) => (
                                  <option key={p.id} value={p.name}>
                                    {p.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )
                        })}
                        <p className="mt-2 text-xs text-ink-faint">
                          Assign a family member to share their color everywhere (calendar, chores). Colors
                          are set on the Family members card.
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
              <a
                href="/api/calendar/auth/start"
                className={`mt-1 inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95 ${
                  cal?.client_config ? 'bg-sky-500 hover:bg-sky-600' : 'pointer-events-none bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <Icon name="add" className="text-base" /> Connect Google Account
              </a>
            </div>

            {/* iCloud */}
            <div className="border-t border-[var(--outline-var)] pt-4">
              <h3 className="text-base font-semibold text-ink mb-3 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-2">
                  <Icon name="cloud" className="text-lg text-[var(--primary)]" />
                  iCloud Reminders
                </span>
                {renderLastUpdated('icloud')}
                <Badge
                  ok={!!status?.icloud.connected}
                  label={
                    status?.icloud.connected
                      ? 'connected'
                      : status?.icloud.needs_2fa
                        ? '2FA needed'
                        : 'not connected'
                  }
                />
              </h3>
              {!status?.icloud.connected && (
                <div className="flex flex-col gap-3">
                  {!status?.icloud_configured && (
                    <>
                      <input
                        value={icUser}
                        onChange={(e) => setIcUser(e.target.value)}
                        placeholder="Apple ID email"
                        className="input-glass px-4 py-2.5 text-base"
                      />
                      <input
                        value={icPass}
                        onChange={(e) => setIcPass(e.target.value)}
                        type="password"
                        placeholder="Password (or app-specific password)"
                        className="input-glass px-4 py-2.5 text-base"
                      />
                    </>
                  )}
                  <button
                    onClick={icloudLogin}
                    disabled={busy === 'icloud'}
                    className="btn-primary py-2.5 text-base"
                  >
                    {busy === 'icloud' ? 'Connecting…' : 'Sign in to iCloud'}
                  </button>
                  {status?.icloud.needs_2fa && (
                    <div className="flex gap-2">
                      <input
                        value={icCode}
                        onChange={(e) => setIcCode(e.target.value)}
                        placeholder="2FA code"
                        inputMode="numeric"
                        className="flex-1 input-glass px-4 py-2.5 text-base tracking-widest text-center font-semibold"
                      />
                      <button
                        onClick={icloud2fa}
                        className="btn-primary px-6 py-2.5 text-base"
                      >
                        Verify
                      </button>
                    </div>
                  )}
                </div>
              )}
              {icMsg && <p className="mt-2 text-sm font-medium text-ink-soft">{icMsg}</p>}
              {status?.icloud.connected && (
                <ICloudLists status={status} onSaved={reload} />
              )}
            </div>

            {/* Alexa */}
            <div className="border-t border-[var(--outline-var)] pt-4">
              <h3 className="text-base font-semibold text-ink mb-2 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-2">
                  <Icon name="graphic_eq" className="text-lg text-[var(--primary)]" />
                  Alexa Lists
                </span>
                {renderLastUpdated('alexa')}
                <Badge ok={!!status?.alexa.connected} label={status?.alexa.connected ? 'connected' : 'not connected'} />
              </h3>
              <p className="text-sm text-ink-soft leading-relaxed">
                Syncs your shopping and to-do lists from Amazon Alexa. Credentials must be configured in your server's <code>docker-compose.yml</code> file.
              </p>
              {status?.alexa.error && (
                <p className="mt-2 text-sm font-semibold text-rose-400">
                  Error: {status.alexa.error}
                </p>
              )}
            </div>
          </div>
        </Card>
        )}

        {/* People */}
        {section === 'family' && (
        <Card title={<><Icon name="groups" /> Members</>}>
          <div className="flex flex-col gap-3">
            <FamilyNameRow />
            {(people ?? []).map((p, i) => (
              <div key={p.id} className="glass-inset px-3 py-2">
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} color={p.color} src={p.avatar} emoji={p.avatar_emoji} size={38} />
                  <span className="min-w-0 flex-1 truncate text-base font-medium">{p.name}</span>
                  <button
                    onClick={() => {
                      const next = [...(people ?? [])]
                      next[i] = { ...p, chores_enabled: p.chores_enabled === false ? true : false }
                      savePeople(next)
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                      p.chores_enabled !== false
                        ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30'
                        : 'bg-slate-200/60 text-slate-500 dark:bg-slate-800/60 dark:text-slate-400 border border-transparent'
                    }`}
                    title={p.chores_enabled !== false ? 'Included in chores & leaderboard' : 'Skipped for chores'}
                  >
                    <Icon name={p.chores_enabled !== false ? 'task_alt' : 'do_not_distribute'} className="text-sm" />
                    <span>{p.chores_enabled !== false ? 'Chores Active' : 'Skipped for Chores'}</span>
                  </button>
                  <button
                    onClick={() => setColorEditing(colorEditing === p.id ? null : p.id)}
                    className="btn-glass flex items-center gap-2 px-3 py-1.5 text-sm"
                  >
                    <span className="h-4 w-4 rounded-full" style={{ background: p.color }} />
                    Picture
                    <Icon name={colorEditing === p.id ? 'expand_less' : 'expand_more'} className="text-base" />
                  </button>
                  <button
                    onClick={() => setConfirmRemovePerson(p)}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-rose-400 active:surface-tile-high"
                    title={`Remove ${p.name}`}
                  >
                    <Icon name="delete" className="text-lg" />
                  </button>
                </div>
                <AnimatePresence initial={false}>
                  {colorEditing === p.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={SPATIAL_STANDARD_DEFAULT}
                      className="overflow-hidden"
                    >
                      {/* Display picture: pick an emoji (or "None" for a colored initial) */}
                      <p className="pt-3 text-xs font-semibold uppercase tracking-wide text-ink-soft">Picture</p>
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        <button
                          onClick={() => {
                            const next = [...(people ?? [])]
                            next[i] = { ...p, avatar_emoji: '' }
                            savePeople(next)
                          }}
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white transition-all active:scale-90 ${
                            !p.avatar_emoji ? 'ring-2 ring-white' : 'opacity-80'
                          }`}
                          style={{ background: p.color }}
                          title="Use initial"
                        >
                          {p.name.charAt(0).toUpperCase()}
                        </button>
                        {AVATAR_EMOJIS.map((em) => {
                          const active = p.avatar_emoji === em
                          return (
                            <button
                              key={em}
                              onClick={() => {
                                const next = [...(people ?? [])]
                                next[i] = { ...p, avatar_emoji: em }
                                savePeople(next)
                              }}
                              className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition-all active:scale-90 ${
                                active ? 'scale-110 shadow-md ring-2 ring-[var(--primary)]' : 'surface-tile opacity-90 hover:opacity-100'
                              }`}
                              style={active ? { background: p.color } : undefined}
                            >
                              {em}
                            </button>
                          )
                        })}
                      </div>
                      {/* Color: also tints their calendar, chores, and coin chips */}
                      <p className="pt-4 text-xs font-semibold uppercase tracking-wide text-ink-soft">Color</p>
                      <div className="flex flex-wrap gap-1.5 pb-1 pt-2">
                        {COLORS.map((c) => {
                          const active = p.color === c
                          return (
                            <button
                              key={c}
                              onClick={() => {
                                const next = [...(people ?? [])]
                                next[i] = { ...p, color: c }
                                savePeople(next)
                              }}
                              className={`flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 ${
                                active ? 'scale-110 shadow-md ring-2 ring-white' : 'opacity-80 active:opacity-100'
                              }`}
                              style={{ background: c }}
                            >
                              {active && (
                                <Icon name="check" className="text-lg text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
            <div className="flex gap-2">
              <input
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Add a family member"
                className="flex-1 input-glass px-4 py-2 text-base"
              />
              <button
                onClick={() => {
                  if (!newPersonName.trim()) return
                  savePeople([
                    ...(people ?? []),
                    { id: 0, name: newPersonName.trim(), color: COLORS[(people?.length ?? 0) % COLORS.length] },
                  ])
                  setNewPersonName('')
                }}
                className="btn-primary px-6 py-3 text-lg"
              >
                Add
              </button>
            </div>
          </div>
        </Card>
        )}

        {/* Gemini */}
        {section === 'integrations' && (
        <Card
          title={<><Icon name="auto_awesome" /> Recipe AI</>}
          badge={<Badge ok={!!status?.gemini_configured} label={status?.gemini_configured ? status.gemini_model : 'no API key'} />}
        >
          <p className="text-sm text-ink-soft">
            Set <code className="font-medium">GEMINI_API_KEY</code> (and optionally{' '}
            <code className="font-medium">GEMINI_MODEL</code>) in the server's <code>.env</code>. Used when a
            recipe site isn't supported by the built-in scraper.
          </p>
        </Card>
        )}

        {/* Rewards Store */}
        {section === 'family' && (
        <Card title={<><Icon name="storefront" /> Rewards Store</>}>
          <div className="flex flex-col gap-3">
            {(rewardItems ?? []).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl surface-tile px-4 py-2">
                <span className="text-xl">{item.emoji}</span>
                <span className="flex-1 text-base font-medium">{item.title}</span>
                <span className="text-sm font-medium text-amber-500"><CoinIcon /> {item.coin_cost}</span>
                <button
                  onClick={() => deleteReward(item.id)}
                  className="text-rose-400 hover:text-rose-500"
                >
                  ✕
                </button>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-1">
              <input
                value={newRewardEmoji}
                onChange={(e) => setNewRewardEmoji(e.target.value)}
                className="w-14 input-glass px-2 py-2 text-center text-xl"
                maxLength={4}
              />
              <input
                value={newRewardTitle}
                onChange={(e) => setNewRewardTitle(e.target.value)}
                placeholder="Reward name"
                className="flex-1 input-glass px-4 py-2 text-base"
              />
              <input
                type="number"
                min={1}
                max={999}
                value={newRewardCost}
                onChange={(e) => setNewRewardCost(Math.max(1, Number(e.target.value)))}
                className="w-16 input-glass px-2 py-2 text-base"
              />
              <span className="text-base text-amber-500"><CoinIcon /></span>
              <button
                onClick={addReward}
                disabled={!newRewardTitle.trim()}
                className="btn-primary px-5 py-2.5 text-base disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </Card>
        )}

        {section === 'rewards' && <PointsAdminCard />}
        {section === 'rewards' && <RewardStoreCard />}

        {section === 'looks' && <AppearanceCard />}

        {section === 'looks' && (
        <Card title={<><Icon name="celebration" /> Celebration preview</>}>
          <p className="mb-2 text-sm text-ink-soft">
            One of these {CELEBRATIONS.length} plays whenever a chore or to-do is completed. Tap to try.
          </p>
          <div className="flex flex-wrap gap-2">
            {CELEBRATIONS.map((c) => (
              <button key={c.name} onClick={() => celebrate(c.name)} className="btn-glass px-4 py-2 text-sm">
                {c.emoji} {c.label}
              </button>
            ))}
            <button onClick={() => celebrate()} className="btn-primary px-5 py-2 text-sm">
              Surprise me!
            </button>
          </div>
        </Card>
        )}

        {section === 'looks' && (
        <Card title={<><Icon name="redeem" /> Reward animation preview</>}>
          <p className="mb-2 text-sm text-ink-soft">
            One of these {REWARD_ANIMATIONS.length} plays when someone redeems a reward. Tap to try.
          </p>
          <div className="flex flex-wrap gap-2">
            {REWARD_ANIMATIONS.map((a) => (
              <button key={a.name} onClick={() => celebrateReward(a.name)} className="btn-glass px-4 py-2 text-sm">
                {a.emoji} {a.label}
              </button>
            ))}
            <button
              onClick={() => celebrateReward()}
              className="rounded-full bg-gradient-to-r from-amber-400 to-orange-400 px-5 py-2 text-sm font-medium text-white shadow-lg shadow-orange-400/40 active:scale-95"
            >
              Surprise me!
            </button>
          </div>
        </Card>
        )}

        {section === 'kids' && <KidsDailyCard />}

        {section === 'looks' && <PinFailPreviewCard />}

        {section === 'general' && <WeatherCard />}

        {section === 'general' && status && <TimezoneCard status={status} reload={reload} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {confirmDisconnectGoogle && (
        <ConfirmModal
          title="Disconnect Google Account"
          message={`Are you sure you want to disconnect ${confirmDisconnectGoogle.email}?`}
          onConfirm={async () => {
            await api.del(`/api/calendar/accounts/${confirmDisconnectGoogle.id}`)
            setConfirmDisconnectGoogle(null)
            reloadCal()
          }}
          onCancel={() => setConfirmDisconnectGoogle(null)}
        />
      )}

      {confirmRemovePerson && (
        <ConfirmModal
          title="Remove Family Member"
          message={`Are you sure you want to remove ${confirmRemovePerson.name}?`}
          onConfirm={() => {
            savePeople((people ?? []).filter((x) => x.id !== confirmRemovePerson.id))
            setConfirmRemovePerson(null)
          }}
          onCancel={() => setConfirmRemovePerson(null)}
        />
      )}
    </div>
  )
}

function PinFailPreviewCard() {
  const [fail, setFail] = useState<PinFailAnimation | null>(null)

  return (
    <Card title={<><Icon name="gpp_bad" /> Wrong-PIN preview</>}>
      <p className="mb-2 text-sm text-ink-soft">
        One of these {PIN_FAIL_ANIMATIONS.length} plays when someone enters the wrong Setup PIN.
        Tap to try.
      </p>
      <div className="flex flex-wrap gap-2">
        {PIN_FAIL_ANIMATIONS.map((a) => (
          <button key={a.name} onClick={() => setFail(a)} className="btn-glass px-4 py-2 text-sm">
            {a.emoji} {a.label}
          </button>
        ))}
        <button
          onClick={() => setFail(PIN_FAIL_ANIMATIONS[Math.floor(Math.random() * PIN_FAIL_ANIMATIONS.length)])}
          className="btn-primary px-5 py-2 text-sm"
        >
          Surprise me!
        </button>
      </div>
      {fail && <PinFailOverlay key={fail.name} anim={fail} onDone={() => setFail(null)} />}
    </Card>
  )
}

function FamilyNameRow() {
  const { data, reload } = useData<{ name: string }>('/api/setup/family-name', ['setup'])
  const [val, setVal] = useState<string | null>(null)
  const value = val ?? data?.name ?? ''

  const save = async () => {
    if (val === null || val === data?.name) return
    await api.put('/api/setup/settings', { family_name: val })
    setVal(null)
    reload()
  }

  return (
    <label className="flex items-center gap-3 text-base font-medium text-ink-soft">
      Nivas Name
      <input
        value={value}
        onChange={(e) => setVal(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        placeholder="e.g. Davuluri — result: Davuluri Nivas"
        className="input-glass flex-1 px-4 py-2.5 text-base font-normal"
        maxLength={30}
      />
    </label>
  )
}

function AppearanceCard() {
  const [style, setStyleState] = useState<ThemeStyle>(getStyle)
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance)
  const [font, setFontState] = useState<FontChoice>(getFont)
  const [accentColor, setAccentColorState] = useState(localStorage.getItem('accentColor') || '')
  const [syncing, setSyncing] = useState(false)

  const pickStyle = (s: ThemeStyle) => {
    setStyleState(s)
    setStyle(s)
  }
  const pickAppearance = async (a: Appearance, broadcast = true) => {
    setAppearanceState(a)
    setAppearance(a)
    if (broadcast) {
      setSyncing(true)
      try {
        await api.post('/api/setup/theme', { appearance: a, reload: true })
      } catch (e) {
        console.warn('Failed to broadcast global theme:', e)
      } finally {
        setTimeout(() => setSyncing(false), 1000)
      }
    }
  }
  const pickFont = (f: FontChoice) => {
    setFontState(f)
    setFont(f)
  }

  return (
    <Card title={<><Icon name="palette" /> Appearance</>}>
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-2 text-base font-medium text-ink-soft">Theme</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['material', 'auto_awesome_mosaic', 'Material You'],
                ['glass', 'blur_on', 'Liquid Glass'],
                ['woodland', 'forest', 'Woodland'],
              ] as [ThemeStyle, string, string][]
            ).map(([s, icon, label]) => (
              <motion.button
                key={s}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                transition={PRESS_SPRING}
                onClick={() => pickStyle(s)}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-base font-medium transition-all ${
                  style === s ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'glass-inset text-ink-soft'
                }`}
              >
                <Icon name={icon} /> {label}
              </motion.button>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-base font-medium text-ink-soft">
              Mode — Auto follows the device's light/dark setting
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => pickAppearance(appearance, true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25 transition-all border border-[var(--primary)]/20"
            >
              <Icon name={syncing ? 'sync' : 'devices'} className={syncing ? 'animate-spin text-sm' : 'text-sm'} />
              <span>{syncing ? 'Broadcasting...' : 'Sync Theme to All Displays'}</span>
            </motion.button>
          </div>
          <div className="flex gap-2">
            {(
              [
                ['auto', 'routine', 'Auto'],
                ['light', 'light_mode', 'Light'],
                ['dark', 'dark_mode', 'Dark'],
              ] as [Appearance, string, string][]
            ).map(([a, icon, label]) => (
              <motion.button
                key={a}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                transition={PRESS_SPRING}
                onClick={() => pickAppearance(a, true)}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-base font-medium transition-all ${
                  appearance === a ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'glass-inset text-ink-soft'
                }`}
              >
                <Icon name={icon} /> {label}
              </motion.button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-base font-medium text-ink-soft">Font</p>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <motion.button
                key={f.id}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.95 }}
                transition={PRESS_SPRING}
                onClick={() => pickFont(f.id)}
                style={{ fontFamily: f.stack }}
                className={`flex flex-col items-start rounded-xl px-5 py-2.5 transition-all ${
                  font === f.id ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'glass-inset text-ink'
                }`}
              >
                <span className="text-lg font-medium">{f.label}</span>
                <span className={`text-xs ${font === f.id ? 'opacity-80' : 'text-ink-soft'}`}>
                  The quick brown fox 123
                </span>
              </motion.button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <span className="text-[0.65rem] font-bold uppercase tracking-wider text-ink-soft">
            Accent Color
          </span>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Emerald', hex: '' }, // default
              { label: 'Sapphire', hex: '#2563eb' },
              { label: 'Amethyst', hex: '#7c3aed' },
              { label: 'Rose', hex: '#e11d48' },
              { label: 'Amber', hex: '#d97706' },
              { label: 'Slate', hex: '#475569' },
            ].map((c) => (
              <button
                key={c.label}
                onClick={() => {
                  setAccentColor(c.hex || null)
                  setAccentColorState(c.hex)
                }}
                className={`h-10 w-10 rounded-full border-2 transition-all duration-200 ${
                  (c.hex === '' && accentColor === '') || accentColor === c.hex
                    ? 'border-ink scale-110 shadow-sm'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: c.hex || 'var(--primary)' }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>
    </Card>
  )
}

function WeatherCard() {
  const { data: weather, reload } = useData<WeatherData>('/api/weather', [])
  const [lat, setLat] = useState('')
  const [lon, setLon] = useState('')
  const [unit, setUnit] = useState<'fahrenheit' | 'celsius'>('fahrenheit')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const la = parseFloat(lat)
    const lo = parseFloat(lon)
    if (Number.isNaN(la) || Number.isNaN(lo)) return
    setSaving(true)
    try {
      await api.put('/api/weather/location', { lat: la, lon: lo, unit })
      reload()
    } finally {
      setSaving(false)
    }
  }

  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(4))
      setLon(pos.coords.longitude.toFixed(4))
    })
  }

  return (
    <Card
      title={<><Icon name="partly_cloudy_day" /> Weather</>}
      badge={
        <Badge
          ok={!!weather?.configured}
          label={
            weather?.current ? `${weather.current.temp}° ${weather.current.label}` : 'no location set'
          }
        />
      }
    >
      <p className="mb-3 text-base text-ink-soft">
        Powered by Open-Meteo (free, no key). Set your home coordinates to show weather on the Home
        screen and calendar.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          placeholder="Latitude"
          inputMode="decimal"
          className="input-glass w-32 px-4 py-3 text-base"
        />
        <input
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          placeholder="Longitude"
          inputMode="decimal"
          className="input-glass w-32 px-4 py-3 text-base"
        />
        <button
          onClick={() => setUnit(unit === 'fahrenheit' ? 'celsius' : 'fahrenheit')}
          className="btn-glass px-4 py-3 text-base"
        >
          °{unit === 'fahrenheit' ? 'F' : 'C'}
        </button>
        <button onClick={useMyLocation} className="btn-glass px-4 py-3 text-base">
          <Icon name="my_location" /> Use my location
        </button>
        <button
          onClick={save}
          disabled={saving || !lat || !lon}
          className="btn-primary px-6 py-3 text-base"
        >
          Save
        </button>
      </div>
    </Card>
  )
}

function ICloudLists({ status, onSaved }: { status: SetupStatus; onSaved: () => void }) {
  const { data, error: fetchError, reload: reloadLists } = useData<{ lists: string[]; error: string }>('/api/setup/icloud/lists', [], 30000)
  const settings = status.settings
  const lists = data?.lists ?? []
  const taskLists = settings.icloud_task_lists
  const loading = !fetchError && lists.length === 0
  const apiError = data?.error || fetchError

  // Retry every 3s while lists are empty (sync job may be holding the lock)
  useEffect(() => {
    if (lists.length > 0) return
    const t = setInterval(reloadLists, 3000)
    return () => clearInterval(t)
  }, [lists.length, reloadLists])

  const save = (patch: object) => api.put('/api/setup/settings', patch).then(onSaved)

  return (
    <div className="mt-3 flex flex-col gap-4">
      {loading && (
        <p className="text-base text-ink-soft animate-pulse">Loading iCloud lists…</p>
      )}
      {apiError && (
        <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/60">
          <p className="text-base text-amber-700 dark:text-amber-300">Could not load lists: {apiError}</p>
          <button
            onClick={reloadLists}
            className="rounded-lg bg-amber-200 px-3 py-1 text-sm font-medium text-amber-800 dark:text-amber-200"
          >
            Retry
          </button>
        </div>
      )}
      <label className="flex items-center gap-3 text-base font-medium text-ink">
        Shopping list:
        <select
          value={settings.icloud_shopping_list}
          onChange={(e) => save({ icloud_shopping_list: e.target.value })}
          disabled={lists.length === 0}
          className="input-glass px-3 py-2 text-base disabled:opacity-50"
        >
          {lists.length === 0 ? (
            <option>{settings.icloud_shopping_list}</option>
          ) : (
            [settings.icloud_shopping_list, ...lists.filter((l) => l !== settings.icloud_shopping_list)].map((l) => (
              <option key={l}>{l}</option>
            ))
          )}
        </select>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-base font-medium text-ink shrink-0">To-Do lists (synced to the To-Dos view):</p>
        <div className="flex flex-wrap gap-1.5">
          {lists
            .filter((l) => l !== settings.icloud_shopping_list)
            .map((l) => {
              const active = taskLists === null || taskLists.includes(l)
              return (
                <label
                  key={l}
                  onClick={() => {
                    const current = taskLists ?? lists.filter((x) => x !== settings.icloud_shopping_list)
                    save({
                      icloud_task_lists: active ? current.filter((x) => x !== l) : [...current, l],
                    })
                  }}
                  className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border select-none transition-all ${
                    active
                      ? 'bg-sky-50 border-sky-300 text-sky-800 dark:bg-sky-950/40 dark:border-sky-800 dark:text-sky-300'
                      : 'bg-transparent border-[var(--outline)] text-ink-soft opacity-70 hover:opacity-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    readOnly
                    className="h-3.5 w-3.5 accent-sky-500 rounded border-slate-300"
                  />
                  <span>{l}</span>
                </label>
              )
            })}
        </div>
      </div>
    </div>
  )
}

function TimezoneCard({ status, reload }: { status: SetupStatus; reload: () => void }) {
  const currentTz = status.settings.secondary_tz || 'Asia/Kolkata'
  const currentEmoji = status.settings.secondary_tz_emoji || '🇮🇳'

  const [tz, setTz] = useState(currentTz)
  const [emoji, setEmoji] = useState(currentEmoji)
  const [customTz, setCustomTz] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [saving, setSaving] = useState(false)

  const commonTzs = [
    { value: 'Asia/Kolkata', label: 'India (Asia/Kolkata)' },
    { value: 'America/New_York', label: 'US Eastern (America/New_York)' },
    { value: 'America/Chicago', label: 'US Central (America/Chicago)' },
    { value: 'America/Denver', label: 'US Mountain (America/Denver)' },
    { value: 'America/Los_Angeles', label: 'US Pacific (America/Los_Angeles)' },
    { value: 'Europe/London', label: 'United Kingdom (Europe/London)' },
    { value: 'Europe/Paris', label: 'Central Europe (Europe/Paris)' },
    { value: 'Asia/Singapore', label: 'Singapore (Asia/Singapore)' },
    { value: 'Asia/Tokyo', label: 'Japan (Asia/Tokyo)' },
    { value: 'Australia/Sydney', label: 'Sydney (Australia/Sydney)' },
  ]

  const flags = ['🇮🇳', '🇺🇸', '🇬🇧', '🇪🇺', '🇯🇵', '🇸🇬', '🇦🇺', '🇨🇦', '🇧🇷', '🇲🇽', '🇿🇦', '🇨🇳', '🇳🇿', '🗺️', '⏰', '🌐']

  const handleSave = async (newTz: string, newEmoji: string) => {
    setSaving(true)
    try {
      await api.put('/api/setup/settings', {
        secondary_tz: newTz,
        secondary_tz_emoji: newEmoji,
      })
      reload()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const selectTz = (val: string) => {
    if (val === 'custom') {
      setShowCustom(true)
    } else {
      setShowCustom(false)
      setTz(val)
      handleSave(val, emoji)
    }
  }

  const selectEmoji = (val: string) => {
    setEmoji(val)
    handleSave(tz, val)
  }

  const saveCustom = () => {
    if (!customTz.trim()) return
    setTz(customTz.trim())
    handleSave(customTz.trim(), emoji)
    setShowCustom(false)
  }

  return (
    <Card title={<><Icon name="schedule" /> Secondary Time Zone</>}>
      <p className="mb-4 text-sm text-ink-soft">
        Configure the secondary timezone displayed in the dashboard header.
      </p>
      
      <div className="flex flex-col gap-5">
        {/* Timezone Select */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-ink-soft">Select Time Zone</label>
          <div className="flex gap-2">
            <select
              value={commonTzs.some(c => c.value === tz) ? tz : 'custom'}
              onChange={(e) => selectTz(e.target.value)}
              className="flex-1 input-glass px-4 py-2.5 text-base"
            >
              {commonTzs.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
              <option value="custom">Custom time zone...</option>
            </select>
          </div>
        </div>

        {/* Custom Timezone Input */}
        {(showCustom || !commonTzs.some(c => c.value === tz)) && (
          <div className="flex gap-2 items-end">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-medium text-ink-soft">Custom IANA Time Zone</label>
              <input
                value={customTz || tz}
                onChange={(e) => setCustomTz(e.target.value)}
                placeholder="e.g. America/Phoenix"
                className="input-glass px-4 py-2 text-base"
              />
            </div>
            <button
              onClick={saveCustom}
              className="btn-primary px-5 py-2.5 text-base h-[46px]"
            >
              Apply
            </button>
          </div>
        )}

        {/* Emoji/Flag Picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-ink-soft">Time Zone Flag / Emoji</label>
          <div className="flex flex-wrap gap-2 p-3 glass-inset rounded-xl">
            {flags.map((f) => {
              const isActive = emoji === f
              return (
                <button
                  key={f}
                  onClick={() => selectEmoji(f)}
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-2xl transition-all active:scale-90 ${
                    isActive
                      ? 'bg-[var(--primary-container)] text-[var(--on-primary-container)] ring-2 ring-[var(--primary)] scale-110 shadow-md'
                      : 'hover:bg-slate-300/15 dark:hover:bg-slate-700/15'
                  }`}
                >
                  {f}
                </button>
              )
            })}
            
            {/* Custom Emoji Input */}
            <div className="flex items-center gap-1.5 ml-auto pl-2 border-l border-[var(--outline-var)]">
              <input
                value={flags.includes(emoji) ? '' : emoji}
                onChange={(e) => {
                  const val = e.target.value.trim()
                  if (val) selectEmoji(val)
                }}
                placeholder="Custom..."
                className="w-20 input-glass px-2 py-1 text-base text-center"
                maxLength={4}
              />
            </div>
          </div>
        </div>

        {/* Display Preview */}
        <div className="flex items-center gap-3 p-3 glass rounded-xl text-sm font-medium text-ink-soft">
          <span className="text-emerald-500 font-semibold flex items-center gap-1">
            <Icon name="info" className="text-lg" /> Current Config:
          </span>
          <span className="text-ink font-semibold flex items-center gap-1">
            {emoji} {tz}
          </span>
          {saving && <span className="ml-auto text-xs text-ink-faint animate-pulse">Saving...</span>}
        </div>
      </div>
    </Card>
  )
}

function KidsDailyCard() {
  const { data, reload, loading } = useData<KidsDailyAdminResponse>('/api/kids-daily/admin', [])
  const [regenerating, setRegenerating] = useState(false)
  const [toggling, setToggling] = useState(false)

  const content = data?.content
  const isForceActive = Boolean(data?.settings?.force_banner_active)

  const handleToggleForce = async () => {
    setToggling(true)
    try {
      await api.post('/api/kids-daily/settings', {
        force_banner_active: !isForceActive,
      })
      reload()
    } finally {
      setToggling(false)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      await api.post('/api/kids-daily/regenerate')
      reload()
    } finally {
      setRegenerating(false)
    }
  }

  return (
    <Card
      title={
        <>
          <Icon name="wb_sunny" className="text-amber-500" /> Kids Daily Hub & STEM Answers
        </>
      }
      badge={
        <Badge
          ok={Boolean(content)}
          label={
            content?.generated_by === 'gemini_ai'
              ? 'Gemini AI'
              : 'Daily Catalog'
          }
        />
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-500/10 p-4 border border-amber-500/20">
          <div>
            <h3 className="text-base font-semibold text-ink flex items-center gap-2">
              <Icon name="schedule" className="text-amber-600 dark:text-amber-400" />
              Morning Floating Schedule
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Active on Weekdays from <strong>6:00 AM – 8:00 AM</strong> and Weekends from <strong>9:00 AM – 11:00 AM</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleToggleForce}
              disabled={toggling || loading}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition active:scale-95 cursor-pointer shadow-sm ${
                isForceActive
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'glass-inset text-ink hover:bg-white/20'
              }`}
              title="Force show banner anytime for testing"
            >
              <Icon name={isForceActive ? 'visibility' : 'visibility_off'} className="text-sm" />
              <span>{isForceActive ? 'Force Active: ON' : 'Force Active: OFF (Default)'}</span>
            </button>

            <button
              onClick={handleRegenerate}
              disabled={regenerating || loading}
              className="btn-glass flex items-center gap-1.5 px-3 py-2 text-xs font-semibold disabled:opacity-50 cursor-pointer"
              title="Generate new daily questions with AI"
            >
              <Icon name="refresh" className={`text-sm ${regenerating ? 'animate-spin' : ''}`} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>

        {content ? (
          <div className="flex flex-col gap-4">
            {/* Word of the day and Fun fact breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[var(--outline-var)] p-4 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1">
                    <Icon name="menu_book" className="text-sm" /> Word of the Day
                  </span>
                  <span className="text-xs text-ink-faint italic">{content.word_of_the_day.part_of_speech}</span>
                </div>
                <h4 className="text-lg font-bold text-ink">
                  {content.word_of_the_day.word} <span className="text-xs font-normal text-ink-soft">[{content.word_of_the_day.pronunciation}]</span>
                </h4>
                <p className="text-xs text-ink mt-1">{content.word_of_the_day.definition}</p>
                <p className="text-xs text-ink-soft italic mt-2 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10">
                  “{content.word_of_the_day.example}”
                </p>
              </div>

              <div className="rounded-2xl border border-[var(--outline-var)] p-4 bg-slate-50/50 dark:bg-slate-900/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <Icon name="lightbulb" className="text-sm" /> Fun Fact
                  </span>
                  <span className="text-xs text-ink-faint font-semibold">{content.fun_fact.category}</span>
                </div>
                <div className="flex gap-2">
                  <span className="text-2xl select-none">{content.fun_fact.emoji}</span>
                  <p className="text-xs text-ink font-medium leading-relaxed">{content.fun_fact.fact}</p>
                </div>
                {content.fun_fact.did_you_know && (
                  <p className="text-xs text-ink-soft mt-2 bg-emerald-500/5 p-2 rounded-lg border border-emerald-500/10">
                    <strong>Did you know?</strong> {content.fun_fact.did_you_know}
                  </p>
                )}
              </div>
            </div>

            {/* STEM Questions with PIN-Protected Answers for Parents */}
            <div className="rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4 flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-purple-500/15 pb-2">
                <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                  <Icon name="lock_open" className="text-base" /> Parent STEM Answer Keys & Talking Points
                </h4>
                <span className="text-[11px] text-ink-faint">Answers kept private from Home view</span>
              </div>

              {/* 5-Year Old Question & Answer */}
              <div className="rounded-xl bg-white/40 dark:bg-black/20 p-3.5 border border-purple-500/15">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                    🎈 5-Year-Old Challenge: {content.stem_5yo.topic}
                  </span>
                  {content.stem_5yo.hint && (
                    <span className="text-[11px] text-ink-soft italic">Hint: {content.stem_5yo.hint}</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-ink mb-2">Q: {content.stem_5yo.question}</p>
                <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">Answer: </span>
                  <span className="text-ink font-medium">{content.stem_5yo.answer}</span>
                </div>
                {content.stem_5yo.parent_explanation && (
                  <p className="text-[11px] text-ink-soft mt-2 leading-relaxed">
                    <strong>How to explain it: </strong>{content.stem_5yo.parent_explanation}
                  </p>
                )}
              </div>

              {/* 9-Year Old Question & Answer */}
              <div className="rounded-xl bg-white/40 dark:bg-black/20 p-3.5 border border-indigo-500/15">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300">
                    🚀 9-Year-Old Challenge: {content.stem_9yo.topic}
                  </span>
                  {content.stem_9yo.hint && (
                    <span className="text-[11px] text-ink-soft italic">Hint: {content.stem_9yo.hint}</span>
                  )}
                </div>
                <p className="text-xs font-semibold text-ink mb-2">Q: {content.stem_9yo.question}</p>
                <div className="rounded-lg bg-emerald-500/10 p-2.5 border border-emerald-500/20 text-xs">
                  <span className="font-bold text-emerald-700 dark:text-emerald-300">Answer: </span>
                  <span className="text-ink font-medium">{content.stem_9yo.answer}</span>
                </div>
                {content.stem_9yo.parent_explanation && (
                  <p className="text-[11px] text-ink-soft mt-2 leading-relaxed">
                    <strong>Deep dive concept: </strong>{content.stem_9yo.parent_explanation}
                  </p>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-8 text-ink-soft">
            <Icon name="progress_activity" className="animate-spin text-2xl" />
          </div>
        )}
      </div>
    </Card>
  )
}

