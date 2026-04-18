import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onCancel])

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div
        ref={panelRef}
        className="bg-surface border border-border rounded-xl w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-border">
          <h2 className="text-white font-semibold">{title}</h2>
        </div>
        <div className="p-6">
          <p className="text-muted text-sm">{message}</p>
        </div>
        <div className="px-6 pb-6 flex gap-3 justify-end">
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white font-medium transition-colors text-sm disabled:opacity-50 ${
              danger
                ? 'bg-danger hover:bg-red-600'
                : 'bg-primary hover:bg-indigo-500'
            }`}
          >
            {loading ? 'Please wait…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
