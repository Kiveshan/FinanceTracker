# Personal Finance Dashboard — v1 Spec

> **Learning note:** A spec document serves as a contract between what you want to build and what you actually build. Writing it before touching code forces you to resolve ambiguities early — when changing your mind is free. Once you're in code, changing your mind costs time.

---

## Problem

Managing personal finances requires either paid apps or brittle spreadsheets. A single, self-owned tool is needed to track accounts, transactions, budgets, and financial health — without ongoing cost or manual formula maintenance.

---

## Solution

A lightweight web application for personal financial management. Single-user, hosted on a free tier, covering account tracking, transaction management, budgeting, and a dashboard that gives a clear picture of financial health at a glance.

**The dashboard answers three questions:**

- How much money do I currently have?
- Where is my money going?
- Am I improving financially over time?

---

## Users

A single user (you). No complex auth system needed — just a simple password-protected login to keep the app private since it will be publicly hosted.

> **Learning note:** Scope creep often starts at the user model. "What if I want to share this with my partner?" is a real question, but adding multi-user support multiplies complexity significantly. Lock it to single-user for v1 and revisit later.

---

## Core Features

### 1. Account Management

- Create and manage accounts of four types: **cheque, savings, credit, investment**
- Each account has a name, type, and an **opening balance**
- Account balances are **derived from transactions**, not stored directly

> **Learning note:** Storing a balance as a field (e.g. `account.balance = 5000`) creates a sync problem — if you edit a past transaction, the balance won't automatically update. Deriving the balance by summing all transactions against an account means the number is always correct by definition. This is called a **single source of truth** — a core principle in data modelling.

- Credit accounts display their balance as a **liability** (what you owe, not what you have)
- Transfers between accounts are **balance-neutral** — they do not count as income or expense

> **Learning note:** A transfer is moving money from one pocket to another. If you pay R1,000 from your cheque account to your credit card, your net worth hasn't changed. If you counted that as an expense, your cash flow report would be wrong. This distinction — transfer vs expense — trips up most first-time finance app implementations.

---

### 2. Transaction Tracking

- Manually enter transactions with the following fields:
  - Date
  - Amount
  - Type: `income` | `expense` | `transfer`
  - Account (which account the transaction belongs to)
  - Category
  - Notes (optional)
- Edit and delete existing transactions
- Filter and search transactions by: date range, account, category, type

> **Learning note:** Soft-delete vs hard-delete is a design decision worth knowing. Hard delete removes the row from the database permanently. Soft delete marks it as deleted (e.g. `deleted_at` timestamp) but keeps the data. For a finance app, soft delete is safer — it means you can recover a mistakenly deleted transaction. For v1 we'll keep it simple with hard delete, but know this trade-off exists.

---

### 3. CSV Import

- Upload a CSV bank statement
- Map CSV columns to transaction fields (date, description, amount)
- Preview parsed transactions before confirming import
- Detect duplicates by comparing: **date + amount + description** against existing transactions
- Flag duplicates for user review — do not silently skip them

> **Learning note:** Deduplication is harder than it sounds. Banks don't give transactions unique IDs in their CSV exports. So we fingerprint each transaction using a combination of fields. The risk is false positives — two legitimate transactions on the same day for the same amount (e.g. two R50 grocery trips). Flagging instead of auto-skipping puts the human in control of the final call.

---

### 4. Categories

- A default set of categories is provided out of the box:
  - **Income:** Salary, Freelance, Investment Return, Other Income
  - **Expense:** Groceries, Transport, Utilities, Rent, Entertainment, Healthcare, Insurance, Subscriptions, Other Expense
- Users can create, rename, and delete custom categories
- Categories have a **type**: `income` or `expense`
- Each transaction is assigned exactly one category

> **Learning note:** Separating income and expense categories prevents a spending breakdown chart from mixing salary with groceries. It also means budget limits (which only apply to expenses) won't accidentally appear on income categories.

---

### 5. Budgeting

- Set a monthly spending limit per expense category
- Budgets **reset automatically** each calendar month — no manual renewal needed
- Dashboard shows current spend vs budget limit per category
- Visual indicator at three states:
  - ✅ Under budget (< 80% spent)
  - ⚠️ Approaching limit (80–99% spent)
  - 🔴 Over budget (≥ 100% spent)

> **Learning note:** The auto-reset behaviour is a product decision, not a technical one. You could alternatively let users set a budget once and have it persist indefinitely. Auto-reset suits most people because spending patterns repeat monthly. If you find a category where you want a one-off limit (e.g. a holiday fund), that's a v2 feature.

---

### 6. Dashboard

The dashboard is the core of the application. All metrics default to the **current calendar month** with the ability to switch to any past month.

| Widget | Description |
|---|---|
| **Net Worth** | Total assets minus total liabilities, with month-on-month change |
| **Account Balances** | Live balance per account, grouped by account type |
| **Monthly Cash Flow** | Total income, total expenses, and net (income − expenses) |
| **Savings Rate** | (Income − Expenses) ÷ Income, expressed as a percentage |
| **Spending Breakdown** | Expenses by category shown as a chart |
| **Income Breakdown** | Income by category shown as a chart |
| **Budget Status** | Per-category spend vs limit with visual indicators |
| **Recent Transactions** | Last 10 transactions with date, description, category, amount |
| **Largest Expenses** | Top 5 highest expense transactions for the selected month |
| **Time Filter** | Switch dashboard view between months |

---

## Data Model

> **Learning note:** Defining the data model before writing any code is one of the highest-leverage things you can do. It forces you to answer questions like "does a budget belong to a month or to a user?" before you've built anything that depends on the answer. Changes to a data model mid-build are expensive.

| Entity | Key Fields |
|---|---|
| `Account` | `id`, `name`, `type` (cheque/savings/credit/investment), `opening_balance`, `created_at` |
| `Transaction` | `id`, `date`, `amount`, `type` (income/expense/transfer), `account_id`, `category_id`, `notes`, `created_at` |
| `Category` | `id`, `name`, `type` (income/expense) |
| `Budget` | `id`, `category_id`, `monthly_limit`, `month` (YYYY-MM) |
| `Import` | `id`, `filename`, `status`, `transaction_count`, `duplicate_count`, `created_at` |

**Key relationships:**
- A `Transaction` belongs to one `Account` and one `Category`
- A transfer transaction uses a `from_account_id` and `to_account_id` instead of a single `account_id`
- A `Budget` is scoped to a specific month — a new row is created each month per category

---

## Tech Stack

> **Learning note:** The goal here is to use the simplest stack that solves the problem. Each added technology is a new thing to learn, configure, debug, and maintain. Redis and BullMQ (from your original spec) are powerful tools for background job processing — but processing a CSV file synchronously on a personal app takes milliseconds. Never add infrastructure you don't need yet.

| Layer | Choice | Why |
|---|---|---|
| **Language** | TypeScript | Type safety catches bugs at compile time, not runtime. Self-documenting. Better tooling. |
| **Frontend** | React + Vite | Component-based UI, fast dev server, industry standard |
| **Backend** | Node.js + Express | You already know JS, TypeScript compiles directly to Node, simple REST API |
| **Database** | PostgreSQL | Relational model fits financial data well. Free on Railway. |
| **Hosting** | Railway (free tier) | Hosts both the Node app and PostgreSQL. Zero ops, deploys from GitHub. |
| **Styling** | Tailwind CSS | Utility-first, fast to build with, no context switching between files |
| **Charts** | Recharts | React-native charting library, easy to integrate |

**No Redis. No job queues. No Docker (for now).** CSV processing happens synchronously — fast enough for personal-scale imports.

---

## Non-Goals (v1)

These are explicitly out of scope. Writing them down is just as important as the feature list — it prevents scope creep.

- Mobile app
- Real-time bank API integration
- Multi-currency support
- Multiple users or shared household access
- AI-powered insights or financial advice
- Investment portfolio tracking (individual stocks/ETFs) — investment accounts track a total balance only
- Recurring transaction automation

---

## What Changed From Your Original Spec

| Original | Revised | Reason |
|---|---|---|
| Node + Express + PostgreSQL + Redis + BullMQ + Docker + AWS | Node + Express + PostgreSQL + Railway | Redis/BullMQ is overkill for personal-scale CSV imports. Docker + AWS adds ops overhead with no benefit for a single user. |
| JavaScript | TypeScript | Better for learning. Catches data shape bugs at compile time. Self-documents your data model. |
| Implicit balance storage | Derived balances from transactions | Single source of truth. Prevents sync bugs when editing historical transactions. |
| Transfer mentioned twice, undefined | Transfer explicitly defined as balance-neutral | Prevents double-counting in cash flow and net worth calculations. |
| No opening balances | Opening balance field on Account | Without this, account balances are wrong until you import full transaction history. |
| No category types | Categories typed as income or expense | Keeps spending and income breakdowns separate. Prevents budgets appearing on income categories. |
| No login mentioned | Simple password gate | App is publicly hosted — needs basic protection. |
| Budget reset behaviour undefined | Auto-reset monthly | Resolves ambiguity before it becomes a bug. |

---

## Success Criteria

- [ ] Can create accounts with opening balances and see correct live balances immediately
- [ ] Can manually enter a transaction and have the dashboard reflect it without a page refresh
- [ ] Can import a CSV, preview parsed transactions, and confirm without creating duplicates
- [ ] Dashboard answers the three core questions clearly for the current month
- [ ] Budgets reset on the first of each month and show correct spend-vs-limit status
- [ ] Transfer transactions do not affect net cash flow calculations
- [ ] App is accessible via a public URL on Railway with password protection