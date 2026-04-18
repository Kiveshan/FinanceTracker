import { Request, Response } from 'express'
import { query } from '../db'
import { CreateBudgetBody, UpdateBudgetBody } from '../types'

// GET /api/budgets?month=YYYY-MM
// Returns all expense categories with their budget limit and actual spend for the month
export const getBudgets = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { month } = req.query
    const targetMonth = (month as string) || new Date().toISOString().slice(0, 7)

    const result = await query(
      `SELECT
         c.id          AS category_id,
         c.name        AS category_name,
         c.type        AS category_type,
         b.id,
         b.monthly_limit,
         b.month,
         COALESCE(
           (
             SELECT SUM(t.amount)
             FROM transactions t
             WHERE t.category_id = c.id
               AND t.type = 'expense'
               AND t.deleted_at IS NULL
               AND t.user_id = $1
               AND TO_CHAR(t.date, 'YYYY-MM') = $2
           ),
           0
         ) AS spent
       FROM categories c
       LEFT JOIN budgets b
         ON b.category_id = c.id AND b.month = $2 AND b.user_id = $1
       WHERE c.user_id = $1
         AND c.type = 'expense'
       ORDER BY c.name ASC`,
      [userId, targetMonth]
    )

    const rows = result.rows.map(row => ({
      ...row,
      monthly_limit: row.monthly_limit ? +row.monthly_limit : null,
      spent: +row.spent,
      percentage: row.monthly_limit ? (+row.spent / +row.monthly_limit) * 100 : null,
    }))

    res.json(rows)
  } catch (error) {
    console.error('Error fetching budgets:', error)
    res.status(500).json({ error: 'Failed to fetch budgets' })
  }
}

// POST /api/budgets
// Upserts a budget for a category+month — updates if one already exists
export const upsertBudget = async (req: Request, res: Response) => {
  try {
    const { category_id, monthly_limit, month }: CreateBudgetBody = req.body

    if (!category_id || !monthly_limit || !month) {
      return res.status(400).json({ error: 'category_id, monthly_limit, and month are required' })
    }

    if (monthly_limit <= 0) {
      return res.status(400).json({ error: 'monthly_limit must be greater than 0' })
    }

    const result = await query(
      `INSERT INTO budgets (user_id, category_id, monthly_limit, month)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, category_id, month)
       DO UPDATE SET monthly_limit = $3, updated_at = NOW()
       RETURNING *`,
      [req.user!.id, category_id, monthly_limit, month]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error upserting budget:', error)
    res.status(500).json({ error: 'Failed to save budget' })
  }
}

// PATCH /api/budgets/:id
export const updateBudget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { monthly_limit }: UpdateBudgetBody = req.body

    if (!monthly_limit || monthly_limit <= 0) {
      return res.status(400).json({ error: 'monthly_limit must be greater than 0' })
    }

    const result = await query(
      `UPDATE budgets
       SET monthly_limit = $1, updated_at = NOW()
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [monthly_limit, id, req.user!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating budget:', error)
    res.status(500).json({ error: 'Failed to update budget' })
  }
}

// DELETE /api/budgets/:id
export const deleteBudget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      `DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id`,
      [id, req.user!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Budget not found' })
    }

    res.json({ message: 'Budget deleted successfully' })
  } catch (error) {
    console.error('Error deleting budget:', error)
    res.status(500).json({ error: 'Failed to delete budget' })
  }
}
