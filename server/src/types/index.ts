// =============================================================================
// Shared TypeScript types
// These mirror your database schema exactly.
// =============================================================================

// LEARNING NOTE: Why define types that mirror the database?
// Your database enforces structure at the SQL level. TypeScript enforces it
// at the application level. Having both means bugs get caught in two places.
// If your database has amount as NUMERIC, your TypeScript type has amount as
// number. If you accidentally pass a string, TypeScript catches it before
// the query ever runs.

export type AccountType = 'cheque' | 'savings' | 'credit' | 'investment'

export interface Account {
  id: number
  user_id: number
  name: string
  type: AccountType
  opening_balance: number
  created_at: Date
  updated_at: Date
  is_active: boolean
}

// LEARNING NOTE: What is the difference between type and interface?
// Both define the shape of an object. In practice for this project they
// are interchangeable. The convention we'll follow: use `interface` for
// objects that represent entities (things from the database), and use
// `type` for unions like AccountType where you're defining a set of
// allowed values.

export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransferDirection = 'debit' | 'credit'

export interface Transaction {
  id: number
  user_id: number
  account_id: number
  category_id: number | null
  type: TransactionType
  amount: number
  date: string
  description: string
  notes: string | null
  transfer_pair_id: number | null
  transfer_direction: TransferDirection | null
  deleted_at: Date | null
  import_id: number | null
  created_at: Date
  updated_at: Date
}

export type CategoryType = 'income' | 'expense'

export interface Category {
  id: number
  user_id: number
  name: string
  type: CategoryType
  is_default: boolean
  created_at: Date
}

export interface Budget {
  id: number
  user_id: number
  category_id: number
  monthly_limit: number
  month: string
  created_at: Date
  updated_at: Date
}

// LEARNING NOTE: What are these "Create" types?
// When creating a new account, you don't have an id yet — the database
// generates it. You also don't have created_at or updated_at — the database
// sets those automatically. So the shape of "data coming in to create an
// account" is different from the shape of "a complete account from the database".
// Omit<Account, 'id' | 'created_at' | 'updated_at'> means: take the Account
// interface and remove those three fields. This is called a utility type.
// What the client sends when creating an account
export interface CreateAccountBody {
  name: string
  type: AccountType
  opening_balance?: number
}

// What the client sends when updating an account
export interface UpdateAccountBody {
  name?: string
  opening_balance?: number
}

export type CreateTransactionInput = Omit<Transaction,'id' | 'created_at' | 'updated_at' | 'deleted_at'>
