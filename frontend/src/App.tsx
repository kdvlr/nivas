import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  PRESS_SPRING,
  EXPRESSIVE_ENTER,
  EFFECTS_DEFAULT,
  SPATIAL_EXPRESSIVE_DEFAULT,
} from './lib/motion'
import { api } from './lib/api'
import { CelebrationProvider } from './components/celebrations/CelebrationContext'
import { RewardCelebrationProvider } from './components/celebrations/RewardCelebrationContext'
import Icon from './components/Icon'
import { useClock, useData } from './lib/hooks'
import {
  getAppearance,
  getStyle,
  setAppearance,
  setStyle,
  watchSystemTheme,
  type Appearance,
  type ThemeStyle,
} from './lib/theme'
import { startWs } from './lib/ws'
import Home from './views/Home'
import Calendar from './views/Calendar'
import Chores from './views/Chores'
import ToDos from './views/ToDos'
import Rewards from './views/Rewards'
import Shopping from './views/Shopping'
import Meals from './views/Meals'
import Recipes from './views/Recipes'
import Setup from './views/Setup'

const NAV = [
  { id: 'home', label: 'Home', icon: 'home', view: Home, active: 'bg-sky-200 text-sky-950 dark:bg-sky-900 dark:text-sky-100' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar_month', view: Calendar, active: 'bg-rose-200 text-rose-950 dark:bg-rose-900 dark:text-rose-100' },
  { id: 'chores', label: 'Chores', icon: 'family_star', view: Chores, active: 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100' },
  { id: 'todos', label: 'To-Dos', icon: 'task_alt', view: ToDos, active: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping_cart', view: Shopping, active: 'bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100' },
  { id: 'meals', label: 'Meals', icon: 'restaurant', view: Meals, active: 'bg-teal-200 text-teal-950 dark:bg-teal-900 dark:text-teal-100' },
  { id: 'recipes', label: 'Recipes', icon: 'menu_book', view: Recipes, active: 'bg-pink-200 text-pink-950 dark:bg-pink-900 dark:text-pink-100' },
  { id: 'setup', label: 'Setup', icon: 'settings', view: Setup, active: 'bg-slate-300 text-slate-950 dark:bg-slate-700 dark:text-slate-100' },
] as const

const IDLE_RETURN_MS = 5 * 60 * 1000

function currentRoute() {
  const hash = location.hash.replace(/^#\/?/, '').split('/')[0]
  if (hash === 'rewards') return 'rewards'
  return NAV.some((n) => n.id === hash) ? hash : 'home'
}

const APPEARANCE_META: Record<Appearance, { icon: string; label: string; next: Appearance }> = {
  auto: { icon: 'routine', label: 'Auto', next: 'light' },
  light: { icon: 'light_mode', label: 'Light', next: 'dark' },
  dark: { icon: 'dark_mode', label: 'Dark', next: 'auto' },
}

const APPEARANCE_OPTIONS: { id: Appearance; icon: string; label: string }[] = [
  { id: 'auto', icon: 'routine', label: 'Auto' },
  { id: 'light', icon: 'light_mode', label: 'Light' },
  { id: 'dark', icon: 'dark_mode', label: 'Dark' },
]

const STYLE_OPTIONS: { id: ThemeStyle; icon: string; label: string }[] = [
  { id: 'material', icon: 'palette', label: 'Material' },
  { id: 'glass', icon: 'blur_on', label: 'Glass' },
  { id: 'woodland', icon: 'forest', label: 'Woodland' },
]

/** Segmented control with a spring-animated pill behind the active option. */
function SegmentedRow<T extends string>({
  label,
  options,
  value,
  onSelect,
  pillId,
}: {
  label: string
  options: { id: T; icon: string; label: string }[]
  value: T
  onSelect: (v: T) => void
  pillId: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{label}</span>
      <div className="glass-inset flex !rounded-full p-1">
        {options.map((o) => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              onClick={() => onSelect(o.id)}
              className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2.5 text-sm font-medium transition-colors duration-200 ${
                active ? 'text-[var(--on-primary)]' : 'text-ink-soft'
              }`}
            >
              {active && (
                <motion.span
                  layoutId={pillId}
                  transition={SPATIAL_EXPRESSIVE_DEFAULT}
                  className="absolute inset-0 rounded-full bg-[var(--primary)]"
                />
              )}
              <Icon name={o.icon} filled={active} className="relative z-10 text-lg" />
              <span className="relative z-10">{o.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const getTzDateString = (date: Date, timeZone: string) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = formatter.formatToParts(date)
    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    return `${year}-${month}-${day}`
  } catch (e) {
    return ''
  }
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance)
  const [style, setStyleState] = useState<ThemeStyle>(getStyle)
  const [moreOpen, setMoreOpen] = useState(false)

  const { data: config } = useData<{ family_name: string; secondary_tz: string; secondary_tz_emoji: string }>(
    '/api/setup/config',
    ['setup'],
  )


  useEffect(() => {
    startWs()
    const unwatch = watchSystemTheme() // follow OS light/dark while in auto
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => {
      unwatch()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  // kiosk behavior: return to Home after inactivity
  useEffect(() => {
    let timer = setTimeout(goHome, IDLE_RETURN_MS)
    function goHome() {
      if (currentRoute() !== 'home') location.hash = '#/home'
    }
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(goHome, IDLE_RETURN_MS)
    }
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) window.addEventListener(ev, reset)
    return () => {
      clearTimeout(timer)
      for (const ev of ['pointerdown', 'touchstart', 'keydown'])
        window.removeEventListener(ev, reset)
    }
  }, [])

  const chooseAppearance = (a: Appearance) => {
    setAppearanceState(a)
    setAppearance(a)
  }

  const chooseStyle = (s: ThemeStyle) => {
    setStyleState(s)
    setStyle(s)
  }

  const cycleAppearance = () => chooseAppearance(APPEARANCE_META[appearance].next)

  // close the quick-settings sheet whenever navigation happens
  useEffect(() => {
    setMoreOpen(false)
  }, [route])

  const View = route === 'rewards' ? Rewards : (NAV.find((n) => n.id === route)?.view ?? Home)
  const activeNav = route === 'rewards' ? 'chores' : route

  const now = useClock()
  const isHome = route === 'home'



  return (
    <CelebrationProvider>
      <RewardCelebrationProvider>
        <div className="flex h-full flex-col lg:flex-row gap-2 p-2 lg:gap-4 lg:p-4">
          <nav className="glass order-last lg:order-first flex flex-row lg:flex-col w-full lg:w-22 h-14 lg:h-full shrink-0 items-center justify-around lg:justify-start gap-1 lg:gap-4 py-1.5 lg:py-4 px-2 lg:px-0">
            {/* Main Nav Items */}
            <div className="flex flex-row lg:flex-col items-center justify-around lg:justify-start gap-1 lg:gap-1.5 flex-1 lg:flex-none w-full">
              {NAV.filter(n => n.id !== 'setup').map((n) => {
                const isActive = activeNav === n.id
                return (
                  <a
                    key={n.id}
                    href={`#/${n.id}`}
                    className={`flex flex-col items-center gap-0.5 py-1 lg:py-1.5 transition-all duration-200 group text-center flex-1 lg:flex-none w-12 lg:w-full ${
                      isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={PRESS_SPRING}
                      className={`flex items-center justify-center h-7 w-10 lg:h-8 lg:w-14 rounded-full transition-all duration-200 ${
                        isActive ? n.active : 'group-hover:bg-slate-300/15 dark:group-hover:bg-slate-700/15'
                      }`}
                    >
                      <Icon name={n.icon} filled={isActive} className="text-[1.25rem] lg:text-[1.55rem]" />
                    </motion.div>
                    <span className="hidden text-[0.65rem] font-medium lg:block tracking-tight">{n.label}</span>
                  </a>
                )
              })}

              {/* Mobile only: quick-settings sheet trigger (desktop has the sidebar tools) */}
              <button
                onClick={() => setMoreOpen(true)}
                className={`lg:hidden flex flex-col items-center gap-0.5 py-1 transition-all duration-200 group text-center flex-1 w-12 ${
                  moreOpen || activeNav === 'setup' ? 'text-ink' : 'text-ink-soft hover:text-ink'
                }`}
                title="Settings"
              >
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  transition={PRESS_SPRING}
                  className={`flex items-center justify-center h-7 w-10 rounded-full transition-all duration-200 ${
                    moreOpen || activeNav === 'setup'
                      ? 'bg-slate-300 text-slate-950 dark:bg-slate-700 dark:text-slate-100'
                      : ''
                  }`}
                >
                  <Icon name="more_horiz" filled={moreOpen || activeNav === 'setup'} className="text-[1.25rem]" />
                </motion.div>
              </button>
            </div>

            {/* Bottom/Right Tools (Desktop Only) */}
            <div className="hidden lg:flex lg:mt-auto flex-col items-center gap-1.5 lg:pb-4 w-full">
              <button
                onClick={cycleAppearance}
                className="flex flex-col items-center gap-0.5 py-1 lg:py-1.5 group text-center text-ink-soft hover:text-ink w-full cursor-pointer"
                title="Appearance: follows your device in Auto"
              >
                <motion.div
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  transition={PRESS_SPRING}
                  className="flex items-center justify-center h-7 w-10 lg:h-8 lg:w-14 rounded-full transition-all duration-200 group-hover:bg-slate-300/15 dark:group-hover:bg-slate-700/15"
                >
                  <Icon name={APPEARANCE_META[appearance].icon} className="text-[1.25rem] lg:text-[1.55rem]" />
                </motion.div>
                <span className="hidden text-[0.65rem] font-medium lg:block tracking-tight">
                  {APPEARANCE_META[appearance].label}
                </span>
              </button>
              {NAV.filter(n => n.id === 'setup').map((n) => {
                const isActive = activeNav === n.id
                return (
                  <a
                    key={n.id}
                    href={`#/${n.id}`}
                    className={`flex flex-col items-center gap-0.5 py-1 lg:py-1.5 transition-all duration-200 group text-center w-full ${
                      isActive ? 'text-ink' : 'text-ink-soft hover:text-ink'
                    }`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      transition={PRESS_SPRING}
                      className={`flex items-center justify-center h-7 w-10 lg:h-8 lg:w-14 rounded-full transition-all duration-200 ${
                        isActive ? n.active : 'group-hover:bg-slate-300/15 dark:group-hover:bg-slate-700/15'
                      }`}
                    >
                      <Icon name={n.icon} filled={isActive} className="text-[1.25rem] lg:text-[1.55rem]" />
                    </motion.div>
                    <span className="hidden text-[0.65rem] font-medium lg:block tracking-tight">{n.label}</span>
                  </a>
                )
              })}
            </div>
          </nav>
          <main className="flex min-w-0 flex-1 flex-col overflow-y-auto py-1">
            {!isHome && (
              <header className="flex flex-col px-6 py-4 lg:px-8">
                <div className="flex flex-col">
                  <div className="flex items-baseline gap-3">
                    <span className="text-2xl font-normal tabular-nums tracking-tight text-[var(--primary)]">
                      {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </span>
                    <span className="text-lg font-medium text-ink-soft">
                      {now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                  {(() => {
                    const secondaryTz = config?.secondary_tz || 'Asia/Kolkata'
                    const secondaryEmoji = config?.secondary_tz_emoji || '🇮🇳'
                    const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone
                    const localDateStr = getTzDateString(now, localTz)
                    const secondaryDateStr = getTzDateString(now, secondaryTz)
                    const hasDateDiff = localDateStr !== secondaryDateStr && secondaryDateStr !== ''
                    
                    let secondaryDateFormatted = ''
                    if (hasDateDiff) {
                      try {
                        secondaryDateFormatted = new Intl.DateTimeFormat('en-US', {
                          timeZone: secondaryTz,
                          month: 'long',
                          day: 'numeric',
                        }).format(now)
                      } catch (e) {}
                    }
                    
                    let secondaryTimeFormatted = ''
                    try {
                      secondaryTimeFormatted = now.toLocaleTimeString(undefined, {
                        timeZone: secondaryTz,
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    } catch (e) {
                      secondaryTimeFormatted = now.toLocaleTimeString()
                    }

                    return (
                      <div className={`mt-1 flex gap-6 font-semibold text-ink-soft ${route === 'setup' ? 'text-base' : 'text-lg'}`}>
                        <span>
                          {secondaryEmoji} {secondaryTimeFormatted}
                          {hasDateDiff && secondaryDateFormatted && (
                            <span className={`ml-1 opacity-80 ${route === 'setup' ? 'text-xs' : 'text-sm'}`}>
                              ({secondaryDateFormatted})
                            </span>
                          )}
                        </span>
                      </div>
                    )
                  })()}
                </div>
              </header>
            )}
            <AnimatePresence mode="wait">
              <motion.div
                key={route}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={EXPRESSIVE_ENTER}
                className="flex flex-1 flex-col min-h-0"
              >
                <View />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Mobile quick-settings bottom sheet. Stays mounted; springs on/off
            screen via `animate` (exit-unmount animations proved unreliable
            with layoutId pills inside the sheet). */}
        <motion.div
          initial={false}
          animate={{ opacity: moreOpen ? 1 : 0 }}
          transition={EFFECTS_DEFAULT}
          className={`fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden ${moreOpen ? '' : 'pointer-events-none'}`}
          onClick={() => setMoreOpen(false)}
        />
        <motion.div
          initial={false}
          animate={{ y: moreOpen ? '0%' : '115%' }}
          transition={SPATIAL_EXPRESSIVE_DEFAULT}
          drag={moreOpen ? 'y' : false}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.55 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 70 || info.velocity.y > 500) setMoreOpen(false)
          }}
          className={`glass fixed inset-x-0 bottom-0 z-40 !rounded-b-none !rounded-t-3xl p-5 pb-[calc(2rem+env(safe-area-inset-bottom))] lg:hidden ${moreOpen ? '' : 'pointer-events-none'}`}
        >
          <div className="mx-auto mb-5 h-1.5 w-12 rounded-full bg-[var(--outline-var)]" />
          <div className="flex flex-col gap-5">
            <SegmentedRow
              label="Appearance"
              pillId="sheet-appearance-pill"
              options={APPEARANCE_OPTIONS}
              value={appearance}
              onSelect={chooseAppearance}
            />
            <SegmentedRow
              label="Theme"
              pillId="sheet-style-pill"
              options={STYLE_OPTIONS}
              value={style}
              onSelect={chooseStyle}
            />
            <motion.a
              href="#/setup"
              whileTap={{ scale: 0.97 }}
              transition={PRESS_SPRING}
              className="btn-glass flex items-center justify-between !rounded-2xl px-5 py-3.5 text-base"
            >
              <span className="flex items-center gap-3">
                <Icon name="settings" /> All settings
              </span>
              <Icon name="chevron_right" />
            </motion.a>
          </div>
        </motion.div>
      </RewardCelebrationProvider>
    </CelebrationProvider>
  )
}
