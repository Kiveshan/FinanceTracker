import { Card } from '../../components/ui/Card'
import { formatCurrency, formatDateShort } from '../../utils/format'
import type { Transaction } from '../../types'

interface Props {
  expenses: (Transaction & { account_name: string; category_name: string | null })[]
}

export function LargestExpensesList({ expenses }: Props) {
  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-4">Largest Expenses</p>
      {expenses.length === 0 ? (
        <p className="text-muted text-sm">No expenses this month.</p>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {expenses.map((tx, idx) => (
            <div key={tx.id} className="py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <span className="text-muted text-xs w-4 shrink-0">#{idx + 1}</span>
                <div className="min-w-0">
                  <p className="text-white text-sm truncate">{tx.description}</p>
                  <p className="text-muted text-xs">{formatDateShort(tx.date)} · {tx.category_name ?? '—'}</p>
                </div>
              </div>
              <p className="text-danger text-sm font-medium shrink-0">-{formatCurrency(tx.amount)}</p>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
