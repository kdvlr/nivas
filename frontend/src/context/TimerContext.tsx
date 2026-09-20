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

export interface ActiveTimer {
  id: string
  label: string
  totalSeconds: number
  remainingSeconds: number
  status: 'running' | 'paused' | 'ringing'
  endTimestamp: number
  stage: TimerStage
}

interface StoredTimer {
  id: string
  label: string
  totalSeconds: number
  status: 'running' | 'paused' | 'ringing'
  endTimestamp: number
  remainingSeconds: number
  savedAt: number
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
  startTimer: (totalSeconds: number, label?: string) => void
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

  const startTimer = useCallback((totalSeconds: number, label = 'Timer') => {
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
    })
    setIsCreateModalOpen(false)
    setIsFullScreen(true)
  }, [])

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
  }, [])

  const dismissAlarm = useCallback(() => {
    stopAlarmSound()
    setTimer(null)
    setIsFullScreen(false)
    localStorage.removeItem(STORAGE_KEY)
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
