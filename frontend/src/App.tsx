import { useEffect, useRef, useState, lazy, Suspense } from 'react'
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
const Calendar = lazy(() => import('./views/Calendar'))
const Chores = lazy(() => import('./views/Chores'))
const ToDos = lazy(() => import('./views/ToDos'))
const Rewards = lazy(() => import('./views/Rewards'))
const Shopping = lazy(() => import('./views/Shopping'))
const Recipes = lazy(() => import('./views/Recipes'))
const Setup = lazy(() => import('./views/Setup'))
const Photos = lazy(() => import('./views/Photos'))
const YTMusic = lazy(() => import('./views/YTMusic'))
import MiniPlayerBar, { Track } from './components/ytmusic/MiniPlayerBar'
import FloatingActionButton from './components/FloatingActionButton'
import Slideshow, { hasSkyOverride } from './components/Slideshow'
import { GlobalTooltip } from './components/GlobalTooltip'

const NAV = [
  { id: 'home', label: 'Home', icon: 'home', view: Home, active: 'bg-sky-200 text-sky-950 dark:bg-sky-900 dark:text-sky-100', activeText: 'text-sky-600 dark:text-sky-400' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar_month', view: Calendar, active: 'bg-rose-200 text-rose-950 dark:bg-rose-900 dark:text-rose-100', activeText: 'text-rose-600 dark:text-rose-400' },
  { id: 'chores', label: 'Chores', icon: 'family_star', view: Chores, active: 'bg-amber-200 text-amber-950 dark:bg-amber-900 dark:text-amber-100', activeText: 'text-amber-600 dark:text-amber-400' },
  { id: 'todos', label: 'To-Dos', icon: 'task_alt', view: ToDos, active: 'bg-emerald-200 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100', activeText: 'text-emerald-600 dark:text-emerald-400' },
  { id: 'ytmusic', label: 'Music', icon: 'graphic_eq', view: YTMusic, active: 'bg-rose-300 text-rose-950 dark:bg-rose-950 dark:text-rose-100', activeText: 'text-rose-600 dark:text-rose-400' },
  { id: 'shopping', label: 'Shopping', icon: 'shopping_cart', view: Shopping, active: 'bg-orange-200 text-orange-950 dark:bg-orange-900 dark:text-orange-100', activeText: 'text-orange-600 dark:text-orange-400' },
  { id: 'recipes', label: 'Recipes', icon: 'restaurant', view: Recipes, active: 'bg-pink-200 text-pink-950 dark:bg-pink-900 dark:text-pink-100', activeText: 'text-pink-600 dark:text-pink-400' },
  { id: 'photos', label: 'Photos', icon: 'photo_library', view: Photos, active: 'bg-indigo-200 text-indigo-950 dark:bg-indigo-900 dark:text-indigo-100', activeText: 'text-indigo-600 dark:text-indigo-400' },
  { id: 'setup', label: 'Setup', icon: 'settings', view: Setup, active: 'bg-slate-300 text-slate-950 dark:bg-slate-700 dark:text-slate-100', activeText: 'text-slate-600 dark:text-slate-400' },
] as const

function currentRoute() {
  // strip the query string first: "#/photos?sky=day" is still the photos route
  const hash = location.hash.replace(/^#\/?/, '').split('?')[0].split('/')[0]
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

import { playChime } from './lib/useAudioChime'
import TopClockHeader from './components/TopClockHeader'
import AmbientCalendarOverlay, { type ReminderPayload } from './components/AmbientCalendarOverlay'

export default function App() {
  const [route, setRoute] = useState(currentRoute)
  const [appearance, setAppearanceState] = useState<Appearance>(getAppearance)
  const [style, setStyleState] = useState<ThemeStyle>(getStyle)
  const [moreOpen, setMoreOpen] = useState(false)
  const [slideshowActive, setSlideshowActive] = useState(false)
  const slideshowActiveRef = useRef(false)
  slideshowActiveRef.current = slideshowActive
  const alertedSetRef = useRef(new Set<string>())
  const dashboardRef = useRef<HTMLDivElement>(null)
  const resumeVideosRef = useRef<HTMLVideoElement[]>([])

  // The gallery autoplays a muted <video> for every Live Photo scrolled into
  // view. Hiding the dashboard stops it painting but the browser keeps
  // decoding those videos behind the screensaver, which on a large library is
  // a lot of continuous work for something nobody can see. Pause them while
  // the slideshow is up and resume whatever was actually playing on exit
  // (the tiles' IntersectionObservers won't re-fire on their own).
  useEffect(() => {
    const root = dashboardRef.current
    if (!root) return
    if (slideshowActive) {
      const paused: HTMLVideoElement[] = []
      root.querySelectorAll('video').forEach((v) => {
        if (!v.paused) {
          v.pause()
          paused.push(v)
        }
      })
      resumeVideosRef.current = paused
    } else if (resumeVideosRef.current.length) {
      resumeVideosRef.current.forEach((v) => {
        if (v.isConnected) v.play().catch(() => {})
      })
      resumeVideosRef.current = []
    }
  }, [slideshowActive])
  const [photosList, setPhotosList] = useState<any[]>([])
  
  // YouTube Music Pure Server-Side Synchronized Player State
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [durationSeconds, setDurationSeconds] = useState<number>(0)
  const [playQueue, setPlayQueue] = useState<Track[]>([])

  const syncPlayerState = async () => {
    try {
      const state = await api.get<any>('/api/ytmusic/player/state')
      if (state) {
        setIsPlaying(state.isPlaying)
        setCurrentTrack(state.currentTrack)
        setElapsedSeconds(state.elapsedSeconds || 0)
        setDurationSeconds(state.durationSeconds || 0)
        setPlayQueue(Array.isArray(state.queue) ? state.queue : [])
      }
    } catch (e) {
      // Ignore
    }
  }

  useEffect(() => {
    syncPlayerState()
    const interval = setInterval(syncPlayerState, 1000)
    return () => clearInterval(interval)
  }, [])

  const handlePlayTrack = (track: Track, queue?: Track[]) => {
    api.post<any>('/api/ytmusic/player/play', {
      videoId: track.videoId,
      title: track.title,
      artist: track.artist,
      thumbnail: track.thumbnail,
      album: track.album,
      duration: track.duration,
      isPureAudio: track.isPureAudio,
      source: track.source,
      queue,
    }).then((res) => {
      if (res) {
        setIsPlaying(res.isPlaying)
        setCurrentTrack(res.currentTrack)
        setPlayQueue(Array.isArray(res.queue) ? res.queue : [])
      }
    }).catch(() => {})
  }

  const handleTogglePlay = () => {
    const endpoint = isPlaying ? '/api/ytmusic/player/pause' : '/api/ytmusic/player/resume'
    api.post<any>(endpoint).then((res) => {
      if (res) setIsPlaying(res.isPlaying)
    }).catch(() => {})
  }

  const handleNextTrack = () => {
    api.post<any>('/api/ytmusic/player/next').then((res) => {
      if (res) {
        setIsPlaying(res.isPlaying)
        setCurrentTrack(res.currentTrack)
        setPlayQueue(Array.isArray(res.queue) ? res.queue : [])
      }
    }).catch(() => {})
  }

  const handlePrevTrack = () => {
    api.post<any>('/api/ytmusic/player/prev').catch(() => {})
  }

  const seekDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleSeek = (secs: number) => {
    setElapsedSeconds(secs)
    if (seekDebounceRef.current) {
      clearTimeout(seekDebounceRef.current)
    }
    seekDebounceRef.current = setTimeout(() => {
      api.post<any>('/api/ytmusic/player/seek', { seconds: secs }).catch(() => {})
    }, 120)
  }

  const handleStopPlayer = () => {
    api.post<any>('/api/ytmusic/player/stop').then((res) => {
      if (res) {
        setIsPlaying(false)
        setCurrentTrack(null)
        setElapsedSeconds(0)
        setDurationSeconds(0)
        setPlayQueue([])
      }
    }).catch(() => {
      setIsPlaying(false)
      setCurrentTrack(null)
    })
  }

  const handleMute = () => {
    api.post('/api/ytmusic/airplay/volume/master', { volume: 0 }).catch(() => {})
  }

  const handleQueueTrack = (track: Track, playNext: boolean) => {
    api.post<any>(playNext ? '/api/ytmusic/player/queue/next' : '/api/ytmusic/player/queue', track)
      .then((res) => setPlayQueue(Array.isArray(res?.queue) ? res.queue : []))
      .catch(() => {})
  }

  const handleQueueChange = (queue: Track[]) => {
    setPlayQueue(queue)
    api.put<any>('/api/ytmusic/player/queue', { queue })
      .then((res) => setPlayQueue(Array.isArray(res?.queue) ? res.queue : []))
      .catch(() => syncPlayerState())
  }

  // Touch gestures for swipe-to-navigate and pull-to-refresh
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null)
  const [touchEnd, setTouchEnd] = useState<{ x: number; y: number } | null>(null)
  const mainRef = useRef<HTMLElement>(null)
  const [pullY, setPullY] = useState(0)
  const [isPulling, setIsPulling] = useState(false)

function isWithinQuietHours(now: Date, startStr = '22:00', endStr = '06:00'): boolean {
  const [startH, startM] = (startStr || '22:00').split(':').map(Number)
  const [endH, endM] = (endStr || '06:00').split(':').map(Number)
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = (isNaN(startH) ? 22 : startH) * 60 + (isNaN(startM) ? 0 : startM)
  const endMinutes = (isNaN(endH) ? 6 : endH) * 60 + (isNaN(endM) ? 0 : endM)

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  } else {
    return currentMinutes >= startMinutes || currentMinutes < endMinutes
  }
}

  const { data: config, reload: reloadConfig } = useData<{
    family_name: string
    secondary_tz: string
    secondary_tz_emoji: string
    appearance?: Appearance
    kiosk_sleep_enabled?: boolean
    kiosk_sleep_start?: string
    kiosk_sleep_end?: string
    kiosk_daytime_screen_off_mins?: number
    kiosk_suppress_night_motion?: boolean
  }>(
    '/api/setup/config',
    ['setup'],
  )
  const configRef = useRef(config)
  configRef.current = config

  useEffect(() => {
    if (config?.appearance) {
      const current = localStorage.getItem('appearance') ?? 'auto'
      if (config.appearance !== current) {
        setAppearance(config.appearance)
        setAppearanceState(config.appearance)
      }
    }
  }, [config?.appearance])

  // Poll server config and refresh on visibility change so wall tablets stay in sync
  useEffect(() => {
    const timer = setInterval(() => {
      reloadConfig()
    }, 30000)
    const onVis = () => {
      if (document.visibilityState === 'visible') reloadConfig()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [reloadConfig])

  useEffect(() => {
    applyTheme()
    startWs()
    const unwatch = watchSystemTheme() // follow OS light/dark while in auto
    const onHash = () => setRoute(currentRoute())
    const handleAppChanged = (e: Event) => {
      const customEv = e as CustomEvent<Appearance>
      if (customEv.detail) setAppearanceState(customEv.detail)
    }
    window.addEventListener('hashchange', onHash)
    window.addEventListener('appearance-changed', handleAppChanged)
    return () => {
      unwatch()
      window.removeEventListener('hashchange', onHash)
      window.removeEventListener('appearance-changed', handleAppChanged)
    }
  }, [])

  // "#/photos?sky=night&skyfx=stormy" jumps straight into the slideshow so the
  // sky preview is one URL away. Keyed on the route, so dismissing it stays
  // dismissed until you navigate again.
  useEffect(() => {
    if (route === 'photos' && hasSkyOverride()) setSlideshowActive(true)
  }, [route])

  // Fetch the photo list for the screensaver.
  //
  // This used to be a single attempt: if it failed, photosList stayed empty for
  // the life of the page and the screensaver silently never rendered (its
  // trigger fires, but there's nothing to show). A wall tablet boots alongside
  // the server and routinely loses this race, so retry with backoff and then
  // Pre-fetch photos list in background for slideshow; back off if backend is warming up,
  // refresh occasionally to pick up newly added photos.
  useEffect(() => {
    let alive = true
    let attempt = 0
    let timer: ReturnType<typeof setTimeout>

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(load, ms)
    }

    async function load() {
      try {
        const res = await fetch('/api/photos')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        if (!alive) return
        if (!Array.isArray(data) || data.length === 0) throw new Error('empty photo list')
        setPhotosList(data)
        attempt = 0
        schedule(30 * 60 * 1000)
      } catch (err) {
        if (!alive) return
        attempt++
        console.error('Photo list fetch failed (retrying):', err)
        schedule(Math.min(60_000, 2_000 * 2 ** Math.min(attempt, 5)))
      }
    }

    load()
    return () => {
      alive = false
      clearTimeout(timer)
    }
  }, [])

  // 1-Hour and 10-Minute Scheduled Event/Task Reminders
  useEffect(() => {
    const checkReminders = async () => {
      try {
        const today = new Date()
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
        const endStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate() + 1).padStart(2, '0')}`

        const events = await api.get<any[]>(`/api/calendar/events?start=${todayStr}T00:00:00&end=${endStr}T23:59:59`).catch(() => [])
        const nowMs = Date.now()

        for (const ev of events || []) {
          if (ev.all_day) continue
          const startMs = new Date(ev.start).getTime()
          const diffMin = Math.round((startMs - nowMs) / (60 * 1000))

          // 1 Hour threshold (58m - 62m)
          if (diffMin >= 58 && diffMin <= 62) {
            const key = `ev_${ev.id}_60m`
            if (!alertedSetRef.current.has(key)) {
              alertedSetRef.current.add(key)
              triggerReminderAlert({
                title: ev.title,
                timeStr: new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                minutesLeft: 60,
                personName: ev.person_name,
                personColor: ev.color,
                type: 'event',
              })
            }
          }

          // 10 Minute threshold (8m - 12m)
          if (diffMin >= 8 && diffMin <= 12) {
            const key = `ev_${ev.id}_10m`
            if (!alertedSetRef.current.has(key)) {
              alertedSetRef.current.add(key)
              triggerReminderAlert({
                title: ev.title,
                timeStr: new Date(ev.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
                minutesLeft: 10,
                personName: ev.person_name,
                personColor: ev.color,
                type: 'event',
              })
            }
          }
        }
      } catch (e) {
        console.warn('[Reminders] Error checking reminders:', e)
      }
    }

    function triggerReminderAlert(payload: ReminderPayload) {
      playChime('reminder')
      window.dispatchEvent(new CustomEvent('trigger-calendar-overlay', { detail: { reminder: payload } }))
    }

    const interval = setInterval(checkReminders, 30 * 1000)
    checkReminders()
    return () => clearInterval(interval)
  }, [])

  const lastMotionTimeRef = useRef<number>(Date.now())
  const wasQuietHoursRef = useRef<boolean>(false)
  const [isScreenOff, setIsScreenOff] = useState<boolean>(false)

  // Screensaver + kiosk return to home + Fully Kiosk screen-off & motion wake logic
  useEffect(() => {
    const SLIDESHOW_TRIGGER_MS = 3 * 60 * 1000 // 3 minutes of inactivity to start slideshow
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000 // 2 hours threshold for wake destination

    const getNoMotionTimeoutMs = () => {
      const mins = configRef.current?.kiosk_daytime_screen_off_mins ?? 15
      return Math.max(1, mins) * 60 * 1000
    }

    let slideshowTimer = setTimeout(startSlideshow, SLIDESHOW_TRIGGER_MS)
    let screenOffTimer = setTimeout(turnScreenOff, getNoMotionTimeoutMs())

    function turnScreenOff() {
      setIsScreenOff(true)
      if (typeof (window as any).fully !== 'undefined' && (window as any).fully.turnScreenOff) {
        try {
          ;(window as any).fully.turnScreenOff()
        } catch (e) {
          console.warn('[Fully Kiosk] turnScreenOff error:', e)
        }
      }
    }

    function turnScreenOn() {
      setIsScreenOff(false)
      if (typeof (window as any).fully !== 'undefined' && (window as any).fully.turnScreenOn) {
        try {
          ;(window as any).fully.turnScreenOn()
        } catch (e) {
          console.warn('[Fully Kiosk] turnScreenOn error:', e)
        }
      }
    }

    function startSlideshow() {
      setSlideshowActive(true)
      if (currentRoute() !== 'home') location.hash = '#/home'
    }

    function reset() {
      lastMotionTimeRef.current = Date.now()
      turnScreenOn()
      clearTimeout(screenOffTimer)
      screenOffTimer = setTimeout(turnScreenOff, getNoMotionTimeoutMs())

      clearTimeout(slideshowTimer)
      slideshowTimer = setTimeout(startSlideshow, SLIDESHOW_TRIGGER_MS)
    }

    function handleKioskMotion() {
      const cfg = configRef.current
      const inQuiet =
        cfg?.kiosk_sleep_enabled !== false &&
        isWithinQuietHours(new Date(), cfg?.kiosk_sleep_start ?? '22:00', cfg?.kiosk_sleep_end ?? '06:00')

      // Quiet hours motion suppression: ignore ambient camera motion / shadows at night
      if (inQuiet && (cfg?.kiosk_suppress_night_motion ?? true)) {
        return
      }

      const nowMs = Date.now()
      const elapsedMs = nowMs - lastMotionTimeRef.current

      // Turn screen back on via Fully Kiosk if off
      turnScreenOn()

      // Reset the daytime screen off timer whenever motion is detected
      clearTimeout(screenOffTimer)
      screenOffTimer = setTimeout(turnScreenOff, getNoMotionTimeoutMs())

      // If the user is actively interacting with the app (slideshow is NOT active),
      // DO NOT let camera motion interrupt their search, typing, or view with the slideshow!
      if (!slideshowActiveRef.current) {
        return
      }

      // Waking up from an active screensaver:
      // Over 2 hours of inactivity -> Home Page
      // Under 2 hours of inactivity -> Keep Photos Slideshow active
      lastMotionTimeRef.current = nowMs
      if (elapsedMs > TWO_HOURS_MS) {
        setSlideshowActive(false)
        if (currentRoute() !== 'home') location.hash = '#/home'
      } else {
        setSlideshowActive(true)
      }
    }

    // Schedule check ticker for automatic quiet hours transitions (runs every 15 seconds)
    const checkSchedule = () => {
      const cfg = configRef.current
      if (cfg?.kiosk_sleep_enabled === false) return
      const inQuiet = isWithinQuietHours(
        new Date(),
        cfg?.kiosk_sleep_start ?? '22:00',
        cfg?.kiosk_sleep_end ?? '06:00',
      )

      if (inQuiet && !wasQuietHoursRef.current) {
        wasQuietHoursRef.current = true
        turnScreenOff()
      } else if (!inQuiet && wasQuietHoursRef.current) {
        wasQuietHoursRef.current = false
        turnScreenOn()
        setSlideshowActive(false)
        if (currentRoute() !== 'home') location.hash = '#/home'
      }
    }

    const scheduleInterval = setInterval(checkSchedule, 15000)
    checkSchedule()

    for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
      window.addEventListener(ev, reset, { passive: true })
    }

    for (const ev of ['fully-motion', 'fully-screen-on', 'fully-proximity']) {
      window.addEventListener(ev, handleKioskMotion)
    }

    // Automatically bind to Fully Kiosk JavaScript Interface if present
    if (typeof (window as any).fully !== 'undefined') {
      try {
        ;(window as any).fully.bind('onMotion', 'window.dispatchEvent(new Event("fully-motion"))')
        ;(window as any).fully.bind('onScreenOn', 'window.dispatchEvent(new Event("fully-screen-on"))')
        ;(window as any).fully.bind('onProximity', 'window.dispatchEvent(new Event("fully-proximity"))')
      } catch (e) {
        console.warn('[Fully Kiosk] JS binding notice:', e)
      }
    }

    return () => {
      clearInterval(scheduleInterval)
      clearTimeout(slideshowTimer)
      clearTimeout(screenOffTimer)
      for (const ev of ['pointerdown', 'touchstart', 'keydown']) {
        window.removeEventListener(ev, reset)
      }
      for (const ev of ['fully-motion', 'fully-screen-on', 'fully-proximity']) {
        window.removeEventListener(ev, handleKioskMotion)
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
    setTouchStart(null)
    setTouchEnd(null)
    setIsPulling(false)
  }



  return (
    <CelebrationProvider>
      <RewardCelebrationProvider>
        {/* While the screensaver covers the screen, stop painting the dashboard
            underneath it. `visibility: hidden` keeps the tree mounted (so
            FullCalendar keeps its measured layout) but skips paint and
            compositing for the whole app — the slideshow gets the GPU. */}
        <div
          className="flex h-full flex-col lg:flex-row gap-2 p-2 lg:gap-4 lg:p-4"
          ref={dashboardRef}
          style={slideshowActive ? { visibility: 'hidden' } : undefined}
        >
          <nav className="glass group/nav order-last lg:order-first flex flex-row lg:flex-col w-full lg:w-16 hover:lg:w-48 transition-[width] duration-300 ease-in-out h-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:h-full shrink-0 items-center lg:items-start justify-around lg:justify-start gap-1 lg:gap-4 py-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom,0px))] lg:py-4 px-2 lg:px-2 z-20">

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
            className={`flex min-w-0 flex-1 flex-col overflow-y-auto relative py-1 lg:py-0 ${
              route !== 'ytmusic' && currentTrack ? 'pb-32 sm:pb-36 lg:pb-0' : 'pb-16 lg:pb-0'
            }`}
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
            <AnimatePresence mode="wait">
              <motion.div
                key={route}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={EXPRESSIVE_ENTER}
                className="flex flex-1 flex-col min-h-0"
              >
                <Suspense
                  fallback={
                    <div className="flex flex-1 items-center justify-center p-12 text-ink-soft">
                      <Icon name="progress_activity" className="animate-spin text-3xl" />
                    </div>
                  }
                >
                  <View
                    now={now}
                    config={config}
                    onStartSlideshow={() => setSlideshowActive(true)}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    queue={playQueue}
                    elapsedSeconds={elapsedSeconds}
                    durationSeconds={durationSeconds}
                    onPlayTrack={handlePlayTrack}
                    onTogglePlay={handleTogglePlay}
                    onNextTrack={handleNextTrack}
                    onPrevTrack={handlePrevTrack}
                    onSeek={handleSeek}
                    onQueueTrack={handleQueueTrack}
                    onQueueChange={handleQueueChange}
                  />
                </Suspense>
              </motion.div>
            </AnimatePresence>
          </main>

          {/* Floating Dock: Themed FAB + MiniPlayerBar */}
          <div className="fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom,0px)+8px)] right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end sm:flex-row sm:items-end gap-3 pointer-events-none">
            <FloatingActionButton
              route={route}
              hasPlayer={Boolean(currentTrack)}
              className="pointer-events-auto shrink-0"
            />
            {route !== 'ytmusic' && currentTrack && (
              <MiniPlayerBar
                docked
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                elapsedSeconds={elapsedSeconds}
                durationSeconds={durationSeconds}
                onTogglePlay={handleTogglePlay}
                onNextTrack={handleNextTrack}
                onPrevTrack={handlePrevTrack}
                onSeek={handleSeek}
                onOpenFullPlayer={() => { window.location.hash = '#/ytmusic' }}
                onClose={handleStopPlayer}
                className="pointer-events-auto shrink-0"
              />
            )}
          </div>
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
        {slideshowActive && photosList.length > 0 && !isScreenOff && (
          <Slideshow
            photos={photosList}
            onDismiss={() => setSlideshowActive(false)}
            currentTrack={currentTrack}
            queue={playQueue}
            isPlaying={isPlaying}
            elapsedSeconds={elapsedSeconds}
            durationSeconds={durationSeconds}
            onTogglePlay={handleTogglePlay}
            onNextTrack={handleNextTrack}
            onPrevTrack={handlePrevTrack}
            onSeek={handleSeek}
            onOpenFullPlayer={() => {
              setSlideshowActive(false)
              window.location.hash = '#/ytmusic'
            }}
          />
        )}
        <GlobalTooltip />
      </RewardCelebrationProvider>
    </CelebrationProvider>
  )
}
