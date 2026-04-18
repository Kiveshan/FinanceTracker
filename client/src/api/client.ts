export const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001/api'

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('finance_token')
  return token ? { Authorization: `Bearer ${token}` } : {}
}
