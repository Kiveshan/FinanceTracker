import { useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Toaster } from 'sonner'
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  PiggyBank,
  Tags,
  Upload,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { AccountsPage } from './pages/accounts/AccountsPage'
import { TransactionsPage } from './pages/transactions/TransactionsPage'
import { CategoriesPage } from './pages/categories/CategoriesPage'
import { BudgetsPage } from './pages/budgets/BudgetsPage'
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { ImportPage } from './pages/imports/ImportPage'
import { ImportHistoryPage } from './pages/imports/ImportHistoryPage'
import { LoginPage } from './pages/auth/LoginPage'
import { useAuth } from './hooks/useAuth'

// LEARNING NOTE: BrowserRouter provides routing context to the whole app.
// Routes contains all your route definitions.
// Route maps a URL path to a component.
// NavLink is like an <a> tag but React Router aware — it knows which
// route is active and can apply active styles automatically.

const NAV_ITEMS = [
  { to: '/',             label: 'Dashboard',    icon: LayoutDashboard },
  { to: '/accounts',     label: 'Accounts',     icon: Wallet },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets',      label: 'Budgets',      icon: PiggyBank },
  { to: '/categories',   label: 'Categories',   icon: Tags },
  { to: '/import',       label: 'Import',       icon: Upload },
]

function SidebarContent({ email, logout, onNavClick }: {
  email: string | null
  logout: () => void
  onNavClick?: () => void
}) {
  return (
    <>
      <div className="mb-8 px-2">
        <h1 className="text-white font-bold text-lg">FinanceTracker</h1>
        <p className="text-muted text-xs mt-1">Personal Dashboard</p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={onNavClick}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-primary text-white font-medium'
                  : 'text-muted hover:text-white hover:bg-border'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        {email && <p className="text-muted text-xs px-3 mb-2 truncate">{email}</p>}
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 text-left text-muted hover:text-white text-sm rounded-lg hover:bg-border transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </>
  )
}

function MobileTopBar({ onToggle }: { onToggle: () => void }) {
  const location = useLocation()
  const current = NAV_ITEMS.find(n => {
    if (n.to === '/') return location.pathname === '/'
    return location.pathname.startsWith(n.to)
  })

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-surface border-b border-border flex items-center px-4 gap-3">
      <button onClick={onToggle} className="text-muted hover:text-white transition-colors">
        <Menu size={22} />
      </button>
      <span className="text-white font-semibold text-sm">{current?.label ?? 'FinanceTracker'}</span>
    </header>
  )
}

function AppShell({ email, logout }: { email: string | null; logout: () => void }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 bg-surface border-r border-border flex-col p-4 fixed h-full z-30">
        <SidebarContent email={email} logout={logout} />
      </aside>

      {/* Mobile top bar */}
      <MobileTopBar onToggle={() => setDrawerOpen(true)} />

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="relative w-64 bg-surface border-r border-border flex flex-col p-4 h-full animate-slide-in">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 text-muted hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
            <SidebarContent email={email} logout={logout} onNavClick={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="md:ml-56 flex-1 min-h-screen pt-14 md:pt-0">
        <Routes>
          <Route path="/"             element={<DashboardPage />} />
          <Route path="/accounts"     element={<AccountsPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budgets"      element={<BudgetsPage />} />
          <Route path="/categories"   element={<CategoriesPage />} />
          <Route path="/import"         element={<ImportPage />} />
          <Route path="/import/history" element={<ImportHistoryPage />} />
        </Routes>
      </main>

      <Toaster
        theme="dark"
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1a1d27',
            border: '1px solid #2a2d3a',
            color: '#f9fafb',
          },
        }}
      />
    </div>
  )
}

function App() {
  const { isAuthenticated, email, login, register, logout } = useAuth()

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage onLogin={login} onRegister={register} />
        <Toaster
          theme="dark"
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1a1d27',
              border: '1px solid #2a2d3a',
              color: '#f9fafb',
            },
          }}
        />
      </>
    )
  }

  return (
    <BrowserRouter>
      <AppShell email={email} logout={logout} />
    </BrowserRouter>
  )
}

export default App
