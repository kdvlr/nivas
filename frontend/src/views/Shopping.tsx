import { useState } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { PRESS_SPRING, EXPRESSIVE_ENTER } from '../lib/motion'
import { api } from '../lib/api'
import { useData } from '../lib/hooks'
import type { ShoppingItem } from '../lib/types'
import Modal from '../components/Modal'

const SOURCE_ICON: Record<string, string> = { icloud: '', alexa: '🔵', local: '🖥️' }

export default function Shopping() {
  const { data: items, reload } = useData<ShoppingItem[]>('/api/shopping', ['shopping'])
  const [newTitle, setNewTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  const active = (items ?? []).filter((i) => !i.completed)
  const done = (items ?? []).filter((i) => i.completed)

  const toggle = async (item: ShoppingItem) => {
    await api.patch(`/api/shopping/${item.id}`, { completed: !item.completed })
    reload()
  }

  const add = async () => {
    const title = newTitle.trim()
    if (!title || busy) return
    setBusy(true)
    try {
      await api.post('/api/shopping', { title })
      setNewTitle('')
      reload()
    } finally {
      setBusy(false)
    }
  }

  const clearCompleted = async () => {
    setBusy(true)
    try {
      await api.del('/api/shopping/completed')
      setShowClearConfirm(false)
      reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full flex-col px-4 lg:px-8">
      <div className="mb-4 lg:mb-5 flex flex-wrap items-center gap-2 lg:gap-4">
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight text-ink">Shopping</h1>
        <span className="text-base lg:text-lg font-normal text-ink-soft">{active.length} items</span>
        <span className="ml-auto text-xs lg:text-base text-ink-soft hidden sm:inline">
          synced with Reminders + Alexa
        </span>
      </div>

      <div className="mb-4 lg:mb-6 flex gap-2 lg:gap-3">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add an item…"
          className="flex-1 input-glass px-4 py-2.5 lg:px-6 lg:py-4 text-base lg:text-xl focus:outline-none"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={PRESS_SPRING}
          onClick={add}
          disabled={!newTitle.trim() || busy}
          className="btn-primary px-5 py-2.5 lg:px-10 lg:py-4 text-base lg:text-xl cursor-pointer"
        >
          Add
        </motion.button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {active.length === 0 && done.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-ink-soft">
            <span className="text-7xl">🛒</span>
            <p className="text-2xl font-normal">Shopping list is empty</p>
          </div>
        )}

        <LayoutGroup>
          <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 2xl:grid-cols-4">
            <AnimatePresence initial={false}>
              {active.map((item) => (
                <motion.div
                  key={item.id}
                  layoutId={String(item.id)}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9, y: 15 }}
                  transition={EXPRESSIVE_ENTER}
                  className="relative overflow-hidden rounded-xl bg-emerald-500/10 border border-emerald-500/20 shadow-sm"
                >
                  {/* Swipe indicator background */}
                  <div className="absolute inset-y-0 left-4 flex items-center text-emerald-600 dark:text-emerald-400">
                    <span className="msr text-2xl font-bold">check_circle</span>
                  </div>
                  <div className="absolute inset-y-0 right-4 flex items-center text-emerald-600 dark:text-emerald-400">
                    <span className="msr text-2xl font-bold">check_circle</span>
                  </div>

                  <motion.button
                    drag="x"
                    dragConstraints={{ left: 0, right: 0 }}
                    dragElastic={{ left: 0.6, right: 0.6 }}
                    onDragEnd={async (event, info) => {
                      if (Math.abs(info.offset.x) > 80) {
                        await toggle(item)
                      }
                    }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={PRESS_SPRING}
                    className="relative flex w-full items-center gap-3 glass p-4 text-left cursor-grab active:cursor-grabbing"
                  >
                    <span
                      onClick={(e) => {
                        e.stopPropagation()
                        toggle(item)
                      }}
                      className="h-9 w-9 shrink-0 rounded-full border-4 border-teal-400/40 hover:border-teal-500 hover:bg-teal-500/10 transition-all duration-200 cursor-pointer flex items-center justify-center"
                    />
                    <span className="min-w-0 flex-1 truncate text-xl font-normal text-ink">{item.title}</span>
                    <span className="text-sm">
                      {item.sources.map((s) => SOURCE_ICON[s] ?? '').join(' ')}
                    </span>
                  </motion.button>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {done.length > 0 && (
            <>
              <div className="mb-3 mt-8 flex items-center justify-between">
                <h2 className="text-xl font-normal text-ink-soft">In the cart</h2>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  transition={PRESS_SPRING}
                  onClick={() => setShowClearConfirm(true)}
                  className="text-sm font-medium text-rose-500 cursor-pointer"
                >
                  Clear All
                </motion.button>
              </div>
              <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 2xl:grid-cols-4">
                <AnimatePresence>
                  {done.map((item) => (
                    <motion.button
                      key={item.id}
                      layoutId={String(item.id)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 0.6, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={EXPRESSIVE_ENTER}
                      whileHover={{ scale: 1.02, opacity: 0.8 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => toggle(item)}
                      className="flex items-center gap-3 rounded-xl glass-inset p-4 text-left cursor-pointer"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-lg font-normal text-white shadow-sm">
                        ✓
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xl font-normal line-through text-ink-soft">
                        {item.title}
                      </span>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </motion.div>
            </>
          )}
        </LayoutGroup>
      </div>

      {showClearConfirm && (
        <Modal title="Clear items?" onClose={() => setShowClearConfirm(false)}>
          <div className="flex flex-col gap-6">
            <p className="text-xl text-ink-soft">
              This will remove all {done.length} items from your dashboard and sync the completion to iCloud and Alexa.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="btn-glass flex-1 py-4 text-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={clearCompleted}
                disabled={busy}
                className="btn-primary flex-1 py-4 text-xl cursor-pointer"
              >
                {busy ? 'Clearing...' : 'Yes, clear all'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
