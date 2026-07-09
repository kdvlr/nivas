import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
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
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={EFFECTS_DEFAULT}
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm lg:p-8"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={EXPRESSIVE_ENTER}
        className={`glass max-h-[88vh] w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} overflow-y-auto p-6 lg:p-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-medium tracking-tight text-ink">{title}</h2>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            transition={PRESS_SPRING}
            onClick={onClose}
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
