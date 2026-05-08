import { useState } from 'react'
import type { AccountType, CreateAccountBody } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'

interface AddAccountModalProps {
  onClose:  () => void
  onSubmit: (data: CreateAccountBody) => Promise<void>
}

const ACCOUNT_TYPES: { value: AccountType; label: string; description: string }[] = [
  { value: 'cheque',     label: 'Cheque',     description: 'Day-to-day spending account'  },
  { value: 'savings',    label: 'Savings',    description: 'Savings or notice account'    },
  { value: 'credit',     label: 'Credit',     description: 'Credit card or overdraft'     },
  { value: 'investment', label: 'Investment', description: 'Unit trusts, shares, EasyEquities' },
]

export function AddAccountModal({ onClose, onSubmit }: AddAccountModalProps) {
  useModalClose(onClose)
  const [name, setName]               = useState('')
  const [type, setType]               = useState<AccountType>('cheque')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Account name is required'); return }
    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit({ name: name.trim(), type, opening_balance: 0 })
      onClose()
    } catch {
      setError('Failed to create account. Please try again.')
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
        <h2 className="text-white text-xl font-semibold mb-2">Add Account</h2>
        <p className="text-muted text-xs mb-6">
          The opening balance will be set when you import your first statement.
        </p>

        <div className="flex flex-col gap-5">
          {/* Name */}
          <div>
            <label className="text-muted text-sm block mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSubmit() }}
              placeholder="e.g. Standard Bank Cheque"
              autoFocus
              className="w-full bg-background border border-border rounded-lg px-3 py-2
                         text-white placeholder:text-muted focus:outline-none
                         focus:border-primary transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-muted text-sm block mb-2">Account Type</label>
            <div className="grid grid-cols-2 gap-2">
              {ACCOUNT_TYPES.map(t => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    type === t.value
                      ? 'border-primary bg-primary/10 text-white'
                      : 'border-border text-muted hover:border-white/30 hover:text-white'
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs mt-0.5 opacity-70">{t.description}</p>
                </button>
              ))}
            </div>
          </div>

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
              disabled={isSubmitting || !name.trim()}
              className="flex-1 px-4 py-2 bg-primary rounded-lg text-white
                         font-medium hover:bg-indigo-500 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
