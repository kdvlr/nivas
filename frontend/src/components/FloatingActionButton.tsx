import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Icon from './Icon'
import { PRESS_SPRING } from '../lib/motion'

interface FloatingActionButtonProps {
  route: string
  hasPlayer?: boolean
  className?: string
}

interface SpeedDialItem {
  id: string
  label: string
  icon: string
  color: string
  hash: string
  type: string
}

const SPEED_DIAL_ITEMS: SpeedDialItem[] = [
  {
    id: 'event',
    label: 'New Event',
    icon: 'event',
    color: 'text-[var(--primary)]',
    hash: '#/calendar?action=new',
    type: 'event',
  },
  {
    id: 'chore',
    label: 'New Chore',
    icon: 'stars',
    color: 'text-amber-500',
    hash: '#/chores?action=new',
    type: 'chore',
  },
  {
    id: 'todo',
    label: 'New To-Do',
    icon: 'task_alt',
    color: 'text-emerald-500',
    hash: '#/todos?action=new',
    type: 'todo',
  },
  {
    id: 'recipe',
    label: 'New Recipe',
    icon: 'menu_book',
    color: 'text-orange-500',
    hash: '#/recipes?action=new',
    type: 'recipe',
  },
]

const SECTION_ACTION_LABELS: Record<string, { label: string; type: string }> = {
  calendar: { label: 'New Event', type: 'event' },
  recipes: { label: 'New Recipe', type: 'recipe' },
  todos: { label: 'New To-Do', type: 'todo' },
  chores: { label: 'New Chore', type: 'chore' },
  shopping: { label: 'Add Item', type: 'shopping' },
}

export default function FloatingActionButton({
  route,
  hasPlayer = false,
  className = '',
}: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false)
  const isDashboard = route === 'home'
  const sectionMeta = SECTION_ACTION_LABELS[route]

  if (!isDashboard && !sectionMeta) {
    return null
  }

  const handleSpeedDialClick = (item: SpeedDialItem) => {
    setOpen(false)
    window.dispatchEvent(
      new CustomEvent('nivas:create-item', { detail: { type: item.type } })
    )
    window.location.hash = item.hash
  }

  const handleMainButtonClick = () => {
    if (isDashboard) {
      setOpen(!open)
    } else if (sectionMeta) {
      window.dispatchEvent(
        new CustomEvent('nivas:create-item', { detail: { type: sectionMeta.type } })
      )
    }
  }

  const tooltipLabel = isDashboard
    ? open
      ? 'Close'
      : 'Add item'
    : sectionMeta?.label ?? 'Add'

  return (
    <div className={`relative flex flex-col items-end pointer-events-auto select-none ${className}`}>
      {/* Backdrop for Dashboard Speed-Dial */}
      <AnimatePresence>
        {isDashboard && open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-30 bg-black/25 dark:bg-black/45 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Speed Dial Menu Items */}
      <AnimatePresence>
        {isDashboard && open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.88 }}
            transition={{ type: 'spring', stiffness: 350, damping: 24 }}
            className="absolute bottom-[4.25rem] right-0 z-40 flex flex-col items-end gap-2.5 min-w-[170px]"
          >
            {SPEED_DIAL_ITEMS.map((item, idx) => (
              <motion.button
                key={item.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.15, delay: (SPEED_DIAL_ITEMS.length - 1 - idx) * 0.03 }}
                whileHover={{ scale: 1.04, x: -3 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleSpeedDialClick(item)}
                className="glass group flex items-center justify-end gap-3 rounded-full py-2.5 px-4 shadow-xl border border-[var(--outline-var)] text-ink active:surface-tile-high cursor-pointer transition-colors"
              >
                <span className="text-sm font-semibold tracking-tight text-ink group-hover:text-[var(--primary)] transition-colors">
                  {item.label}
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface)] shadow-inner">
                  <Icon name={item.icon} className={`text-xl ${item.color}`} />
                </span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Themed Big + Button */}
      <motion.button
        type="button"
        title={tooltipLabel}
        aria-label={tooltipLabel}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        transition={PRESS_SPRING}
        onClick={handleMainButtonClick}
        className={`relative z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-2xl bg-[var(--primary)] text-[var(--on-primary)] border border-white/20 hover:brightness-110 active:brightness-95 cursor-pointer transition-shadow`}
      >
        <motion.div
          animate={{ rotate: isDashboard && open ? 45 : 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 22 }}
          className="flex items-center justify-center"
        >
          <Icon name="add" className="text-3xl font-bold" />
        </motion.div>
      </motion.button>
    </div>
  )
}
