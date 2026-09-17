import React, { useRef, useState } from 'react'
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
  const isPointerDownRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const startXRef = useRef(0)
  const startVolumeRef = useRef(value)
  const rectRef = useRef<{ left: number; width: number } | null>(null)
  const dragValueRef = useRef(value)
  const [isDragging, setIsDragging] = useState(false)
  const [dragValue, setDragValue] = useState(value)
  const previousVolumeRef = useRef(value > 0 ? value : 50)

  // Keep internal state in sync with external prop changes when NOT actively dragging
  if (!isPointerDownRef.current && dragValueRef.current !== value) {
    dragValueRef.current = value
    setDragValue(value)
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return
    event.currentTarget.setPointerCapture(event.pointerId)
    const rect = event.currentTarget.getBoundingClientRect()
    rectRef.current = { left: rect.left, width: rect.width }
    isPointerDownRef.current = true
    hasDraggedRef.current = false
    startXRef.current = event.clientX
    startVolumeRef.current = dragValueRef.current
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current || disabled || !rectRef.current || rectRef.current.width <= 0) return

    const deltaX = event.clientX - startXRef.current
    if (!hasDraggedRef.current) {
      // Require at least 4px of movement to qualify as a drag gesture
      if (Math.abs(deltaX) < 4) return
      hasDraggedRef.current = true
      setIsDragging(true)
    }

    const deltaFraction = deltaX / rectRef.current.width
    const nextValue = Math.max(0, Math.min(100, Math.round(startVolumeRef.current + deltaFraction * 100)))
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
    if (!isPointerDownRef.current) return

    if (hasDraggedRef.current) {
      const finalValue = dragValueRef.current
      onChangeEnd?.(finalValue)
    }

    isPointerDownRef.current = false
    hasDraggedRef.current = false
    setIsDragging(false)
    rectRef.current = null
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let step = 0
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      step = event.shiftKey ? 5 : 2
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      step = event.shiftKey ? -5 : -2
    } else if (event.key === 'Home') {
      step = -dragValueRef.current
    } else if (event.key === 'End') {
      step = 100 - dragValueRef.current
    }
    if (step !== 0) {
      event.preventDefault()
      const nextVal = Math.max(0, Math.min(100, dragValueRef.current + step))
      dragValueRef.current = nextVal
      setDragValue(nextVal)
      onChange(nextVal)
      onChangeEnd?.(nextVal)
    }
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
      role="slider"
      aria-label={`${label} volume`}
      aria-valuenow={displayValue}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={handleKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ touchAction: 'none' }}
      className={`group relative flex h-11 select-none items-center overflow-hidden rounded-xl border border-[var(--outline-var)] bg-[var(--sc)] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] ${
        isDragging ? 'border-[var(--primary)] shadow-sm cursor-grabbing' : 'hover:border-[var(--outline)] cursor-grab'
      } ${disabled ? 'opacity-40 pointer-events-none' : ''} ${className}`}
    >
      {/* Fill Bar */}
      <div
        className={`absolute inset-y-0 left-0 bg-[var(--primary)]/20 dark:bg-[var(--primary)]/35 ${
          isDragging ? 'transition-none' : 'transition-all duration-150 ease-out'
        }`}
        style={{ width: `${displayValue}%` }}
      />

      {/* Label and Controls */}
      <div className="relative z-10 flex w-full items-center justify-between gap-2 px-3 text-ink pointer-events-none">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={toggleMute}
            className="pointer-events-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-ink-soft transition hover:bg-[var(--sc-high)] hover:text-ink cursor-pointer"
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
