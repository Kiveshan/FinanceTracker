import { useState, useEffect } from 'react'
import type { Account, Category, CreateTransactionBody, TransactionType } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'

interface Props {
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSubmit: (data: CreateTransactionBody) => Promise<void>
}

export function AddTransactionModal({ accounts, categories, onClose, onSubmit }: Props) {
  useModalClose(onClose)
  const today = new Date().toISOString().split('T')[0]

  const [type, setType]               = useState<TransactionType>('expense')
  const [accountId, setAccountId]     = useState<string>(accounts[0]?.id.toString() ?? '')
  const [toAccountId, setToAccountId] = useState<string>('')
  const [categoryId, setCategoryId]   = useState<string>('')
  const [amount, setAmount]           = useState<string>('')
  const [date, setDate]               = useState<string>(today)
  const [description, setDescription] = useState<string>('')
  const [notes, setNotes]             = useState<string>('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  const filteredCategories = categories.filter(c =>
    type === 'transfer' ? false : c.type === type
  )

  useEffect(() => {
    setCategoryId('')
  }, [type])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!accountId || !amount || !date || !description.trim()) {
      setError('Account, amount, date, and description are required')
      return
    }
    if (type === 'transfer' && !toAccountId) {
      setError('Destination account is required for transfers')
      return
    }
    if (type === 'transfer' && accountId === toAccountId) {
      setError('Source and destination accounts must be different')
      return
    }

    try {
      setSubmitting(true)
      await onSubmit({
        account_id:    Number(accountId),
        to_account_id: type === 'transfer' ? Number(toAccountId) : undefined,
        category_id:   categoryId ? Number(categoryId) : null,
        type,
        amount:        parseFloat(amount),
        date,
        description:   description.trim(),
        notes:         notes.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create transaction')
    } finally {
      setSubmitting(false)
    }
  }

  const TYPE_TABS: TransactionType[] = ['expense', 'income', 'transfer']

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-white font-semibold text-lg">Add Transaction</h2>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
          {/* Type tabs */}
          <div className="flex rounded-lg overflow-hidden border border-border">
            {TYPE_TABS.map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                  type === t ? 'bg-primary text-white' : 'text-muted hover:text-white hover:bg-border'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Date + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-muted text-xs block mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-muted text-xs block mb-1">Amount (R)</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-muted text-xs block mb-1">Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Woolworths groceries"
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Account */}
          <div>
            <label className="text-muted text-xs block mb-1">
              {type === 'transfer' ? 'From Account' : 'Account'}
            </label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select account</option>
              {accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* To Account (transfer only) */}
          {type === 'transfer' && (
            <div>
              <label className="text-muted text-xs block mb-1">To Account</label>
              <select
                value={toAccountId}
                onChange={e => setToAccountId(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select destination account</option>
                {accounts.filter(a => a.id.toString() !== accountId).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category (income/expense only) */}
          {type !== 'transfer' && (
            <div>
              <label className="text-muted text-xs block mb-1">Category</label>
              <select
                value={categoryId}
                onChange={e => setCategoryId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">No category</option>
                {filteredCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-muted text-xs block mb-1">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50"
            >
              {submitting ? 'Adding…' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
