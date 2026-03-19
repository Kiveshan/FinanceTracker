-- =============================================================================
-- Seed Data
-- =============================================================================
-- Run this file to reset the database to a clean development state.
-- WARNING: This wipes all existing data. Do not run in production.
--
-- Usage:
--   psql -U postgres -d finance_tracker -f server/src/db/seed.sql
-- =============================================================================

-- Wipe all data and reset id counters
-- ORDER matters here — child tables must be truncated before parent tables
-- because of foreign key constraints. CASCADE handles this automatically.
TRUNCATE TABLE
  imports,
  transactions,
  budgets,
  categories,
  accounts,
  users
RESTART IDENTITY CASCADE;

-- =============================================================================
-- Users
-- =============================================================================
-- One dev user. Password auth comes later — placeholder hash for now.
INSERT INTO users (email, password_hash) VALUES
  ('dev@financetracker.com', 'placeholder_not_a_real_hash');

-- =============================================================================
-- Accounts
-- =============================================================================
-- Realistic starting balances so dashboard metrics are meaningful immediately
INSERT INTO accounts (user_id, name, type, opening_balance) VALUES
  (1, 'FNB Cheque',      'cheque',     15000.00),
  (1, 'FNB Savings',     'savings',    42000.00),
  (1, 'FNB Credit Card', 'credit',     -3500.00),
  (1, 'Easy Equities',   'investment', 28000.00);

-- =============================================================================
-- Categories
-- =============================================================================
-- Default income categories
INSERT INTO categories (user_id, name, type, is_default) VALUES
  (1, 'Salary',            'income',  TRUE),
  (1, 'Freelance',         'income',  TRUE),
  (1, 'Investment Return', 'income',  TRUE),
  (1, 'Other Income',      'income',  TRUE);

-- Default expense categories
INSERT INTO categories (user_id, name, type, is_default) VALUES
  (1, 'Groceries',     'expense', TRUE),
  (1, 'Transport',     'expense', TRUE),
  (1, 'Utilities',     'expense', TRUE),
  (1, 'Rent',          'expense', TRUE),
  (1, 'Entertainment', 'expense', TRUE),
  (1, 'Healthcare',    'expense', TRUE),
  (1, 'Insurance',     'expense', TRUE),
  (1, 'Subscriptions', 'expense', TRUE),
  (1, 'Eating Out',    'expense', TRUE),
  (1, 'Other Expense', 'expense', TRUE);

-- =============================================================================
-- Transactions — current month
-- =============================================================================
-- Using DATE_TRUNC to always generate dates relative to the current month.
-- This means the seed data is always relevant no matter when you run it.
-- LEARNING NOTE: DATE_TRUNC('month', NOW()) gives you the first day of the
-- current month. Adding intervals like '5 days' offsets from there.
-- This way your dashboard always shows data for the current month.

INSERT INTO transactions (user_id, account_id, category_id, type, amount, date, description) VALUES
  -- Income
  (1, 1, 1, 'income',  25000.00, DATE_TRUNC('month', NOW())::DATE + 0,  'Monthly salary'),
  (1, 1, 2, 'income',   4500.00, DATE_TRUNC('month', NOW())::DATE + 3,  'Freelance project payment'),

  -- Expenses
  (1, 1, 5, 'expense',  2800.00, DATE_TRUNC('month', NOW())::DATE + 1,  'Woolworths groceries'),
  (1, 1, 6, 'expense',   650.00, DATE_TRUNC('month', NOW())::DATE + 2,  'Uber and fuel'),
  (1, 1, 7, 'expense',  1200.00, DATE_TRUNC('month', NOW())::DATE + 2,  'Electricity and water'),
  (1, 1, 8, 'expense', 12000.00, DATE_TRUNC('month', NOW())::DATE + 1,  'Monthly rent'),
  (1, 1, 9, 'expense',   850.00, DATE_TRUNC('month', NOW())::DATE + 4,  'Steers and movies'),
  (1, 1, 12,'expense',   599.00, DATE_TRUNC('month', NOW())::DATE + 3,  'Netflix, Spotify, iCloud'),

  -- Credit card expenses
  (1, 3, 5, 'expense',  1500.00, DATE_TRUNC('month', NOW())::DATE + 5,  'Checkers groceries'),
  (1, 3, 10,'expense',   450.00, DATE_TRUNC('month', NOW())::DATE + 6,  'Clicks pharmacy');

-- =============================================================================
-- Transfer example — cheque to savings
-- =============================================================================
-- LEARNING NOTE: Transfers are two rows sharing a transfer_pair_id.
-- We use a subquery to set transfer_pair_id to the id of the first row
-- so both rows are linked. The first row is the debit (money leaving cheque),
-- the second is the credit (money arriving in savings).

WITH debit AS (
  INSERT INTO transactions
    (user_id, account_id, category_id, type, amount, date, description, transfer_direction)
  VALUES
    (1, 1, NULL, 'transfer', 5000.00, DATE_TRUNC('month', NOW())::DATE + 7,
     'Transfer to savings', 'debit')
  RETURNING id
)
INSERT INTO transactions
  (user_id, account_id, category_id, type, amount, date, description, transfer_direction, transfer_pair_id)
SELECT
  1, 2, NULL, 'transfer', 5000.00, DATE_TRUNC('month', NOW())::DATE + 7,
  'Transfer from cheque', 'credit', debit.id
FROM debit;

-- Update transfer_pair_id on the debit row to match the credit row
-- so both rows reference each other symmetrically
UPDATE transactions t1
SET transfer_pair_id = t2.id
FROM transactions t2
WHERE t1.description = 'Transfer to savings'
  AND t2.description = 'Transfer from cheque'
  AND t1.transfer_pair_id IS NULL;

-- =============================================================================
-- Budgets — current month
-- =============================================================================
INSERT INTO budgets (user_id, category_id, monthly_limit, month) VALUES
  (1, 5,  3500.00, TO_CHAR(NOW(), 'YYYY-MM')),  -- Groceries
  (1, 6,  1000.00, TO_CHAR(NOW(), 'YYYY-MM')),  -- Transport
  (1, 7,  1500.00, TO_CHAR(NOW(), 'YYYY-MM')),  -- Utilities
  (1, 8, 13000.00, TO_CHAR(NOW(), 'YYYY-MM')),  -- Rent
  (1, 9,  1000.00, TO_CHAR(NOW(), 'YYYY-MM')),  -- Entertainment
  (1, 12,  800.00, TO_CHAR(NOW(), 'YYYY-MM'));  -- Subscriptions

-- =============================================================================
-- Verify
-- =============================================================================
SELECT 'users'        AS table_name, COUNT(*) AS rows FROM users
UNION ALL
SELECT 'accounts',      COUNT(*) FROM accounts
UNION ALL
SELECT 'categories',    COUNT(*) FROM categories
UNION ALL
SELECT 'transactions',  COUNT(*) FROM transactions
UNION ALL
SELECT 'budgets',       COUNT(*) FROM budgets;
