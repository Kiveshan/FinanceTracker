import { Request, Response } from 'express'
import { query } from '../db'
import { CreateBudgetBody } from '../types'

// GET /api/budgets?month=YYYY-MM
// Returns all expense categories with their recurring limit and actual spend for the given month
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
       LEFT JOIN budgets b ON b.category_id = c.id AND b.user_id = $1
       WHERE c.user_id = $1
         AND c.type = 'expense'
       ORDER BY b.monthly_limit DESC NULLS LAST, c.name ASC`,
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
// Upserts a recurring budget limit for a category — one per category, applies every month
export const upsertBudget = async (req: Request, res: Response) => {
  try {
    const { category_id, monthly_limit }: CreateBudgetBody = req.body

    if (!category_id || !monthly_limit) {
      return res.status(400).json({ error: 'category_id and monthly_limit are required' })
    }

    if (monthly_limit <= 0) {
      return res.status(400).json({ error: 'monthly_limit must be greater than 0' })
    }

    const result = await query(
      `INSERT INTO budgets (user_id, category_id, monthly_limit)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, category_id)
       DO UPDATE SET monthly_limit = $3, updated_at = NOW()
       RETURNING *`,
      [req.user!.id, category_id, monthly_limit]
    )

    res.status(201).json(result.rows[0])
  } catch (error) {
    console.error('Error upserting budget:', error)
    res.status(500).json({ error: 'Failed to save budget' })
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
