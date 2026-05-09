import { useState } from 'react'
import type { Account } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'
import { formatCurrency } from '../../utils/format'

interface VerifyBalanceModalProps {
  account:  Account
  onClose:  () => void
  onAdjust: (accountId: number, newOpeningBalance: number) => Promise<void>
}

export function VerifyBalanceModal({ account, onClose, onAdjust }: VerifyBalanceModalProps) {
  useModalClose(onClose)
  const [bankValue, setBankValue]     = useState('')
  const [isAdjusting, setIsAdjusting] = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [done, setDone]               = useState(false)

  const appBalance  = account.current_balance
  const bankBalance = parseFloat(bankValue)
  const hasInput    = bankValue !== '' && !isNaN(bankBalance)
  const discrepancy = hasInput ? bankBalance - appBalance : null
  const isMatch     = discrepancy !== null && Math.abs(discrepancy) < 0.01

  // new_opening = desired_balance - tx_sum
  // tx_sum      = current_balance - opening_balance
  const txSum          = appBalance - account.opening_balance
  const newOpening     = hasInput ? bankBalance - txSum : null

  const handleAdjust = async () => {
    if (newOpening === null) return
    setIsAdjusting(true)
    setError(null)
    try {
      await onAdjust(account.id, newOpening)
      setDone(true)
    } catch {
      setError('Failed to adjust balance. Please try again.')
    } finally {
      setIsAdjusting(false)
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
        <h2 className="text-white text-xl font-semibold mb-1">Verify Balance</h2>
        <p className="text-muted text-xs mb-6">{account.name}</p>

        {done ? (
          <div className="flex flex-col gap-4">
            <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3">
              <p className="text-success text-sm font-medium">Balance adjusted</p>
              <p className="text-muted text-xs mt-0.5">
                Your app now shows {formatCurrency(bankBalance)} — matching your bank.
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-primary rounded-lg text-white font-medium
                         hover:bg-indigo-500 transition-colors"
            >
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* App balance reference */}
            <div className="bg-background rounded-lg px-4 py-3 flex justify-between items-center">
              <p className="text-muted text-sm">App shows</p>
              <p className="text-white font-semibold">{formatCurrency(appBalance)}</p>
            </div>

            {/* Bank balance input */}
            <div>
              <label className="text-muted text-sm block mb-1">
                What does your bank show right now?
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">R</span>
                <input
                  type="number"
                  step="0.01"
                  value={bankValue}
                  onChange={e => { setBankValue(e.target.value); setError(null) }}
                  onKeyDown={e => { if (e.key === 'Enter' && hasInput && !isMatch) handleAdjust() }}
                  placeholder="0.00"
                  autoFocus
                  className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-2
                             text-white placeholder:text-muted focus:outline-none
                             focus:border-primary transition-colors"
                />
              </div>
            </div>

            {/* Result */}
            {hasInput && isMatch && (
              <div className="bg-success/10 border border-success/30 rounded-lg px-4 py-3">
                <p className="text-success text-sm font-medium">✓ All good — balances match</p>
              </div>
            )}

            {hasInput && !isMatch && discrepancy !== null && (
              <div className="bg-warning/10 border border-warning/30 rounded-lg px-4 py-3 flex flex-col gap-1">
                <p className="text-warning text-sm font-medium">
                  {discrepancy > 0
                    ? `App is ${formatCurrency(Math.abs(discrepancy))} too low`
                    : `App is ${formatCurrency(Math.abs(discrepancy))} too high`}
                </p>
                <p className="text-muted text-xs">
                  This usually means a transaction is missing or was imported twice.
                  You can adjust the opening balance to force the numbers to match.
                </p>
              </div>
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

              {hasInput && !isMatch ? (
                <button
                  onClick={handleAdjust}
                  disabled={isAdjusting}
                  className="flex-1 px-4 py-2 bg-warning/80 hover:bg-warning rounded-lg
                             text-black font-medium transition-colors disabled:opacity-50"
                >
                  {isAdjusting ? 'Adjusting…' : 'Adjust to Match'}
                </button>
              ) : (
                <button
                  onClick={onClose}
                  disabled={!hasInput}
                  className="flex-1 px-4 py-2 bg-primary rounded-lg text-white font-medium
                             hover:bg-indigo-500 transition-colors disabled:opacity-50"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
