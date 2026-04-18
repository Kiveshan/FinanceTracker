import { useState, useEffect } from 'react'
import type { Transaction, Account, Category, CreateTransactionBody, UpdateTransactionBody } from '../../types'
import { transactionsApi, type TransactionFilters } from '../../api/transactions'
import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { TransactionRow } from './TransactionRow'
import { AddTransactionModal } from './AddTransactionModal'
import { EditTransactionModal } from './EditTransactionModal'
import { useDebounce } from '../../hooks/useDebounce'
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Receipt } from 'lucide-react'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toast } from 'sonner'

type SortCol = 'date' | 'amount' | 'description' | 'category' | 'account'
type SortDir = 'asc' | 'desc'

export function TransactionsPage() {
  useDocumentTitle('Transactions')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [accounts, setAccounts]         = useState<Account[]>([])
  const [categories, setCategories]     = useState<Category[]>([])
  const [isLoading, setIsLoading]       = useState(true)
  const [error, setError]               = useState<string | null>(null)
  const [total, setTotal]               = useState(0)

  const [showAddModal, setShowAddModal]     = useState(false)
  const [editingTx, setEditingTx]           = useState<Transaction | null>(null)

  // Filters
  const [filterType, setFilterType]           = useState<string>('')
  const [filterAccount, setFilterAccount]     = useState<string>('')
  const [filterCategory, setFilterCategory]   = useState<string>('')
  const [filterDateFrom, setFilterDateFrom]   = useState<string>('')
  const [filterDateTo, setFilterDateTo]       = useState<string>('')
  const [filterSearch, setFilterSearch]       = useState<string>('')

  // Pagination
  const [page, setPage]     = useState(1)
  const PAGE_SIZE = 50

  // Sorting
  const [sortBy, setSortBy]   = useState<SortCol>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const debouncedSearch = useDebounce(filterSearch, 300)

  useEffect(() => {
    Promise.all([accountsApi.getAll(), categoriesApi.getAll()])
      .then(([accs, cats]) => {
        setAccounts(accs)
        setCategories(cats)
      })
      .catch(() => setError('Failed to load accounts/categories'))
  }, [])

  // Reset to page 1 when filters or sort change
  useEffect(() => {
    setPage(1)
  }, [filterType, filterAccount, filterCategory, filterDateFrom, filterDateTo, debouncedSearch, sortBy, sortDir])

  useEffect(() => {
    fetchTransactions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType, filterAccount, filterCategory, filterDateFrom, filterDateTo, debouncedSearch, page, sortBy, sortDir])

  const fetchTransactions = async () => {
    try {
      setIsLoading(true)
      const filters: TransactionFilters = {
        page,
        limit: PAGE_SIZE,
        sort_by: sortBy,
        sort_dir: sortDir,
      }
      if (filterType)       filters.type        = filterType
      if (filterAccount)    filters.account_id  = Number(filterAccount)
      if (filterCategory)   filters.category_id = Number(filterCategory)
      if (filterDateFrom)   filters.date_from   = filterDateFrom
      if (filterDateTo)     filters.date_to     = filterDateTo
      if (debouncedSearch)  filters.search      = debouncedSearch
      const result = await transactionsApi.getAll(filters)
      setTransactions(result.data)
      setTotal(result.total)
    } catch {
      setError('Failed to load transactions')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (data: CreateTransactionBody) => {
    try {
      await transactionsApi.create(data)
      await fetchTransactions()
      toast.success('Transaction created')
    } catch {
      toast.error('Failed to create transaction')
    }
  }

  const handleUpdate = async (id: number, data: UpdateTransactionBody) => {
    try {
      await transactionsApi.update(id, data)
      await fetchTransactions()
      toast.success('Transaction updated')
    } catch {
      toast.error('Failed to update transaction')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await transactionsApi.delete(id)
      await fetchTransactions()
      toast.success('Transaction deleted')
    } catch {
      toast.error('Failed to delete transaction')
    }
  }

  const toggleSort = (col: SortCol) => {
    if (sortBy === col) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col)
      setSortDir(col === 'amount' ? 'desc' : 'asc')
    }
  }

  const SortIcon = ({ col }: { col: SortCol }) => {
    if (sortBy !== col) return <ArrowUpDown size={14} className="text-muted" />
    return sortDir === 'asc'
      ? <ArrowUp size={14} className="text-primary" />
      : <ArrowDown size={14} className="text-primary" />
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const rangeStart = (page - 1) * PAGE_SIZE + 1
  const rangeEnd   = Math.min(page * PAGE_SIZE, total)

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
          <p className="text-muted text-sm mt-1">{total} transactions</p>
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
        <div className="flex justify-center py-16"><Spinner size={32} /></div>
      ) : transactions.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions found"
          description="Add your first transaction to start tracking your finances."
          action={{ label: '+ Add Transaction', onClick: () => setShowAddModal(true) }}
        />
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                {[
                  { col: 'date' as SortCol,        label: 'Date',        align: 'text-left' },
                  { col: 'description' as SortCol,  label: 'Description', align: 'text-left' },
                  { col: 'category' as SortCol,     label: 'Category',    align: 'text-left' },
                  { col: 'account' as SortCol,      label: 'Account',     align: 'text-left' },
                  { col: 'amount' as SortCol,       label: 'Amount',      align: 'text-right' },
                ].map(({ col, label, align }) => (
                  <th
                    key={col}
                    onClick={() => toggleSort(col)}
                    className={`py-3 px-4 ${align} text-muted text-xs font-medium uppercase tracking-wider cursor-pointer hover:text-white transition-colors select-none`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {label}
                      <SortIcon col={col} />
                    </span>
                  </th>
                ))}
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

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-muted text-sm">Showing {rangeStart}–{rangeEnd} of {total}</p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg text-muted hover:text-white hover:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-white text-sm px-3">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg text-muted hover:text-white hover:bg-border transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
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
          accounts={accounts}
          categories={categories}
          onClose={() => setEditingTx(null)}
          onSubmit={handleUpdate}
        />
      )}
    </div>
  )
}
