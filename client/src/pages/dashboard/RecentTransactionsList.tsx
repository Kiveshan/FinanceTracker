import { Card } from '../../components/ui/Card'
import type { Transaction } from '../../types'

interface Props {
  transactions: (Transaction & { account_name: string; category_name: string | null })[]
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(amount)
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
}

export function RecentTransactionsList({ transactions }: Props) {
  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-4">Recent Transactions</p>
      {transactions.length === 0 ? (
        <p className="text-muted text-sm">No transactions yet.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {transactions.map(tx => {
            const isExpense  = tx.type === 'expense'
            const isTransfer = tx.type === 'transfer'
            const isDebit    = isTransfer && tx.transfer_direction === 'debit'
            const amountColour = isExpense || isDebit ? 'text-danger' : isTransfer ? 'text-blue-400' : 'text-success'
            const sign = isExpense || isDebit ? '-' : '+'

            return (
              <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm truncate">{tx.description}</p>
                  <p className="text-muted text-xs">{formatDate(tx.date)} · {tx.account_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-medium ${amountColour}`}>
                    {sign}{formatCurrency(tx.amount)}
                  </p>
                  <p className="text-muted text-xs">{tx.category_name ?? tx.type}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
