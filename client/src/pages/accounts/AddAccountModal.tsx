import { useState } from 'react'
import type { AccountType, CreateAccountBody } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'

interface AddAccountModalProps {
  onClose: () => void
  onSubmit: (data: CreateAccountBody) => Promise<void>
}

const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: 'cheque',     label: 'Cheque'     },
  { value: 'savings',    label: 'Savings'    },
  { value: 'credit',     label: 'Credit'     },
  { value: 'investment', label: 'Investment' },
]

export function AddAccountModal({ onClose, onSubmit }: AddAccountModalProps) {
  useModalClose(onClose)
  // LEARNING NOTE: One state value per form field.
  // When the user types, we call the setter which updates state,
  // which re-renders the component with the new value in the input.
  // This pattern is called a controlled component — React owns the value,
  // not the DOM. It means you always have the current form values in state,
  // ready to submit.
  const [name, setName]                   = useState('')
  const [type, setType]                   = useState<AccountType>('cheque')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [isSubmitting, setIsSubmitting]   = useState(false)
  const [error, setError]                 = useState<string | null>(null)

  const handleSubmit = async () => {
    // Basic validation
    if (!name.trim()) {
      setError('Account name is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit({
        name: name.trim(),
        type,
        opening_balance: parseFloat(openingBalance) || 0
      })
      onClose()
    } catch {
      setError('Failed to create account. Please try again.')
    } finally {
      // LEARNING NOTE: finally always runs whether the try succeeded or failed.
      // We use it here to always reset isSubmitting — otherwise the button
      // stays disabled forever if the request fails.
      setIsSubmitting(false)
    }
  }

  return (
    // Backdrop — clicking outside closes the modal
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      {/* Modal panel — stop click from reaching backdrop */}
      <div
        className="bg-surface border border-border rounded-xl p-6 w-full max-w-md mx-4"
        onClick={e => e.stopPropagation()}
        // LEARNING NOTE: e.stopPropagation() prevents the click on the modal
        // panel from bubbling up to the backdrop div, which would close the
        // modal immediately. Event bubbling means a click on a child element
        // also triggers click handlers on all its parents. stopPropagation()
        // stops that chain.
      >
        <h2 className="text-white text-xl font-semibold mb-6">Add Account</h2>

        <div className="flex flex-col gap-4">
          {/* Account name */}
          <div>
            <label className="text-muted text-sm block mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. FNB Cheque"
              className="w-full bg-background border border-border rounded-lg px-3 py-2
                         text-white placeholder:text-muted focus:outline-none
                         focus:border-primary transition-colors"
            />
          </div>

          {/* Account type */}
          <div>
            <label className="text-muted text-sm block mb-1">Account Type</label>
            <select
              value={type}
              onChange={e => setType(e.target.value as AccountType)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2
                         text-white focus:outline-none focus:border-primary transition-colors"
            >
              {ACCOUNT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Opening balance */}
          <div>
            <label className="text-muted text-sm block mb-1">Opening Balance (R)</label>
            <input
              type="number"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2
                         text-white focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Error message */}
          {error && (
            <p className="text-danger text-sm">{error}</p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg
                         text-muted hover:text-white hover:border-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 bg-primary rounded-lg text-white
                         font-medium hover:bg-indigo-500 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
