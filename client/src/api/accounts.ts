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


  
    if (!response.ok) {
      throw new Error('Failed to fetch accounts')
    }

        const data = await response.json()

    return data.map((account : Account)=> parseAccount(account))
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

    const raw_data : Account = await response.json()
  
  
    return parseAccount ({...raw_data, current_balance : raw_data.opening_balance}) 
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



function parseAccount(data:Account) {
  return {...data ,opening_balance : data.opening_balance, current_balance : +data.current_balance } 
}