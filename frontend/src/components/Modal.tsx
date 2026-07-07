import type { ReactNode } from 'react'

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
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm lg:p-8"
      onClick={onClose}
    >
      <div
        className={`glass max-h-[88vh] w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} overflow-y-auto p-6 lg:p-8`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-2xl font-medium tracking-tight text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="btn-glass flex h-11 w-11 items-center justify-center text-xl !text-ink-soft"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
