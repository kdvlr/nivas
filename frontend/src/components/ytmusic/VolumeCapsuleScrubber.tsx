import React, { useRef, useState, useCallback } from 'react'
import Icon from '../Icon'

interface VolumeCapsuleScrubberProps {
  value: number
  onChange: (value: number) => void
  onChangeEnd?: (value: number) => void
  label: string
  icon?: string
  disabled?: boolean
  className?: string
}

export default function VolumeCapsuleScrubber({
  value,
  onChange,
  onChangeEnd,
  label,
  icon = 'volume_up',
  disabled = false,
  className = '',
}: VolumeCapsuleScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const rectRef = useRef<{ left: number; width: number } | null>(null)
  const dragValueRef = useRef(value)
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState(value)
  const previousVolumeRef = useRef(value > 0 ? value : 50)

  // Keep internal state in sync with external prop changes when NOT actively dragging
  if (!isDraggingRef.current && dragValueRef.current !== value) {
    dragValueRef.current = value
    setDragValue(value)
  }

  const computeVolumeFromPointer = useCallback((clientX: number) => {
    if (!rectRef.current || rectRef.current.width <= 0) return dragValueRef.current
    const { left, width } = rectRef.current
    const fraction = (clientX - left) / width
    return Math.max(0, Math.min(100, Math.round(fraction * 100)))
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    rectRef.current = { left: rect.left, width: rect.width }
    isDraggingRef.current = true
    setIsDragging(true)

    const nextValue = computeVolumeFromPointer(event.clientX)
    dragValueRef.current = nextValue
    setDragValue(nextValue)
    onChange(nextValue)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || disabled) return
    const nextValue = computeVolumeFromPointer(event.clientX)
    if (nextValue !== dragValueRef.current) {
      dragValueRef.current = nextValue
      setDragValue(nextValue)
      onChange(nextValue)
    }
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    setIsDragging(false)
    rectRef.current = null
    const finalValue = dragValueRef.current
    onChangeEnd?.(finalValue)
  }

  const displayValue = isDragging ? dragValue : value

  const toggleMute = (event: React.MouseEvent) => {
    event.stopPropagation()
    if (disabled) return
    if (displayValue > 0) {
      previousVolumeRef.current = displayValue
      dragValueRef.current = 0
      setDragValue(0)
      onChange(0)
      onChangeEnd?.(0)
    } else {
      const restored = previousVolumeRef.current || 50
      dragValueRef.current = restored
      setDragValue(restored)
      onChange(restored)
      onChangeEnd?.(restored)
    }
  }

  const volumeIcon = displayValue === 0 ? 'volume_off' : displayValue < 50 ? 'volume_down' : icon

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className={`relative flex h-11 select-none items-center overflow-hidden rounded-xl border border-[var(--outline-var)] bg-[var(--sc)] transition-transform duration-100 ${
        isDragging ? 'scale-[0.99] border-[var(--primary)]' : ''
      } ${disabled ? 'opacity-40 pointer-events-none' : 'cursor-ew-resize'} ${className}`}
    >
      {/* Fill Bar */}
      <div
        className={`absolute inset-y-0 left-0 bg-[var(--primary)]/20 dark:bg-[var(--primary)]/35 ${
          isDragging ? 'transition-none' : 'transition-all duration-150 ease-out'
        }`}
        style={{ width: `${displayValue}%` }}
      />

      {/* Label and Controls */}
      <div className="relative z-10 flex w-full items-center justify-between gap-2 px-3 text-ink">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
            title={displayValue === 0 ? 'Unmute' : 'Mute'}
          >
            <Icon name={volumeIcon} className="text-base" />
          </button>
          <span className="truncate text-[0.92rem] font-medium text-ink">{label}</span>
        </div>
        <span className="shrink-0 text-xs font-semibold tabular-nums text-ink-soft">{displayValue}%</span>
      </div>
    </div>
  )
}
