import { useState, useEffect } from 'react'
import type { BudgetWithSpend } from '../../types'
import { budgetsApi } from '../../api/budgets'
import { SetBudgetModal } from './SetBudgetModal'
import { Card } from '../../components/ui/Card'

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(amount)
}

function statusIcon(pct: number | null): { icon: string; colour: string } {
  if (pct === null) return { icon: '—', colour: 'text-muted' }
  if (pct >= 100)   return { icon: '🔴', colour: 'text-danger' }
  if (pct >= 80)    return { icon: '⚠️', colour: 'text-warning' }
  return               { icon: '✅', colour: 'text-success' }
}

export function BudgetsPage() {
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [month, setMonth]           = useState<string>(currentMonth)
  const [budgets, setBudgets]       = useState<BudgetWithSpend[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [editing, setEditing]       = useState<BudgetWithSpend | null>(null)

  useEffect(() => { fetchBudgets() }, [month]) // eslint-disable-line react-hooks/exhaustive-deps

  const fetchBudgets = async () => {
    try {
      setIsLoading(true)
      const data = await budgetsApi.getAll(month)
      setBudgets(data)
    } catch {
      setError('Failed to load budgets')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpsert = async (categoryId: number, limit: number, targetMonth: string) => {
    await budgetsApi.upsert({ category_id: categoryId, monthly_limit: limit, month: targetMonth })
    await fetchBudgets()
  }

  const handleDelete = async (id: number) => {
    await budgetsApi.delete(id)
    setBudgets(prev => prev.map(b => b.id === id ? { ...b, id: undefined as unknown as number, monthly_limit: null as unknown as number } : b))
    await fetchBudgets()
  }

  // Generate month options: current month + 11 previous months
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  if (isLoading) return <div className="flex items-center justify-center h-64"><p className="text-muted">Loading…</p></div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-bold">Budgets</h1>
          <p className="text-muted text-sm mt-1">Monthly spending limits per category</p>
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

      {error && <p className="text-danger mb-4 text-sm">{error}</p>}

      {budgets.length === 0 ? (
        <p className="text-muted text-center py-16">No expense categories yet. Add categories first.</p>
      ) : (
        <div className="flex flex-col gap-8">

          {/* ── Active budgets ── */}
          {(() => {
            const active = budgets.filter(b => b.monthly_limit !== null)
            return active.length > 0 ? (
              <section>
                <h2 className="text-muted text-xs font-medium uppercase tracking-wider mb-3">Active Budgets</h2>
                <div className="flex flex-col gap-3">
                  {active.map(budget => {
                    const pct = (budget.spent / budget.monthly_limit!) * 100
                    const { icon, colour } = statusIcon(pct)
                    const barColour = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'

                    return (
                      <Card key={budget.category_id} className="flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span>{icon}</span>
                            <span className="text-white font-medium">{budget.category_name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-medium ${colour}`}>
                              {formatCurrency(budget.spent)} / {formatCurrency(budget.monthly_limit!)}
                            </span>
                            <button
                              onClick={() => setEditing(budget)}
                              className="text-muted hover:text-white text-xs transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(budget.id)}
                              className="text-muted hover:text-danger text-xs transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        <div className="w-full bg-border rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${barColour}`}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                        <p className="text-muted text-xs">{pct.toFixed(0)}% of limit used</p>
                      </Card>
                    )
                  })}
                </div>
              </section>
            ) : null
          })()}

          {/* ── Categories without a budget ── */}
          {(() => {
            const unset = budgets.filter(b => b.monthly_limit === null)
            return unset.length > 0 ? (
              <section>
                <h2 className="text-muted text-xs font-medium uppercase tracking-wider mb-3">Add a Budget</h2>
                <div className="flex flex-col gap-2">
                  {unset.map(budget => (
                    <div
                      key={budget.category_id}
                      className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl hover:border-primary transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-muted text-sm">{budget.category_name}</span>
                        <span className="text-muted text-xs">
                          · {formatCurrency(budget.spent)} spent this month
                        </span>
                      </div>
                      <button
                        onClick={() => setEditing(budget)}
                        className="px-3 py-1 bg-primary/20 hover:bg-primary text-primary hover:text-white text-xs font-medium rounded-lg transition-colors"
                      >
                        + Set Budget
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            ) : null
          })()}

        </div>
      )}

      {editing && (
        <SetBudgetModal
          budget={editing}
          month={month}
          onClose={() => setEditing(null)}
          onSubmit={handleUpsert}
        />
      )}
    </div>
  )
}
