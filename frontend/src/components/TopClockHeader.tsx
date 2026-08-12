import React from 'react'

interface TopClockHeaderProps {
  now: Date
  config?: any
  route?: string
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

export default function TopClockHeader({ now, config, route }: TopClockHeaderProps) {
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
            {secondaryEmoji} {secondaryTimeFormatted}
            {hasDateDiff && secondaryDateFormatted && (
              <span className={`ml-1 opacity-80 ${route === 'setup' ? 'text-xs' : 'text-sm'}`}>
                ({secondaryDateFormatted})
              </span>
            )}
          </span>
        </div>
      </div>
    </header>
  )
}
