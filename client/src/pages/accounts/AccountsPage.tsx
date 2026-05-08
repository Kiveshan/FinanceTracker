import { useState, useEffect } from 'react'
import type { Account } from '../../types'
import { accountsApi } from '../../api/accounts'
import { AccountCard } from './AccountCard'
import { AddAccountModal } from './AddAccountModal'
import { EditAccountModal } from './EditAccountModal'
import { UpdatePortfolioModal } from './UpdatePortfolioModal'
import type { CreateAccountBody } from '../../types'
import { categoriesApi } from '../../api/categories'
import { transactionsApi } from '../../api/transactions'
import { formatCurrency } from '../../utils/format'
import { Spinner } from '../../components/ui/Spinner'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toast } from 'sonner'

export function AccountsPage() {
  useDocumentTitle('Accounts')
  const [accounts, setAccounts]     = useState<Account[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showModal, setShowModal]               = useState(false)
  const [editingAccount, setEditingAccount]     = useState<Account | null>(null)
  const [portfolioAccount, setPortfolioAccount] = useState<Account | null>(null)

  // LEARNING NOTE: useEffect with an empty dependency array []
  // runs exactly once — when the component first mounts (appears on screen).
  // This is the standard pattern for fetching data when a page loads.
  // The dependency array controls when the effect re-runs:
  //   []           → run once on mount
  //   [id]         → re-run whenever id changes
  //   no array     → re-run after every render (almost never what you want)
  useEffect(() => {
    fetchAccounts()
  }, [])

  const fetchAccounts = async () => {
    try {
      setIsLoading(true)
      const data = await accountsApi.getAll()
      setAccounts(data)
    } catch {
      setError('Failed to load accounts')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreate = async (data: CreateAccountBody) => {
    try {
      const newAccount = await accountsApi.create(data)
      setAccounts(prev => [...prev, newAccount])
      toast.success('Account created')
    } catch {
      toast.error('Failed to create account')
    }
  }

  const handleUpdate = async (id: number, data: { name?: string; opening_balance?: number }) => {
    try {
      const updated = await accountsApi.update(id, data)
      setAccounts(prev => prev.map(a => a.id === id ? updated : a))
      toast.success('Account updated')
    } catch {
      toast.error('Failed to update account')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await accountsApi.delete(id)
      setAccounts(prev => prev.filter(a => a.id !== id))
      toast.success('Account deleted')
    } catch {
      toast.error('Failed to delete account')
    }
  }

  const handleUpdatePortfolio = async (account: Account, newValue: number) => {
    const delta = newValue - account.current_balance
    if (delta === 0) return

    const isGrowth    = delta > 0
    const txType      = isGrowth ? 'income' : 'expense'
    const categoryName = isGrowth ? 'Investment Returns' : 'Investment Loss'

    // Find or create the category
    const categories = await categoriesApi.getAll()
    let category = categories.find(c => c.name === categoryName && c.type === txType)
    if (!category) {
      category = await categoriesApi.create({ name: categoryName, type: txType })
    }

    const today = new Date().toISOString().slice(0, 10)
    await transactionsApi.create({
      account_id:  account.id,
      category_id: category.id,
      type:        txType,
      amount:      Math.abs(delta),
      date:        today,
      description: isGrowth ? 'Portfolio Return' : 'Portfolio Loss',
    })

    // Refresh account balances
    await fetchAccounts()
    toast.success(`Portfolio updated to ${formatCurrency(newValue)}`)
  }

  // Group accounts by type for display
  // LEARNING NOTE: reduce() here builds an object where each key is
  // an account type and each value is an array of accounts of that type.
  const grouped = accounts.reduce((acc, account) => {
    const type = account.type
    if (!acc[type]) acc[type] = []
    acc[type].push(account)
    return acc
  }, {} as Record<string, Account[]>)

  // Calculate total net worth for the header
  const netWorth = accounts.reduce((sum, account) => {
    return account.type === 'credit'
      ? sum - Math.abs(account.current_balance)
      : sum + account.current_balance
  }, 0)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size={32} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-danger">{error}</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-white text-2xl font-bold">Accounts</h1>
          <p className="text-muted text-sm mt-1">
            Net worth:{' '}
            <span className={netWorth >= 0 ? 'text-success' : 'text-danger'}>
              {formatCurrency(netWorth)}
            </span>
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary rounded-lg text-white
                     font-medium hover:bg-indigo-500 transition-colors"
        >
          + Add Account
        </button>
      </div>

      {/* Account groups */}
      {Object.entries(grouped).map(([type, typeAccounts]) => (
        <div key={type} className="mb-8">
          <h2 className="text-muted text-sm font-medium uppercase tracking-wider mb-4">
            {type}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {typeAccounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onDelete={handleDelete}
                onEdit={setEditingAccount}
                onUpdateValue={setPortfolioAccount}
              />
            ))}
          </div>
        </div>
      ))}

      {accounts.length === 0 && (
        <div className="text-center py-16">
          <p className="text-muted text-lg">No accounts yet</p>
          <p className="text-muted text-sm mt-2">
            Add your first account to get started
          </p>
        </div>
      )}

      {showModal && (
        <AddAccountModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
        />
      )}

      {editingAccount && (
        <EditAccountModal
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSubmit={handleUpdate}
        />
      )}

      {portfolioAccount && (
        <UpdatePortfolioModal
          account={portfolioAccount}
          onClose={() => setPortfolioAccount(null)}
          onSubmit={newValue => handleUpdatePortfolio(portfolioAccount, newValue)}
        />
      )}
    </div>
  )
}
