import { useEffect, useState } from 'react'
import { CelebrationProvider } from './components/celebrations/CelebrationContext'
import { RewardCelebrationProvider } from './components/celebrations/RewardCelebrationContext'
import Icon from './components/Icon'
import { useClock } from './lib/hooks'
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

const STYLE_META: Record<ThemeStyle, { icon: string; label: string; next: ThemeStyle }> = {
  material: { icon: 'palette', label: 'Material', next: 'glass' },
  glass: { icon: 'blur_on', label: 'Glass', next: 'woodland' },
  woodland: { icon: 'forest', label: 'Woodland', next: 'material' },
}

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance)
  const [style, setStyleState] = useState<ThemeStyle>(getStyle)

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

  const cycleAppearance = () => {
    const next = APPEARANCE_META[appearance].next
    setAppearanceState(next)
    setAppearance(next)
  }

  const cycleStyle = () => {
    const next = STYLE_META[style].next
    setStyleState(next)
    setStyle(next)
  }

  const View = route === 'rewards' ? Rewards : (NAV.find((n) => n.id === route)?.view ?? Home)
  const activeNav = route === 'rewards' ? 'chores' : route

  const now = useClock()
  const isHome = route === 'home'

  const mobileTools = (
    <div className="flex lg:hidden items-center gap-1.5 shrink-0">
      <button
        onClick={cycleAppearance}
        className="btn-glass p-2 text-ink-soft rounded-full active:scale-95"
        title="Appearance"
      >
        <Icon name={APPEARANCE_META[appearance].icon} className="text-base" />
      </button>
      <a
        href="#/setup"
        className={`btn-glass p-2 rounded-full active:scale-95 ${
          activeNav === 'setup' ? 'bg-slate-300 dark:bg-slate-700 text-ink' : 'text-ink-soft'
        }`}
      >
        <Icon name="settings" className="text-base" />
      </a>
    </div>
  )

  return (
    <CelebrationProvider>
      <RewardCelebrationProvider>
        <div className="flex h-full flex-col lg:flex-row gap-2 p-2 lg:gap-4 lg:p-4">
          <nav className="glass order-last lg:order-first flex flex-col w-full lg:w-28 shrink-0 items-center gap-1.5 lg:gap-4 py-2 lg:py-4 px-2 lg:px-0">
            {/* Main Nav Items */}
            <div className="flex flex-row lg:flex-col items-center justify-around lg:justify-start gap-1 lg:gap-1.5 flex-1 lg:flex-none w-full lg:w-auto">
              {NAV.filter(n => n.id !== 'setup').map((n) => (
                <a
                  key={n.id}
                  href={`#/${n.id}`}
                  className={`flex w-12 lg:w-24 flex-col items-center gap-0.5 rounded-full py-1 lg:py-2 transition-all duration-200 ${
                    activeNav === n.id ? n.active : 'text-ink-soft active:surface-tile-high'
                  }`}
                >
                  <Icon name={n.icon} filled={activeNav === n.id} className="text-[1.35rem] lg:text-[2.1rem]" />
                  <span className="hidden text-[0.7rem] font-medium lg:block">{n.label}</span>
                </a>
              ))}
            </div>

            {/* Bottom/Right Tools (Desktop Only) */}
            <div className="hidden lg:flex lg:mt-auto flex-col items-center gap-1.5">
              <button
                onClick={cycleAppearance}
                className="flex w-12 lg:w-24 flex-col items-center gap-0.5 rounded-full py-1 lg:py-2 text-ink-soft transition-all active:surface-tile-high"
                title="Appearance: follows your device in Auto"
              >
                <Icon name={APPEARANCE_META[appearance].icon} className="text-[1.2rem] lg:text-[1.8rem]" />
                <span className="hidden text-[0.65rem] font-medium lg:block">
                  {APPEARANCE_META[appearance].label}
                </span>
              </button>
              {NAV.filter(n => n.id === 'setup').map((n) => (
                <a
                  key={n.id}
                  href={`#/${n.id}`}
                  className={`flex w-12 lg:w-24 flex-col items-center gap-0.5 rounded-full py-1 lg:py-2 transition-all duration-200 ${
                    activeNav === n.id ? n.active : 'text-ink-soft active:surface-tile-high'
                  }`}
                >
                  <Icon name={n.icon} filled={activeNav === n.id} className="text-[1.35rem] lg:text-[2.1rem]" />
                  <span className="hidden text-[0.7rem] font-medium lg:block">{n.label}</span>
                </a>
              ))}
            </div>

            {/* Mobile Tools (Row 2) */}
            {mobileTools}
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
                  <div className={`mt-1 flex gap-6 font-semibold text-ink-soft ${route === 'setup' ? 'text-base' : 'text-lg'}`}>
                    <span>
                      🇮🇳 {now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })}
                      {now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }) !== now.toLocaleDateString('en-IN') && (
                        <span className={`ml-1 opacity-80 ${route === 'setup' ? 'text-xs' : 'text-sm'}`}>
                          ({new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })})
                        </span>
                      )}
                    </span>
                  </div>
                </div>
              </header>
            )}
            <View />
          </main>
        </div>
      </RewardCelebrationProvider>
    </CelebrationProvider>
  )
}
