import { Request, Response } from 'express'
import { query } from '../db'
import pool from '../db'

// GET /api/transactions
// Supports query params: account_id, category_id, type, date_from, date_to, search
export const getTransactions = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { account_id, category_id, type, date_from, date_to, search, page, limit, sort_by, sort_dir } = req.query

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

    // Sorting
    const allowedSortCols: Record<string, string> = {
      date: 't.date',
      amount: 't.amount',
      description: 't.description',
      category: 'c.name',
      account: 'a.name',
    }
    const sortCol = allowedSortCols[sort_by as string] ?? 't.date'
    const sortDirection = sort_dir === 'asc' ? 'ASC' : 'DESC'
    const orderClause = `${sortCol} ${sortDirection}, t.created_at DESC`

    // Count total before pagination
    const countResult = await query(
      `SELECT COUNT(*) FROM transactions t
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE ${conditions.join(' AND ')}`,
      params
    )
    const total = parseInt(countResult.rows[0].count, 10)

    // Pagination
    const pageNum  = Math.max(1, parseInt(page as string, 10) || 1)
    const limitNum = Math.min(200, Math.max(1, parseInt(limit as string, 10) || 50))
    const offset   = (pageNum - 1) * limitNum

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
       ORDER BY ${orderClause}
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...params, limitNum, offset]
    )

    res.json({ data: result.rows, total, page: pageNum, limit: limitNum })
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
// Supports: amount, date, description, category_id, notes, type, account_id, to_account_id
// Handles transfer pair creation / deletion when type changes
export const updateTransaction = async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id
  const { amount, date, description, category_id, notes, type, account_id, to_account_id } = req.body

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Load the existing row
    const existing = await client.query(
      `SELECT * FROM transactions WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId]
    )
    if (existing.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Transaction not found' })
    }
    const tx = existing.rows[0]

    const newType      = type       ?? tx.type
    const newAccountId = account_id ?? tx.account_id
    const newAmount    = amount     ?? tx.amount
    const newDate      = date       ?? tx.date
    const newDesc      = description ?? tx.description
    const newCatId     = category_id !== undefined ? category_id : tx.category_id
    const newNotes     = notes       !== undefined ? notes       : tx.notes

    const wasTransfer = tx.type === 'transfer'
    const isTransfer  = newType === 'transfer'

    if (isTransfer && !to_account_id && !tx.transfer_pair_id) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'to_account_id is required for transfers' })
    }

    // ── Case 1: was transfer, now non-transfer ───────────────────────────
    if (wasTransfer && !isTransfer) {
      // Soft-delete the paired leg
      if (tx.transfer_pair_id) {
        await client.query(
          `UPDATE transactions SET deleted_at = NOW(), updated_at = NOW() WHERE id = $1 AND user_id = $2`,
          [tx.transfer_pair_id, userId]
        )
      }
      // Update this row: change type, clear transfer fields
      const updated = await client.query(
        `UPDATE transactions
         SET type = $1, account_id = $2, amount = $3, date = $4, description = $5,
             category_id = $6, notes = $7,
             transfer_direction = NULL, transfer_pair_id = NULL,
             updated_at = NOW()
         WHERE id = $8 AND user_id = $9
         RETURNING *`,
        [newType, newAccountId, newAmount, newDate, newDesc, newCatId, newNotes, id, userId]
      )
      await client.query('COMMIT')
      return res.json(updated.rows[0])
    }

    // ── Case 2: was non-transfer, now transfer ───────────────────────────
    if (!wasTransfer && isTransfer) {
      const destId = to_account_id
      if (!destId) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: 'to_account_id is required for transfers' })
      }
      // Update this row to be the debit leg
      const debitUpdated = await client.query(
        `UPDATE transactions
         SET type = 'transfer', account_id = $1, amount = $2, date = $3, description = $4,
             category_id = $5, notes = $6, transfer_direction = 'debit',
             updated_at = NOW()
         WHERE id = $7 AND user_id = $8
         RETURNING *`,
        [newAccountId, newAmount, newDate, newDesc, newCatId, newNotes, id, userId]
      )
      const debitRow = debitUpdated.rows[0]

      // Create the credit leg
      const creditResult = await client.query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, type, amount, date, description, notes, transfer_direction, transfer_pair_id)
         VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, 'credit', $8)
         RETURNING *`,
        [userId, destId, newCatId, newAmount, newDate, newDesc, newNotes, debitRow.id]
      )
      const creditRow = creditResult.rows[0]

      // Back-fill pair id on debit leg
      await client.query(
        `UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`,
        [creditRow.id, debitRow.id]
      )

      await client.query('COMMIT')
      return res.json({ ...debitRow, transfer_pair_id: creditRow.id })
    }

    // ── Case 3: was transfer, still transfer ─────────────────────────────
    if (wasTransfer && isTransfer) {
      const newDestId = to_account_id ?? null

      // Update this (debit/credit) leg
      const updated = await client.query(
        `UPDATE transactions
         SET account_id = $1, amount = $2, date = $3, description = $4,
             category_id = $5, notes = $6, updated_at = NOW()
         WHERE id = $7 AND user_id = $8
         RETURNING *`,
        [newAccountId, newAmount, newDate, newDesc, newCatId, newNotes, id, userId]
      )

      // If the destination account changed (and we know the pair), update the paired leg's account_id too
      if (tx.transfer_pair_id) {
        const pairFields: string[] = ['amount = $1', 'date = $2', 'description = $3', 'notes = $4', 'updated_at = NOW()']
        const pairParams: unknown[] = [newAmount, newDate, newDesc, newNotes]
        let pIdx = 5

        // Only change the pair's account_id if a new destination was explicitly provided
        if (newDestId && tx.transfer_direction === 'debit') {
          pairFields.push(`account_id = $${pIdx++}`)
          pairParams.push(newDestId)
        } else if (newDestId && tx.transfer_direction === 'credit') {
          // If we're editing the credit leg and a to_account_id was supplied, treat it as the new account for this leg
          pairFields.push(`account_id = $${pIdx++}`)
          pairParams.push(newDestId)
        }

        pairParams.push(tx.transfer_pair_id, userId)
        await client.query(
          `UPDATE transactions SET ${pairFields.join(', ')}
           WHERE id = $${pIdx++} AND user_id = $${pIdx}`,
          pairParams
        )
      }

      await client.query('COMMIT')
      return res.json(updated.rows[0])
    }

    // ── Case 4: plain income/expense ────────────────────────────────────
    const updated = await client.query(
      `UPDATE transactions
       SET type = $1, account_id = $2, amount = $3, date = $4, description = $5,
           category_id = $6, notes = $7, updated_at = NOW()
       WHERE id = $8 AND user_id = $9 AND deleted_at IS NULL
       RETURNING *`,
      [newType, newAccountId, newAmount, newDate, newDesc, newCatId, newNotes, id, userId]
    )

    await client.query('COMMIT')
    res.json(updated.rows[0])
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error updating transaction:', error)
    res.status(500).json({ error: 'Failed to update transaction' })
  } finally {
    client.release()
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
