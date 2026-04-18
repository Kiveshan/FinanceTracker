import { Request, Response } from 'express'
import { query } from '../db'
import pool from '../db'

// GET /api/transactions
// Supports query params: account_id, category_id, type, date_from, date_to, search
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { account_id, category_id, type, date_from, date_to, search } = req.query

    const conditions: string[] = ['t.user_id = $1', 't.deleted_at IS NULL']
    const params: unknown[] = [userId]
    let idx = 2

    if (account_id) {
      conditions.push(`t.account_id = $${idx++}`)
      params.push(account_id)
    }
    if (category_id) {
      conditions.push(`t.category_id = $${idx++}`)
      params.push(category_id)
    }
    if (type) {
      conditions.push(`t.type = $${idx++}`)
      params.push(type)
    }
    if (date_from) {
      conditions.push(`t.date >= $${idx++}`)
      params.push(date_from)
    }
    if (date_to) {
      conditions.push(`t.date <= $${idx++}`)
      params.push(date_to)
    }
    if (search) {
      conditions.push(`t.description ILIKE $${idx++}`)
      params.push(`%${search}%`)
    }

    const result = await query(
      `SELECT
         t.*,
         a.name AS account_name,
         c.name AS category_name,
         ta.name AS to_account_name
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN transactions tp ON tp.id = t.transfer_pair_id AND tp.deleted_at IS NULL
       LEFT JOIN accounts ta ON ta.id = tp.account_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.date DESC, t.created_at DESC`,
      params
    )

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching transactions:', error)
    res.status(500).json({ error: 'Failed to fetch transactions' })
  }
}

// POST /api/transactions
// For transfers: creates two paired rows inside a DB transaction
export const createTransaction = async (req: Request, res: Response) => {
  const {
    account_id,
    to_account_id,
    category_id,
    type,
    amount,
    date,
    description,
    notes,
  } = req.body

  if (!account_id || !type || !amount || !date || !description) {
    return res.status(400).json({ error: 'account_id, type, amount, date, and description are required' })
  }

  const validTypes = ['income', 'expense', 'transfer']
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${validTypes.join(', ')}` })
  }

  if (type === 'transfer' && !to_account_id) {
    return res.status(400).json({ error: 'to_account_id is required for transfers' })
  }

  if (Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be greater than 0' })
  }

  const userId = req.user!.id
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    if (type === 'transfer') {
      // Insert the debit leg (money leaving from_account)
      const debitResult = await client.query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, type, amount, date, description, notes, transfer_direction)
         VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, 'debit')
         RETURNING *`,
        [userId, account_id, category_id ?? null, amount, date, description, notes ?? null]
      )
      const debitRow = debitResult.rows[0]

      // Insert the credit leg (money arriving at to_account)
      const creditResult = await client.query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, type, amount, date, description, notes, transfer_direction, transfer_pair_id)
         VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, 'credit', $8)
         RETURNING *`,
        [userId, to_account_id, category_id ?? null, amount, date, description, notes ?? null, debitRow.id]
      )
      const creditRow = creditResult.rows[0]

      // Back-fill pair id on the debit row
      await client.query(
        `UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`,
        [creditRow.id, debitRow.id]
      )

      await client.query('COMMIT')
      return res.status(201).json({ debit: { ...debitRow, transfer_pair_id: creditRow.id }, credit: creditRow })
    }

    // Income or expense — single row
    const result = await client.query(
      `INSERT INTO transactions
         (user_id, account_id, category_id, type, amount, date, description, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [userId, account_id, category_id ?? null, type, amount, date, description, notes ?? null]
    )

    await client.query('COMMIT')
    res.status(201).json(result.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error creating transaction:', error)
    res.status(500).json({ error: 'Failed to create transaction' })
  } finally {
    client.release()
  }
}

// PATCH /api/transactions/:id
export const updateTransaction = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { amount, date, description, category_id, notes } = req.body

    const result = await query(
      `UPDATE transactions
       SET amount      = COALESCE($1, amount),
           date        = COALESCE($2, date),
           description = COALESCE($3, description),
           category_id = COALESCE($4, category_id),
           notes       = COALESCE($5, notes),
           updated_at  = NOW()
       WHERE id = $6 AND user_id = $7 AND deleted_at IS NULL
       RETURNING *`,
      [amount ?? null, date ?? null, description ?? null, category_id ?? null, notes ?? null, id, req.user!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating transaction:', error)
    res.status(500).json({ error: 'Failed to update transaction' })
  }
}

// DELETE /api/transactions/:id  — soft delete
// If the transaction is one leg of a transfer, soft-deletes both legs
export const deleteTransaction = async (req: Request, res: Response) => {
  const { id } = req.params
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const userId = req.user!.id
    const found = await client.query(
      `SELECT id, type, transfer_pair_id FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    )

    if (found.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Transaction not found' })
    }

    const tx = found.rows[0]
    await client.query(
      `UPDATE transactions SET deleted_at = NOW() WHERE id = $1`,
      [tx.id]
    )

    if (tx.type === 'transfer' && tx.transfer_pair_id) {
      await client.query(
        `UPDATE transactions SET deleted_at = NOW() WHERE id = $1`,
        [tx.transfer_pair_id]
      )
    }

    await client.query('COMMIT')
    res.json({ message: 'Transaction deleted successfully' })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error deleting transaction:', error)
    res.status(500).json({ error: 'Failed to delete transaction' })
  } finally {
    client.release()
  }
}
