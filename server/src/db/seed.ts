/**
 * Demo data seed script
 *
 * Creates a demo user with 4 months of realistic South African
 * financial data across four accounts.
 *
 * Usage:
 *   npm run seed          (from the server/ directory)
 *
 * Safe to re-run — wipes and recreates the demo user's data each time.
 *
 * Demo credentials:
 *   Email:    demo@financetracker.co.za
 *   Password: demo
 */

import bcrypt from 'bcryptjs'
import pool from './index'

const DEMO_EMAIL    = 'demo@financetracker.co.za'
const DEMO_PASSWORD = 'demo'

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/** Returns an ISO date string for `day` of the month that is `monthsAgo` months before today. */
function d(monthsAgo: number, day: number): string {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day)
  return date.toISOString().slice(0, 10)
}

/** Returns true if the given day should be included for `monthsAgo`.
 *  Past months always include all days; current month only includes days up to today. */
function include(monthsAgo: number, day: number): boolean {
  if (monthsAgo > 0) return true
  return day <= new Date().getDate()
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // ── Demo user ─────────────────────────────────────────────────────────
    console.log('Creating demo user...')
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2
       RETURNING id`,
      [DEMO_EMAIL, passwordHash]
    )
    const userId = userResult.rows[0].id as number

    // ── Wipe existing demo data (dependency order) ─────────────────────────
    console.log('Clearing existing demo data...')
    await client.query(`DELETE FROM user_category_rules WHERE user_id = $1`, [userId])
    await client.query(`DELETE FROM budgets          WHERE user_id = $1`, [userId])
    // Self-referential FK — must NULL before deleting
    await client.query(`UPDATE transactions SET transfer_pair_id = NULL WHERE user_id = $1`, [userId])
    await client.query(`DELETE FROM transactions WHERE user_id = $1`, [userId])
    await client.query(`DELETE FROM imports      WHERE user_id = $1`, [userId])
    await client.query(`DELETE FROM accounts     WHERE user_id = $1`, [userId])
    await client.query(`DELETE FROM categories   WHERE user_id = $1`, [userId])

    // ── Accounts ──────────────────────────────────────────────────────────
    console.log('Creating accounts...')

    const insertAccount = async (name: string, type: string, openingBalance: number): Promise<number> => {
      const r = await client.query(
        `INSERT INTO accounts (user_id, name, type, opening_balance)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [userId, name, type, openingBalance]
      )
      return r.rows[0].id as number
    }

    // Opening balances are set so that after 4 months of transactions the
    // balances land in a realistic range:
    //   Cheque:  ~R24,500   Savings:  ~R53,500
    //   Credit:  ~-R7,200   Investment: ~R92,500
    const chequeId     = await insertAccount('Standard Bank Cheque',  'cheque',     2500)
    const savingsId    = await insertAccount('FNB Savings Account',   'savings',    38000)
    const creditId     = await insertAccount('Absa Credit Card',      'credit',     -11000)
    const investmentId = await insertAccount('Easy Equities',         'investment', 85000)

    // ── Categories ────────────────────────────────────────────────────────
    console.log('Creating categories...')

    const insertCategory = async (name: string, type: 'income' | 'expense'): Promise<number> => {
      const r = await client.query(
        `INSERT INTO categories (user_id, name, type)
         VALUES ($1, $2, $3) RETURNING id`,
        [userId, name, type]
      )
      return r.rows[0].id as number
    }

    const cat = {
      // Income
      salary:            await insertCategory('Salary',             'income'),
      investmentReturns: await insertCategory('Investment Returns', 'income'),
      interestIncome:    await insertCategory('Interest Income',    'income'),
      otherIncome:       await insertCategory('Other Income',       'income'),
      // Expense
      groceries:         await insertCategory('Groceries',          'expense'),
      foodDining:        await insertCategory('Food & Dining',      'expense'),
      fuel:              await insertCategory('Fuel',               'expense'),
      transport:         await insertCategory('Transport',          'expense'),
      utilities:         await insertCategory('Utilities',          'expense'),
      insurance:         await insertCategory('Insurance',          'expense'),
      medicalAid:        await insertCategory('Medical Aid',        'expense'),
      entertainment:     await insertCategory('Entertainment',      'expense'),
      shopping:          await insertCategory('Shopping',           'expense'),
      subscriptions:     await insertCategory('Subscriptions',      'expense'),
      bankFees:          await insertCategory('Bank Fees',          'expense'),
      cashWithdrawals:   await insertCategory('Cash Withdrawals',   'expense'),
      phoneInternet:     await insertCategory('Phone & Internet',   'expense'),
      investmentLoss:    await insertCategory('Investment Loss',    'expense'),
      otherExpenses:     await insertCategory('Other Expenses',     'expense'),
    }

    // ── Transaction helpers ───────────────────────────────────────────────

    const insertTx = async (
      accountId:         number,
      categoryId:        number | null,
      type:              'income' | 'expense' | 'transfer',
      amount:            number,
      date:              string,
      description:       string,
      transferDirection: 'debit' | 'credit' | null = null,
    ): Promise<number> => {
      const r = await client.query(
        `INSERT INTO transactions
           (user_id, account_id, category_id, type, amount, date, description, transfer_direction)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [userId, accountId, categoryId, type, amount, date, description, transferDirection]
      )
      return r.rows[0].id as number
    }

    /** Creates a paired transfer (both legs, linked via transfer_pair_id). */
    const insertTransfer = async (
      fromAccountId: number,
      toAccountId:   number,
      amount:        number,
      date:          string,
      description:   string,
    ) => {
      const debitId  = await insertTx(fromAccountId, null, 'transfer', amount, date, description, 'debit')
      const creditId = await insertTx(toAccountId,   null, 'transfer', amount, date, description, 'credit')
      await client.query(`UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`, [creditId, debitId])
      await client.query(`UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`, [debitId, creditId])
    }

    // ── Transactions — 4 months of data ───────────────────────────────────
    console.log('Creating transactions (4 months)...')

    // Per-month variation arrays — indexed by monthsAgo (3=oldest, 0=current)
    const groceries1   = [1650, 1820, 1750, 1680]  // Pick n Pay
    const groceries2   = [1050, 1180, 1120, 980]   // Checkers
    const municipalAmt = [2650, 2720, 2680, 2710]
    const fuelAmt      = [875,  1020, 960,  890]
    const takealotAmt  = [850,  1150, 995,  720]
    const interestAmt  = [310,  325,  338,  342]
    // Investment: positive = return, negative = loss
    const investAmt    = [1850, 3200, -1100, 2450] // March (mAgo=2) had a bad month

    for (const mAgo of [3, 2, 1, 0]) {
      const idx = mAgo // use mAgo directly as index (3=oldest month)

      // ── CHEQUE ACCOUNT ──────────────────────────────────────────────────

      // 1st — Debit orders
      if (include(mAgo, 1)) {
        await insertTx(chequeId, cat.medicalAid, 'expense', 2840,  d(mAgo, 1), 'DISCOVERY HEALTH PREMIUM')
        await insertTx(chequeId, cat.insurance,  'expense', 1350,  d(mAgo, 1), 'OUTSURANCE INSURANCE')
      }

      // 2nd — Streaming subscriptions
      if (include(mAgo, 2)) {
        await insertTx(chequeId, cat.subscriptions, 'expense', 229,  d(mAgo, 2), 'NETFLIX SUBSCRIPTION')
        await insertTx(chequeId, cat.subscriptions, 'expense', 100,  d(mAgo, 2), 'SPOTIFY SUBSCRIPTION')
        await insertTx(chequeId, cat.subscriptions, 'expense', 949,  d(mAgo, 2), 'MULTICHOICE DSTV SUBSCRIPTION')
      }

      // 3rd — Phone
      if (include(mAgo, 3)) {
        await insertTx(chequeId, cat.phoneInternet, 'expense', 899, d(mAgo, 3), 'VODACOM MONTHLY SUBSCRIPTION')
      }

      // 5th — Groceries (Pick n Pay)
      if (include(mAgo, 5)) {
        await insertTx(chequeId, cat.groceries, 'expense', groceries1[idx], d(mAgo, 5), 'PICK N PAY STORES')
      }

      // 7th — Municipality
      if (include(mAgo, 7)) {
        await insertTx(chequeId, cat.utilities, 'expense', municipalAmt[idx], d(mAgo, 7), 'CITY OF CAPE TOWN MUNICIPALITY')
      }

      // 8th — Dinner out
      if (include(mAgo, 8)) {
        await insertTx(chequeId, cat.foodDining, 'expense', 340, d(mAgo, 8), 'NANDOS V&A WATERFRONT')
      }

      // 10th — Fuel
      if (include(mAgo, 10)) {
        await insertTx(chequeId, cat.fuel, 'expense', fuelAmt[idx], d(mAgo, 10), 'ENGEN GARAGE')
      }

      // 12th — Uber Eats
      if (include(mAgo, 12)) {
        await insertTx(chequeId, cat.foodDining, 'expense', 290, d(mAgo, 12), 'UBER EATS ORDER')
      }

      // 15th — ATM
      if (include(mAgo, 15)) {
        await insertTx(chequeId, cat.cashWithdrawals, 'expense', 500, d(mAgo, 15), 'ATM CASH WITHDRAWAL')
      }

      // 18th — Groceries (Checkers)
      if (include(mAgo, 18)) {
        await insertTx(chequeId, cat.groceries, 'expense', groceries2[idx], d(mAgo, 18), 'CHECKERS SUPERMARKET')
      }

      // 20th — Bank fee
      if (include(mAgo, 20)) {
        await insertTx(chequeId, cat.bankFees, 'expense', 149, d(mAgo, 20), 'STANDARD BANK MONTHLY ACCOUNT FEE')
      }

      // 22nd — Fast food
      if (include(mAgo, 22)) {
        await insertTx(chequeId, cat.foodDining, 'expense', 165, d(mAgo, 22), 'KFC DRIVE THRU')
      }

      // 25th — Salary (main income event)
      if (include(mAgo, 25)) {
        await insertTx(chequeId, cat.salary, 'income', 28000, d(mAgo, 25), 'SALARY PAYMENT — EMPLOYER')
      }

      // 26th — Transfer to savings
      if (include(mAgo, 26)) {
        await insertTransfer(chequeId, savingsId, 3500, d(mAgo, 26), 'TRANSFER TO SAVINGS')
      }

      // 27th — Transport (Uber / parking)
      if (include(mAgo, 27)) {
        await insertTx(chequeId, cat.transport, 'expense', 185, d(mAgo, 27), 'UBER TRIP')
      }

      // 28th — Credit card payment
      if (include(mAgo, 28)) {
        await insertTransfer(chequeId, creditId, 5500, d(mAgo, 28), 'CREDIT CARD PAYMENT')
      }

      // ── CREDIT CARD ─────────────────────────────────────────────────────

      // 3rd — Woolworths
      if (include(mAgo, 3)) {
        await insertTx(creditId, cat.shopping, 'expense', 1800, d(mAgo, 3), 'WOOLWORTHS FOOD AND CLOTHING')
      }

      // 9th — Entertainment (movies)
      if (include(mAgo, 9)) {
        await insertTx(creditId, cat.entertainment, 'expense', 280, d(mAgo, 9), 'NU METRO CINEMAS')
      }

      // 11th — Restaurant on CC
      if (include(mAgo, 11)) {
        await insertTx(creditId, cat.foodDining, 'expense', 520, d(mAgo, 11), 'MUGG AND BEAN RESTAURANT')
      }

      // 16th — Takealot
      if (include(mAgo, 16)) {
        await insertTx(creditId, cat.shopping, 'expense', takealotAmt[idx], d(mAgo, 16), 'TAKEALOT ONLINE SHOPPING')
      }

      // 23rd — Pharmacy
      if (include(mAgo, 23)) {
        await insertTx(creditId, cat.otherExpenses, 'expense', 380, d(mAgo, 23), 'DISCHEM PHARMACY')
      }

      // ── SAVINGS ACCOUNT ─────────────────────────────────────────────────

      // 28th — Interest
      if (include(mAgo, 28)) {
        await insertTx(savingsId, cat.interestIncome, 'income', interestAmt[idx], d(mAgo, 28), 'FNB SAVINGS ACCOUNT INTEREST')
      }

      // ── INVESTMENT ACCOUNT ───────────────────────────────────────────────

      // 28th — Monthly portfolio movement
      if (include(mAgo, 28)) {
        const amount = investAmt[idx]
        if (amount > 0) {
          await insertTx(investmentId, cat.investmentReturns, 'income',  amount,            d(mAgo, 28), 'Portfolio Return')
        } else {
          await insertTx(investmentId, cat.investmentLoss,    'expense', Math.abs(amount),  d(mAgo, 28), 'Portfolio Loss')
        }
      }
    }

    // ── Budgets (recurring monthly limits) ────────────────────────────────
    console.log('Creating budgets...')

    const insertBudget = async (categoryId: number, limit: number) => {
      await client.query(
        `INSERT INTO budgets (user_id, category_id, monthly_limit)
         VALUES ($1, $2, $3)`,
        [userId, categoryId, limit]
      )
    }

    await insertBudget(cat.groceries,     4000)
    await insertBudget(cat.foodDining,    2000)
    await insertBudget(cat.fuel,          1500)
    await insertBudget(cat.utilities,     3500)
    await insertBudget(cat.shopping,      3000)
    await insertBudget(cat.subscriptions, 1500)
    await insertBudget(cat.phoneInternet, 1000)
    await insertBudget(cat.insurance,     1500)
    await insertBudget(cat.medicalAid,    3000)
    await insertBudget(cat.entertainment,  500)

    await client.query('COMMIT')

    // ── Summary ───────────────────────────────────────────────────────────
    const txCount  = await pool.query(`SELECT COUNT(*) FROM transactions WHERE user_id = $1`, [userId])
    const catCount = await pool.query(`SELECT COUNT(*) FROM categories   WHERE user_id = $1`, [userId])
    const budCount = await pool.query(`SELECT COUNT(*) FROM budgets      WHERE user_id = $1`, [userId])

    console.log('\n✅  Demo data seeded successfully!\n')
    console.log(`   Transactions : ${txCount.rows[0].count}`)
    console.log(`   Categories   : ${catCount.rows[0].count}`)
    console.log(`   Budgets      : ${budCount.rows[0].count}\n`)
    console.log('   ─────────────────────────────────────')
    console.log(`   Email    : ${DEMO_EMAIL}`)
    console.log(`   Password : ${DEMO_PASSWORD}`)
    console.log('   ─────────────────────────────────────\n')

  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌  Seed failed:', err)
    throw err
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1))
