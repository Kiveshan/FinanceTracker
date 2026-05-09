# Finance Tracker

A personal finance dashboard for tracking spending, income, and net worth across multiple bank accounts. Built for South African banking — Standard Bank CSV files are auto-detected and the category engine knows local merchants out of the box.

---

## Features

### Accounts
- Track cheque, savings, credit, and investment accounts in one view
- Balances are derived live from transactions — nothing is stored and can go stale
- Credit accounts show "Amount Owed" and subtract from net worth correctly
- Investment accounts use a portfolio valuation model — enter the current portfolio value and the app records the delta as a single income/expense transaction instead of cluttering the ledger with individual trades

### CSV Import
- **Standard Bank**: drop in the CSV and the format is detected automatically — no column mapping needed
- **Any other bank**: map date, description, and amount columns manually in the UI
- Transfers are detected by description pattern (PayShap, IB Payment, Immediate Payment, IB Transfer) and recorded as a single leg per account — no double counting when you import both sides of a transfer
- Duplicate detection prevents the same transaction being imported twice, even across separate imports
- Enter your statement closing balance on import and the app back-calculates the correct opening balance automatically

### Smart Auto-Categorisation
The category engine runs in three layers, each more personalised than the last:

1. **Keyword rules** — 35+ patterns covering SA merchants (Pick n Pay, Woolworths, Checkers, Nando's, KFC, Vodacom, Telkom, Outsurance, Discovery, DSTV, Dischem, Takealot, and more), grouped into categories like Groceries, Food & Dining, Fuel, Transport, Insurance, Medical Aid, Entertainment, Bank Fees
2. **Personal learned rules** — every time you re-categorise an imported transaction, the engine saves that `description → category` mapping and applies it automatically on all future imports. The system gets more accurate the more you use it.
3. **Fallback** — anything unmatched lands in "Other Income" or "Other Expenses" so nothing is ever left uncategorised

### Budgets
- Set a monthly spending limit per expense category — configured once, applies every month automatically
- Overview bar shows total budgeted vs total spent and your surplus or deficit at a glance
- Switch months to compare actuals against your limits for any past month

### Dashboard
- Month selector — every figure on the page (cash flow, net worth, account balances, budget progress) reflects the selected month, not today
- Cash flow summary, net worth, savings rate, spending by category, largest expenses, recent transactions, budget progress
- Account balances show the historical balance at the end of the selected month

### Transactions
- Full CRUD — add, edit, and delete (soft delete, recoverable via import rollback)
- Manual transfers create both legs automatically
- Filter by account, category, type, date range, or keyword search
- Pagination and sortable columns

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| Charts | Recharts |
| Routing | React Router v7 |
| Toasts | Sonner |
| Icons | Lucide React |
| Backend | Node.js, Express, TypeScript, tsx |
| Database | PostgreSQL |
| Auth | JWT + bcrypt |
| CSV parsing | csv-parse |

---

## Project Structure

```
FinanceTracker/
├── client/                  # React frontend (Vite)
│   └── src/
│       ├── api/             # Typed fetch wrappers (accounts, transactions, imports, etc.)
│       ├── components/      # Shared UI (Card, Spinner, ConfirmDialog, EmptyState)
│       ├── hooks/           # useModalClose, useDocumentTitle
│       ├── pages/           # One folder per route
│       │   ├── accounts/    # AccountsPage, AccountCard, AddAccountModal, UpdatePortfolioModal
│       │   ├── budgets/     # BudgetsPage, SetBudgetModal
│       │   ├── dashboard/   # DashboardPage
│       │   ├── imports/     # ImportPage (upload → assign → preview → done)
│       │   └── transactions/# TransactionsPage, TransactionRow, EditTransactionModal
│       ├── types/           # Shared TypeScript interfaces
│       └── utils/           # formatCurrency, formatDate, formatMonth
├── server/                  # Express backend
│   └── src/
│       ├── controllers/     # Route handlers
│       ├── db/
│       │   ├── index.ts     # PostgreSQL pool + query helper
│       │   └── schema.sql   # Full schema + all migrations (idempotent, safe to re-run)
│       ├── middleware/       # JWT auth
│       ├── routes/          # Express routers
│       └── types/           # Server-side TypeScript types
├── package.json             # Workspace root — runs client and server together
└── README.md
```

---

## Prerequisites

- Node.js 18+
- PostgreSQL 14+

---

## Setup

### 1. Clone and install

```bash
git clone https://github.com/your-username/FinanceTracker.git
cd FinanceTracker
npm install
```

### 2. Create the database

```bash
psql -U postgres -c "CREATE DATABASE financetracker;"
psql -U postgres -d financetracker -f server/src/db/schema.sql
```

The schema file is idempotent — re-run it any time to pick up new migrations without touching existing data.

### 3. Configure environment variables

```bash
cp server/.env.example server/.env
```

Edit `server/.env`:

```env
DATABASE_URL=postgresql://postgres:yourpassword@localhost:5432/financetracker
NODE_ENV=development
PORT=3001
JWT_SECRET=replace_with_a_long_random_secret
```

### 4. Start

```bash
npm run dev
```

Starts both backend (port 3001) and frontend (port 5173) concurrently. Open [http://localhost:5173](http://localhost:5173).

---

## First-time Setup

1. **Register** on the login screen
2. **Add your accounts** — Accounts → Add Account. Pick the type (cheque, savings, credit, investment). Opening balance is set automatically on your first import.
3. **Import transaction history** — Imports → upload a CSV. Standard Bank is auto-detected; other banks use the column mapper. Assign the account, enter the closing balance from your statement, confirm.
4. **Fix any categories** — the import auto-categorises everything. Anything in the wrong category can be corrected in Transactions. The engine remembers your corrections and applies them automatically next time.
5. **Set budgets** — Budgets → set a monthly limit for the categories you want to track. Set once, applies every month.
6. **Ongoing** — import a new statement monthly. Duplicate detection ensures only new transactions are added.

---

## API Reference

All endpoints except `/api/auth/*` and `/health` require `Authorization: Bearer <token>`.

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/accounts` | List accounts with live balances |
| POST | `/api/accounts` | Create account |
| PATCH | `/api/accounts/:id` | Update name or opening balance |
| DELETE | `/api/accounts/:id` | Soft-delete account |
| GET | `/api/transactions` | List transactions (filterable, paginated, sortable) |
| POST | `/api/transactions` | Create transaction (transfers create both legs) |
| PATCH | `/api/transactions/:id` | Update transaction — saves a learned category rule if re-categorised |
| DELETE | `/api/transactions/:id` | Soft-delete (deletes both legs for transfers) |
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PATCH | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |
| GET | `/api/budgets?month=YYYY-MM` | List budgets with actuals for the given month |
| POST | `/api/budgets` | Create or update a recurring budget limit |
| DELETE | `/api/budgets/:id` | Remove a budget limit |
| GET | `/api/dashboard?month=YYYY-MM` | Full dashboard data for the selected month |
| POST | `/api/imports/upload` | Upload and parse a CSV file |
| POST | `/api/imports/preview` | Categorise rows and detect duplicates |
| POST | `/api/imports/confirm` | Commit previewed rows to the database |
| GET | `/api/imports` | Import history |
| DELETE | `/api/imports/:id` | Roll back an import (soft-deletes its transactions) |
| GET | `/health` | Health check |

---

## Deployment (Railway)

Set these environment variables in your Railway project:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Set automatically by the Railway PostgreSQL plugin |
| `NODE_ENV` | `production` |
| `PORT` | Set automatically by Railway |
| `JWT_SECRET` | A long random secret string |

For the frontend, set `VITE_API_URL` to your deployed server URL (e.g. `https://your-server.railway.app/api`).