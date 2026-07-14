import { ReactNode } from 'react'
import Modal from './Modal'

export default function ConfirmModal({
  title,
  message,
  confirmText = 'Delete',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: {
  title: string
  message: string | ReactNode
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="flex flex-col gap-6">
        <p className="text-lg text-ink-soft">{message}</p>
        <div className="flex gap-3 mt-2">
          <button
            onClick={onCancel}
            className="btn-glass flex-1 py-3 text-lg font-medium cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-xl flex-1 py-3 text-lg font-medium cursor-pointer bg-rose-500 text-white shadow-md hover:bg-rose-600 active:scale-[0.98] transition-all"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </Modal>
  )
}
