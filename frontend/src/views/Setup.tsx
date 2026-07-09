import { useEffect, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { M3_EXPRESSIVE_SPRING, M3_STANDARD_SPRING } from '../lib/motion'
import CoinIcon from '../components/CoinIcon'
import Icon from '../components/Icon'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import type { CalendarStatus, SetupStatus, RewardStoreItem, WeatherData } from '../lib/types'
import { useCelebration } from '../components/celebrations/CelebrationContext'
import {
  FONTS,
  getAppearance,
  getFont,
  getStyle,
  setAppearance,
  setFont,
  setStyle,
  type Appearance,
  type FontChoice,
  type ThemeStyle,
} from '../lib/theme'
import type { CelebrationName } from '../components/celebrations/animations'
import { useRewardCelebration } from '../components/celebrations/RewardCelebrationContext'
import type { RewardAnimationName } from '../components/celebrations/reward-animations'

const COLORS = [
  '#f87171', '#fb923c', '#fbbf24', '#facc15', '#a3e635', '#4ade80', '#34d399', '#2dd4bf',
  '#22d3ee', '#38bdf8', '#60a5fa', '#818cf8', '#c084fc', '#e879f9', '#f472b6', '#fb7185',
]

interface Person {
  id: number
  name: string
  color: string
}

function Card({ title, badge, children }: { title: ReactNode; badge?: ReactNode; children: ReactNode }) {
  return (
    <motion.section
      layout
      whileHover={{ scale: 1.01, y: -2 }}
      transition={M3_STANDARD_SPRING}
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

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        ok ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
      }`}
    >
      {label}
    </span>
  )
}

function PinPad({ onUnlock }: { onUnlock: () => void }) {
  const [entered, setEntered] = useState('')
  const [wrong, setWrong] = useState(false)

  const press = async (d: string) => {
    const next = entered + d
    setEntered(next)
    const r = await api.post<{ ok: boolean }>('/api/setup/pin/verify', { pin: next })
    if (r.ok) {
      onUnlock()
    } else if (next.length >= 8) {
      setWrong(true)
      setTimeout(() => {
        setEntered('')
        setWrong(false)
      }, 500)
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <Icon name="lock" className="text-6xl text-ink-soft" />
      <p className="text-xl font-medium text-ink-soft">Enter the Setup PIN</p>
      <div className={`flex h-8 items-center gap-3 ${wrong ? 'animate-bounce' : ''}`}>
        {entered.length === 0 ? (
          <span className="text-ink-faint">·</span>
        ) : (
          Array.from(entered).map((_, i) => (
            <span
              key={i}
              className={`h-4 w-4 rounded-full ${wrong ? 'bg-rose-400' : 'bg-sky-500'}`}
            />
          ))
        )}
      </div>
      <div className="grid grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) =>
          d === '' ? (
            <span key={i} />
          ) : (
            <button
              key={i}
              onClick={() => (d === '⌫' ? setEntered(entered.slice(0, -1)) : press(d))}
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
    </div>
  )
}

export default function Setup() {
  const [pinState, setPinState] = useState<'checking' | 'locked' | 'open'>('checking')

  useEffect(() => {
    api
      .get<{ required: boolean }>('/api/setup/pin')
      .then((r) => {
        if (!r.required || sessionStorage.getItem('setup_unlocked') === '1') setPinState('open')
        else setPinState('locked')
      })
      .catch(() => setPinState('open'))
  }, [])

  if (pinState === 'checking') return null
  if (pinState === 'locked') {
    return (
      <PinPad
        onUnlock={() => {
          sessionStorage.setItem('setup_unlocked', '1')
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
  const [newPersonName, setNewPersonName] = useState('')
  const [newRewardEmoji, setNewRewardEmoji] = useState('🎁')
  const [newRewardTitle, setNewRewardTitle] = useState('')
  const [newRewardCost, setNewRewardCost] = useState(5)

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
    await api.put('/api/setup/people', list.map((p) => ({ name: p.name, color: p.color })))
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
    <div className="h-full overflow-y-auto p-4 lg:p-6">
      <div className="mb-4 lg:mb-5 flex flex-wrap items-center gap-3 lg:gap-4">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Setup</h1>
        <button
          onClick={() => api.post('/api/setup/sync')}
          className="ml-auto btn-primary px-4 py-2 lg:px-6 lg:py-3 text-base lg:text-lg"
        >
          <Icon name="sync" /> Sync everything now
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 pb-8 xl:grid-cols-2 xl:gap-5">
        {/* Google Calendar */}
        <Card
          title={<><Icon name="calendar_month" /> Google Calendar</>}
          badge={<Badge ok={(cal?.accounts.length ?? 0) > 0} label={`${cal?.accounts.length ?? 0} account(s)`} />}
        >
          {!cal?.client_config && (
            <p className="mb-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/60 text-base text-amber-700 dark:text-amber-300">
              Install your Google OAuth client file first: drop{' '}
              <code className="font-medium">google_client_secret.json</code> into the server's{' '}
              <code className="font-medium">data/credentials/</code> folder (see README), and add{' '}
              <code className="break-all font-medium">{cal?.redirect_uri}</code> as a redirect URI.
            </p>
          )}
          <a
            href="/api/calendar/auth/start"
            className={`inline-block rounded-xl px-6 py-3 text-lg font-medium text-white ${
              cal?.client_config ? 'bg-sky-500 active:bg-sky-600' : 'pointer-events-none bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <Icon name="add" /> Connect a Google account
          </a>
          {(cal?.accounts ?? []).map((a) => (
            <div key={a.id} className="mt-4 rounded-xl border-2 border-[var(--outline-var)] p-4">
              <div className="mb-2 flex items-center">
                <span className="text-lg font-medium">{a.email}</span>
                <button
                  onClick={async () => {
                    if (confirm(`Disconnect ${a.email}?`)) {
                      await api.del(`/api/calendar/accounts/${a.id}`)
                      reloadCal()
                    }
                  }}
                  className="ml-auto text-base font-medium text-rose-400"
                >
                  disconnect
                </button>
              </div>
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
                      className="h-7 w-7 accent-teal-500"
                    />
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ background: s.color }}
                      title="event color"
                    />
                    <span className="min-w-0 flex-1 truncate text-base font-medium">{s.name}</span>
                    <select
                      value={linkedPerson ? linkedPerson.name : ''}
                      onChange={(e) => updateSelection(s.id, { person_name: e.target.value })}
                      className="input-glass w-36 px-2 py-1.5 text-base"
                    >
                      <option value="">— no person —</option>
                      {(people ?? []).map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    {!linkedPerson && (
                      <div className="flex max-w-40 flex-wrap gap-1">
                        {COLORS.slice(0, 8).map((c) => (
                          <button
                            key={c}
                            onClick={() => updateSelection(s.id, { color: c })}
                            className={`h-6 w-6 rounded-full ${s.color === c ? 'ring-2 ring-slate-700/40 dark:ring-slate-200/60 ring-offset-1' : ''}`}
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              <p className="mt-2 text-sm text-ink-faint">
                Assign a family member to share their color everywhere (calendar, chores). Colors
                are set on the Family members card.
              </p>
            </div>
          ))}
        </Card>

        {/* iCloud */}
        <Card
          title={<><Icon name="cloud" /> iCloud Reminders</>}
          badge={
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
          }
        >
          {!status?.icloud.connected && (
            <div className="flex flex-col gap-3">
              {!status?.icloud_configured && (
                <>
                  <input
                    value={icUser}
                    onChange={(e) => setIcUser(e.target.value)}
                    placeholder="Apple ID email"
                    className="input-glass px-4 py-3 text-lg"
                  />
                  <input
                    value={icPass}
                    onChange={(e) => setIcPass(e.target.value)}
                    type="password"
                    placeholder="Password (or app-specific password)"
                    className="input-glass px-4 py-3 text-lg"
                  />
                </>
              )}
              <button
                onClick={icloudLogin}
                disabled={busy === 'icloud'}
                className="btn-primary py-3 text-lg"
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
                    className="flex-1 input-glass px-4 py-3 text-lg tracking-widest"
                  />
                  <button
                    onClick={icloud2fa}
                    className="btn-primary px-6 py-3 text-lg"
                  >
                    Verify
                  </button>
                </div>
              )}
            </div>
          )}
          {icMsg && <p className="mt-2 text-base font-medium text-ink-soft">{icMsg}</p>}
          {status?.icloud.connected && (
            <ICloudLists status={status} onSaved={reload} />
          )}
        </Card>

        {/* Alexa */}
        <Card
          title={<><Icon name="graphic_eq" /> Alexa Lists</>}
          badge={<Badge ok={!!status?.alexa.connected} label={status?.alexa.connected ? 'connected' : 'not connected'} />}
        >
          <p className="text-sm text-ink-soft">
            Syncs your shopping and to-do lists from Amazon Alexa. Credentials must be configured in your server's <code>docker-compose.yml</code> file.
          </p>
          {status?.alexa.error && (
            <p className="mt-2 text-sm font-semibold text-rose-400">
              Error: {status.alexa.error}
            </p>
          )}
        </Card>

        {/* People */}
        <Card title={<><Icon name="groups" /> Members</>}>
          <div className="flex flex-col gap-3">
            <FamilyNameRow />
            {(people ?? []).map((p, i) => (
              <div key={p.id} className="flex items-center gap-3">
                <span className="flex-1 text-lg font-medium">{p.name}</span>
                <div className="flex gap-1">
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
                        className={`group relative flex h-8 w-8 items-center justify-center rounded-full transition-all active:scale-90 ${
                          active 
                            ? 'ring-2 ring-white dark:ring-white scale-110 shadow-lg z-10' 
                            : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                        style={{ background: c }}
                      >
                        {active && (
                          <Icon 
                            name="check" 
                            className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)] text-lg" 
                          />
                        )}
                      </button>
                    )
                  })}
                </div>
                <button
                  onClick={() => savePeople((people ?? []).filter((x) => x.id !== p.id))}
                  className="text-rose-400"
                >
                  ✕
                </button>
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

        {/* Gemini + celebrations */}
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

        {/* Rewards Store */}
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

        <Card title={<><Icon name="celebration" /> Celebration preview</>}>
          <p className="mb-2 text-sm text-ink-soft">One of these plays whenever a chore or to-do is completed.</p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['confetti', '🎊'],
                ['fireworks', '🎆'],
                ['rocket', '🚀'],
                ['flowers', '🌸'],
                ['sparkle', '🧚'],
                ['unicorn', '🦄'],
                ['superhero', '🦸'],
                ['bubbles', '🫧'],
              ] as [CelebrationName, string][]
            ).map(([n, e]) => (
              <button key={n} onClick={() => celebrate(n)} className="btn-glass px-4 py-2 text-sm capitalize">
                {e} {n}
              </button>
            ))}
            <button onClick={() => celebrate()} className="btn-primary px-5 py-2 text-sm">
              Surprise me!
            </button>
          </div>
        </Card>

        <Card title={<><Icon name="redeem" /> Reward animation preview</>}>
          <p className="mb-2 text-sm text-ink-soft">
            These play when someone redeems a reward from the store.
          </p>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ['fairy', '🧚 Fairy wish'],
                ['treasure', '💰 Treasure chest'],
                ['candy', '🍭 Sweet treats'],
                ['puppies', '🐶 Puppy party'],
                ['racecar', '🏎️ Victory lap'],
              ] as [RewardAnimationName, string][]
            ).map(([n, label]) => (
              <button key={n} onClick={() => celebrateReward(n)} className="btn-glass px-4 py-2 text-sm">
                {label}
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

        <AppearanceCard />

        <WeatherCard />

        {status && <TimezoneCard status={status} reload={reload} />}

        {/* sync health */}
        <Card title={<><Icon name="monitor_heart" /> Sync health</>}>
          {Object.keys(status?.sync ?? {}).length === 0 ? (
            <p className="text-sm text-ink-soft">No syncs have run yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {Object.entries(status?.sync ?? {}).map(([name, s]) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.ok ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                  <span className="w-20 font-medium capitalize">{name}</span>
                  <span className="text-ink-soft">{new Date(s.at).toLocaleTimeString()}</span>
                  {s.detail && <span className="truncate text-rose-500">{s.detail}</span>}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
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

  const pickStyle = (s: ThemeStyle) => {
    setStyleState(s)
    setStyle(s)
  }
  const pickAppearance = (a: Appearance) => {
    setAppearanceState(a)
    setAppearance(a)
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
              <button
                key={s}
                onClick={() => pickStyle(s)}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-base font-medium transition-all ${
                  style === s ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'glass-inset text-ink-soft'
                }`}
              >
                <Icon name={icon} /> {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-base font-medium text-ink-soft">
            Mode — Auto follows the device's light/dark setting
          </p>
          <div className="flex gap-2">
            {(
              [
                ['auto', 'routine', 'Auto'],
                ['light', 'light_mode', 'Light'],
                ['dark', 'dark_mode', 'Dark'],
              ] as [Appearance, string, string][]
            ).map(([a, icon, label]) => (
              <button
                key={a}
                onClick={() => pickAppearance(a)}
                className={`flex items-center gap-2 rounded-xl px-5 py-3 text-base font-medium transition-all ${
                  appearance === a ? 'bg-[var(--primary)] text-[var(--on-primary)]' : 'glass-inset text-ink-soft'
                }`}
              >
                <Icon name={icon} /> {label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-2 text-base font-medium text-ink-soft">Font</p>
          <div className="flex flex-wrap gap-2">
            {FONTS.map((f) => (
              <button
                key={f.id}
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
              </button>
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
      <div>
        <p className="mb-2 text-base font-medium text-ink">To-Do lists (synced to the To-Dos view):</p>
        <div className="flex flex-wrap gap-2">
          {lists
            .filter((l) => l !== settings.icloud_shopping_list)
            .map((l) => {
              const active = taskLists === null || taskLists.includes(l)
              return (
                <button
                  key={l}
                  onClick={() => {
                    const current = taskLists ?? lists.filter((x) => x !== settings.icloud_shopping_list)
                    save({
                      icloud_task_lists: active ? current.filter((x) => x !== l) : [...current, l],
                    })
                  }}
                  className={`rounded-full px-4 py-2 text-base font-medium ${
                    active ? 'bg-sky-500 text-white' : 'surface-tile text-ink-soft'
                  }`}
                >
                  {l}
                </button>
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
