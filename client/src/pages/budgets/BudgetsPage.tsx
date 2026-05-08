import { useState, useEffect } from 'react'
import type { BudgetWithSpend } from '../../types'
import { budgetsApi } from '../../api/budgets'
import { SetBudgetModal } from './SetBudgetModal'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { formatCurrency, formatMonth } from '../../utils/format'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { PiggyBank } from 'lucide-react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toast } from 'sonner'

export function BudgetsPage() {
  useDocumentTitle('Budgets')
  const currentMonth = new Date().toISOString().slice(0, 7)

  const [month, setMonth]       = useState<string>(currentMonth)
  const [budgets, setBudgets]   = useState<BudgetWithSpend[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [editing, setEditing]   = useState<BudgetWithSpend | null>(null)
  const [deleting, setDeleting] = useState<BudgetWithSpend | null>(null)

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

  const handleUpsert = async (categoryId: number, limit: number) => {
    await budgetsApi.upsert({ category_id: categoryId, monthly_limit: limit })
    await fetchBudgets()
    toast.success('Budget saved')
  }

  const handleDelete = async (id: number) => {
    await budgetsApi.delete(id)
    await fetchBudgets()
    toast.success('Budget removed')
  }

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    return d.toISOString().slice(0, 7)
  })

  const budgeted   = budgets.filter(b => b.monthly_limit !== null)
  const unbudgeted = budgets.filter(b => b.monthly_limit === null && b.spent > 0)

  const totalLimit = budgeted.reduce((s, b) => s + (b.monthly_limit ?? 0), 0)
  const totalSpent = budgeted.reduce((s, b) => s + b.spent, 0)
  const overallPct = totalLimit > 0 ? (totalSpent / totalLimit) * 100 : 0
  const surplus    = totalLimit - totalSpent

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Budgets</h1>
          <p className="text-muted text-sm mt-1">Monthly spending limits — set once, apply every month</p>
        </div>
        <select
          value={month}
          onChange={e => setMonth(e.target.value)}
          className="bg-surface border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
        >
          {monthOptions.map(m => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      </div>

      {error && <p className="text-danger mb-4 text-sm">{error}</p>}

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="No expense categories yet"
          description="Add expense categories first, then set monthly spending limits."
        />
      ) : (
        <div className="flex flex-col gap-6">

          {/* ── Summary bar ── */}
          {budgeted.length > 0 && (
            <Card className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-muted text-sm">
                  {formatMonth(month)} — <span className="text-white">{budgeted.length}</span> budget{budgeted.length !== 1 ? 's' : ''}
                </p>
                <p className={`text-sm font-semibold ${surplus >= 0 ? 'text-success' : 'text-danger'}`}>
                  {surplus >= 0 ? `R${formatCurrency(surplus)} remaining` : `R${formatCurrency(Math.abs(surplus))} over`}
                </p>
              </div>
              <div className="w-full bg-border rounded-full h-2.5">
                <div
                  className={`h-2.5 rounded-full transition-all ${overallPct >= 100 ? 'bg-danger' : overallPct >= 80 ? 'bg-warning' : 'bg-success'}`}
                  style={{ width: `${Math.min(overallPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted">
                <span>{formatCurrency(totalSpent)} spent</span>
                <span>{formatCurrency(totalLimit)} total budget</span>
              </div>
            </Card>
          )}

          {/* ── Budgeted categories ── */}
          {budgeted.length > 0 && (
            <section>
              <h2 className="text-muted text-xs font-medium uppercase tracking-wider mb-3">Active Budgets</h2>
              <div className="flex flex-col gap-2">
                {budgeted.map(b => {
                  const pct       = (b.spent / b.monthly_limit!) * 100
                  const barColour = pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'
                  const remaining = b.monthly_limit! - b.spent

                  return (
                    <Card key={b.category_id} className="flex flex-col gap-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-white text-sm font-medium">{b.category_name}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-muted text-xs">
                            {formatCurrency(b.spent)} / {formatCurrency(b.monthly_limit!)}
                          </span>
                          <button onClick={() => setEditing(b)} className="text-muted hover:text-white text-xs transition-colors">Edit</button>
                          <button onClick={() => setDeleting(b)} className="text-muted hover:text-danger text-xs transition-colors">Remove</button>
                        </div>
                      </div>
                      <div className="w-full bg-border rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${barColour}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <p className="text-muted text-xs">
                        {pct >= 100
                          ? <span className="text-danger">{formatCurrency(Math.abs(remaining))} over budget</span>
                          : <span>{formatCurrency(remaining)} remaining · {pct.toFixed(0)}% used</span>
                        }
                      </p>
                    </Card>
                  )
                })}
              </div>
            </section>
          )}

          {/* ── Unbudgeted categories with spend ── */}
          {unbudgeted.length > 0 && (
            <section>
              <h2 className="text-muted text-xs font-medium uppercase tracking-wider mb-3">No Limit Set</h2>
              <div className="flex flex-col gap-2">
                {unbudgeted.map(b => (
                  <div
                    key={b.category_id}
                    className="flex items-center justify-between px-4 py-3 bg-surface border border-border rounded-xl"
                  >
                    <div>
                      <span className="text-white text-sm">{b.category_name}</span>
                      <span className="text-muted text-xs ml-2">· {formatCurrency(b.spent)} spent</span>
                    </div>
                    <button
                      onClick={() => setEditing(b)}
                      className="px-3 py-1 bg-primary/20 hover:bg-primary text-primary hover:text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      + Set Limit
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Zero-spend unbudgeted ── */}
          {(() => {
            const inactive = budgets.filter(b => b.monthly_limit === null && b.spent === 0)
            return inactive.length > 0 ? (
              <section>
                <h2 className="text-muted text-xs font-medium uppercase tracking-wider mb-3">Other Categories</h2>
                <div className="flex flex-wrap gap-2">
                  {inactive.map(b => (
                    <button
                      key={b.category_id}
                      onClick={() => setEditing(b)}
                      className="px-3 py-1.5 border border-border rounded-lg text-muted text-xs hover:border-primary hover:text-white transition-colors"
                    >
                      {b.category_name} +
                    </button>
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
          onClose={() => setEditing(null)}
          onSubmit={handleUpsert}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Remove Budget"
          message={`Remove the spending limit for "${deleting.category_name}"? The category and its transactions won't be affected.`}
          confirmLabel="Remove"
          onConfirm={() => { const id = deleting.id!; setDeleting(null); handleDelete(id) }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  )
}
