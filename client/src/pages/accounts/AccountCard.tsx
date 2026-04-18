import type { Account } from '../../types'
import { Card } from '../../components/ui/Card'

interface AccountCardProps {
  account: Account
  onDelete: (id: number) => void
  onEdit: (account: Account) => void
}

// Maps account types to display labels and colours
const ACCOUNT_TYPE_STYLES: Record<string, { label: string; colour: string }> = {
  cheque:     { label: 'Cheque',     colour: 'text-blue-400'   },
  savings:    { label: 'Savings',    colour: 'text-green-400'  },
  credit:     { label: 'Credit',     colour: 'text-red-400'    },
  investment: { label: 'Investment', colour: 'text-purple-400' },
}

// LEARNING NOTE: Number formatting
// toLocaleString('en-ZA', ...) formats numbers according to South African
// locale conventions — comma separators, R currency symbol.
// Always format money for display. Never show raw floats to users.
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    minimumFractionDigits: 2
  }).format(amount)
}

export function AccountCard({ account, onDelete, onEdit }: AccountCardProps) {
  const typeStyle = ACCOUNT_TYPE_STYLES[account.type]
  const isNegative = account.current_balance < 0

  return (
    <Card className="flex flex-col gap-4 hover:border-primary transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wider ${typeStyle.colour}`}>
            {typeStyle.label}
          </p>
          <h3 className="text-white font-semibold text-lg mt-1">
            {account.name}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onEdit(account)}
            className="text-muted hover:text-white transition-colors text-sm"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(account.id)}
            className="text-muted hover:text-danger transition-colors text-sm"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Balance */}
      <div>
        <p className="text-muted text-xs mb-1">Current Balance</p>
        <p className={`text-2xl font-bold ${isNegative ? 'text-danger' : 'text-white'}`}>
          {formatCurrency(account.current_balance)}
        </p>
      </div>

      {/* Opening balance */}
      <div className="border-t border-border pt-3">
        <p className="text-muted text-xs">
          Opening balance: {formatCurrency(account.opening_balance)}
        </p>
      </div>
    </Card>
  )
}
