import { useState, useCallback } from 'react'
import { BASE_URL } from '../api/client'

const TOKEN_KEY = 'finance_token'

const EMAIL_KEY = 'finance_email'

export function useAuth() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY))
  const [email, setEmail] = useState<string | null>(() => localStorage.getItem(EMAIL_KEY))

  const isAuthenticated = token !== null

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Login failed')
    }
    const { token: newToken, user } = await response.json()
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(EMAIL_KEY, user.email)
    setToken(newToken)
    setEmail(user.email)
  }, [])

  const register = useCallback(async (email: string, password: string): Promise<void> => {
    const response = await fetch(`${BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error ?? 'Registration failed')
    }
    const { token: newToken, user } = await response.json()
    localStorage.setItem(TOKEN_KEY, newToken)
    localStorage.setItem(EMAIL_KEY, user.email)
    setToken(newToken)
    setEmail(user.email)
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    setToken(null)
    setEmail(null)
  }, [])

  return { token, email, isAuthenticated, login, register, logout }
}
