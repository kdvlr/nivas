import React from 'react'
import Icon from './Icon'
import { useTimer } from '../context/TimerContext'
import { formatTimerDisplay } from '../lib/timer'

interface TopClockHeaderProps {
  now: Date
  config?: any
  route?: string
  className?: string
}

export function getTzDateString(d: Date, tzName: string): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tzName,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    return formatter.format(d)
  } catch (e) {
    return ''
  }
}

export default function TopClockHeader({ now, config, className = '' }: TopClockHeaderProps) {
  let timerCtx: ReturnType<typeof useTimer> | null = null
  try {
    timerCtx = useTimer()
  } catch {
    // Graceful fallback if rendered outside provider
  }

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
        month: 'short',
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

  const handleClockClick = () => {
    if (timerCtx) {
      timerCtx.openCreateModal()
    } else {
      window.dispatchEvent(new CustomEvent('open-create-timer'))
    }
  }

  const activeTimer = timerCtx?.timer

  return (
    <div className={`flex flex-col items-end text-right shrink-0 ${className}`}>
      <button
        type="button"
        onClick={handleClockClick}
        title="Click to set a timer"
        className="group/clock flex items-center justify-end gap-2 cursor-pointer select-none transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] outline-none text-right"
      >
        {activeTimer && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--primary)]/10 text-[var(--primary)] animate-pulse">
            <Icon name="timer" className="text-sm" />
            <span>{formatTimerDisplay(activeTimer.remainingSeconds).formatted}</span>
          </span>
        )}
        <div className="text-4xl sm:text-5xl lg:text-5xl font-bold tabular-nums tracking-tight text-[var(--primary)] leading-none group-hover/clock:opacity-90">
          {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
        </div>
      </button>

      <div className="mt-1 flex items-center gap-2 text-sm lg:text-base font-semibold text-ink-soft">
        <span>{now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="opacity-40">•</span>
        <span>
          {secondaryEmoji} {secondaryTimeFormatted}
          {hasDateDiff && secondaryDateFormatted && (
            <span className="ml-1 text-xs opacity-80">({secondaryDateFormatted})</span>
          )}
        </span>
      </div>
    </div>
  )
}
