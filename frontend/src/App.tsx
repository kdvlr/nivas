import { useEffect, useRef, useState } from 'react'
import { api } from './lib/api'
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
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const mainRef = useRef<HTMLDivElement>(null)

  // Auto-close drawer on route change
  useEffect(() => {
    setDrawerOpen(false)
  }, [route])

  // Swipe drawer gestures
  useEffect(() => {
    let startX = 0
    let startY = 0

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (startX === 0) return

      const diffX = e.touches[0].clientX - startX
      const diffY = e.touches[0].clientY - startY

      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (!drawerOpen && startX < 40 && diffX > 50) {
          setDrawerOpen(true)
          startX = 0
        } else if (drawerOpen && diffX < -50) {
          setDrawerOpen(false)
          startX = 0
        }
      }
    }

    const handleTouchEnd = () => {
      startX = 0
      startY = 0
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [drawerOpen])

  // Pull to refresh gestures
  useEffect(() => {
    const main = mainRef.current
    if (!main) return

    let startY = 0
    let isAtTop = false

    const touchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY
      isAtTop = main.scrollTop === 0
    }

    const touchMove = (e: TouchEvent) => {
      if (!isAtTop) return

      const currentY = e.touches[0].clientY
      const diffY = currentY - startY

      if (diffY > 0) {
        if (e.cancelable) e.preventDefault()
        setPulling(true)
        const dist = Math.min(100, diffY * 0.4)
        setPullDistance(dist)
      }
    }

    const touchEnd = async () => {
      if (!pulling) return
      setPulling(false)

      if (pullDistance > 60) {
        setRefreshing(true)
        setPullDistance(50)
        try {
          await api.post('/api/setup/sync')
        } catch {
          // ignore
        } finally {
          setRefreshing(false)
          setPullDistance(0)
        }
      } else {
        setPullDistance(0)
      }
    }

    main.addEventListener('touchstart', touchStart, { passive: true })
    main.addEventListener('touchmove', touchMove, { passive: false })
    main.addEventListener('touchend', touchEnd, { passive: true })

    return () => {
      main.removeEventListener('touchstart', touchStart)
      main.removeEventListener('touchmove', touchMove)
      main.removeEventListener('touchend', touchEnd)
    }
  }, [pulling, pullDistance])

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

  const menuButton = (
    <button
      onClick={() => setDrawerOpen(true)}
      className="flex lg:hidden btn-glass p-2.5 text-ink-soft rounded-full active:scale-95 mr-3 shrink-0 items-center justify-center"
      title="Menu"
    >
      <Icon name="menu" className="text-lg" />
    </button>
  )

  return (
    <CelebrationProvider>
      <RewardCelebrationProvider>
        <div className="flex h-full flex-col lg:flex-row gap-2 p-2 lg:gap-4 lg:p-4">
          {drawerOpen && (
            <div 
              className="fixed inset-0 bg-black/45 backdrop-blur-sm z-40 lg:hidden transition-all duration-300"
              onClick={() => setDrawerOpen(false)}
            />
          )}

          <nav className={`glass fixed lg:static top-0 left-0 z-50 h-full w-24 lg:w-28 flex flex-col items-center py-4 lg:py-4 px-2 lg:px-0 transition-transform duration-300 ease-in-out ${
            drawerOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}>
            {/* Main Nav Items */}
            <div className="flex flex-col items-center gap-1 lg:gap-1.5">
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

            {/* Bottom/Right Tools */}
            <div className="mt-auto flex flex-col items-center gap-1.5">
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
          </nav>
          <main ref={mainRef} className="relative flex min-w-0 flex-1 flex-col overflow-y-auto py-1">
            {pullDistance > 0 && (
              <div 
                className="absolute left-1/2 -translate-x-1/2 z-40 bg-white dark:bg-slate-800 shadow-md rounded-full w-10 h-10 flex items-center justify-center transition-all duration-150"
                style={{ 
                  top: `${pullDistance - 15}px`,
                  transform: `translate(-50%, 0) rotate(${pullDistance * 4}deg)`,
                  opacity: Math.min(1, pullDistance / 50)
                }}
              >
                {refreshing ? (
                  <Icon name="sync" className="animate-spin text-[var(--primary)]" />
                ) : (
                  <Icon name="arrow_downward" className="text-[var(--primary)]" />
                )}
              </div>
            )}
            {!isHome && (
              <header className="flex items-center px-4 py-3 lg:px-8 lg:py-4">
                {menuButton}
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
            <View {...(isHome ? { menuButton } : {})} />
          </main>
        </div>
      </RewardCelebrationProvider>
    </CelebrationProvider>
  )
}
