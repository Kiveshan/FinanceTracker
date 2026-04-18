import { Request, Response } from 'express'
import { query } from '../db'
import { CreateAccountBody, UpdateAccountBody } from '../types'

// LEARNING NOTE: async/await and error handling
// Every database call is asynchronous — it takes time and could fail.
// We wrap each controller in try/catch. If anything goes wrong, we catch
// the error and return a 500 response with a clear message.
// Without try/catch, an unhandled error would crash your entire server.

// GET /api/accounts
// Returns all active accounts for the user
export const getAccounts = async (req: Request, res: Response) => {
  try {
    const result = await query(`
      SELECT
        a.*,
        -- LEARNING NOTE: This subquery calculates the live balance.
        -- We sum all non-deleted transactions for this account and add
        -- the opening balance. This is the "derived balance" approach
        -- from the spec — the balance is always correct because it's
        -- calculated from the source of truth (transactions), not stored.
        COALESCE(
          (
            SELECT
              SUM(
                CASE
                  -- For transfers: debit means money leaving (subtract)
                  --                credit means money arriving (add)
                  WHEN t.type = 'transfer' AND t.transfer_direction = 'debit'  THEN -t.amount
                  WHEN t.type = 'transfer' AND t.transfer_direction = 'credit' THEN  t.amount
                  -- For income: money arriving (add)
                  WHEN t.type = 'income'   THEN  t.amount
                  -- For expenses: money leaving (subtract)
                  WHEN t.type = 'expense'  THEN -t.amount
                  ELSE 0
                END
              )
            FROM transactions t
            WHERE t.account_id = a.id
              AND t.deleted_at IS NULL
          ),
          0
        ) + a.opening_balance AS current_balance
      FROM accounts a
      WHERE a.is_active = true AND a.user_id = $1
      ORDER BY a.created_at ASC
    `, [req.user!.id])

    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching accounts:', error)
    res.status(500).json({ error: 'Failed to fetch accounts' })
  }
}

// GET /api/accounts/:id
// Returns a single account by id
export const getAccountById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    const result = await query(
      'SELECT * FROM accounts WHERE id = $1 AND is_active = true AND user_id = $2',
      [id, req.user!.id]
    )

    // LEARNING NOTE: What is $1?
    // Never put user input directly into a SQL string like:
    //   `SELECT * FROM accounts WHERE id = ${id}`
    // This is called SQL injection — a classic security vulnerability where
    // a malicious user crafts an id like "1; DROP TABLE accounts;" and your
    // query runs it. Using $1, $2 etc (parameterised queries) tells pg to
    // treat the value as data, never as executable SQL.

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' })
    }

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error fetching account:', error)
    res.status(500).json({ error: 'Failed to fetch account' })
  }
}

// POST /api/accounts
// Creates a new account
export const createAccount = async (req: Request, res: Response) => {
  try {
      const { name, type, opening_balance }: CreateAccountBody = req.body

    // LEARNING NOTE: Input validation
    // Never trust data coming from the client. Always validate on the server.
    // The database has CHECK constraints as a last line of defence, but we
    // validate here first to give clear error messages back to the user.
    if (!name || !type) {
      return res.status(400).json({ error: 'Name and type are required' })
    }

    const validTypes = ['cheque', 'savings', 'credit', 'investment']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Type must be one of: ${validTypes.join(', ')}`
      })
    }

    const result = await query(
      `INSERT INTO accounts (user_id, name, type, opening_balance)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.user!.id, name, type, opening_balance ?? 0]
      // LEARNING NOTE: RETURNING *
      // PostgreSQL's RETURNING clause gives you back the inserted row
      // immediately after the INSERT — including the generated id and
      // timestamps. Without it you'd need a second SELECT query to get
      // the new account's id.
    )

    res.status(201).json(result.rows[0])
    // LEARNING NOTE: Status 201 vs 200
    // 200 means "OK — here's what you asked for."
    // 201 means "Created — a new resource was successfully created."
    // Using the right status code makes your API self-documenting.
  } catch (error) {
    console.error('Error creating account:', error)
    res.status(500).json({ error: 'Failed to create account' })
  }
}

// PATCH /api/accounts/:id
// Updates an account name or opening balance
export const updateAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { name, opening_balance }: UpdateAccountBody = req.body

    const updated = await query(
      `UPDATE accounts
       SET name = COALESCE($1, name),
           opening_balance = COALESCE($2, opening_balance),
           updated_at = NOW()
       WHERE id = $3 AND is_active = true AND user_id = $4
       RETURNING id`,
      [name, opening_balance, id, req.user!.id]
      // LEARNING NOTE: COALESCE in updates
      // COALESCE($1, name) means: use the new value if provided,
      // otherwise keep the existing value. This lets the client send
      // only the fields they want to update — a partial update pattern
      // called PATCH (vs PUT which replaces the entire resource).
    )

    if (updated.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' })
    }

    // Re-fetch with the computed current_balance subquery so the client
    // always receives a consistent shape (same as getAccounts returns).
    const result = await query(
      `SELECT
         a.*,
         COALESCE(
           (
             SELECT SUM(
               CASE
                 WHEN t.type = 'transfer' AND t.transfer_direction = 'debit'  THEN -t.amount
                 WHEN t.type = 'transfer' AND t.transfer_direction = 'credit' THEN  t.amount
                 WHEN t.type = 'income'   THEN  t.amount
                 WHEN t.type = 'expense'  THEN -t.amount
                 ELSE 0
               END
             )
             FROM transactions t
             WHERE t.account_id = a.id AND t.deleted_at IS NULL
           ),
           0
         ) + a.opening_balance AS current_balance
       FROM accounts a
       WHERE a.id = $1`,
      [updated.rows[0].id]
    )

    res.json(result.rows[0])
  } catch (error) {
    console.error('Error updating account:', error)
    res.status(500).json({ error: 'Failed to update account' })
  }
}

// DELETE /api/accounts/:id
// Soft deletes an account (sets is_active = false)
export const deleteAccount = async (req: Request, res: Response) => {
  try {
    const { id } = req.params

    // LEARNING NOTE: We don't actually DELETE the row.
    // We set is_active = false. Every query that reads accounts filters
    // WHERE is_active = true, so this account effectively disappears
    // from the app — but the data and its transactions are preserved.
    const result = await query(
      `UPDATE accounts
       SET is_active = false, updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, req.user!.id]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Account not found' })
    }

    res.json({ message: 'Account deleted successfully' })
  } catch (error) {
    console.error('Error deleting account:', error)
    res.status(500).json({ error: 'Failed to delete account' })
  }
}
