import { useState } from 'react'
import type { Account } from '../../types'

interface Props {
  account: Account
  onClose: () => void
  onSubmit: (id: number, data: { name?: string; opening_balance?: number }) => Promise<void>
}

export function EditAccountModal({ account, onClose, onSubmit }: Props) {
  const [name, setName]                   = useState(account.name)
  const [openingBalance, setOpeningBalance] = useState(String(account.opening_balance))
  const [submitting, setSubmitting]         = useState(false)
  const [error, setError]                   = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    try {
      setSubmitting(true)
      await onSubmit(account.id, { name: name.trim(), opening_balance: parseFloat(openingBalance) })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface border border-border rounded-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-white font-semibold">Edit Account</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          <div>
            <label className="text-muted text-xs block mb-1">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-muted text-xs block mb-1">Opening Balance (R)</label>
            <input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={e => setOpeningBalance(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>
          {error && <p className="text-danger text-sm">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50">
              {submitting ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
