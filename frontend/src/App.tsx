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
  applyTheme,
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
import Photos from './views/Photos'
import Slideshow from './components/Slideshow'

const NAV = [
  { id: 'home', label: 'Home', icon: 'home', view: Home, active: 'bg-sky-200 text-sky-950 dark:bg-sky-900 dark:text-sky-100', activeText: 'text-sky-600 dark:text-sky-400' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar_month', view: Calendar, active: 'bg-rose-200 text-rose-950 dark:bg-rose-900 dark:text-rose-100', activeText: 'text-rose-600 dark:text-rose-400' },
  { id: 'chores', label: 'Chores', icon: 'family_star', view: Chores, active: 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100', activeText: 'text-amber-600 dark:text-amber-400' },
  { id: 'todos', label: 'To-Dos', icon: 'task_alt', view: ToDos, active: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100', activeText: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping_cart', view: Shopping, active: 'bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100', activeText: 'text-orange-600 dark:text-orange-400' },
  { id: 'meals', label: 'Meals', icon: 'restaurant', view: Meals, active: 'bg-teal-200 text-teal-950 dark:bg-teal-900 dark:text-teal-100', activeText: 'text-teal-600 dark:text-teal-400' },
  { id: 'recipes', label: 'Recipes', icon: 'menu_book', view: Recipes, active: 'bg-pink-200 text-pink-950 dark:bg-pink-900 dark:text-pink-100', activeText: 'text-pink-600 dark:text-pink-400' },
  { id: 'photos', label: 'Photos', icon: 'photo_library', view: Photos, active: 'bg-indigo-200 text-indigo-950 dark:bg-indigo-900 dark:text-indigo-100', activeText: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'setup', label: 'Setup', icon: 'settings', view: Setup, active: 'bg-slate-300 text-slate-950 dark:bg-slate-700 dark:text-slate-100', activeText: 'text-slate-600 dark:text-slate-400' },
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
  inline = false,
}: {
  label: string
  options: { id: T; icon: string; label: string }[]
  value: T
  onSelect: (v: T) => void
  pillId: string
  inline?: boolean
}) {
  return (
    <div className={inline ? "flex items-center justify-between gap-4" : "flex flex-col gap-2"}>
      <span className={inline ? "text-[0.95rem] font-medium text-ink shrink-0 w-24" : "text-xs font-semibold uppercase tracking-wider text-ink-soft"}>{label}</span>
      <div 
        className={`glass-inset flex !rounded-full p-1 overflow-x-auto ${inline ? 'flex-1' : ''} [&::-webkit-scrollbar]:hidden`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {options.map((o) => {
          const active = o.id === value
          return (
            <button
              key={o.id}
              onClick={() => onSelect(o.id)}
              className={`relative flex items-center justify-center gap-1.5 rounded-full py-2.5 px-3.5 text-sm font-medium transition-colors duration-200 shrink-0 ${
                active ? 'text-[var(--on-primary)]' : 'text-ink-soft'
              } ${!inline && options.length <= 3 ? 'flex-1' : ''}`}
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
  const [slideshowActive, setSlideshowActive] = useState(false)
  const [photosList, setPhotosList] = useState<any[]>([])
  
  // Touch gestures for swipe-to-navigate and pull-to-refresh
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [pullY, setPullY] = useState(0)
  const [isPulling, setIsPulling] = useState(false)

  const { data: config } = useData<{ family_name: string; secondary_tz: string; secondary_tz_emoji: string }>(
    '/api/setup/config',
    ['setup'],
  )


  useEffect(() => {
    applyTheme()
    startWs()
    const unwatch = watchSystemTheme() // follow OS light/dark while in auto
    const onHash = () => setRoute(currentRoute())
    window.addEventListener('hashchange', onHash)
    return () => {
      unwatch()
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  // Fetch photos list for screensaver
  useEffect(() => {
    fetch('/api/photos')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setPhotosList(data)
        }
      })
      .catch((err) => console.error('Failed to pre-fetch photos list:', err))
  }, [])

  // Screensaver + kiosk return to home timers
  useEffect(() => {
    const IDLE_RETURN_MS = 3 * 60 * 1000              // 3 minutes of inactivity to go Home
    const SLIDESHOW_TRIGGER_MS = (3 * 60 + 30) * 1000  // 30s later (3m30s total) to start screensaver
    
    let slideshowTimer = setTimeout(startSlideshow, SLIDESHOW_TRIGGER_MS)
    let homeTimer = setTimeout(goHome, IDLE_RETURN_MS)
    
    function startSlideshow() {
      setSlideshowActive(true)
    }
    
    function goHome() {
      if (currentRoute() !== 'home') location.hash = '#/home'
    }
    
    function reset() {
      // Only re-arm the idle timers here. Do NOT dismiss the slideshow — the
      // Slideshow owns its own exit (tap a photo / the backdrop → onDismiss),
      // so tapping a video to watch it full doesn't nuke the whole overlay.
      clearTimeout(slideshowTimer)
      clearTimeout(homeTimer)
      slideshowTimer = setTimeout(startSlideshow, SLIDESHOW_TRIGGER_MS)
      homeTimer = setTimeout(goHome, IDLE_RETURN_MS)
    }
    
    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      window.addEventListener(ev, reset, { passive: true })
    }
    
    return () => {
      clearTimeout(slideshowTimer)
      clearTimeout(homeTimer)
      for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
        window.removeEventListener(ev, reset)
      }
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

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY })
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd({ x: e.targetTouches[0].clientX, y: e.targetTouches[0].clientY })
    if (touchStart && mainRef.current && mainRef.current.scrollTop <= 0) {
      const yDiff = e.targetTouches[0].clientY - touchStart.y
      if (yDiff > 0 && yDiff < 200) { // Limit max pull
        setPullY(Math.min(yDiff * 0.4, 80))
      }
    }
  }

  const onTouchEnd = () => {
    if (pullY > 60) {
      setIsPulling(true)
      window.location.reload()
      return
    }
    setPullY(0)
    
    if (!touchStart || !touchEnd) return
    const xDiff = touchStart.x - touchEnd.x
    const yDiff = Math.abs(touchStart.y - touchEnd.y)
    
    // Only trigger horizontal swipe if the swipe is mostly horizontal
    if (Math.abs(xDiff) > 60 && yDiff < 40) {
      const currentIndex = NAV.findIndex(n => n.id === activeNav)
      if (xDiff > 0 && currentIndex < NAV.length - 2) {
        // Swipe left (next tab, excluding setup at the end)
        window.location.hash = `#/${NAV[currentIndex + 1].id}`
      } else if (xDiff < 0 && currentIndex > 0) {
        // Swipe right (prev tab)
        window.location.hash = `#/${NAV[currentIndex - 1].id}`
      }
    }
    setTouchStart(null)
    setTouchEnd(null)
    setIsPulling(false)
  }



  return (
    <CelebrationProvider>
      <RewardCelebrationProvider>
        <div className="flex h-full flex-col lg:flex-row gap-2 p-2 lg:gap-4 lg:p-4">
          <nav className="glass group/nav order-last lg:order-first flex flex-row lg:flex-col w-full lg:w-16 hover:lg:w-48 transition-[width] duration-300 ease-in-out h-14 lg:h-full shrink-0 items-center lg:items-start justify-around lg:justify-start gap-1 lg:gap-4 py-1.5 lg:py-4 px-2 lg:px-2 z-20">

            {/* Main Nav Items */}
            <div className="flex flex-row lg:flex-col items-center justify-around lg:justify-start gap-1 lg:gap-3 flex-1 lg:flex-none w-full">
              {NAV.filter(n => n.id !== 'setup').map((n, index) => {
                const isActive = activeNav === n.id
                const mobileHidden = index > 4 ? 'hidden lg:flex' : 'flex'
                return (
                  <a
                    key={n.id}
                    href={`#/${n.id}`}
                    className={`${mobileHidden} flex-col lg:flex-row items-center lg:justify-start justify-center transition-all duration-200 group text-center lg:text-left flex-1 lg:flex-none w-12 lg:w-full overflow-hidden`}
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={PRESS_SPRING}
                      className={`flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 rounded-2xl w-full py-1.5 lg:py-2.5 lg:px-3 transition-all duration-200 ${
                        isActive ? n.active : 'text-ink-soft group-hover:text-ink group-hover:bg-slate-300/15 dark:group-hover:bg-slate-700/15'
                      }`}
                    >
                      <Icon name={n.icon} filled={isActive} className="text-[1.25rem] lg:text-[1.55rem] shrink-0" />
                      <span className="hidden text-[0.65rem] lg:text-sm font-semibold lg:block tracking-tight leading-none whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-300 w-0 group-hover/nav:w-auto">{n.label}</span>
                    </motion.div>
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
                  <Icon name="more_vert" filled={moreOpen || activeNav === 'setup'} className="text-[1.25rem]" />
                </motion.div>
              </button>
            </div>

            {/* Bottom/Right Tools (Desktop Only) */}
            <div className="hidden lg:flex lg:mt-auto flex-col items-center gap-3 lg:pb-4 w-full">
              <button
                onClick={cycleAppearance}
                className="flex flex-col lg:flex-row items-center lg:justify-start justify-center transition-all duration-200 group text-center lg:text-left w-full cursor-pointer overflow-hidden"
                title="Appearance: follows your device in Auto"
              >
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={PRESS_SPRING}
                  className="flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 rounded-2xl w-full py-1.5 lg:py-2.5 lg:px-3 transition-all duration-200 text-ink-soft group-hover:text-ink group-hover:bg-slate-300/15 dark:group-hover:bg-slate-700/15"
                >
                  <Icon name={APPEARANCE_META[appearance].icon} className="text-[1.25rem] lg:text-[1.55rem] shrink-0" />
                  <span className="hidden text-[0.65rem] lg:text-sm font-semibold lg:block tracking-tight leading-none whitespace-nowrap opacity-0 lg:scale-95 group-hover/nav:opacity-100 group-hover/nav:scale-100 transition-all duration-300 w-0 group-hover/nav:w-auto">
                    {APPEARANCE_META[appearance].label}
                  </span>
                </motion.div>
              </button>
              {NAV.filter(n => n.id === 'setup').map((n) => {
                const isActive = activeNav === n.id
                return (
                  <a
                    key={n.id}
                    href={`#/${n.id}`}
                    className="flex flex-col lg:flex-row items-center lg:justify-start justify-center transition-all duration-200 group text-center lg:text-left w-full overflow-hidden"
                  >
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      transition={PRESS_SPRING}
                      className={`flex flex-col lg:flex-row items-center lg:justify-start justify-center gap-1 lg:gap-3 rounded-2xl w-full py-1.5 lg:py-2.5 lg:px-3 transition-all duration-200 ${
                        isActive ? n.active : 'text-ink-soft group-hover:text-ink group-hover:bg-slate-300/15 dark:group-hover:bg-slate-700/15'
                      }`}
                    >
                      <Icon name={n.icon} filled={isActive} className="text-[1.25rem] lg:text-[1.55rem] shrink-0" />
                      <span className="hidden text-[0.65rem] lg:text-sm font-semibold lg:block tracking-tight leading-none whitespace-nowrap opacity-0 lg:scale-95 group-hover/nav:opacity-100 group-hover/nav:scale-100 transition-all duration-300 w-0 group-hover/nav:w-auto">{n.label}</span>
                    </motion.div>
                  </a>
                )
              })}
            </div>
          </nav>
          <main 
            ref={mainRef}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
            className="flex min-w-0 flex-1 flex-col overflow-y-auto py-1 relative"
          >
            {pullY > 0 && (
              <div 
                className="absolute left-0 right-0 flex justify-center z-50 pointer-events-none transition-transform duration-100"
                style={{ transform: `translateY(${pullY - 40}px)` }}
              >
                <div 
                  className="glass rounded-full p-2.5 shadow-md flex items-center justify-center transition-transform"
                  style={{ transform: `rotate(${pullY * 2}deg)` }}
                >
                  <Icon 
                    name="refresh" 
                    className={`text-2xl text-ink ${isPulling ? 'animate-spin' : ''}`}
                  />
                </div>
              </div>
            )}
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
                <View onStartSlideshow={() => setSlideshowActive(true)} />
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
            
            {/* More Views Section (Moved above Theme/Appearance) */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">More Views</span>
              <div className="flex flex-col gap-1">
                {NAV.slice(5).filter(n => n.id !== 'setup').map((n) => (
                  <motion.a
                    key={n.id}
                    href={`#/${n.id}`}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-4 rounded-2xl px-5 py-3.5 text-base hover:bg-slate-300/20 dark:hover:bg-slate-700/20"
                  >
                    <Icon name={n.icon} className="text-ink-soft" />
                    <span className="font-medium">{n.label}</span>
                  </motion.a>
                ))}
              </div>
            </div>

            {/* Settings Section */}
            <div className="flex flex-col gap-4 mt-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">Settings</span>
              
              <SegmentedRow
                label="Appearance"
                pillId="sheet-appearance-pill"
                options={APPEARANCE_OPTIONS}
                value={appearance}
                onSelect={setAppearanceState}
                inline
              />
              <SegmentedRow
                label="Theme"
                pillId="sheet-style-pill"
                options={STYLE_OPTIONS}
                value={style}
                onSelect={chooseStyle}
                inline
              />
              
              <motion.a
                href="#/setup"
                whileTap={{ scale: 0.97 }}
                transition={PRESS_SPRING}
                className="btn-glass flex items-center justify-between !rounded-2xl px-5 py-3.5 text-base mt-2"
              >
                <span className="flex items-center gap-3">
                  <Icon name="settings" /> All settings
                </span>
                <Icon name="chevron_right" />
              </motion.a>
            </div>
          </div>
        </motion.div>
        {slideshowActive && photosList.length > 0 && (
          <Slideshow photos={photosList} onDismiss={() => setSlideshowActive(false)} />
        )}
      </RewardCelebrationProvider>
    </CelebrationProvider>
  )
}
