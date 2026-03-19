-- =============================================================================
-- Personal Finance Dashboard — Database Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT        NOT NULL UNIQUE,
  password_hash TEXT        NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS accounts (
  id              SERIAL PRIMARY KEY,
  user_id         INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT           NOT NULL,
  type            TEXT           NOT NULL CHECK (type IN ('cheque', 'savings', 'credit', 'investment')),
  opening_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  is_active       BOOLEAN        NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  type       TEXT        NOT NULL CHECK (type IN ('income', 'expense')),
  is_default BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id                 SERIAL PRIMARY KEY,
  user_id            INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  account_id         INTEGER        NOT NULL REFERENCES accounts(id) ON DELETE RESTRICT,
  category_id        INTEGER        REFERENCES categories(id) ON DELETE SET NULL,
  type               TEXT           NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  amount             NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  date               DATE           NOT NULL,
  description        TEXT           NOT NULL DEFAULT '',
  notes              TEXT,
  transfer_pair_id   INTEGER,
  transfer_direction TEXT           CHECK (transfer_direction IN ('debit', 'credit')),
  deleted_at         TIMESTAMPTZ,
  import_id          INTEGER,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS budgets (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id   INTEGER        NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  monthly_limit NUMERIC(12, 2) NOT NULL CHECK (monthly_limit > 0),
  month         CHAR(7)        NOT NULL,
  created_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, category_id, month)
);

CREATE TABLE IF NOT EXISTS imports (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER     NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename          TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'complete', 'failed')),
  transaction_count INTEGER     NOT NULL DEFAULT 0,
  duplicate_count   INTEGER     NOT NULL DEFAULT 0,
  error_message     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions
  ADD CONSTRAINT fk_transactions_import
  FOREIGN KEY (import_id) REFERENCES imports(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_user_id     ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id  ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date        ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_import_id   ON transactions(import_id);
CREATE INDEX IF NOT EXISTS idx_transactions_active      ON transactions(user_id, date)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_user_month ON budgets(user_id, month);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id   ON accounts(user_id);
