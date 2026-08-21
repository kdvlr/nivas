import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'

interface TooltipState {
  text: string
  x: number
  y: number
  visible: boolean
  placement: 'top' | 'bottom'
}

export function GlobalTooltip() {
  const [tooltip, setTooltip] = useState<TooltipState>({
    text: '',
    x: 0,
    y: 0,
    visible: false,
    placement: 'top',
  })

  const timerRef = useRef<number | null>(null)
  const currentTargetRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    const handleMouseOver = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest?.('[title], [data-tooltip]') as HTMLElement | null
      if (!target) {
        hideTooltip()
        return
      }

      // If it has a title attribute, capture it and remove title so browser doesn't show slow native tooltip
      if (target.hasAttribute('title')) {
        const titleText = target.getAttribute('title') || ''
        if (titleText.trim()) {
          target.setAttribute('data-tooltip', titleText)
          target.removeAttribute('title')
        }
      }

      const text = target.getAttribute('data-tooltip')
      if (!text || !text.trim()) {
        hideTooltip()
        return
      }

      if (currentTargetRef.current === target && tooltip.visible) {
        return
      }

      currentTargetRef.current = target

      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
      }

      // Fast 120ms delay instead of the native 1500ms browser delay
      timerRef.current = window.setTimeout(() => {
        if (!currentTargetRef.current) return
        const rect = currentTargetRef.current.getBoundingClientRect()
        const placement = rect.top < 44 ? 'bottom' : 'top'
        const x = Math.max(16, Math.min(window.innerWidth - 16, rect.left + rect.width / 2))
        const y = placement === 'top' ? rect.top - 8 : rect.bottom + 8

        setTooltip({
          text,
          x,
          y,
          visible: true,
          placement,
        })
      }, 120)
    }

    const hideTooltip = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current)
        timerRef.current = null
      }
      currentTargetRef.current = null
      setTooltip((prev) => (prev.visible ? { ...prev, visible: false } : prev))
    }

    window.addEventListener('mouseover', handleMouseOver, { passive: true })
    window.addEventListener('scroll', hideTooltip, { passive: true })
    window.addEventListener('pointerdown', hideTooltip, { passive: true })
    window.addEventListener('keydown', hideTooltip, { passive: true })

    return () => {
      window.removeEventListener('mouseover', handleMouseOver)
      window.removeEventListener('scroll', hideTooltip)
      window.removeEventListener('pointerdown', hideTooltip)
      window.removeEventListener('keydown', hideTooltip)
      if (timerRef.current) window.clearTimeout(timerRef.current)
    }
  }, [tooltip.visible])

  if (!tooltip.visible || !tooltip.text) return null

  return createPortal(
    <div
      style={{
        left: `${tooltip.x}px`,
        top: `${tooltip.y}px`,
        transform: tooltip.placement === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0%)',
      }}
      className="fixed z-[99999] pointer-events-none max-w-xs whitespace-pre-wrap rounded-lg bg-[#18181b]/95 text-white text-xs font-medium px-2.5 py-1.5 shadow-2xl border border-white/20 backdrop-blur-md transition-opacity duration-150"
    >
      {tooltip.text}
    </div>,
    document.body
  )
}
