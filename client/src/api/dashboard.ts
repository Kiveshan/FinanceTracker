import { BASE_URL, getAuthHeaders } from './client'
import type { Transaction, Account } from '../types'

export interface CategoryChartItem {
  name: string
  value: number
}

export interface BudgetStatusItem {
  category_id: number
  category_name: string
  id: number | null
  monthly_limit: number | null
  spent: number
  percentage: number | null
}

export interface DashboardData {
  month: string
  net_worth: number
  net_worth_change: number
  cash_flow: {
    total_income: number
    total_expenses: number
    net: number
  }
  savings_rate: number
  spending_by_category: CategoryChartItem[]
  income_by_category: CategoryChartItem[]
  budget_status: BudgetStatusItem[]
  recent_transactions: (Transaction & { account_name: string; category_name: string | null })[]
  largest_expenses: (Transaction & { account_name: string; category_name: string | null })[]
  accounts: Account[]
}

export const dashboardApi = {
  get: async (month?: string): Promise<DashboardData> => {
    const qs = month ? `?month=${month}` : ''
    const response = await fetch(`${BASE_URL}/dashboard${qs}`, { headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to fetch dashboard data')
    return response.json()
  },
}
