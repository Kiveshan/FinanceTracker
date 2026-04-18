import { useState, useEffect } from 'react'
import { dashboardApi, type DashboardData } from '../../api/dashboard'
import { NetWorthCard } from './NetWorthCard'
import { CashFlowCard } from './CashFlowCard'
import { SavingsRateCard } from './SavingsRateCard'
import { SpendingBreakdownChart } from './SpendingBreakdownChart'
import { IncomeBreakdownChart } from './IncomeBreakdownChart'
import { BudgetStatusWidget } from './BudgetStatusWidget'
import { RecentTransactionsList } from './RecentTransactionsList'
import { LargestExpensesList } from './LargestExpensesList'
import { AccountBalancesCard } from './AccountBalancesCard'

export function DashboardPage() {
  const currentMonth = new Date().toISOString().slice(0, 7)
  const [month, setMonth]         = useState<string>(currentMonth)
  const [data, setData]           = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    dashboardApi.get(month)
      .then(setData)
      .catch(() => setError('Failed to load dashboard data'))
      .finally(() => setIsLoading(false))
  }, [month])

  // Generate last 12 months for the selector
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-bold">Dashboard</h1>
          <p className="text-muted text-sm mt-1">Your financial health at a glance</p>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-danger mb-6">{error}</p>}

      {isLoading || !data ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted">Loading dashboard…</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {/* Row 1: Key metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <NetWorthCard netWorth={data.net_worth} change={data.net_worth_change} />
            <CashFlowCard
              totalIncome={data.cash_flow.total_income}
              totalExpenses={data.cash_flow.total_expenses}
              net={data.cash_flow.net}
            />
            <SavingsRateCard rate={data.savings_rate} />
          </div>

          {/* Row 2: Account balances + Budget status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <AccountBalancesCard accounts={data.accounts} />
            <BudgetStatusWidget items={data.budget_status} />
          </div>

          {/* Row 3: Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SpendingBreakdownChart data={data.spending_by_category} />
            <IncomeBreakdownChart   data={data.income_by_category} />
          </div>

          {/* Row 4: Transaction lists */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <RecentTransactionsList transactions={data.recent_transactions} />
            <LargestExpensesList    expenses={data.largest_expenses} />
          </div>
        </div>
      )}
    </div>
  )
}
