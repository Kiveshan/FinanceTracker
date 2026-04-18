import { Card } from '../../components/ui/Card'
import type { BudgetStatusItem } from '../../api/dashboard'

interface Props {
  items: BudgetStatusItem[]
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 0 }).format(n)
}

function statusIcon(pct: number | null) {
  if (pct === null) return '—'
  if (pct >= 100)   return '🔴'
  if (pct >= 80)    return '⚠️'
  return '✅'
}

export function BudgetStatusWidget({ items }: Props) {
  const withBudget = items.filter(i => i.monthly_limit !== null)

  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-4">Budget Status</p>
      {withBudget.length === 0 ? (
        <p className="text-muted text-sm">No budgets set for this month.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {withBudget.map(item => {
            const pct = item.percentage ?? 0
            const barPct = Math.min(pct, 100)
            const barColour = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'
            return (
              <div key={item.category_id}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white text-sm flex items-center gap-1.5">
                    <span>{statusIcon(item.percentage)}</span>
                    {item.category_name}
                  </span>
                  <span className="text-muted text-xs">
                    {formatCurrency(item.spent)} / {formatCurrency(item.monthly_limit!)}
                  </span>
                </div>
                <div className="w-full bg-border rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${barColour}`} style={{ width: `${barPct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
}
