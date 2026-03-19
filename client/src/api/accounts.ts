import type { Account, CreateAccountBody } from '../types'

// LEARNING NOTE: Why a dedicated API layer?
// You could call fetch() directly inside your components. But then if
// the URL changes, or you need to add an auth header, you'd update it
// in every component. The API layer centralises all backend communication.
// Components call getAccounts() — they don't know or care about fetch().

const BASE_URL = 'http://localhost:3001/api'

export const accountsApi = {
  getAll: async (): Promise<Account[]> => {
    const response = await fetch(`${BASE_URL}/accounts`)

    // LEARNING NOTE: fetch() does NOT throw an error for 4xx/5xx responses.
    // A 404 or 500 still resolves successfully — you have to check ok manually.
    // This trips up almost everyone the first time they use fetch.
    if (!response.ok) {
      throw new Error('Failed to fetch accounts')
    }

    return response.json()
  },

  create: async (data: CreateAccountBody): Promise<Account> => {
    const response = await fetch(`${BASE_URL}/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      throw new Error('Failed to create account')
    }

    return response.json()
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/accounts/${id}`, {
      method: 'DELETE'
    })

    if (!response.ok) {
      throw new Error('Failed to delete account')
    }
  }
}
