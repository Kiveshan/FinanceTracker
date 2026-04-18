import type { Category, CreateCategoryBody, UpdateCategoryBody } from '../types'
import { BASE_URL, getAuthHeaders } from './client'

export const categoriesApi = {
  getAll: async (): Promise<Category[]> => {
    const response = await fetch(`${BASE_URL}/categories`, { headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to fetch categories')
    return response.json()
  },

  create: async (body: CreateCategoryBody): Promise<Category> => {
    const response = await fetch(`${BASE_URL}/categories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('Failed to create category')
    return response.json()
  },

  update: async (id: number, body: UpdateCategoryBody): Promise<void> => {
    const response = await fetch(`${BASE_URL}/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error('Failed to update category')
  },

  delete: async (id: number): Promise<void> => {
    const response = await fetch(`${BASE_URL}/categories/${id}`, { method: 'DELETE', headers: getAuthHeaders() })
    if (!response.ok) throw new Error('Failed to delete category')
  },
}
