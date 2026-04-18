import type { Transaction } from '../../types'

interface Props {
  transaction: Transaction
  onEdit: (tx: Transaction) => void
  onDelete: (id: number) => void
}

const TYPE_STYLES: Record<string, string> = {
  income:   'text-success',
  expense:  'text-danger',
  transfer: 'text-blue-400',
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-ZA', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function TransactionRow({ transaction: tx, onEdit, onDelete }: Props) {
  const isExpense  = tx.type === 'expense'
  const isTransfer = tx.type === 'transfer'
  const isDebit    = isTransfer && tx.transfer_direction === 'debit'

  const displayAmount = isExpense || isDebit
    ? `-${formatCurrency(tx.amount)}`
    : `+${formatCurrency(tx.amount)}`

  const accountLabel = isTransfer
    ? isDebit
      ? `${tx.account_name} → ${tx.to_account_name ?? '?'}`
      : `${tx.to_account_name ?? '?'} → ${tx.account_name}`
    : tx.account_name ?? '—'

  return (
    <tr className="border-b border-border hover:bg-border/30 transition-colors group">
      <td className="py-3 px-4 text-muted text-sm whitespace-nowrap">{formatDate(tx.date)}</td>
      <td className="py-3 px-4">
        <p className="text-white text-sm">{tx.description}</p>
        {tx.notes && <p className="text-muted text-xs mt-0.5">{tx.notes}</p>}
      </td>
      <td className="py-3 px-4 text-muted text-sm">{tx.category_name ?? '—'}</td>
      <td className="py-3 px-4 text-muted text-sm">{accountLabel}</td>
      <td className={`py-3 px-4 text-sm font-medium text-right whitespace-nowrap ${TYPE_STYLES[tx.type]}`}>
        {displayAmount}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(tx)}
            className="text-muted hover:text-white text-xs transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(tx.id)}
            className="text-muted hover:text-danger text-xs transition-colors"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  )
}
