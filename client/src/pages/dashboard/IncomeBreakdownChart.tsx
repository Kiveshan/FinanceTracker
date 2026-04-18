import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Card } from '../../components/ui/Card'
import type { CategoryChartItem } from '../../api/dashboard'

const COLOURS = ['#10b981', '#6366f1', '#f59e0b', '#3b82f6', '#8b5cf6', '#14b8a6', '#ec4899', '#f43f5e']

interface Props {
  data: CategoryChartItem[]
}

export function IncomeBreakdownChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <p className="text-muted text-xs font-medium uppercase tracking-wider mb-2">Income Breakdown</p>
        <p className="text-muted text-sm text-center py-8">No income this month</p>
      </Card>
    )
  }

  return (
    <Card>
      <p className="text-muted text-xs font-medium uppercase tracking-wider mb-4">Income Breakdown</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLOURS[i % COLOURS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR' }).format(Number(value))
            }
            contentStyle={{ backgroundColor: '#1e1e2e', border: '1px solid #2a2a3a', borderRadius: '8px', color: '#fff' }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '12px', color: '#9ca3af' }} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  )
}
