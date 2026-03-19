import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { AccountsPage } from './pages/accounts/AccountsPage'

// LEARNING NOTE: BrowserRouter provides routing context to the whole app.
// Routes contains all your route definitions.
// Route maps a URL path to a component.
// NavLink is like an <a> tag but React Router aware — it knows which
// route is active and can apply active styles automatically.

function App() {
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
        </aside>

        {/* Main content — offset by sidebar width */}
        <main className="ml-56 flex-1 min-h-screen">
          <Routes>
            <Route path="/"             element={<div className="p-6 text-white">Dashboard coming soon</div>} />
            <Route path="/accounts"     element={<AccountsPage />} />
            <Route path="/transactions" element={<div className="p-6 text-white">Transactions coming soon</div>} />
            <Route path="/budgets"      element={<div className="p-6 text-white">Budgets coming soon</div>} />
          </Routes>
        </main>

      </div>
    </BrowserRouter>
  )
}

export default App
