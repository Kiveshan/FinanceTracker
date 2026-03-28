import { useState, useEffect } from 'react'
import type { Account } from '../../types'
import { accountsApi } from '../../api/accounts'
import { AccountCard } from './AccountCard'
import { AddAccountModal } from './AddAccountModal'
import type { CreateAccountBody } from '../../types'

export function AccountsPage() {
  const [accounts, setAccounts]     = useState<Account[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [showModal, setShowModal]   = useState(false)

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
    const newAccount = await accountsApi.create(data)
    // LEARNING NOTE: Never mutate state directly.
    // setAccounts(accounts.push(newAccount)) — WRONG. push mutates the array.
    // Instead create a new array with the spread operator:
    setAccounts(prev => [...prev, newAccount])
    // [...prev, newAccount] means: all existing accounts, plus the new one.
    // React sees a new array reference and knows to re-render.
  }

  const handleDelete = async (id: number) => {
    await accountsApi.delete(id)
    // Remove the deleted account from state
    setAccounts(prev => prev.filter(a => a.id !== id))
    // LEARNING NOTE: filter returns a new array containing only items
    // where the condition is true. a.id !== id keeps everything except
    // the deleted account. Again — new array, not mutation.
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
        <p className="text-muted">Loading accounts...</p>
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
              {new Intl.NumberFormat('en-ZA', {
                style: 'currency',
                currency: 'ZAR'
              }).format(netWorth)}
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
    </div>
  )
}
