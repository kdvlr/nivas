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
    // iTunes / Apple Music style double note icon
    return (
      <span
        title="Local Lossless Audio (iTunes)"
        aria-label="Local Audio"
        className={`inline-flex items-center justify-center shrink-0 align-middle ${className}`}
        style={{ width: size, height: size }}
      >
        <svg
          viewBox="0 0 24 24"
          width={size}
          height={size}
          className="text-pink-500 dark:text-pink-400 drop-shadow-sm"
          fill="currentColor"
        >
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </span>
    )
  }

  // YouTube Music red badge with play triangle
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
        className="text-red-600 dark:text-red-500 drop-shadow-sm"
        fill="currentColor"
      >
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
        <polygon points="10,8 16,12 10,16" fill="white" />
      </svg>
    </span>
  )
}
