import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Account, Category } from '../../types'
import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { BASE_URL, getAuthHeaders } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../utils/format'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

// ── Types ────────────────────────────────────────────────────────────────────

interface RawRow { [key: string]: string }

interface PreviewRow {
  row_index:          number
  date:               string
  description:        string
  amount:             number
  type:               'income' | 'expense' | 'transfer'
  transfer_direction: 'debit' | 'credit' | null
  is_duplicate:       boolean
  category_id:        number | null
  account_id:         number | null
  to_account_id:      number | null
  raw?:               RawRow
}

interface ImportResult {
  inserted:          number
  skipped:           number
  adjusted_accounts: Array<{
    account_id:          number
    account_name:        string
    new_opening_balance: number
    target_balance:      number
  }>
}

type Step = 'upload' | 'assign' | 'preview' | 'done'

// ── Inline create-category ───────────────────────────────────────────────────

function CreateCategoryInline({
  type, onCreated, onCancel,
}: {
  type: 'income' | 'expense'
  onCreated: (cat: Category) => void
  onCancel: () => void
}) {
  const [name, setName]     = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      const cat = await categoriesApi.create({ name: name.trim(), type })
      onCreated(cat)
    } catch {
      setErr('Failed to create')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <input
        autoFocus
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
        placeholder="Category name"
        className="bg-background border border-primary rounded px-2 py-1 text-white text-xs focus:outline-none w-28"
      />
      <button onClick={handleSave} disabled={saving || !name.trim()}
        className="px-2 py-1 bg-primary rounded text-white text-xs disabled:opacity-50">
        {saving ? '…' : 'Add'}
      </button>
      <button onClick={onCancel} className="px-2 py-1 text-muted text-xs hover:text-white">✕</button>
      {err && <span className="text-danger text-xs">{err}</span>}
    </div>
  )
}

// ── Category cell ────────────────────────────────────────────────────────────

function CategoryCell({
  row, categories, onSelect, onNewCategory,
}: {
  row:           PreviewRow
  categories:    Category[]
  onSelect:      (id: number | null) => void
  onNewCategory: (cat: Category) => void
}) {
  const [creating, setCreating] = useState(false)
  const txType = row.type as 'income' | 'expense'
  const opts   = categories.filter(c => c.type === txType)

  if (creating) {
    return (
      <CreateCategoryInline
        type={txType}
        onCreated={cat => { onNewCategory(cat); onSelect(cat.id); setCreating(false) }}
        onCancel={() => setCreating(false)}
      />
    )
  }

  return (
    <select
      value={row.category_id ?? ''}
      onChange={e => {
        if (e.target.value === '__new__') { setCreating(true); return }
        onSelect(e.target.value ? Number(e.target.value) : null)
      }}
      className="bg-background border border-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary w-40"
    >
      <option value="">— None —</option>
      {opts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="__new__">+ New…</option>
    </select>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ImportPage() {
  useDocumentTitle('Import')

  const [step, setStep]         = useState<Step>('upload')
  const [accounts, setAccounts] = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [error, setError]       = useState<string | null>(null)
  const authHeaders             = getAuthHeaders()
  const fileRef                 = useRef<HTMLInputElement>(null)

  // ── Step 1 state ──
  const [filename, setFilename]       = useState('')
  const [format, setFormat]           = useState<'generic' | 'standard_bank'>('generic')
  const [uploadedRows, setUploadedRows] = useState<RawRow[]>([])
  const [columns, setColumns]         = useState<string[]>([])
  const [dateCol, setDateCol]         = useState('')
  const [descCol, setDescCol]         = useState('')
  const [amountCol, setAmountCol]     = useState('')
  const [uploading, setUploading]     = useState(false)

  // ── Step 2 state ──
  const [accountId, setAccountId]         = useState('')
  const [closingBalance, setClosingBalance] = useState('')
  const [previewing, setPreviewing]       = useState(false)

  // ── Step 3 state ──
  const [previewRows, setPreviewRows]         = useState<PreviewRow[]>([])
  const [skipDuplicates, setSkipDuplicates]   = useState(true)
  const [confirming, setConfirming]           = useState(false)

  // ── Step 4 state ──
  const [result, setResult] = useState<ImportResult | null>(null)

  useEffect(() => {
    accountsApi.getAll().then(setAccounts).catch(() => {})
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  // Step 1: Upload
  // ─────────────────────────────────────────────────────────────────────────
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE_URL}/imports/upload`, {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })
      if (!res.ok) { const err = await res.json(); throw new Error(err.error ?? 'Upload failed') }
      const data = await res.json()
      setFilename(data.filename)
      setFormat(data.format)
      setUploadedRows(data.rows)
      if (data.format === 'generic') {
        setColumns(data.columns)
        const cols: string[] = data.columns
        setDateCol(cols.find(c => /date/i.test(c))               ?? cols[0] ?? '')
        setDescCol(cols.find(c => /desc|narr|ref|detail/i.test(c)) ?? cols[1] ?? '')
        setAmountCol(cols.find(c => /amount|debit|credit/i.test(c)) ?? cols[2] ?? '')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const canContinueFromUpload =
    uploadedRows.length > 0 &&
    (format === 'standard_bank' || !!(dateCol && descCol && amountCol))

  // ─────────────────────────────────────────────────────────────────────────
  // Step 2 → 3: Fetch preview from server
  // ─────────────────────────────────────────────────────────────────────────
  const handlePreview = async () => {
    if (!accountId) { setError('Please select an account'); return }
    setError(null)
    setPreviewing(true)
    try {
      const body: Record<string, unknown> = { rows: uploadedRows, format }
      if (format === 'generic') {
        body.date_col        = dateCol
        body.description_col = descCol
        body.amount_col      = amountCol
      }
      const res = await fetch(`${BASE_URL}/imports/preview`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body:    JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')

      const id = Number(accountId)
      setPreviewRows((data.rows as PreviewRow[]).map(r => ({ ...r, account_id: id })))
      setCategories(data.categories ?? [])
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Step 3 → 4: Confirm import
  // ─────────────────────────────────────────────────────────────────────────
  const handleConfirm = async () => {
    const toImport = skipDuplicates
      ? previewRows.filter(r => !r.is_duplicate)
      : previewRows

    setError(null)
    setConfirming(true)
    try {
      const account_targets =
        closingBalance.trim() !== '' && accountId
          ? [{ account_id: Number(accountId), target_balance: parseFloat(closingBalance) }]
          : []

      const res = await fetch(`${BASE_URL}/imports/confirm`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body:    JSON.stringify({ rows: toImport, filename, account_targets }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult({ inserted: data.inserted, skipped: data.skipped, adjusted_accounts: data.adjusted_accounts ?? [] })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setConfirming(false)
    }
  }

  const updateRow = (rowIndex: number, patch: Partial<PreviewRow>) => {
    setPreviewRows(prev => prev.map(r => r.row_index === rowIndex ? { ...r, ...patch } : r))
  }

  const reset = () => {
    setStep('upload')
    setFilename(''); setUploadedRows([]); setColumns([])
    setDateCol(''); setDescCol(''); setAmountCol('')
    setAccountId(''); setClosingBalance('')
    setPreviewRows([]); setCategories([]); setResult(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Derived counts ────────────────────────────────────────────────────────
  const toImport      = skipDuplicates ? previewRows.filter(r => !r.is_duplicate) : previewRows
  const dupCount      = previewRows.filter(r => r.is_duplicate).length
  const incomeCount   = toImport.filter(r => r.type === 'income').length
  const expenseCount  = toImport.filter(r => r.type === 'expense').length
  const transferCount = toImport.filter(r => r.type === 'transfer').length

  const selectedAccount = accounts.find(a => a.id === Number(accountId))

  // ─────────────────────────────────────────────────────────────────────────
  // Step indicator
  // ─────────────────────────────────────────────────────────────────────────
  const STEPS: { key: Step; label: string }[] = [
    { key: 'upload',  label: 'Upload'  },
    { key: 'assign',  label: 'Assign'  },
    { key: 'preview', label: 'Review'  },
    { key: 'done',    label: 'Done'    },
  ]
  const stepOrder = STEPS.map(s => s.key)
  const currentIdx = stepOrder.indexOf(step)

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 max-w-5xl mx-auto">

      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Import Transactions</h1>
          <p className="text-muted text-sm mt-1">Upload a bank statement CSV to import your transactions</p>
        </div>
        <Link to="/import/history" className="text-muted text-sm hover:text-white transition-colors">
          Import History →
        </Link>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEPS.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
              step === s.key                ? 'bg-primary text-white' :
              currentIdx > i               ? 'bg-success text-white' :
                                             'bg-border text-muted'
            }`}>{currentIdx > i ? '✓' : i + 1}</div>
            <span className={`text-sm ${step === s.key ? 'text-white' : 'text-muted'}`}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="text-border mx-1">›</span>}
          </div>
        ))}
      </div>

      {error && (
        <p className="text-danger mb-4 text-sm bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Step 1: Upload                                                       */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="flex flex-col gap-4">
          <Card>
            <p className="text-white font-medium mb-1">Upload Bank Statement</p>
            <p className="text-muted text-xs mb-4">
              Import each account's statement separately. Standard Bank CSV is detected automatically — no column mapping needed.
            </p>

            {/* Drop zone */}
            <label className={`flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl transition-colors ${
              uploading ? 'border-border opacity-50 cursor-wait' :
              filename  ? 'border-success/50 bg-success/5 cursor-pointer' :
                          'border-border hover:border-primary cursor-pointer'
            }`}>
              {uploading ? (
                <p className="text-muted text-sm">Parsing…</p>
              ) : filename ? (
                <div className="text-center">
                  <p className="text-success text-sm font-medium">✓ {filename}</p>
                  <p className="text-muted text-xs mt-1">
                    {uploadedRows.length} rows · {format === 'standard_bank' ? 'Standard Bank format detected' : 'Generic CSV'}
                  </p>
                  <p className="text-muted text-xs mt-1 underline">Click to change file</p>
                </div>
              ) : (
                <div className="text-center">
                  <p className="text-muted text-sm">Click to select a CSV file</p>
                  <p className="text-muted text-xs mt-1">Standard Bank · generic CSV · max 5 MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleUpload}
                disabled={uploading}
              />
            </label>
          </Card>

          {/* Generic CSV column mapping — appears after upload */}
          {filename && format === 'generic' && (
            <Card>
              <p className="text-white font-medium mb-1">Map Columns</p>
              <p className="text-muted text-xs mb-4">Tell us which column contains the date, description, and amount.</p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                {([
                  { label: 'Date',        value: dateCol,   set: setDateCol   },
                  { label: 'Description', value: descCol,   set: setDescCol   },
                  { label: 'Amount',      value: amountCol, set: setAmountCol },
                ] as const).map(({ label, value, set }) => (
                  <div key={label}>
                    <label className="text-muted text-xs block mb-1">{label} column</label>
                    <select
                      value={value}
                      onChange={e => (set as (v: string) => void)(e.target.value)}
                      className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                    >
                      <option value="">Select…</option>
                      {columns.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {/* 3-row preview */}
              {dateCol && descCol && amountCol && (
                <div className="overflow-x-auto">
                  <p className="text-muted text-xs mb-2">Preview (first 3 rows)</p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="py-1.5 px-2 text-left text-muted">Date</th>
                        <th className="py-1.5 px-2 text-left text-muted">Description</th>
                        <th className="py-1.5 px-2 text-right text-muted">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploadedRows.slice(0, 3).map((r, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="py-1.5 px-2 text-muted">{r[dateCol]}</td>
                          <td className="py-1.5 px-2 text-muted truncate max-w-xs">{r[descCol]}</td>
                          <td className="py-1.5 px-2 text-right text-muted">{r[amountCol]}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {canContinueFromUpload && (
            <div className="flex justify-end">
              <button
                onClick={() => setStep('assign')}
                className="px-5 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm"
              >
                Continue →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Step 2: Assign account + closing balance                             */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'assign' && (
        <Card>
          <p className="text-white font-medium mb-1">Assign Account</p>
          <p className="text-muted text-xs mb-6">
            {filename} — {uploadedRows.length} transactions
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">

            {/* Account selector */}
            <div>
              <label className="text-muted text-xs block mb-1">
                Which account does this statement belong to? <span className="text-danger">*</span>
              </label>
              <select
                value={accountId}
                onChange={e => setAccountId(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select account…</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>

            {/* Closing balance */}
            <div>
              <label className="text-muted text-xs block mb-1">
                Closing balance on this statement <span className="text-muted">(optional)</span>
              </label>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 12 500.00"
                value={closingBalance}
                onChange={e => setClosingBalance(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              />
              {selectedAccount && (
                <p className="text-muted text-xs mt-1">
                  App currently shows: <span className="text-white">{formatCurrency(selectedAccount.current_balance)}</span>
                </p>
              )}
              <p className="text-muted text-xs mt-1">
                Enter the balance shown on your bank statement. The app will auto-calibrate the opening balance to match.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('upload'); setError(null) }}
              className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handlePreview}
              disabled={previewing || !accountId}
              className="px-5 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50"
            >
              {previewing ? 'Loading…' : 'Preview Transactions →'}
            </button>
          </div>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Step 3: Review                                                        */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-4">

          {/* Summary bar */}
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white font-medium">{previewRows.length} transactions found</p>
                {format === 'standard_bank' && (
                  <p className="text-primary text-xs mt-0.5">✓ Standard Bank — dates, amounts, and transfers parsed automatically</p>
                )}
                <div className="flex flex-wrap gap-2 mt-2">
                  {incomeCount   > 0 && <span className="text-success text-xs bg-success/10 px-2 py-0.5 rounded">{incomeCount} income</span>}
                  {expenseCount  > 0 && <span className="text-white text-xs bg-border/50 px-2 py-0.5 rounded">{expenseCount} expense</span>}
                  {transferCount > 0 && <span className="text-blue-400 text-xs bg-blue-400/10 px-2 py-0.5 rounded">{transferCount} transfer</span>}
                  {dupCount > 0 && skipDuplicates && (
                    <span className="text-warning text-xs bg-warning/10 px-2 py-0.5 rounded">
                      {dupCount} duplicate{dupCount > 1 ? 's' : ''} will be skipped
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skip-dupes"
                  checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="skip-dupes" className="text-muted text-sm select-none cursor-pointer">
                  Skip duplicates
                </label>
              </div>
            </div>
          </Card>

          {/* Transactions table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider w-28">Date</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider">Description</th>
                    <th className="py-2.5 px-3 text-right text-muted text-xs font-medium uppercase tracking-wider w-28">Amount</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider w-28">Type</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider w-44">Category</th>
                    <th className="py-2.5 px-3 text-center text-muted text-xs font-medium uppercase tracking-wider w-16">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(row => {
                    const isDimmed  = row.is_duplicate && skipDuplicates
                    const isTransfer = row.type === 'transfer'
                    const rowAccent  = isTransfer ? 'border-l-2 border-l-blue-500/60' : ''

                    return (
                      <tr
                        key={row.row_index}
                        className={`border-b border-border transition-colors hover:bg-border/20 ${rowAccent} ${isDimmed ? 'opacity-40' : ''}`}
                      >
                        {/* Date */}
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => updateRow(row.row_index, { date: e.target.value })}
                            className="bg-transparent text-muted text-xs focus:outline-none focus:text-white w-full"
                          />
                        </td>

                        {/* Description */}
                        <td className="py-2 px-3 max-w-xs">
                          <input
                            type="text"
                            value={row.description}
                            onChange={e => updateRow(row.row_index, { description: e.target.value })}
                            title={row.description}
                            className="bg-transparent text-white text-xs focus:outline-none w-full truncate"
                          />
                        </td>

                        {/* Amount */}
                        <td className={`py-2 px-3 text-xs text-right font-medium ${
                          row.type === 'income'   ? 'text-success' :
                          row.type === 'transfer' ? 'text-blue-400' :
                                                    'text-white'
                        }`}>
                          {row.type === 'income' ? '+' : row.type === 'expense' ? '-' : ''}
                          {formatCurrency(row.amount)}
                        </td>

                        {/* Type */}
                        <td className="py-2 px-3">
                          <select
                            value={row.type}
                            onChange={e => {
                              const t = e.target.value as PreviewRow['type']
                              updateRow(row.row_index, {
                                type:               t,
                                transfer_direction: t === 'transfer' ? (row.transfer_direction ?? 'debit') : null,
                                category_id:        null,
                              })
                            }}
                            className={`bg-background border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-primary ${
                              row.type === 'income'   ? 'border-success/40 text-success' :
                              row.type === 'transfer' ? 'border-blue-500/40 text-blue-400' :
                                                        'border-border text-muted'
                            }`}
                          >
                            <option value="income">Income</option>
                            <option value="expense">Expense</option>
                            <option value="transfer">Transfer</option>
                          </select>
                        </td>

                        {/* Category / direction */}
                        <td className="py-2 px-3">
                          {isTransfer ? (
                            <select
                              value={row.transfer_direction ?? 'debit'}
                              onChange={e => updateRow(row.row_index, { transfer_direction: e.target.value as 'debit' | 'credit' })}
                              className="bg-background border border-blue-500/30 rounded px-1.5 py-0.5 text-blue-400 text-xs focus:outline-none focus:border-blue-400"
                            >
                              <option value="debit">↑ Outflow</option>
                              <option value="credit">↓ Inflow</option>
                            </select>
                          ) : (
                            <CategoryCell
                              row={row}
                              categories={categories}
                              onSelect={id => updateRow(row.row_index, { category_id: id })}
                              onNewCategory={cat => setCategories(prev => [...prev, cat])}
                            />
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-2 px-3 text-center">
                          {row.is_duplicate
                            ? <span className="text-warning text-xs">Skip</span>
                            : <span className="text-success text-xs">✓</span>
                          }
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => { setStep('assign'); setError(null) }}
              className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm"
            >
              Back
            </button>
            <button
              onClick={handleConfirm}
              disabled={confirming || toImport.length === 0}
              className="px-5 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50"
            >
              {confirming
                ? 'Importing…'
                : `Import ${toImport.length} transaction${toImport.length !== 1 ? 's' : ''} →`
              }
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────────────── */}
      {/* Step 4: Done                                                          */}
      {/* ──────────────────────────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <Card>
          <div className="text-center py-4">
            <p className="text-4xl mb-4">✅</p>
            <p className="text-white text-xl font-bold mb-1">Import complete</p>
            <p className="text-muted text-sm">
              {result.inserted} transaction{result.inserted !== 1 ? 's' : ''} imported
              {result.skipped > 0 ? `, ${result.skipped} skipped` : ''}
            </p>
          </div>

          {result.adjusted_accounts.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-muted text-xs font-medium uppercase tracking-wider mb-3">Balance calibrated</p>
              {result.adjusted_accounts.map(a => (
                <div key={a.account_id} className="flex items-center justify-between bg-background rounded-lg px-4 py-2 text-sm">
                  <span className="text-white font-medium">{a.account_name}</span>
                  <span className="text-muted text-xs">
                    Closing balance = {formatCurrency(a.target_balance)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-center gap-3 mt-6 pt-6 border-t border-border">
            <button
              onClick={reset}
              className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm"
            >
              Import another file
            </button>
            <Link to="/transactions" className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">
              View Transactions
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
