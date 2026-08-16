import React from 'react'

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

  return (
    <div className={`flex flex-col items-end text-right shrink-0 ${className}`}>
      <div className="text-4xl lg:text-5xl font-semibold tabular-nums tracking-tight text-[var(--primary)] leading-none">
        {now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
      </div>
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
