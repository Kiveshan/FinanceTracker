import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../utils/format'
import type { Account } from '../../types'

interface Props {
  accounts: Account[]
}

const TYPE_LABELS: Record<string, string> = {
  cheque: 'Cheque', savings: 'Savings', credit: 'Credit', investment: 'Investment',
}
const TYPE_COLOURS: Record<string, string> = {
  cheque: 'text-blue-400', savings: 'text-green-400', credit: 'text-red-400', investment: 'text-purple-400',
}

export function AccountBalancesCard({ accounts }: Props) {
  const grouped = accounts.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, Account[]>)

  const netWorth = accounts.reduce((sum, a) =>
    a.type === 'credit' ? sum - Math.abs(a.current_balance) : sum + a.current_balance
  , 0)

  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-4">Account Balances</p>
      {accounts.length === 0 ? (
        <p className="text-muted text-sm">No accounts yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Object.entries(grouped).map(([type, list]) => (
            <div key={type}>
              <p className={`text-xs font-medium uppercase tracking-wider mb-2 ${TYPE_COLOURS[type] ?? 'text-muted'}`}>
                {TYPE_LABELS[type] ?? type}
              </p>
              {list.map(a => {
                const isCredit = a.type === 'credit'
                const displayBalance = isCredit ? Math.abs(a.current_balance) : a.current_balance
                return (
                  <div key={a.id} className="flex justify-between items-center py-1">
                    <div className="flex flex-col">
                      <span className="text-white text-sm">{a.name}</span>
                      {isCredit && (
                        <span className="text-red-400 text-xs">amount owed</span>
                      )}
                    </div>
                    <span className={`text-sm font-medium ${isCredit ? 'text-red-400' : a.current_balance < 0 ? 'text-danger' : 'text-white'}`}>
                      {isCredit ? `−${formatCurrency(displayBalance)}` : formatCurrency(displayBalance)}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
          <div className="border-t border-border pt-3 flex justify-between items-center">
            <span className="text-muted text-xs font-medium uppercase tracking-wider">Net Worth</span>
            <span className={`text-sm font-bold ${netWorth < 0 ? 'text-danger' : 'text-white'}`}>
              {formatCurrency(netWorth)}
            </span>
          </div>
        </div>
      )}
    </Card>
  )
}
