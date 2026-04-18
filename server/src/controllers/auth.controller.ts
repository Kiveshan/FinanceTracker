import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { query } from '../db'

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET is not set')
  return secret
}

// POST /api/auth/register
// Creates the first user account (only allowed when no users exist yet)
export const register = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }

    const existing = await query(`SELECT id FROM users WHERE email = $1`, [email.toLowerCase()])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with that email already exists' })
    }

    const hash = await bcrypt.hash(password, 12)
    const result = await query(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
      [email.toLowerCase(), hash]
    )

    const user = result.rows[0]
    const token = jwt.sign({ user_id: user.id }, getSecret(), { expiresIn: '30d' })
    res.status(201).json({ token, user: { id: user.id, email: user.email } })
  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
}

// POST /api/auth/login
// Accepts { email, password }, looks up user in DB, returns JWT
export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }

    const result = await query(
      `SELECT id, email, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }

    const user = result.rows[0]
    const valid = await bcrypt.compare(password, user.password_hash)
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect email or password' })
    }

    const token = jwt.sign({ user_id: user.id }, getSecret(), { expiresIn: '30d' })
    res.json({ token, user: { id: user.id, email: user.email } })
  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
}
