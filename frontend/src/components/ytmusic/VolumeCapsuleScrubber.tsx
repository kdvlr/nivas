import React, { useRef, useState, useCallback } from 'react'
import Icon from '../Icon'

interface VolumeCapsuleScrubberProps {
  value: number
  onChange: (value: number) => void
  label: string
  icon?: string
  disabled?: boolean
  className?: string
}

export default function VolumeCapsuleScrubber({
  value,
  onChange,
  label,
  icon = 'volume_up',
  disabled = false,
  className = '',
}: VolumeCapsuleScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const previousVolumeRef = useRef(value > 0 ? value : 50)
  const [isPressing, setIsPressing] = useState(false)

  const computeVolumeFromPointer = useCallback((clientX: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width <= 0) return
    const fraction = (clientX - rect.left) / rect.width
    const clamped = Math.max(0, Math.min(100, Math.round(fraction * 100)))
    onChange(clamped)
  }, [onChange])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    isDraggingRef.current = true
    setIsPressing(true)
    computeVolumeFromPointer(event.clientX)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return
    computeVolumeFromPointer(event.clientX)
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    isDraggingRef.current = false
    setIsPressing(false)
  }

  const toggleMute = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (disabled) return
    if (value > 0) {
      previousVolumeRef.current = value
      onChange(0)
    } else {
      onChange(previousVolumeRef.current || 50)
    }
  }

  const volumeIcon = value === 0 ? 'volume_off' : value < 50 ? 'volume_down' : icon

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className={`relative flex h-11 select-none items-center overflow-hidden rounded-xl border border-[var(--outline-var)] bg-[var(--sc)] transition-transform duration-100 ${
        isPressing ? 'scale-[0.99] border-[var(--primary)]' : ''
      } ${disabled ? 'opacity-40 pointer-events-none' : 'cursor-ew-resize'} ${className}`}
    >
      {/* Fill Bar */}
      <div
        className="absolute inset-y-0 left-0 bg-[var(--primary)]/20 dark:bg-[var(--primary)]/35 transition-all duration-75 ease-out"
        style={{ width: `${value}%` }}
      />

      {/* Label and Controls */}
      <div className="relative z-10 flex w-full items-center justify-between gap-2 px-3 text-ink">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
            title={value === 0 ? 'Unmute' : 'Mute'}
          >
            <Icon name={volumeIcon} className="text-base" />
          </button>
          <span className="truncate text-[0.92rem] font-medium text-ink">{label}</span>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">{value}%</span>
      </div>
    </div>
  )
}
