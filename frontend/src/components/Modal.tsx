import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import { useEffect, useId, useRef } from 'react'
import { EFFECTS_DEFAULT, EXPRESSIVE_ENTER, PRESS_SPRING } from '../lib/motion'

export default function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    // Only focus the dialog container if nothing inside it already took focus (e.g. via autoFocus)
    if (panelRef.current && !panelRef.current.contains(document.activeElement)) {
      panelRef.current.focus()
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key !== 'Tab' || !panelRef.current) return
      const nodes = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!nodes.length) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus()
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={EFFECTS_DEFAULT}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm lg:p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={EXPRESSIVE_ENTER}
        className={`glass max-h-[88vh] w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} overflow-y-auto p-6 lg:p-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 id={titleId} className="text-2xl font-medium tracking-tight text-ink">{title}</h2>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={PRESS_SPRING}
            onClick={onClose}
            aria-label={`Close ${title}`}
            className="btn-glass flex h-11 w-11 items-center justify-center text-xl !text-ink-soft"
          >
            ✕
          </motion.button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  )
}
