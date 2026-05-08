import type { BudgetWithSpend, CreateBudgetBody } from '../types'
import { BASE_URL, getAuthHeaders } from './client'

export const budgetsApi = {
  getAll: async (month?: string): Promise<BudgetWithSpend[]> => {
    const qs = month ? `?month=${month}` : ''
    const response = await fetch(`${BASE_URL}/budgets${qs}`, { headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to fetch budgets')
    return response.json()
  },

  upsert: async (body: CreateBudgetBody): Promise<void> => {
    const response = await fetch(`${BASE_URL}/budgets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('Failed to save budget')
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/budgets/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to delete budget')
  },
}
