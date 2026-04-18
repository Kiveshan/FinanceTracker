import { useState } from 'react'
import type { Account } from '../../types'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { formatCurrency } from '../../utils/format'

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


export function AccountCard({ account, onDelete, onEdit }: AccountCardProps) {
  const [showConfirm, setShowConfirm] = useState(false)
  const typeStyle = ACCOUNT_TYPE_STYLES[account.type]
  const isCredit  = account.type === 'credit'
  const isNegative = account.current_balance < 0

  const balanceLabel  = isCredit ? 'Amount Owed' : 'Current Balance'
  const displayAmount = isCredit ? Math.abs(account.current_balance) : account.current_balance
  const balanceColour = isCredit ? 'text-red-400' : isNegative ? 'text-danger' : 'text-white'

  return (
    <>
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
            onClick={() => setShowConfirm(true)}
            className="text-muted hover:text-danger transition-colors text-sm"
          >
            Remove
          </button>
        </div>
      </div>

      {/* Balance */}
      <div>
        <p className="text-muted text-xs mb-1">{balanceLabel}</p>
        <p className={`text-2xl font-bold ${balanceColour}`}>
          {isCredit ? `−${formatCurrency(displayAmount)}` : formatCurrency(displayAmount)}
        </p>
        {isCredit && (
          <p className="text-muted text-xs mt-1">This is a liability — money you owe</p>
        )}
      </div>

      {/* Opening balance */}
      <div className="border-t border-border pt-3">
        <p className="text-muted text-xs">
          Opening balance: {formatCurrency(account.opening_balance)}
        </p>
      </div>
    </Card>

    {showConfirm && (
      <ConfirmDialog
        title="Delete Account"
        message={`Are you sure you want to delete "${account.name}"? All associated transactions will also be deleted. This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => { setShowConfirm(false); onDelete(account.id) }}
        onCancel={() => setShowConfirm(false)}
      />
    )}
    </>
  )
}
