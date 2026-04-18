import { useState, useEffect } from 'react'
import type { Transaction, Account, Category, CreateTransactionBody, UpdateTransactionBody } from '../../types'
import { transactionsApi, type TransactionFilters } from '../../api/transactions'
import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { TransactionRow } from './TransactionRow'
import { AddTransactionModal } from './AddTransactionModal'
import { EditTransactionModal } from './EditTransactionModal'

export function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts]         = useState<Account[]>([])
  const [categories, setCategories]     = useState<Category[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [error, setError]               = useState<string | null>(null)

  const [showAddModal, setShowAddModal]     = useState(false)
  const [editingTx, setEditingTx]           = useState<Transaction | null>(null)

  // Filters
  const [filterType, setFilterType]           = useState<string>('')
  const [filterAccount, setFilterAccount]     = useState<string>('')
  const [filterCategory, setFilterCategory]   = useState<string>('')
  const [filterDateFrom, setFilterDateFrom]   = useState<string>('')
  const [filterDateTo, setFilterDateTo]       = useState<string>('')
  const [filterSearch, setFilterSearch]       = useState<string>('')

  useEffect(() => {
    Promise.all([accountsApi.getAll(), categoriesApi.getAll()])
      .then(([accs, cats]) => {
        setAccounts(accs)
        setCategories(cats)
      })
      .catch(() => setError('Failed to load accounts/categories'))
  }, [])

  useEffect(() => {
    fetchTransactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterAccount, filterCategory, filterDateFrom, filterDateTo, filterSearch])

  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      const filters: TransactionFilters = {}
      if (filterType)     filters.type        = filterType
      if (filterAccount)  filters.account_id  = Number(filterAccount)
      if (filterCategory) filters.category_id = Number(filterCategory)
      if (filterDateFrom) filters.date_from   = filterDateFrom
      if (filterDateTo)   filters.date_to     = filterDateTo
      if (filterSearch)   filters.search      = filterSearch
      const data = await transactionsApi.getAll(filters)
      setTransactions(data)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (data: CreateTransactionBody) => {
    const result = await transactionsApi.create(data)
    if ('debit' in result) {
      setTransactions(prev => [result.debit, result.credit, ...prev])
    } else {
      setTransactions(prev => [result, ...prev])
    }
  }

  const handleUpdate = async (id: number, data: UpdateTransactionBody) => {
    const updated = await transactionsApi.update(id, data)
    setTransactions(prev => prev.map(t => t.id === id ? updated : t))
  }

  const handleDelete = async (id: number) => {
    await transactionsApi.delete(id)
    // Remove the deleted tx and its transfer pair if visible
    const tx = transactions.find(t => t.id === id)
    const pairId = tx?.transfer_pair_id
    setTransactions(prev => prev.filter(t => t.id !== id && t.id !== pairId))
  }

  const TYPE_TABS = [
    { value: '', label: 'All' },
    { value: 'expense', label: 'Expenses' },
    { value: 'income', label: 'Income' },
    { value: 'transfer', label: 'Transfers' },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-white text-2xl font-bold">Transactions</h1>
          <p className="text-muted text-sm mt-1">{transactions.length} transactions</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors"
        >
          + Add Transaction
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface border border-border rounded-xl p-4 mb-6 flex flex-wrap gap-3">
        {/* Type tabs */}
        <div className="flex rounded-lg overflow-hidden border border-border">
          {TYPE_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setFilterType(tab.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                filterType === tab.value ? 'bg-primary text-white' : 'text-muted hover:text-white hover:bg-border'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          value={filterAccount}
          onChange={e => setFilterAccount(e.target.value)}
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
        >
          <option value="">All accounts</option>
          {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
        >
          <option value="">All categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <input
          type="date"
          value={filterDateFrom}
          onChange={e => setFilterDateFrom(e.target.value)}
          placeholder="From"
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => setFilterDateTo(e.target.value)}
          placeholder="To"
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary"
        />

        <input
          type="text"
          value={filterSearch}
          onChange={e => setFilterSearch(e.target.value)}
          placeholder="Search description…"
          className="bg-background border border-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-primary flex-1 min-w-36"
        />

        {(filterType || filterAccount || filterCategory || filterDateFrom || filterDateTo || filterSearch) && (
          <button
            onClick={() => { setFilterType(''); setFilterAccount(''); setFilterCategory(''); setFilterDateFrom(''); setFilterDateTo(''); setFilterSearch('') }}
            className="text-muted hover:text-white text-sm transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {error && <p className="text-danger mb-4">{error}</p>}
      {isLoading ? (
        <p className="text-muted text-center py-16">Loading…</p>
      ) : transactions.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted text-lg">No transactions found</p>
          <p className="text-muted text-sm mt-2">Add your first transaction to get started</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Description</th>
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Category</th>
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Account</th>
                <th className="py-3 px-4 text-right text-muted text-xs font-medium uppercase tracking-wider">Amount</th>
                <th className="py-3 px-4"></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(tx => (
                <TransactionRow
                  key={tx.id}
                  transaction={tx}
                  onEdit={setEditingTx}
                  onDelete={handleDelete}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <AddTransactionModal
          accounts={accounts}
          categories={categories}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingTx && (
        <EditTransactionModal
          transaction={editingTx}
          categories={categories}
          onClose={() => setEditingTx(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  )
}
