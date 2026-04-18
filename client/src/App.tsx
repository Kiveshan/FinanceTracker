import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AccountsPage } from './pages/accounts/AccountsPage'
import { TransactionsPage } from './pages/transactions/TransactionsPage'
import { CategoriesPage } from './pages/categories/CategoriesPage'
import { BudgetsPage } from './pages/budgets/BudgetsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { ImportPage } from './pages/imports/ImportPage'
import { LoginPage } from './pages/auth/LoginPage'
import { useAuth } from './hooks/useAuth'

// LEARNING NOTE: BrowserRouter provides routing context to the whole app.
// Routes contains all your route definitions.
// Route maps a URL path to a component.
// NavLink is like an <a> tag but React Router aware — it knows which
// route is active and can apply active styles automatically.

function App() {
  const { isAuthenticated, email, login, register, logout } = useAuth()

  if (!isAuthenticated) {
    return <LoginPage onLogin={login} onRegister={register} />
  }

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background flex">

        {/* Sidebar navigation */}
        <aside className="w-56 bg-surface border-r border-border flex flex-col p-4 fixed h-full">
          <div className="mb-8 px-2">
            <h1 className="text-white font-bold text-lg">FinanceTracker</h1>
            <p className="text-muted text-xs mt-1">Personal Dashboard</p>
          </div>

          <nav className="flex flex-col gap-1">
            {[
              { to: '/',            label: 'Dashboard'    },
              { to: '/accounts',    label: 'Accounts'     },
              { to: '/transactions',label: 'Transactions' },
              { to: '/budgets',     label: 'Budgets'      },
              { to: '/categories',  label: 'Categories'   },
              { to: '/import',      label: 'Import'        },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-primary text-white font-medium'
                      : 'text-muted hover:text-white hover:bg-border'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-auto">
            {email && <p className="text-muted text-xs px-3 mb-2 truncate">{email}</p>}
            <button
              onClick={logout}
              className="w-full px-3 py-2 text-left text-muted hover:text-white text-sm rounded-lg hover:bg-border transition-colors"
            >
              Sign out
            </button>
          </div>
        </aside>

        {/* Main content — offset by sidebar width */}
        <main className="ml-56 flex-1 min-h-screen">
          <Routes>
            <Route path="/"             element={<DashboardPage />} />
            <Route path="/accounts"     element={<AccountsPage />} />
            <Route path="/transactions" element={<TransactionsPage />} />
            <Route path="/budgets"      element={<BudgetsPage />} />
            <Route path="/categories"  element={<CategoriesPage />} />
            <Route path="/import"      element={<ImportPage />} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  )
}

export default App
