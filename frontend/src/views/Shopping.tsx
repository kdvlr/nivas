import { useState } from 'react'
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
    <div className="flex h-full flex-col">
      <div className="mb-5 flex items-center gap-4">
        <h1 className="text-3xl font-medium tracking-tight text-ink">Shopping</h1>
        <span className="text-lg font-normal text-ink-soft">{active.length} items</span>
        <span className="ml-auto text-base text-ink-soft">
          synced with Reminders + Alexa
        </span>
      </div>

      <div className="mb-6 flex gap-3">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add an item…"
          className="flex-1 input-glass px-6 py-4 text-xl"
        />
        <button
          onClick={add}
          disabled={!newTitle.trim() || busy}
          className="btn-primary px-10 py-4 text-xl"
        >
          Add
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        {active.length === 0 && done.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-ink-soft">
            <span className="text-7xl">🛒</span>
            <p className="text-2xl font-normal">Shopping list is empty</p>
          </div>
        )}
        <div className="grid grid-cols-3 gap-3 2xl:grid-cols-4">
          {active.map((item) => (
            <button
              key={item.id}
              onClick={() => toggle(item)}
              className="flex items-center gap-3 glass-inset p-4 text-left active:scale-[0.98]"
            >
              <span className="h-9 w-9 shrink-0 rounded-full border-4 border-teal-300/70" />
              <span className="min-w-0 flex-1 truncate text-xl font-normal">{item.title}</span>
              <span className="text-sm">
                {item.sources.map((s) => SOURCE_ICON[s] ?? '').join(' ')}
              </span>
            </button>
          ))}
        </div>
        {done.length > 0 && (
          <>
            <div className="mb-3 mt-8 flex items-center justify-between">
              <h2 className="text-xl font-normal text-ink-soft">In the cart</h2>
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-sm font-medium text-rose-500 active:opacity-60"
              >
                Clear All
              </button>
            </div>
            <div className="grid grid-cols-3 gap-3 2xl:grid-cols-4">
              {done.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggle(item)}
                  className="flex items-center gap-3 rounded-xl glass-inset p-4 text-left opacity-60"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-400 text-lg font-normal text-white">
                    ✓
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xl font-normal line-through">
                    {item.title}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
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
                className="btn-glass flex-1 py-4 text-xl"
              >
                Cancel
              </button>
              <button
                onClick={clearCompleted}
                disabled={busy}
                className="btn-primary flex-1 py-4 text-xl"
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
