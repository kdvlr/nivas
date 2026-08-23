import React from 'react'

interface MusicSourceIconProps {
  source?: 'local' | 'youtube' | string
  size?: number
  className?: string
}

export default function MusicSourceIcon({
  source = 'youtube',
  size = 14,
  className = '',
}: MusicSourceIconProps) {
  const isLocal = source === 'local'

  if (isLocal) {
    // Apple Music / iTunes iconic gradient circle badge with white double-beamed notes
    return (
      <span
        title="Local Audio (iTunes / Media)"
        aria-label="Local Audio (iTunes)"
        className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className="drop-shadow-sm shrink-0"
          fill="none"
        >
          <circle cx="12" cy="12" r="11" fill="url(#itunes-badge-gradient)" />
          <path
            d="M16.5 6.2v8.5a2.6 2.6 0 0 1-2.1-.4 2.6 2.6 0 0 1-1.2-2.1c0-1.4 1.1-2.6 2.6-2.6.3 0 .5 0 .7.1V7.5l-5.8 1.3v7.4a2.6 2.6 0 0 1-2.1-.4 2.6 2.6 0 0 1-1.2-2.1c0-1.4 1.1-2.6 2.6-2.6.3 0 .5 0 .7.1v-5.6l6.4-1.4z"
            fill="white"
          />
          <defs>
            <linearGradient id="itunes-badge-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
              <stop stopColor="#FA2D48" />
              <stop offset="0.5" stopColor="#D2249E" />
              <stop offset="1" stopColor="#6C5CE7" />
            </linearGradient>
          </defs>
        </svg>
      </span>
    )
  }

  // YouTube Music red circular badge with white play icon
  return (
    <span
      title="YouTube Music"
      aria-label="YouTube Music"
      className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className="drop-shadow-sm shrink-0"
        fill="none"
      >
        <circle cx="12" cy="12" r="11" fill="#FF0000" />
        <circle cx="12" cy="12" r="6.2" stroke="white" strokeWidth="1.2" opacity="0.6" />
        <polygon points="10.2,8.5 15.5,12 10.2,15.5" fill="white" />
      </svg>
    </span>
  )
}
