import { Card } from '../../components/ui/Card'

interface Props {
  rate: number
}

export function SavingsRateCard({ rate }: Props) {
  const clamped = Math.max(0, Math.min(100, rate))
  const colour = rate >= 20 ? 'text-success' : rate >= 0 ? 'text-warning' : 'text-danger'
  const barColour = rate >= 20 ? 'bg-success' : rate >= 0 ? 'bg-warning' : 'bg-danger'

  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">Savings Rate</p>
      <p className={`text-3xl font-bold ${colour}`}>{rate.toFixed(1)}%</p>
      <div className="mt-3 w-full bg-border rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${barColour}`} style={{ width: `${clamped}%` }} />
      </div>
      <p className="text-muted text-xs mt-2">(Income − Expenses) ÷ Income</p>
    </Card>
  )
}
