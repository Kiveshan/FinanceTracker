import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../utils/format'

interface Props {
  netWorth: number
  change: number
}

export function NetWorthCard({ netWorth, change }: Props) {
  const positive = change >= 0
  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">Net Worth</p>
      <p className="text-white text-3xl font-bold">{formatCurrency(netWorth)}</p>
      <p className={`text-sm mt-2 ${positive ? 'text-success' : 'text-danger'}`}>
        {positive ? '▲' : '▼'} {formatCurrency(Math.abs(change))} vs last month
      </p>
    </Card>
  )
}
