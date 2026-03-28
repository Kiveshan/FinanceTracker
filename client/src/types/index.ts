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