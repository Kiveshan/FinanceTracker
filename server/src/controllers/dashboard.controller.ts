import { Request, Response } from 'express'
import { query } from '../db'

// GET /api/dashboard?month=YYYY-MM
export const getDashboard = async (req: Request, res: Response) => {
  try {
    const USER_ID = req.user!.id
    const { month } = req.query
    const targetMonth = (month as string) || new Date().toISOString().slice(0, 7)

    // Previous month for net worth delta
    const [y, m] = targetMonth.split('-').map(Number)
    const prevDate = new Date(y, m - 2, 1)
    const prevMonth = prevDate.toISOString().slice(0, 7)

    // Run all queries in parallel for performance
    const [
      cashFlowResult,
      spendingResult,
      incomeResult,
      budgetResult,
      recentResult,
      largestResult,
      accountsResult,
      prevCashFlowResult,
    ] = await Promise.all([

      // Monthly cash flow
      query(
        `SELECT
           SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expenses
         FROM transactions
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND TO_CHAR(date, 'YYYY-MM') = $2`,
        [USER_ID, targetMonth]
      ),

      // Spending by category
      query(
        `SELECT c.name AS category_name, SUM(t.amount) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = $1
           AND t.type = 'expense'
           AND t.deleted_at IS NULL
           AND TO_CHAR(t.date, 'YYYY-MM') = $2
         GROUP BY c.name
         ORDER BY total DESC`,
        [USER_ID, targetMonth]
      ),

      // Income by category
      query(
        `SELECT c.name AS category_name, SUM(t.amount) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = $1
           AND t.type = 'income'
           AND t.deleted_at IS NULL
           AND TO_CHAR(t.date, 'YYYY-MM') = $2
         GROUP BY c.name
         ORDER BY total DESC`,
        [USER_ID, targetMonth]
      ),

      // Budget status
      query(
        `SELECT
           c.id AS category_id, c.name AS category_name,
           b.id, b.monthly_limit,
           COALESCE(
             (SELECT SUM(t.amount)
              FROM transactions t
              WHERE t.category_id = c.id AND t.type = 'expense'
                AND t.deleted_at IS NULL AND t.user_id = $1
                AND TO_CHAR(t.date, 'YYYY-MM') = $2),
             0
           ) AS spent
         FROM categories c
         LEFT JOIN budgets b ON b.category_id = c.id AND b.month = $2 AND b.user_id = $1
         WHERE c.user_id = $1 AND c.type = 'expense'
         ORDER BY c.name`,
        [USER_ID, targetMonth]
      ),

      // Recent transactions (last 10)
      query(
        `SELECT t.*, a.name AS account_name, c.name AS category_name
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = $1 AND t.deleted_at IS NULL
         ORDER BY t.date DESC, t.created_at DESC
         LIMIT 10`,
        [USER_ID]
      ),

      // Largest expenses this month (top 5)
      query(
        `SELECT t.*, a.name AS account_name, c.name AS category_name
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
         LEFT JOIN categories c ON c.id = t.category_id
         WHERE t.user_id = $1
           AND t.type = 'expense'
           AND t.deleted_at IS NULL
           AND TO_CHAR(t.date, 'YYYY-MM') = $2
         ORDER BY t.amount DESC
         LIMIT 5`,
        [USER_ID, targetMonth]
      ),

      // Account balances at end of selected month
      query(
        `SELECT
           a.id, a.name, a.type, a.opening_balance,
           COALESCE(
             (SELECT SUM(
               CASE
                 WHEN t.type = 'transfer' AND t.transfer_direction = 'debit'  THEN -t.amount
                 WHEN t.type = 'transfer' AND t.transfer_direction = 'credit' THEN  t.amount
                 WHEN t.type = 'income'   THEN  t.amount
                 WHEN t.type = 'expense'  THEN -t.amount
                 ELSE 0
               END)
              FROM transactions t
              WHERE t.account_id = a.id
                AND t.deleted_at IS NULL
                AND t.date < (DATE_TRUNC('month', ($2 || '-01')::date) + INTERVAL '1 month')),
             0
           ) + a.opening_balance AS current_balance
         FROM accounts a
         WHERE a.user_id = $1 AND a.is_active = true
         ORDER BY a.type, a.name`,
        [USER_ID, targetMonth]
      ),

      // Previous month cash flow (for net worth delta)
      query(
        `SELECT
           SUM(CASE WHEN type = 'income'  THEN amount ELSE 0 END) AS total_income,
           SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) AS total_expenses
         FROM transactions
         WHERE user_id = $1
           AND deleted_at IS NULL
           AND TO_CHAR(date, 'YYYY-MM') = $2`,
        [USER_ID, prevMonth]
      ),
    ])

    // Compute net worth
    const accounts = accountsResult.rows.map(a => ({
      ...a,
      current_balance: +a.current_balance,
      opening_balance: +a.opening_balance,
    }))

    const netWorth = accounts.reduce((sum, a) => {
      return a.type === 'credit' ? sum - Math.abs(a.current_balance) : sum + a.current_balance
    }, 0)

    const cf = cashFlowResult.rows[0]
    const totalIncome   = +(cf.total_income   ?? 0)
    const totalExpenses = +(cf.total_expenses ?? 0)
    const netCashFlow   = totalIncome - totalExpenses
    const savingsRate   = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0

    const prevCf = prevCashFlowResult.rows[0]
    const prevIncome   = +(prevCf.total_income   ?? 0)
    const prevExpenses = +(prevCf.total_expenses ?? 0)
    const prevNet = prevIncome - prevExpenses

    res.json({
      month: targetMonth,
      net_worth: netWorth,
      net_worth_change: netCashFlow - prevNet,
      cash_flow: {
        total_income:   totalIncome,
        total_expenses: totalExpenses,
        net:            netCashFlow,
      },
      savings_rate: savingsRate,
      spending_by_category: spendingResult.rows.map(r => ({ name: r.category_name, value: +r.total })),
      income_by_category:   incomeResult.rows.map(r => ({ name: r.category_name, value: +r.total })),
      budget_status: budgetResult.rows.map(r => ({
        ...r,
        monthly_limit: r.monthly_limit ? +r.monthly_limit : null,
        spent: +r.spent,
        percentage: r.monthly_limit ? (+r.spent / +r.monthly_limit) * 100 : null,
      })),
      recent_transactions: recentResult.rows.map(r => ({ ...r, amount: +r.amount })),
      largest_expenses:    largestResult.rows.map(r => ({ ...r, amount: +r.amount })),
      accounts,
    })
  } catch (error) {
    console.error('Error fetching dashboard:', error)
    res.status(500).json({ error: 'Failed to fetch dashboard data' })
  }
}
