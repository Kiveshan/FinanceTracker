import { useState, useEffect } from 'react'
import type { Transaction, Account, Category, UpdateTransactionBody, TransactionType } from '../../types'
import { useModalClose } from '../../hooks/useModalClose'

interface Props {
  transaction: Transaction
  accounts: Account[]
  categories: Category[]
  onClose: () => void
  onSubmit: (id: number, data: UpdateTransactionBody) => Promise<void>
}

export function EditTransactionModal({ transaction, accounts, categories, onClose, onSubmit }: Props) {
  useModalClose(onClose)
  const [type, setType]               = useState<TransactionType>(transaction.type)
  const [accountId, setAccountId]     = useState<string>(transaction.account_id.toString())
  const [toAccountId, setToAccountId] = useState<string>('')
  const [amount, setAmount]           = useState<string>(String(transaction.amount))
  const [date, setDate]               = useState<string>(transaction.date.split('T')[0])
  const [description, setDescription] = useState<string>(transaction.description)
  const [categoryId, setCategoryId]   = useState<string>(transaction.category_id?.toString() ?? '')
  const [notes, setNotes]             = useState<string>(transaction.notes ?? '')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)

  // When editing a transfer, pre-populate the destination account from the pair
  useEffect(() => {
    if (transaction.type === 'transfer') {
      if (transaction.transfer_direction === 'debit') {
        // Find the credit leg account by name match
        const dest = accounts.find(a => a.name === transaction.to_account_name)
        setToAccountId(dest?.id.toString() ?? '')
      } else {
        // We're viewing the credit leg — swap so from=source, to=this account
        const src = accounts.find(a => a.name === transaction.to_account_name)
        setAccountId(src?.id.toString() ?? transaction.account_id.toString())
        setToAccountId(transaction.account_id.toString())
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset category when type changes
  useEffect(() => { setCategoryId('') }, [type])

  const filteredCategories = categories.filter(c => type === 'transfer' ? false : c.type === type)
  const TYPE_TABS: TransactionType[] = ['expense', 'income', 'transfer']

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!accountId) { setError('Account is required'); return }
    if (type === 'transfer' && !toAccountId) { setError('Destination account is required for transfers'); return }
    if (type === 'transfer' && accountId === toAccountId) { setError('Source and destination accounts must be different'); return }

    try {
      setSubmitting(true)
      await onSubmit(transaction.id, {
        type,
        account_id:    Number(accountId),
        to_account_id: type === 'transfer' ? Number(toAccountId) : null,
        amount:        parseFloat(amount),
        date,
        description:   description.trim(),
        category_id:   categoryId ? Number(categoryId) : null,
        notes:         notes.trim() || null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update transaction')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-white font-semibold text-lg">Edit Transaction</h2>
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
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            />
          </div>

          {/* Account */}
          <div>
            <label className="text-muted text-xs block mb-1">{type === 'transfer' ? 'From account' : 'Account'}</label>
            <select
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              required
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
            >
              <option value="">Select account…</option>
              {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* To account (transfers only) */}
          {type === 'transfer' && (
            <div>
              <label className="text-muted text-xs block mb-1">To account</label>
              <select
                value={toAccountId}
                onChange={e => setToAccountId(e.target.value)}
                required
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select destination…</option>
                {accounts.filter(a => a.id.toString() !== accountId).map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* Category (non-transfer only) */}
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
              {submitting ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
