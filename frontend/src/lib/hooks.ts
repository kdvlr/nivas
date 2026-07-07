import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { onRefresh } from './ws'

/** Fetch JSON from `path`, refetch on WS refresh for any of `scopes` and every `pollMs`. */
export function useData<T>(path: string, scopes: string[], pollMs = 120000) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const pathRef = useRef(path)
  pathRef.current = path

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api.get<T>(pathRef.current))
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload, path])

  const scopeKey = scopes.sort().join(',')
  useEffect(() => {
    const un = onRefresh(scopes, reload)
    const timer = setInterval(reload, pollMs)
    return () => {
      un()
      clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reload, scopeKey, pollMs])

  return { data, error, loading, reload }
}

/**
 * Hands-free voice commands via the Web Speech API (Chrome/Android WebView).
 * While `active`, listens continuously and fires onCommand for spoken
 * "next" / "previous" (or "back") / "exit" (or "stop"). Returns whether the
 * mic is actually listening (false when unsupported or permission denied).
 */
export function useVoiceCommands(
  active: boolean,
  onCommand: (cmd: 'next' | 'previous' | 'exit') => void,
) {
  const cbRef = useRef(onCommand)
  cbRef.current = onCommand
  const [listening, setListening] = useState(false)

  useEffect(() => {
    if (!active) return
    const SR =
      (window as unknown as Record<string, unknown>).SpeechRecognition ??
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition
    if (typeof SR !== 'function') return

    let stopped = false
    let fatal = false
    const recRef = { current: null as any }
    let restartTimer: ReturnType<typeof setTimeout> | null = null

    const start = () => {
      if (stopped || fatal) return
      
      if (recRef.current) {
        try { recRef.current.onstart = recRef.current.onend = recRef.current.onerror = recRef.current.onresult = null; recRef.current.stop(); } catch(e) {}
      }

      const r: any = new (SR as any)()
      recRef.current = r
      r.continuous = false // One-shot is more reliable than continuous
      r.interimResults = false
      r.lang = 'en-US'

      r.onresult = (e: any) => {
        const text = e.results[0][0].transcript.toLowerCase()
        if (/\b(next|forward|continue)\b/.test(text)) cbRef.current('next')
        else if (/\b(previous|back|backward|before)\b/.test(text)) cbRef.current('previous')
        else if (/\b(exit|close|stop|done|quit)\b/.test(text)) cbRef.current('exit')
        // The r.onend will trigger the restart
      }

      r.onstart = () => setListening(true)
      
      r.onerror = (e: any) => {
        if (e.error === 'not-allowed' || e.error === 'service-not-allowed') fatal = true
        if (e.error === 'aborted' || e.error === 'no-speech') return
      }

      r.onend = () => {
        setListening(false)
        if (!stopped && !fatal) {
          if (restartTimer) clearTimeout(restartTimer)
          restartTimer = setTimeout(start, 300)
        }
      }

      try {
        r.start()
      } catch (e) {
        if (!stopped && !fatal) {
          if (restartTimer) clearTimeout(restartTimer)
          restartTimer = setTimeout(start, 1000)
        }
      }
    }

    start()
    return () => {
      stopped = true
      if (restartTimer) clearTimeout(restartTimer)
      if (recRef.current) {
        try {
          recRef.current.onstart = recRef.current.onend = recRef.current.onerror = recRef.current.onresult = null
          recRef.current.stop()
        } catch (e) {}
      }
      setListening(false)
    }
  }, [active])

  return listening
}

export function useClock(intervalMs = 1000) {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

export const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })

export const todayISO = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const addDaysISO = (iso: string, days: number) => {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
