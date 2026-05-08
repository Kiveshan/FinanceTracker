// LEARNING NOTE: These mirror the types in server/src/types/index.ts
// In a more advanced setup you'd share one types file between client
// and server using the shared/ folder we created. For now we duplicate
// them — it's a small cost and keeps things simple while you're learning.

export type AccountType = 'cheque' | 'savings' | 'credit' | 'investment'

export interface Account {
  id: number
  name: string
  type: AccountType
  opening_balance: number
  current_balance: number  // calculated by the server, not in DB
  is_active: boolean
  created_at: string
}

export interface CreateAccountBody {
  name: string
  type: AccountType
  opening_balance: number
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

export  interface CreateCategoryBody {
     name : string
     type : CategoryType
}

export interface UpdateCategoryBody {
  name?: string
  type?: CategoryType
}

export type TransactionType = 'income' | 'expense' | 'transfer'
export type TransferDirection = 'debit' | 'credit'

export interface Transaction {
  id: number
  user_id: number
  account_id: number
  account_name?: string
  to_account_name?: string
  category_id: number | null
  category_name?: string | null
  type: TransactionType
  transfer_direction: TransferDirection | null
  transfer_pair_id: number | null
  amount: number
  date: string
  description: string
  notes: string | null
  import_id: number | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface CreateTransactionBody {
  account_id: number
  to_account_id?: number
  category_id?: number | null
  type: TransactionType
  amount: number
  date: string
  description: string
  notes?: string | null
}

export interface UpdateTransactionBody {
  type?: TransactionType
  account_id?: number
  to_account_id?: number | null
  amount?: number
  date?: string
  description?: string
  category_id?: number | null
  notes?: string | null
}

export interface Budget {
  id: number
  user_id: number
  category_id: number
  monthly_limit: number
  created_at: string
  updated_at: string
}

export interface BudgetWithSpend {
  id: number | null
  category_id: number
  category_name: string
  category_type: CategoryType
  monthly_limit: number | null
  spent: number
  percentage: number | null
}

export interface CreateBudgetBody {
  category_id: number
  monthly_limit: number
}