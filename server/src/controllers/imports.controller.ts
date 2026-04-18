import { Request, Response } from 'express'
import { parse } from 'csv-parse/sync'
import { query } from '../db'
import pool from '../db'

export interface PreviewRow {
  row_index: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  raw: Record<string, string>
  is_duplicate: boolean
  category_id: number | null
  account_id: number | null
  to_account_id: number | null
}

// ---------------------------------------------------------------------------
// Standard Bank CSV helpers
// ---------------------------------------------------------------------------

// Standard Bank exports a headerless CSV with fixed columns:
//   [0] row_type  [1] date(YYYYMMDD)  [2] flag  [3] amount  [4] tx_type  [5] merchant  [6-7] codes
function isStandardBank(lines: string[][]): boolean {
  const histLines = lines.filter(c => c[0]?.trim() === 'HIST')
  return histLines.length > 3
}

function parseStandardBankDate(raw: string): string {
  // YYYYMMDD → YYYY-MM-DD
  const s = raw.trim()
  if (s.length === 8) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  return s
}

interface SBRow {
  row_index: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense'
  raw: Record<string, string>
}

function parseStandardBank(lines: string[][]): SBRow[] {
  return lines
    .filter(cols => cols[0]?.trim() === 'HIST')
    .map((cols, idx) => {
      const rawAmount = parseFloat(cols[3]?.trim() ?? '0')
      const txType = cols[4]?.trim() ?? ''
      const merchant = cols[5]?.trim() ?? ''
      const description = merchant ? `${txType} — ${merchant}` : txType
      return {
        row_index:   idx,
        date:        parseStandardBankDate(cols[1]),
        description: description.trim(),
        amount:      Math.abs(rawAmount),
        type:        rawAmount >= 0 ? 'income' : 'expense',
        raw:         { col0: cols[0], col1: cols[1], col2: cols[2], col3: cols[3], col4: cols[4], col5: cols[5] },
      } as SBRow
    })
    .filter(r => r.amount > 0 && r.date)
}

// ---------------------------------------------------------------------------
// Keyword → category name mapping
// ---------------------------------------------------------------------------

const KEYWORD_RULES: Array<{ pattern: RegExp; category: string }> = [
  { pattern: /UBER EATS|NEW UBER EA|DL NEW UBE|DL UBER|UBER EATS/i,      category: 'Food & Dining' },
  { pattern: /KFC|MCDONALD|MCD |CHICKEN LICKE|SCOOTERS|HOLLYWOOD BUN|OCEAN BASKET|GORIMAS|FF FUSION/i, category: 'Food & Dining' },
  { pattern: /\bUBER\b(?!.*EATS)/i,                                        category: 'Transport' },
  { pattern: /STEAM|PLAYSTATION|SONY PSN|EPIC GAME|XBOX/i,                 category: 'Gaming' },
  { pattern: /MEDICAL AID|DISC PREM/i,                                     category: 'Medical' },
  { pattern: /DISCHEM|CLICKS/i,                                            category: 'Pharmacy' },
  { pattern: /WOOLWORTHS|TAKEALOT|AMAZON|WOOTWARE|H&M|MRP|EDGARS|V106-EDG|MRP HOME|VALUECO|CLASSIC EYES|ROOPANAND/i, category: 'Shopping' },
  { pattern: /SALARY|STIPEND|ELECTRONIC BANKING PAYMENT FR/i,              category: 'Salary' },
  { pattern: /SERVICE AGREEMENT|STRATUM/i,                                 category: 'Subscriptions' },
  { pattern: /FEE|BANK CHARGES|MANAGEMENT FEE|STATEMENT COSTS/i,          category: 'Bank Fees' },
  { pattern: /PAYSHAP PAYMENT TO|IB PAYMENT TO|IMMEDIATE PAYMENT|IB TRANSFER/i, category: 'Transfers' },
  { pattern: /PREPAID MOBILE/i,                                            category: 'Mobile' },
]

function matchCategory(description: string, categories: Array<{ id: number; name: string; type: string }>): number | null {
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(description)) {
      const match = categories.find(c => c.name.toLowerCase().includes(rule.category.toLowerCase()))
      if (match) return match.id
      // Also try partial reverse: category name contains a keyword word
      const found = categories.find(c =>
        rule.category.toLowerCase().split(' ').some(word => c.name.toLowerCase().includes(word))
      )
      if (found) return found.id
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// POST /api/imports/upload
// ---------------------------------------------------------------------------
export const uploadCsv = async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const content = file.buffer.toString('utf-8')

    // Try Standard Bank detection first (headerless fixed-column format)
    const rawLines = parse(content, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][]

    if (isStandardBank(rawLines)) {
      const rows = parseStandardBank(rawLines)
      return res.json({
        format: 'standard_bank',
        rows,
        filename: file.originalname,
      })
    }

    // Generic CSV with header row
    let records: Record<string, string>[]
    try {
      records = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      }) as Record<string, string>[]
    } catch {
      return res.status(400).json({ error: 'Could not parse CSV — ensure the file has a header row' })
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' })
    }

    const columns = Object.keys(records[0])
    res.json({ format: 'generic', columns, rows: records, filename: file.originalname })
  } catch (error) {
    console.error('Error uploading CSV:', error)
    res.status(500).json({ error: 'Failed to process CSV file' })
  }
}

// Normalise a description for duplicate-key comparison:
// lower-case, collapse all whitespace, strip em/en dashes to hyphens
function normaliseDesc(d: string): string {
  return d.toLowerCase().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// POST /api/imports/preview
// Receives column mapping (generic) OR pre-parsed rows (SB), returns typed preview with duplicate flags + auto categories
// ---------------------------------------------------------------------------
export const previewImport = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { rows, date_col, description_col, amount_col, format } = req.body as {
      rows: (Record<string, string> | SBRow)[]
      date_col?: string
      description_col?: string
      amount_col?: string
      format?: string
    }

    if (!rows) {
      return res.status(400).json({ error: 'rows is required' })
    }

    // Load user's categories for keyword matching
    const catResult = await query(
      `SELECT id, name, type FROM categories WHERE user_id = $1`,
      [userId]
    )
    const categories: Array<{ id: number; name: string; type: string }> = catResult.rows

    let parsed: PreviewRow[]

    if (format === 'standard_bank') {
      // Rows already typed from the upload step
      parsed = (rows as SBRow[]).map(row => {
        const desc = normaliseDesc(row.description)
        return {
          ...row,
          description:   desc,
          is_duplicate:  false,
          category_id:   matchCategory(desc, categories),
          account_id:    null,
          to_account_id: null,
        }
      })
    } else {
      // Generic column-mapped flow
      if (!date_col || !description_col || !amount_col) {
        return res.status(400).json({ error: 'date_col, description_col, and amount_col are required for generic format' })
      }
      parsed = (rows as Record<string, string>[]).map((row, idx) => {
        const rawAmount = parseFloat(row[amount_col]?.replace(/[^0-9.\-]/g, '') ?? '0')
        const desc = normaliseDesc(row[description_col] ?? '')
        return {
          row_index:    idx,
          date:         row[date_col] ?? '',
          description:  desc,
          amount:       Math.abs(rawAmount),
          type:         rawAmount >= 0 ? 'income' : 'expense',
          raw:          row,
          is_duplicate:  false,
          category_id:   matchCategory(desc, categories),
          account_id:    null,
          to_account_id: null,
        } as PreviewRow
      }).filter(r => r.amount > 0 && r.date)
    }

    // Duplicate detection
    const existing = await query(
      `SELECT date, amount, description FROM transactions WHERE user_id = $1 AND deleted_at IS NULL`,
      [userId]
    )
    const existingSet = new Set(
      existing.rows.map(r =>
        `${r.date.toISOString().slice(0, 10)}|${(+r.amount).toFixed(2)}|${normaliseDesc(r.description)}`
      )
    )

    const withDuplicates = parsed.map(row => ({
      ...row,
      is_duplicate: existingSet.has(`${row.date}|${(+row.amount).toFixed(2)}|${normaliseDesc(row.description)}`),
    }))

    res.json({
      rows: withDuplicates,
      total: withDuplicates.length,
      duplicates: withDuplicates.filter(r => r.is_duplicate).length,
      categories,
    })
  } catch (error) {
    console.error('Error previewing import:', error)
    res.status(500).json({ error: 'Failed to preview import' })
  }
}

// ---------------------------------------------------------------------------
// POST /api/imports/confirm
// ---------------------------------------------------------------------------
export const confirmImport = async (req: Request, res: Response) => {
  const { rows, filename, account_targets } = req.body as {
    rows: PreviewRow[]
    filename: string
    account_targets?: Array<{ account_id: number; target_balance: number }>
  }

  if (!rows || rows.length === 0) {
    return res.status(400).json({ error: 'rows is required' })
  }

  // Every row must have an account assigned
  const missing = rows.filter(r => !r.account_id)
  if (missing.length > 0) {
    return res.status(400).json({ error: `${missing.length} row(s) are missing an account_id` })
  }

  // Transfer rows must have to_account_id
  const badTransfers = rows.filter(r => r.type === 'transfer' && !r.to_account_id)
  if (badTransfers.length > 0) {
    return res.status(400).json({ error: `${badTransfers.length} transfer row(s) are missing a destination account` })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const userId = req.user!.id

    // Create the import record first (we'll update counts after)
    const importResult = await client.query(
      `INSERT INTO imports (user_id, filename, status, transaction_count, duplicate_count)
       VALUES ($1, $2, 'processing', $3, 0)
       RETURNING id`,
      [userId, filename ?? 'import.csv', rows.length]
    )
    const importId = importResult.rows[0].id

    let insertedCount = 0

    for (const row of rows) {
      const txType = row.type ?? 'expense'
      const desc = normaliseDesc(row.description)

      if (txType === 'transfer') {
        // Insert debit leg (money leaving source account)
        const debitResult = await client.query(
          `INSERT INTO transactions
             (user_id, account_id, category_id, type, amount, date, description, import_id, transfer_direction)
           VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, 'debit')
           ON CONFLICT (user_id, account_id, date, amount, description)
           WHERE deleted_at IS NULL
           DO NOTHING
           RETURNING id`,
          [userId, row.account_id, row.category_id ?? null, row.amount, row.date, desc, importId]
        )
        if (!debitResult.rowCount || debitResult.rowCount === 0) continue

        const debitId = debitResult.rows[0].id

        // Insert credit leg (money arriving at destination account)
        const creditResult = await client.query(
          `INSERT INTO transactions
             (user_id, account_id, category_id, type, amount, date, description, import_id, transfer_direction, transfer_pair_id)
           VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, 'credit', $8)
           RETURNING id`,
          [userId, row.to_account_id, row.category_id ?? null, row.amount, row.date, desc, importId, debitId]
        )
        const creditId = creditResult.rows[0].id

        // Back-fill pair id on debit row
        await client.query(
          `UPDATE transactions SET transfer_pair_id = $1 WHERE id = $2`,
          [creditId, debitId]
        )
        insertedCount++
      } else {
        // Income or expense — single row with duplicate guard
        const result = await client.query(
          `INSERT INTO transactions (user_id, account_id, type, category_id, amount, date, description, import_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, account_id, date, amount, description)
           WHERE deleted_at IS NULL
           DO NOTHING
           RETURNING id`,
          [userId, row.account_id, txType, row.category_id ?? null, row.amount, row.date, desc, importId]
        )
        if (result.rowCount && result.rowCount > 0) insertedCount++
      }
    }

    const skippedCount = rows.length - insertedCount

    // Update the import record with real counts
    await client.query(
      `UPDATE imports SET status = 'complete', transaction_count = $1, duplicate_count = $2, updated_at = NOW() WHERE id = $3`,
      [insertedCount, skippedCount, importId]
    )

    // ── Opening balance auto-recalculation ──────────────────────────────────
    const adjustedAccounts: Array<{ account_id: number; account_name: string; new_opening_balance: number; target_balance: number }> = []

    if (account_targets && account_targets.length > 0) {
      for (const target of account_targets) {
        const sumResult = await client.query(
          `SELECT COALESCE(SUM(
             CASE
               WHEN type = 'transfer' AND transfer_direction = 'debit'  THEN -amount
               WHEN type = 'transfer' AND transfer_direction = 'credit' THEN  amount
               WHEN type = 'income'   THEN  amount
               WHEN type = 'expense'  THEN -amount
               ELSE 0
             END
           ), 0) AS tx_sum
           FROM transactions
           WHERE account_id = $1 AND user_id = $2 AND deleted_at IS NULL`,
          [target.account_id, userId]
        )
        const txSum = parseFloat(sumResult.rows[0].tx_sum)
        const newOpening = target.target_balance - txSum

        const updateResult = await client.query(
          `UPDATE accounts SET opening_balance = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3
           RETURNING name`,
          [newOpening.toFixed(2), target.account_id, userId]
        )
        if (updateResult.rows.length > 0) {
          adjustedAccounts.push({
            account_id: target.account_id,
            account_name: updateResult.rows[0].name,
            new_opening_balance: parseFloat(newOpening.toFixed(2)),
            target_balance: target.target_balance,
          })
        }
      }
    }

    await client.query('COMMIT')
    res.status(201).json({
      import_id: importId,
      inserted: insertedCount,
      skipped: skippedCount,
      adjusted_accounts: adjustedAccounts,
    })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error confirming import:', error)
    res.status(500).json({ error: 'Failed to import transactions' })
  } finally {
    client.release()
  }
}

// ---------------------------------------------------------------------------
// GET /api/imports
// ---------------------------------------------------------------------------
export const getImports = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const result = await query(
      `SELECT id, filename, status, transaction_count, duplicate_count, error_message, created_at, updated_at
       FROM imports
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching imports:', error)
    res.status(500).json({ error: 'Failed to fetch import history' })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/imports/:id  — rollback: soft-delete all transactions in batch
// ---------------------------------------------------------------------------
export const rollbackImport = async (req: Request, res: Response) => {
  const { id } = req.params
  const userId = req.user!.id

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Verify the import belongs to this user and is in a rollback-able state
    const importRow = await client.query(
      `SELECT id, status, transaction_count FROM imports WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )
    if (importRow.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Import not found' })
    }
    if (importRow.rows[0].status === 'rolled_back') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Import has already been rolled back' })
    }

    // Soft-delete all transactions linked to this import
    const deleteResult = await client.query(
      `UPDATE transactions SET deleted_at = NOW(), updated_at = NOW()
       WHERE import_id = $1 AND user_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [id, userId]
    )
    const deletedCount = deleteResult.rowCount ?? 0

    // Mark the import as rolled_back
    await client.query(
      `UPDATE imports SET status = 'rolled_back', updated_at = NOW() WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')
    res.json({ rolled_back: deletedCount })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error rolling back import:', error)
    res.status(500).json({ error: 'Failed to roll back import' })
  } finally {
    client.release()
  }
}
