import { useState } from 'react'
import type { Account } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'
import { formatCurrency } from '../../utils/format'

interface UpdatePortfolioModalProps {
  account: Account
  onClose: () => void
  onSubmit: (newValue: number) => Promise<void>
}

export function UpdatePortfolioModal({ account, onClose, onSubmit }: UpdatePortfolioModalProps) {
  useModalClose(onClose)
  const [rawValue, setRawValue]       = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const currentBalance = account.current_balance
  const newValue       = parseFloat(rawValue.replace(/,/g, ''))
  const delta          = isNaN(newValue) ? null : newValue - currentBalance
  const isGrowth       = delta !== null && delta > 0
  const isLoss         = delta !== null && delta < 0
  const unchanged      = delta !== null && delta === 0

  const handleSubmit = async () => {
    if (isNaN(newValue) || newValue < 0) { setError('Enter a valid portfolio value'); return }
    if (unchanged) { onClose(); return }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(newValue)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update portfolio value')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-white text-xl font-semibold mb-1">Update Portfolio Value</h2>
        <p className="text-muted text-xs mb-6">{account.name}</p>

        <div className="flex flex-col gap-5">
          {/* Current value reference */}
          <div className="bg-background rounded-lg px-4 py-3 flex justify-between items-center">
            <p className="text-muted text-sm">Current app balance</p>
            <p className="text-white font-semibold">{formatCurrency(currentBalance)}</p>
          </div>

          {/* New value input */}
          <div>
            <label className="text-muted text-sm block mb-1">New Portfolio Value</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">R</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={rawValue}
                onChange={e => { setRawValue(e.target.value); setError(null) }}
                onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
                placeholder="0.00"
                autoFocus
                className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-2
                           text-white placeholder:text-muted focus:outline-none
                           focus:border-primary transition-colors"
              />
            </div>
          </div>

          {/* Delta preview */}
          {delta !== null && !unchanged && (
            <div className={`rounded-lg px-4 py-3 border ${isGrowth ? 'border-success/30 bg-success/10' : 'border-danger/30 bg-danger/10'}`}>
              <p className="text-muted text-xs mb-1">
                {isGrowth ? 'Portfolio Return — will record as income' : 'Portfolio Loss — will record as expense'}
              </p>
              <p className={`text-lg font-bold ${isGrowth ? 'text-success' : 'text-danger'}`}>
                {isGrowth ? '+' : '−'}{formatCurrency(Math.abs(delta))}
              </p>
            </div>
          )}

          {unchanged && (
            <p className="text-muted text-sm text-center">Value unchanged — nothing will be recorded</p>
          )}

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg
                         text-muted hover:text-white hover:border-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || rawValue === '' || isNaN(newValue)}
              className={`flex-1 px-4 py-2 rounded-lg text-white font-medium transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed
                         ${isLoss ? 'bg-danger hover:bg-red-500' : 'bg-primary hover:bg-indigo-500'}`}
            >
              {isSubmitting ? 'Saving…' : unchanged ? 'Close' : 'Update Value'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
