import type { Transaction, CreateTransactionBody, UpdateTransactionBody } from '../types'
import { BASE_URL, getAuthHeaders } from './client'

export interface TransactionFilters {
  account_id?: number
  category_id?: number
  type?: string
  date_from?: string
  date_to?: string
  search?: string
  page?: number
  limit?: number
  sort_by?: string
  sort_dir?: 'asc' | 'desc'
}

export interface PaginatedTransactions {
  data: Transaction[]
  total: number
  page: number
  limit: number
}

export const transactionsApi = {
  getAll: async (filters: TransactionFilters = {}): Promise<PaginatedTransactions> => {
    const params = new URLSearchParams()
    if (filters.account_id)  params.set('account_id',  String(filters.account_id))
    if (filters.category_id) params.set('category_id', String(filters.category_id))
    if (filters.type)        params.set('type',        filters.type)
    if (filters.date_from)   params.set('date_from',   filters.date_from)
    if (filters.date_to)     params.set('date_to',     filters.date_to)
    if (filters.search)      params.set('search',      filters.search)
    if (filters.page)        params.set('page',        String(filters.page))
    if (filters.limit)       params.set('limit',       String(filters.limit))
    if (filters.sort_by)     params.set('sort_by',     filters.sort_by)
    if (filters.sort_dir)    params.set('sort_dir',    filters.sort_dir)

    const qs = params.toString()
    const response = await fetch(`${BASE_URL}/transactions${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to fetch transactions')
    const json = await response.json()
    return {
      data: json.data.map(parseTransaction),
      total: json.total,
      page: json.page,
      limit: json.limit,
    }
  },

  create: async (body: CreateTransactionBody): Promise<Transaction | { debit: Transaction; credit: Transaction }> => {
    const response = await fetch(`${BASE_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Failed to create transaction')
    }
    const data = await response.json()
    if ('debit' in data) {
      return { debit: parseTransaction(data.debit), credit: parseTransaction(data.credit) }
    }
    return parseTransaction(data)
  },

  update: async (id: number, body: UpdateTransactionBody): Promise<Transaction> => {
    const response = await fetch(`${BASE_URL}/transactions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('Failed to update transaction')
    return parseTransaction(await response.json())
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/transactions/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to delete transaction')
  },
}

function parseTransaction(data: Transaction): Transaction {
  return { ...data, amount: +data.amount }
}
