import { Request, Response } from 'express'
import { parse } from 'csv-parse/sync'
import { query } from '../db'
import pool from '../db'

export interface PreviewRow {
  row_index:          number
  date:               string
  description:        string
  amount:             number
  type:               'income' | 'expense' | 'transfer'
  transfer_direction: 'debit' | 'credit' | null
  raw:                Record<string, string>
  is_duplicate:       boolean
  category_id:        number | null
  account_id:         number | null
  to_account_id:      number | null
}

// ---------------------------------------------------------------------------
// Standard Bank CSV helpers
// ---------------------------------------------------------------------------
function isStandardBank(lines: string[][]): boolean {
  return lines.filter(c => c[0]?.trim() === 'HIST').length > 3
}

function parseStandardBankDate(raw: string): string {
  const s = raw.trim()
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s
}

interface SBRow {
  row_index:          number
  date:               string
  description:        string
  amount:             number
  type:               'income' | 'expense' | 'transfer'
  transfer_direction: 'debit' | 'credit' | null
  raw:                Record<string, string>
}

// ---------------------------------------------------------------------------
// Transfer detection — rows matching this are recorded as type=transfer
// (single leg from the perspective of the imported account).
// ---------------------------------------------------------------------------
const TRANSFER_PATTERN = /PAYSHAP PAYMENT TO|IB PAYMENT TO|IMMEDIATE PAYMENT|IB TRANSFER/i

function parseStandardBank(lines: string[][]): SBRow[] {
  return lines
    .filter(cols => cols[0]?.trim() === 'HIST')
    .map((cols, idx) => {
      const rawAmount   = parseFloat(cols[3]?.trim() ?? '0')
      const txType      = cols[4]?.trim() ?? ''
      const merchant    = cols[5]?.trim() ?? ''
      const description = (merchant ? `${txType} — ${merchant}` : txType).trim()

      let type: 'income' | 'expense' | 'transfer'
      let transfer_direction: 'debit' | 'credit' | null = null

      if (TRANSFER_PATTERN.test(description)) {
        type               = 'transfer'
        transfer_direction = rawAmount < 0 ? 'debit' : 'credit'
      } else {
        type = rawAmount >= 0 ? 'income' : 'expense'
      }

      return {
        row_index: idx,
        date:      parseStandardBankDate(cols[1]),
        description,
        amount:    Math.abs(rawAmount),
        type,
        transfer_direction,
        raw: { col0: cols[0], col1: cols[1], col2: cols[2], col3: cols[3], col4: cols[4], col5: cols[5] },
      } as SBRow
    })
    .filter(r => r.amount > 0 && r.date)
}

// ---------------------------------------------------------------------------
// Keyword → category mapping
//
// Each rule carries a `type` so we know whether to create an income or expense
// category if it doesn't exist yet. Rules are checked top-to-bottom; first
// match wins. Transfers never go through this — they stay uncategorised.
//
// Fallback for unmatched rows:
//   income  → 'Other Income'
//   expense → 'Other Expenses'
// ---------------------------------------------------------------------------
const KEYWORD_RULES: Array<{ pattern: RegExp; category: string; type: 'income' | 'expense' }> = [

  // ── Food & Dining ──────────────────────────────────────────────────────────
  { pattern: /UBER.?EATS|MR.?D.?FOOD|BOLT.?FOOD|CHECKERS.?SIXTY60|SIXTY60/i,                            category: 'Food & Dining',    type: 'expense' },
  { pattern: /KFC|MCDONALD|MCD\s|CHICKEN.?LICKEN|NANDO.?S|STEERS|WIMPY|DEBONAIRS/i,                     category: 'Food & Dining',    type: 'expense' },
  { pattern: /FISHAWAYS|KING.?PIE|ROMAN.?PIZZA|SCOOTERS|OCEAN.?BASKET|SPUR|SADDLES/i,                    category: 'Food & Dining',    type: 'expense' },
  { pattern: /PANAROTTIS|MUGG.?&.?BEAN|VIDA.?E|STARBUCKS|SEATTLE.?COFFEE|PAUL.?BAKERY/i,                category: 'Food & Dining',    type: 'expense' },
  { pattern: /HOLLYWOOD.?BUN|GORIMAS|FF.?FUSION|TASHAS|GOOD.?LUCK/i,                                    category: 'Food & Dining',    type: 'expense' },

  // ── Groceries ─────────────────────────────────────────────────────────────
  { pattern: /PICK.?N.?PAY|PNP\s/i,                                                                      category: 'Groceries',        type: 'expense' },
  { pattern: /\bCHECKERS\b(?!.*SIXTY)/i,                                                                 category: 'Groceries',        type: 'expense' },
  { pattern: /\bSPAR\b|\bOK\sFOODS\b|\bSHOPRITE\b|\bFOOD.?LOVER/i,                                     category: 'Groceries',        type: 'expense' },

  // ── Shopping ──────────────────────────────────────────────────────────────
  { pattern: /WOOLWORTHS|TRUWORTHS|FOSCHINI|MR.?PRICE|MRP\s|MRP\b/i,                                    category: 'Shopping',         type: 'expense' },
  { pattern: /H.?&.?M|ZARA|COTTON.?ON|EDGARS|V106.?EDG|MARKHAM|ACKERMANS|PEP\s/i,                      category: 'Shopping',         type: 'expense' },
  { pattern: /TAKEALOT|WOOTWARE|INCREDIBLE.?CONNECTION|GAME.?STORES|\bGAME\b/i,                          category: 'Shopping',         type: 'expense' },
  { pattern: /MAKRO|BUILDERS|LEROY.?MERLIN|CASANOVA|VALUECO|CLASSIC.?EYES/i,                             category: 'Shopping',         type: 'expense' },
  { pattern: /AMAZON(?!.*PRIME)/i,                                                                        category: 'Shopping',         type: 'expense' },
  { pattern: /ROOPANAND|MRP.?HOME/i,                                                                     category: 'Shopping',         type: 'expense' },

  // ── Transport ─────────────────────────────────────────────────────────────
  { pattern: /\bUBER\b(?!.*(EATS|FOOD))/i,                                                               category: 'Transport',        type: 'expense' },
  { pattern: /\bBOLT\b(?!.*FOOD)/i,                                                                      category: 'Transport',        type: 'expense' },
  { pattern: /GAUTRAIN|MYCITI|INTERCAPE|GREYHOUND|FLIXBUS|AIRPORT.?SHUTTLE/i,                            category: 'Transport',        type: 'expense' },

  // ── Fuel ──────────────────────────────────────────────────────────────────
  { pattern: /\bBP\b.*(FUEL|GARAGE|PETROL|SERVICE)|\bSHELL\b.*(FUEL|GARAGE)/i,                          category: 'Fuel',             type: 'expense' },
  { pattern: /\bENGEN\b|\bCALTEX\b|\bSASOL\b(?!.*BANK)|\bTOTAL\b.*(FUEL|PETROL)/i,                     category: 'Fuel',             type: 'expense' },
  { pattern: /PETROL.?STATION|FUEL.?STATION|GARAGE.?POS/i,                                               category: 'Fuel',             type: 'expense' },

  // ── Phone & Internet ──────────────────────────────────────────────────────
  { pattern: /PREPAID.?MOBILE|AIRTIME|DATA.?BUNDLE|RECHARGE/i,                                           category: 'Phone & Internet', type: 'expense' },
  { pattern: /TELKOM|VODACOM|MTN|CELL.?C|\bRAIN\b|OPENSERVE|WEBAFRICA|AFRIHOST|COOL.?IDEAS/i,           category: 'Phone & Internet', type: 'expense' },

  // ── Utilities ─────────────────────────────────────────────────────────────
  { pattern: /ESKOM|CITY.?POWER|MUNICIPALITY|RATES.?AND.?TAXES|WATER.?&.?ELEC/i,                        category: 'Utilities',        type: 'expense' },
  { pattern: /CITY.?OF.?(CAPE.?TOWN|JOHANNESBURG|TSHWANE|EKURHULENI)/i,                                  category: 'Utilities',        type: 'expense' },

  // ── Medical Aid ───────────────────────────────────────────────────────────
  { pattern: /MEDICAL.?AID|DISC.?PREM|BONITAS|MEDIHELP|FEDHEALTH|BESTMED|MOMENTUM.?HEALTH/i,            category: 'Medical Aid',      type: 'expense' },
  { pattern: /DISCOVERY.?HEALTH|SIZWE.?HOSMED|GENESIS.?MED/i,                                            category: 'Medical Aid',      type: 'expense' },

  // ── Insurance ─────────────────────────────────────────────────────────────
  { pattern: /OUTSURANCE|SANTAM|HOLLARD|BUDGET.?INSURANCE|DIAL.?DIRECT/i,                                category: 'Insurance',        type: 'expense' },
  { pattern: /DISCOVERY.?(LIFE|INSURE|VITALITY)|OLD.?MUTUAL|SANLAM|MOMENTUM(?!.?HEALTH)/i,              category: 'Insurance',        type: 'expense' },
  { pattern: /LIFE.?COVER|SHORT.?TERM.?INSURANCE|CAR.?INSURANCE/i,                                       category: 'Insurance',        type: 'expense' },

  // ── Pharmacy ──────────────────────────────────────────────────────────────
  { pattern: /DISCHEM|DIS-CHEM|\bCLICKS\b|PHARMACY/i,                                                   category: 'Pharmacy',         type: 'expense' },

  // ── Entertainment & Streaming ─────────────────────────────────────────────
  { pattern: /NETFLIX|SHOWMAX|DSTV|MULTICHOICE|DISNEY.?PLUS|APPLE.?TV|PRIME.?VIDEO/i,                   category: 'Entertainment',    type: 'expense' },
  { pattern: /SPOTIFY|APPLE.?MUSIC|YOUTUBE.?PREMIUM|TIDAL|DEEZER/i,                                     category: 'Entertainment',    type: 'expense' },
  { pattern: /AMAZON.?PRIME/i,                                                                            category: 'Entertainment',    type: 'expense' },

  // ── Gaming ────────────────────────────────────────────────────────────────
  { pattern: /STEAM|PLAYSTATION|SONY.?PSN|EPIC.?GAME|XBOX|EA.?GAMES|NINTENDO/i,                         category: 'Gaming',           type: 'expense' },

  // ── Subscriptions & Software ──────────────────────────────────────────────
  { pattern: /MICROSOFT|GOOGLE.?(ONE|STORAGE|WORKSPACE)|DROPBOX|ADOBE|NOTION|GITHUB/i,                  category: 'Subscriptions',    type: 'expense' },
  { pattern: /SERVICE.?AGREEMENT|STRATUM|SUBSCRIPTION|ANNUAL.?FEE/i,                                    category: 'Subscriptions',    type: 'expense' },

  // ── Bank Fees ─────────────────────────────────────────────────────────────
  { pattern: /MONTHLY.?FEE|SERVICE.?FEE|BANK.?CHARGE|ACCOUNT.?FEE|STATEMENT.?COST/i,                   category: 'Bank Fees',        type: 'expense' },
  { pattern: /CARD.?FEE|ATM.?FEE|MANAGEMENT.?FEE|ADMINISTRATION.?FEE|LEDGER.?FEE/i,                    category: 'Bank Fees',        type: 'expense' },

  // ── Cash Withdrawals ──────────────────────────────────────────────────────
  { pattern: /ATM.?WITHDRAWAL|CASH.?WITHDRAWAL|ATM.?CASH/i,                                              category: 'Cash Withdrawals', type: 'expense' },

  // ── Salary & Income ───────────────────────────────────────────────────────
  { pattern: /SALARY|STIPEND|PAYROLL|ELECTRONIC.?BANKING.?PAYMENT.?FR/i,                                 category: 'Salary',           type: 'income'  },
  { pattern: /COMMISSION|BONUS.?PAY|OVERTIME.?PAY/i,                                                     category: 'Salary',           type: 'income'  },
]

// Returns the category name for a description, including 'Other Income' /
// 'Other Expenses' fallback so every non-transfer row gets a category.
function matchCategoryName(description: string, txType: 'income' | 'expense' | 'transfer'): string | null {
  if (txType === 'transfer') return null
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(description)) return rule.category
  }
  return txType === 'income' ? 'Other Income' : 'Other Expenses'
}

// Returns the category type for a given category name.
function categoryType(name: string): 'income' | 'expense' {
  if (name === 'Other Income') return 'income'
  if (name === 'Other Expenses') return 'expense'
  return KEYWORD_RULES.find(r => r.category === name)?.type ?? 'expense'
}

// Returns a matching category ID from the loaded list, or null.
function matchCategory(
  description: string,
  txType: 'income' | 'expense' | 'transfer',
  categories: Array<{ id: number; name: string; type: string }>,
): number | null {
  if (txType === 'transfer') return null
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(description)) {
      const found = categories.find(c => c.name.toLowerCase() === rule.category.toLowerCase())
      if (found) return found.id
    }
  }
  // Fallback
  const fallback = txType === 'income' ? 'Other Income' : 'Other Expenses'
  return categories.find(c => c.name.toLowerCase() === fallback.toLowerCase())?.id ?? null
}

// ---------------------------------------------------------------------------
// POST /api/imports/upload
// ---------------------------------------------------------------------------
export const uploadCsv = async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'No file uploaded' })

    const content  = file.buffer.toString('utf-8')
    const rawLines = parse(content, {
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    }) as string[][]

    if (isStandardBank(rawLines)) {
      const rows = parseStandardBank(rawLines)
      return res.json({ format: 'standard_bank', rows, filename: file.originalname })
    }

    let records: Record<string, string>[]
    try {
      records = parse(content, { columns: true, skip_empty_lines: true, trim: true }) as Record<string, string>[]
    } catch {
      return res.status(400).json({ error: 'Could not parse CSV — ensure the file has a header row' })
    }

    if (records.length === 0) return res.status(400).json({ error: 'CSV file is empty' })

    const columns = Object.keys(records[0])
    res.json({ format: 'generic', columns, rows: records, filename: file.originalname })
  } catch (error) {
    console.error('Error uploading CSV:', error)
    res.status(500).json({ error: 'Failed to process CSV file' })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normaliseDesc(d: string): string {
  return d.toLowerCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
}

// ---------------------------------------------------------------------------
// POST /api/imports/preview
// ---------------------------------------------------------------------------
export const previewImport = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id
    const { rows, date_col, description_col, amount_col, format } = req.body as {
      rows:             (Record<string, string> | SBRow)[]
      date_col?:        string
      description_col?: string
      amount_col?:      string
      format?:          string
    }

    if (!rows) return res.status(400).json({ error: 'rows is required' })

    // Load existing categories
    const catResult = await query(`SELECT id, name, type FROM categories WHERE user_id = $1`, [userId])
    const categories: Array<{ id: number; name: string; type: string }> = catResult.rows

    // Load personal category rules (learned from previous re-categorisations)
    const rulesResult = await query(
      `SELECT pattern, category_id FROM user_category_rules WHERE user_id = $1`,
      [userId]
    )
    const personalRules = new Map<string, number>(
      rulesResult.rows.map((r: { pattern: string; category_id: number }) => [r.pattern, r.category_id])
    )

    // --- Parse rows into PreviewRow ---
    let parsed: PreviewRow[]

    if (format === 'standard_bank') {
      parsed = (rows as SBRow[]).map(row => {
        const desc = normaliseDesc(row.description)
        return {
          ...row,
          description:        desc,
          transfer_direction: row.transfer_direction ?? null,
          is_duplicate:       false,
          category_id:        null,
          account_id:         null,
          to_account_id:      null,
        }
      })
    } else {
      if (!date_col || !description_col || !amount_col) {
        return res.status(400).json({ error: 'date_col, description_col, and amount_col are required for generic format' })
      }
      parsed = (rows as Record<string, string>[]).map((row, idx) => {
        const rawAmount = parseFloat(row[amount_col]?.replace(/[^0-9.\-]/g, '') ?? '0')
        const desc      = normaliseDesc(row[description_col] ?? '')

        let type: 'income' | 'expense' | 'transfer'
        let transfer_direction: 'debit' | 'credit' | null = null

        if (TRANSFER_PATTERN.test(desc)) {
          type               = 'transfer'
          transfer_direction = rawAmount < 0 ? 'debit' : 'credit'
        } else {
          type = rawAmount >= 0 ? 'income' : 'expense'
        }

        return {
          row_index:          idx,
          date:               row[date_col] ?? '',
          description:        desc,
          amount:             Math.abs(rawAmount),
          type,
          transfer_direction,
          raw:                row,
          is_duplicate:       false,
          category_id:        null,
          account_id:         null,
          to_account_id:      null,
        } as PreviewRow
      }).filter(r => r.amount > 0 && r.date)
    }

    // --- Auto-create missing categories ---
    // Collect every category name that any parsed row needs.
    // Personal rules take priority — only fall back to keyword matching when no personal rule exists.
    const neededNames = new Set(
      parsed
        .filter(r => r.type !== 'transfer' && !personalRules.has(r.description))
        .map(r => matchCategoryName(r.description, r.type))
        .filter((n): n is string => n !== null)
    )

    for (const catName of neededNames) {
      const exists = categories.some(c => c.name.toLowerCase() === catName.toLowerCase())
      if (!exists) {
        const cType   = categoryType(catName)
        const inserted = await query(
          `INSERT INTO categories (user_id, name, type)
           VALUES ($1, $2, $3)
           ON CONFLICT DO NOTHING
           RETURNING id, name, type`,
          [userId, catName, cType]
        )
        if (inserted.rows.length > 0) {
          categories.push(inserted.rows[0])
        } else {
          const existing = await query(
            `SELECT id, name, type FROM categories WHERE user_id = $1 AND name = $2`,
            [userId, catName]
          )
          if (existing.rows.length > 0) categories.push(existing.rows[0])
        }
      }
    }

    // --- Assign categories to rows ---
    // Priority: 1) personal rules  2) keyword rules  3) fallback (Other Income/Expenses)
    parsed = parsed.map(row => {
      if (row.type === 'transfer') return { ...row, category_id: null }

      const personalCatId = personalRules.get(row.description)
      if (personalCatId !== undefined && categories.some(c => c.id === personalCatId)) {
        return { ...row, category_id: personalCatId }
      }

      return { ...row, category_id: matchCategory(row.description, row.type, categories) }
    })

    // --- Duplicate detection ---
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
      rows:       withDuplicates,
      total:      withDuplicates.length,
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
//
// Each transfer row inserts exactly one leg — the leg belonging to the account
// being imported. No paired leg is auto-created. This prevents double-counting
// when both sides of a transfer come from separate account statements.
//
// If account_targets is provided, opening_balance is back-calculated so that
//   opening_balance + SUM(all transactions) = target_balance
// ---------------------------------------------------------------------------
export const confirmImport = async (req: Request, res: Response) => {
  const { rows, filename, account_targets } = req.body as {
    rows:             PreviewRow[]
    filename:         string
    account_targets?: Array<{ account_id: number; target_balance: number }>
  }

  if (!rows || rows.length === 0) return res.status(400).json({ error: 'rows is required' })

  const missing = rows.filter(r => !r.account_id)
  if (missing.length > 0) return res.status(400).json({ error: `${missing.length} row(s) missing an account_id` })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const userId = req.user!.id

    // Validate account_targets ownership
    if (account_targets && account_targets.length > 0) {
      const ids        = account_targets.map(t => t.account_id)
      const owned      = await client.query(
        `SELECT id FROM accounts WHERE id = ANY($1) AND user_id = $2 AND is_active = true`,
        [ids, userId]
      )
      const ownedSet   = new Set(owned.rows.map((r: { id: number }) => r.id))
      const invalid    = ids.filter(id => !ownedSet.has(id))
      if (invalid.length > 0) {
        await client.query('ROLLBACK')
        return res.status(400).json({ error: `account_id(s) ${invalid.join(', ')} do not belong to this user` })
      }
    }

    // Create import record
    const importResult = await client.query(
      `INSERT INTO imports (user_id, filename, status, transaction_count, duplicate_count)
       VALUES ($1, $2, 'processing', $3, 0) RETURNING id`,
      [userId, filename ?? 'import.csv', rows.length]
    )
    const importId = importResult.rows[0].id

    let insertedCount = 0

    for (const row of rows) {
      const txType = row.type ?? 'expense'
      const desc   = normaliseDesc(row.description)

      if (txType === 'transfer') {
        const direction = row.transfer_direction ?? 'debit'
        const result = await client.query(
          `INSERT INTO transactions
             (user_id, account_id, category_id, type, amount, date, description, import_id, transfer_direction)
           VALUES ($1, $2, $3, 'transfer', $4, $5, $6, $7, $8)
           ON CONFLICT (user_id, account_id, date, amount, description)
           WHERE deleted_at IS NULL
           DO NOTHING
           RETURNING id`,
          [userId, row.account_id, row.category_id ?? null, row.amount, row.date, desc, importId, direction]
        )
        if (result.rowCount && result.rowCount > 0) insertedCount++
      } else {
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

    await client.query(
      `UPDATE imports SET status = 'complete', transaction_count = $1, duplicate_count = $2, updated_at = NOW() WHERE id = $3`,
      [insertedCount, rows.length - insertedCount, importId]
    )

    // Opening balance recalculation
    const adjustedAccounts: Array<{
      account_id: number; account_name: string; new_opening_balance: number; target_balance: number
    }> = []

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
        const txSum      = parseFloat(sumResult.rows[0].tx_sum)
        const newOpening = target.target_balance - txSum

        const updateResult = await client.query(
          `UPDATE accounts SET opening_balance = $1, updated_at = NOW()
           WHERE id = $2 AND user_id = $3 RETURNING name`,
          [newOpening.toFixed(2), target.account_id, userId]
        )
        if (updateResult.rows.length > 0) {
          adjustedAccounts.push({
            account_id:          target.account_id,
            account_name:        updateResult.rows[0].name,
            new_opening_balance: parseFloat(newOpening.toFixed(2)),
            target_balance:      target.target_balance,
          })
        }
      }
    }

    await client.query('COMMIT')
    res.status(201).json({
      import_id:         importId,
      inserted:          insertedCount,
      skipped:           rows.length - insertedCount,
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
       FROM imports WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Error fetching imports:', error)
    res.status(500).json({ error: 'Failed to fetch import history' })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/imports/:id  — rollback
// ---------------------------------------------------------------------------
export const rollbackImport = async (req: Request, res: Response) => {
  const { id }  = req.params
  const userId  = req.user!.id
  const client  = await pool.connect()

  try {
    await client.query('BEGIN')

    const importRow = await client.query(
      `SELECT id, status FROM imports WHERE id = $1 AND user_id = $2`,
      [id, userId]
    )
    if (importRow.rows.length === 0) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Import not found' })
    }
    if (importRow.rows[0].status === 'rolled_back') {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'Import already rolled back' })
    }

    const deleted = await client.query(
      `UPDATE transactions SET deleted_at = NOW(), updated_at = NOW()
       WHERE import_id = $1 AND user_id = $2 AND deleted_at IS NULL RETURNING id`,
      [id, userId]
    )

    await client.query(
      `UPDATE imports SET status = 'rolled_back', updated_at = NOW() WHERE id = $1`,
      [id]
    )

    await client.query('COMMIT')
    res.json({ rolled_back: deleted.rowCount ?? 0 })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error rolling back import:', error)
    res.status(500).json({ error: 'Failed to roll back import' })
  } finally {
    client.release()
  }
}
