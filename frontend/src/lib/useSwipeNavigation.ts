import { useCallback, useRef } from 'react'
import type { CSSProperties, PointerEvent as ReactPointerEvent, PointerEventHandler } from 'react'

interface SwipeNavigationOptions {
  onSwipeLeft: () => void
  onSwipeRight: () => void
  disabled?: boolean
  minimumDistance?: number
}

interface SwipeStart {
  pointerId: number
  x: number
  y: number
}

/**
 * Recognises deliberate horizontal touch/pen swipes while preserving vertical
 * scrolling and native interaction with buttons, form fields, and events.
 */
export function useSwipeNavigation({
  onSwipeLeft,
  onSwipeRight,
  disabled = false,
  minimumDistance = 56,
}: SwipeNavigationOptions): {
  onPointerDown: PointerEventHandler<HTMLElement>
  onPointerUp: PointerEventHandler<HTMLElement>
  onPointerCancel: PointerEventHandler<HTMLElement>
  style: CSSProperties
} {
  const startRef = useRef<SwipeStart | null>(null)

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.pointerType === 'mouse' || event.button !== 0) return

    const target = event.target as Element | null
    if (target?.closest?.('a, button, input, textarea, select, [role="button"], [data-swipe-ignore="true"], .fc-event')) {
      return
    }

    startRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    }
  }, [disabled])

  const clear = useCallback(() => {
    startRef.current = null
  }, [])

  const onPointerUp = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const start = startRef.current
    startRef.current = null
    if (!start || start.pointerId !== event.pointerId) return

    const deltaX = event.clientX - start.x
    const deltaY = event.clientY - start.y
    if (Math.abs(deltaX) < minimumDistance || Math.abs(deltaX) < Math.abs(deltaY) * 1.25) return

    if (deltaX < 0) onSwipeLeft()
    else onSwipeRight()
  }, [minimumDistance, onSwipeLeft, onSwipeRight])

  return {
    onPointerDown,
    onPointerUp,
    onPointerCancel: clear,
    style: { touchAction: 'pan-y' },
  }
}
