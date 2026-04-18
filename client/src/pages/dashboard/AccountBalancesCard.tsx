import { Card } from '../../components/ui/Card'
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

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n)
}

export function AccountBalancesCard({ accounts }: Props) {
  const grouped = accounts.reduce((acc, a) => {
    if (!acc[a.type]) acc[a.type] = []
    acc[a.type].push(a)
    return acc
  }, {} as Record<string, Account[]>)

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
              {list.map(a => (
                <div key={a.id} className="flex justify-between items-center py-1">
                  <span className="text-white text-sm">{a.name}</span>
                  <span className={`text-sm font-medium ${a.current_balance < 0 ? 'text-danger' : 'text-white'}`}>
                    {formatCurrency(a.current_balance)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
