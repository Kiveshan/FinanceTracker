import { Card } from '../../components/ui/Card'

interface Props {
  totalIncome: number
  totalExpenses: number
  net: number
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(amount)
}

export function CashFlowCard({ totalIncome, totalExpenses, net }: Props) {
  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-4">Monthly Cash Flow</p>
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center">
          <span className="text-muted text-sm">Income</span>
          <span className="text-success font-medium">+{formatCurrency(totalIncome)}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-muted text-sm">Expenses</span>
          <span className="text-danger font-medium">-{formatCurrency(totalExpenses)}</span>
        </div>
        <div className="border-t border-border pt-3 flex justify-between items-center">
          <span className="text-white text-sm font-medium">Net</span>
          <span className={`font-bold ${net >= 0 ? 'text-success' : 'text-danger'}`}>
            {net >= 0 ? '+' : ''}{formatCurrency(net)}
          </span>
        </div>
      </div>
    </Card>
  )
}
