import { useState } from 'react'
import type { BudgetWithSpend } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'

interface Props {
  budget: BudgetWithSpend
  month: string
  onClose: () => void
  onSubmit: (categoryId: number, limit: number, month: string) => Promise<void>
}

export function SetBudgetModal({ budget, month, onClose, onSubmit }: Props) {
  useModalClose(onClose)
  const [limit, setLimit]         = useState<string>(budget.monthly_limit?.toString() ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const parsed = parseFloat(limit)
    if (!parsed || parsed <= 0) { setError('Enter a valid amount'); return }
    try {
      setSubmitting(true)
      await onSubmit(budget.category_id, parsed, month)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save budget')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-white font-semibold">Set Budget — {budget.category_name}</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-muted text-xs block mb-1">Monthly Limit (R)</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={limit}
              onChange={e => setLimit(e.target.value)}
              placeholder="0.00"
              autoFocus
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
