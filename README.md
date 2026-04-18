# FinanceTracker

Personal finance dashboard — track accounts, transactions, budgets, and net worth.

## Stack

- **Frontend:** React + Vite + TypeScript + Tailwind CSS + Recharts
- **Backend:** Node.js + Express + TypeScript
- **Database:** PostgreSQL
- **Hosting:** Railway

## Local Development

### Prerequisites
- Node.js 18+
- PostgreSQL running locally

### 1. Clone and install

```bash
# Root (workspace scripts)
npm install

# Server
cd server && npm install

# Client
cd client && npm install
```

### 2. Set up environment variables

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env with your DATABASE_URL, JWT_SECRET, APP_PASSWORD_HASH

# Client (optional — defaults to localhost:3001)
cp client/.env.example client/.env
```

### 3. Generate a password hash

```bash
node -e "require('bcryptjs').hash('yourpassword', 10).then(console.log)"
```

Paste the output into `APP_PASSWORD_HASH` in `server/.env`.

### 4. Run database schema

```bash
psql $DATABASE_URL -f server/src/db/schema.sql
psql $DATABASE_URL -f server/src/db/seed.sql
```

### 5. Start dev servers

```bash
# Terminal 1 — server (hot reload)
cd server && npm run dev

# Terminal 2 — client (hot reload)
cd client && npm run dev
```

Client runs at `http://localhost:5173`, server at `http://localhost:3001`.

## Railway Deployment

Set these environment variables in Railway:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Auto-set by Railway PostgreSQL plugin |
| `NODE_ENV` | `production` |
| `PORT` | Auto-set by Railway |
| `JWT_SECRET` | A long random secret string |
| `APP_PASSWORD_HASH` | bcrypt hash of your login password |

For the client, set `VITE_API_URL` to your deployed server URL (e.g. `https://your-server.railway.app/api`).

## Features

- **Dashboard** — net worth, cash flow, savings rate, spending/income charts, budget status, recent transactions
- **Accounts** — cheque, savings, credit, investment with derived live balances
- **Transactions** — CRUD with filters, transfer support (balance-neutral)
- **Budgets** — monthly limits per expense category with ✅/⚠️/🔴 status
- **Categories** — custom income and expense categories
- **CSV Import** — upload bank statement, map columns, preview with duplicate detection
- **Auth** — JWT-based password gate