import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getTimerStage, type TimerStage } from '../lib/timer'
import { startAlarmSound, stopAlarmSound } from '../lib/useAudioChime'
import { api } from '../lib/api'
import { onWsMessage } from '../lib/ws'

export interface ActiveTimer {
  id: string
  label: string
  totalSeconds: number
  remainingSeconds: number
  status: 'running' | 'paused' | 'ringing'
  endTimestamp: number
  stage: TimerStage
  source?: 'school_schedule' | 'manual'
}

interface StoredTimer {
  id: string
  label: string
  totalSeconds: number
  status: 'running' | 'paused' | 'ringing'
  endTimestamp: number
  remainingSeconds: number
  savedAt: number
  source?: 'school_schedule' | 'manual'
}

export interface TimerContextValue {
  timer: ActiveTimer | null
  isCreateModalOpen: boolean
  isFullScreen: boolean
  isTimerActive: boolean
  openCreateModal: () => void
  closeCreateModal: () => void
  openFullScreen: () => void
  closeFullScreen: () => void
  startTimer: (totalSeconds: number, label?: string, source?: 'school_schedule' | 'manual') => void
  pauseTimer: () => void
  resumeTimer: () => void
  resetTimer: () => void
  addSeconds: (seconds: number) => void
  cancelTimer: () => void
  dismissAlarm: () => void
}

const STORAGE_KEY = 'nivas_active_timer_v1'

const TimerContext = createContext<TimerContextValue | null>(null)

export function useTimer(): TimerContextValue {
  const ctx = useContext(TimerContext)
  if (!ctx) {
    throw new Error('useTimer must be used within a TimerProvider')
  }
  return ctx
}

export function TimerProvider({ children }: { children: ReactNode }) {
  const [timer, setTimer] = useState<ActiveTimer | null>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return null
      const stored: StoredTimer = JSON.parse(raw)
      const now = Date.now()

      if (stored.status === 'paused') {
        return {
          id: stored.id,
          label: stored.label,
          totalSeconds: stored.totalSeconds,
          remainingSeconds: stored.remainingSeconds,
          status: 'paused',
          endTimestamp: stored.endTimestamp,
          stage: getTimerStage(stored.remainingSeconds),
        }
      }

      if (stored.status === 'running') {
        const remaining = Math.max(0, Math.ceil((stored.endTimestamp - now) / 1000))
        if (remaining > 0) {
          return {
            id: stored.id,
            label: stored.label,
            totalSeconds: stored.totalSeconds,
            remainingSeconds: remaining,
            status: 'running',
            endTimestamp: stored.endTimestamp,
            stage: getTimerStage(remaining),
          }
        }
        // If it ended less than 2 minutes ago, restore as ringing
        if (now - stored.endTimestamp < 120_000) {
          return {
            id: stored.id,
            label: stored.label,
            totalSeconds: stored.totalSeconds,
            remainingSeconds: 0,
            status: 'ringing',
            endTimestamp: stored.endTimestamp,
            stage: 'flashing-red',
          }
        }
      }
      return null
    } catch {
      return null
    }
  })

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(() => Boolean(timer))
  const timerRef = useRef<ActiveTimer | null>(timer)
  timerRef.current = timer

  // Keep localStorage synchronized
  useEffect(() => {
    if (!timer) {
      localStorage.removeItem(STORAGE_KEY)
      return
    }
    const payload: StoredTimer = {
      id: timer.id,
      label: timer.label,
      totalSeconds: timer.totalSeconds,
      status: timer.status,
      endTimestamp: timer.endTimestamp,
      remainingSeconds: timer.remainingSeconds,
      savedAt: Date.now(),
      source: timer.source,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
  }, [timer])

  // Handle active ringing alarm sounds
  useEffect(() => {
    if (timer?.status === 'ringing') {
      startAlarmSound()
    } else {
      stopAlarmSound()
    }
    return () => {
      stopAlarmSound()
    }
  }, [timer?.status])

  // Ticker loop for running timers
  useEffect(() => {
    if (!timer || timer.status !== 'running') return

    const interval = setInterval(() => {
      const current = timerRef.current
      if (!current || current.status !== 'running') return

      const now = Date.now()
      const remaining = Math.max(0, Math.ceil((current.endTimestamp - now) / 1000))
      const stage = getTimerStage(remaining)

      if (remaining <= 0) {
        setTimer({
          ...current,
          remainingSeconds: 0,
          status: 'ringing',
          stage: 'flashing-red',
        })
        setIsFullScreen(true)
      } else {
        setTimer((prev) => {
          if (!prev || prev.status !== 'running') return prev
          return {
            ...prev,
            remainingSeconds: remaining,
            stage,
          }
        })
      }
    }, 250)

    return () => clearInterval(interval)
  }, [timer?.status, timer?.endTimestamp])

  const applyServerTimer = useCallback((serverTimer: any) => {
    if (!serverTimer) {
      setTimer((prev) => {
        if (prev?.source === 'school_schedule') {
          stopAlarmSound()
          setIsFullScreen(false)
          localStorage.removeItem(STORAGE_KEY)
          return null
        }
        return prev
      })
      return
    }

    const now = Date.now()
    const endTimestamp = serverTimer.endTimestamp || now + (serverTimer.remainingSeconds || 0) * 1000
    let remaining = serverTimer.remainingSeconds ?? Math.max(0, Math.ceil((endTimestamp - now) / 1000))
    let status: 'running' | 'paused' | 'ringing' = serverTimer.status || 'running'

    if (status === 'running') {
      remaining = Math.max(0, Math.ceil((endTimestamp - now) / 1000))
      if (remaining <= 0) {
        status = 'ringing'
      }
    }

    const stage = getTimerStage(remaining)

    setTimer({
      id: serverTimer.id,
      label: serverTimer.label || 'Timer',
      totalSeconds: serverTimer.totalSeconds,
      remainingSeconds: remaining,
      status,
      endTimestamp,
      stage,
      source: serverTimer.source || 'manual',
    })

    if (status === 'running' || status === 'ringing') {
      setIsFullScreen(true)
    }
  }, [])

  // Sync with backend timer API and WebSocket broadcasts
  useEffect(() => {
    api
      .get<{ active: boolean; timer?: any }>('/api/timer/state')
      .then((res) => {
        if (res?.active && res.timer) {
          applyServerTimer(res.timer)
        }
      })
      .catch(() => {})

    const unsub = onWsMessage((msg) => {
      if (msg.type === 'timer_sync') {
        applyServerTimer(msg.timer)
      }
    })

    return () => unsub()
  }, [applyServerTimer])

  const openCreateModal = useCallback(() => {
    setIsCreateModalOpen(true)
  }, [])

  const closeCreateModal = useCallback(() => {
    setIsCreateModalOpen(false)
  }, [])

  const openFullScreen = useCallback(() => {
    setIsFullScreen(true)
  }, [])

  const closeFullScreen = useCallback(() => {
    setIsFullScreen(false)
  }, [])

  const startTimer = useCallback(
    (totalSeconds: number, label = 'Timer', source: 'school_schedule' | 'manual' = 'manual') => {
      const safeTotal = Math.max(1, Math.floor(totalSeconds))
      const now = Date.now()
      const endTimestamp = now + safeTotal * 1000
      const stage = getTimerStage(safeTotal)

      stopAlarmSound()
      setTimer({
        id: `timer_${now}`,
        label,
        totalSeconds: safeTotal,
        remainingSeconds: safeTotal,
        status: 'running',
        endTimestamp,
        stage,
        source,
      })
      setIsCreateModalOpen(false)
      setIsFullScreen(true)
      api.post('/api/timer/start', { total_seconds: safeTotal, label, source }).catch(() => {})
    },
    []
  )

  const pauseTimer = useCallback(() => {
    const current = timerRef.current
    if (!current || current.status !== 'running') return

    const remaining = Math.max(0, Math.ceil((current.endTimestamp - Date.now()) / 1000))
    setTimer({
      ...current,
      remainingSeconds: remaining,
      status: 'paused',
      stage: getTimerStage(remaining),
    })
    api.post('/api/timer/pause').catch(() => {})
  }, [])

  const resumeTimer = useCallback(() => {
    const current = timerRef.current
    if (!current || current.status !== 'paused') return

    const now = Date.now()
    const endTimestamp = now + current.remainingSeconds * 1000
    setTimer({
      ...current,
      status: 'running',
      endTimestamp,
      stage: getTimerStage(current.remainingSeconds),
    })
    api.post('/api/timer/resume').catch(() => {})
  }, [])

  const resetTimer = useCallback(() => {
    const current = timerRef.current
    if (!current) return

    stopAlarmSound()
    const now = Date.now()
    const endTimestamp = now + current.totalSeconds * 1000
    setTimer({
      ...current,
      remainingSeconds: current.totalSeconds,
      status: 'running',
      endTimestamp,
      stage: getTimerStage(current.totalSeconds),
    })
    api
      .post('/api/timer/start', {
        total_seconds: current.totalSeconds,
        label: current.label,
        source: current.source || 'manual',
      })
      .catch(() => {})
  }, [])

  const addSeconds = useCallback((extraSeconds: number) => {
    const current = timerRef.current
    if (!current) return

    const MAX_ALLOWED = 23 * 3600 + 59 * 60 // 23:59:00 max
    const newRemaining = Math.min(MAX_ALLOWED, current.remainingSeconds + extraSeconds)
    const newTotal = Math.min(MAX_ALLOWED, current.totalSeconds + extraSeconds)
    const now = Date.now()
    const endTimestamp = current.status === 'running' ? now + newRemaining * 1000 : current.endTimestamp

    setTimer({
      ...current,
      totalSeconds: newTotal,
      remainingSeconds: newRemaining,
      endTimestamp,
      stage: getTimerStage(newRemaining),
    })
  }, [])

  const cancelTimer = useCallback(() => {
    stopAlarmSound()
    setTimer(null)
    setIsFullScreen(false)
    localStorage.removeItem(STORAGE_KEY)
    api.post('/api/timer/cancel').catch(() => {})
  }, [])

  const dismissAlarm = useCallback(() => {
    stopAlarmSound()
    setTimer(null)
    setIsFullScreen(false)
    localStorage.removeItem(STORAGE_KEY)
    api.post('/api/timer/dismiss').catch(() => {})
  }, [])

  // Listen to window event 'open-create-timer'
  useEffect(() => {
    const handler = () => {
      setIsCreateModalOpen(true)
    }
    window.addEventListener('open-create-timer', handler)
    return () => window.removeEventListener('open-create-timer', handler)
  }, [])

  const isTimerActive = Boolean(timer && (timer.status === 'running' || timer.status === 'paused' || timer.status === 'ringing'))

  const value: TimerContextValue = {
    timer,
    isCreateModalOpen,
    isFullScreen,
    isTimerActive,
    openCreateModal,
    closeCreateModal,
    openFullScreen,
    closeFullScreen,
    startTimer,
    pauseTimer,
    resumeTimer,
    resetTimer,
    addSeconds,
    cancelTimer,
    dismissAlarm,
  }

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}
