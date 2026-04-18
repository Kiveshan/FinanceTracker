import { Request, Response } from 'express'
import { parse } from 'csv-parse/sync'
import { query } from '../db'
import pool from '../db'

export interface PreviewRow {
  row_index: number
  date: string
  description: string
  amount: number
  raw: Record<string, string>
  is_duplicate: boolean
}

// POST /api/imports/upload
// Accepts a multipart CSV file, parses it, returns preview rows + column headers
export const uploadCsv = async (req: Request, res: Response) => {
  try {
    const file = req.file
    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const content = file.buffer.toString('utf-8')
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
    res.json({ columns, rows: records, filename: file.originalname })
  } catch (error) {
    console.error('Error uploading CSV:', error)
    res.status(500).json({ error: 'Failed to process CSV file' })
  }
}

// POST /api/imports/preview
// Receives column mapping + raw rows, returns typed preview with duplicate flags
export const previewImport = async (req: Request, res: Response) => {
  try {
    const { rows, date_col, description_col, amount_col } = req.body as {
      rows: Record<string, string>[]
      date_col: string
      description_col: string
      amount_col: string
    }

    if (!rows || !date_col || !description_col || !amount_col) {
      return res.status(400).json({ error: 'rows, date_col, description_col, and amount_col are required' })
    }

    // Parse each row
    const parsed: PreviewRow[] = rows.map((row, idx) => {
      const rawAmount = row[amount_col]?.replace(/[^0-9.\-]/g, '') ?? '0'
      return {
        row_index:    idx,
        date:         row[date_col] ?? '',
        description:  row[description_col] ?? '',
        amount:       Math.abs(parseFloat(rawAmount) || 0),
        raw:          row,
        is_duplicate: false,
      }
    }).filter(r => r.amount > 0 && r.date)

    // Check duplicates: date + amount + description vs existing non-deleted transactions
    const existing = await query(
      `SELECT date, amount, description FROM transactions WHERE user_id = $1 AND deleted_at IS NULL`,
      [req.user!.id]
    )

    const existingSet = new Set(
      existing.rows.map(r => `${r.date.toISOString().slice(0, 10)}|${+r.amount}|${r.description.toLowerCase()}`)
    )

    const withDuplicates = parsed.map(row => ({
      ...row,
      is_duplicate: existingSet.has(`${row.date}|${row.amount}|${row.description.toLowerCase()}`),
    }))

    res.json({ rows: withDuplicates, total: withDuplicates.length, duplicates: withDuplicates.filter(r => r.is_duplicate).length })
  } catch (error) {
    console.error('Error previewing import:', error)
    res.status(500).json({ error: 'Failed to preview import' })
  }
}

// POST /api/imports/confirm
// Inserts confirmed rows, records the import, skips rows flagged as duplicate by the user
export const confirmImport = async (req: Request, res: Response) => {
  const { rows, account_id, filename, skip_duplicates } = req.body as {
    rows: PreviewRow[]
    account_id: number
    filename: string
    skip_duplicates: boolean
  }

  if (!rows || !account_id) {
    return res.status(400).json({ error: 'rows and account_id are required' })
  }

  const toInsert = skip_duplicates ? rows.filter(r => !r.is_duplicate) : rows
  const duplicateCount = rows.filter(r => r.is_duplicate).length

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create the import record
    const userId = req.user!.id
    const importResult = await client.query(
      `INSERT INTO imports (user_id, filename, status, transaction_count, duplicate_count)
       VALUES ($1, $2, 'processing', $3, $4)
       RETURNING id`,
      [userId, filename ?? 'import.csv', toInsert.length, duplicateCount]
    )
    const importId = importResult.rows[0].id

    // Insert transactions
    for (const row of toInsert) {
      await client.query(
        `INSERT INTO transactions (user_id, account_id, type, amount, date, description, import_id)
         VALUES ($1, $2, 'expense', $3, $4, $5, $6)`,
        [userId, account_id, row.amount, row.date, row.description, importId]
      )
    }

    // Mark import complete
    await client.query(
      `UPDATE imports SET status = 'complete', updated_at = NOW() WHERE id = $1`,
      [importId]
    )

    await client.query('COMMIT')
    res.status(201).json({ import_id: importId, inserted: toInsert.length, skipped: duplicateCount })
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Error confirming import:', error)
    res.status(500).json({ error: 'Failed to import transactions' })
  } finally {
    client.release()
  }
}
