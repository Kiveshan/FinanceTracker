import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import type { Account, Category } from '../../types'
import { accountsApi } from '../../api/accounts'
import { categoriesApi } from '../../api/categories'
import { BASE_URL, getAuthHeaders } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { formatCurrency } from '../../utils/format'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface RawRow { [key: string]: string }

interface PreviewRow {
  row_index: number
  date: string
  description: string
  amount: number
  type: 'income' | 'expense' | 'transfer'
  is_duplicate: boolean
  category_id: number | null
  account_id: number | null
  to_account_id: number | null
  raw?: RawRow
}

interface AdjustedAccount {
  account_id: number
  account_name: string
  new_opening_balance: number
  target_balance: number
}

type Step = 'upload' | 'map' | 'preview' | 'done'

// ── Inline create-category mini-form ────────────────────────────────────────
interface CreateCategoryInlineProps {
  type: 'income' | 'expense'
  onCreated: (cat: Category) => void
  onCancel: () => void
}

function CreateCategoryInline({ type, onCreated, onCancel }: CreateCategoryInlineProps) {
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
    <div className="flex items-center gap-1 mt-1">
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

// ── CategoryCell ─────────────────────────────────────────────────────────────
interface CategoryCellProps {
  row: PreviewRow
  categories: Category[]
  onSelect: (id: number | null) => void
  onNewCategory: (cat: Category) => void
}

function CategoryCell({ row, categories, onSelect, onNewCategory }: CategoryCellProps) {
  const [creating, setCreating] = useState(false)
  const rowCats = categories.filter(c => c.type === (row.type === 'transfer' ? 'expense' : row.type))

  if (creating) {
    return (
      <CreateCategoryInline
        type={row.type === 'transfer' ? 'expense' : row.type}
        onCreated={(cat) => { onNewCategory(cat); onSelect(cat.id); setCreating(false) }}
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
      className="bg-background border border-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary w-36"
    >
      <option value="">— None —</option>
      {rowCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
      <option value="__new__">+ New category…</option>
    </select>
  )
}

// ── Main ImportPage ──────────────────────────────────────────────────────────
export function ImportPage() {
  useDocumentTitle('Import')
  const [step, setStep]             = useState<Step>('upload')
  const [accounts, setAccounts]     = useState<Account[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [format, setFormat]         = useState<'generic' | 'standard_bank'>('generic')

  // Step 1 state
  const [filename, setFilename]   = useState<string>('')
  const [columns, setColumns]     = useState<string[]>([])
  const [rawRows, setRawRows]     = useState<RawRow[]>([])
  const [uploading, setUploading] = useState(false)
  const fileRef                   = useRef<HTMLInputElement>(null)

  // Step 2 state (generic only)
  const [dateCol, setDateCol]     = useState<string>('')
  const [descCol, setDescCol]     = useState<string>('')
  const [amountCol, setAmountCol] = useState<string>('')

  // Step 3 state
  const [previewRows, setPreviewRows]     = useState<PreviewRow[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [previewing, setPreviewing]       = useState(false)
  const [globalAccount, setGlobalAccount] = useState<string>('')
  // account_id → target balance string (for opening balance recalculation)
  const [accountTargets, setAccountTargets] = useState<Record<number, string>>({})

  // Step 4 state
  const [confirming, setConfirming]     = useState(false)
  const [result, setResult]             = useState<{ inserted: number; skipped: number; adjusted_accounts: AdjustedAccount[] } | null>(null)
  const [error, setError]               = useState<string | null>(null)

  useEffect(() => {
    accountsApi.getAll().then(setAccounts).catch(() => {})
  }, [])

  const authHeaders = getAuthHeaders()

  // ── Step 1: Upload ──────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

      if (data.format === 'standard_bank') {
        await runPreview(data.rows, 'standard_bank')
      } else {
        setColumns(data.columns)
        setRawRows(data.rows)
        const cols: string[] = data.columns
        setDateCol(cols.find(c => /date/i.test(c)) ?? cols[0] ?? '')
        setDescCol(cols.find(c => /desc|narr|ref|detail/i.test(c)) ?? cols[1] ?? '')
        setAmountCol(cols.find(c => /amount|debit|credit/i.test(c)) ?? cols[2] ?? '')
        setStep('map')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Step 2 → 3: Preview ─────────────────────────────────────────────────
  const runPreview = async (rows: (RawRow | PreviewRow)[], fmt: 'generic' | 'standard_bank', dateCl = '', descCl = '', amountCl = '') => {
    setError(null)
    setPreviewing(true)
    try {
      const body: Record<string, unknown> = { rows, format: fmt }
      if (fmt === 'generic') {
        body.date_col = dateCl
        body.description_col = descCl
        body.amount_col = amountCl
      }
      const res = await fetch(`${BASE_URL}/imports/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setPreviewRows((data.rows as PreviewRow[]).map((r: PreviewRow) => ({
        ...r,
        account_id:    null,
        to_account_id: null,
      })))
      setCategories(data.categories ?? [])
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const handlePreview = () => {
    if (!dateCol || !descCol || !amountCol) { setError('Map all three columns'); return }
    runPreview(rawRows, 'generic', dateCol, descCol, amountCol)
  }

  // ── Step 3 → 4: Confirm ─────────────────────────────────────────────────
  const handleConfirm = async () => {
    const rowsToImport = skipDuplicates ? previewRows.filter(r => !r.is_duplicate) : previewRows

    const unassigned = rowsToImport.filter(r => !r.account_id)
    if (unassigned.length > 0) {
      setError(`${unassigned.length} transaction${unassigned.length > 1 ? 's' : ''} still need an account assigned`)
      return
    }
    const badTransfers = rowsToImport.filter(r => r.type === 'transfer' && !r.to_account_id)
    if (badTransfers.length > 0) {
      setError(`${badTransfers.length} transfer row${badTransfers.length > 1 ? 's' : ''} need a destination account`)
      return
    }

    // Build account_targets from non-empty inputs
    const account_targets = Object.entries(accountTargets)
      .filter(([, v]) => v.trim() !== '')
      .map(([id, v]) => ({ account_id: Number(id), target_balance: parseFloat(v) }))
      .filter(t => !isNaN(t.target_balance))

    setError(null)
    setConfirming(true)
    try {
      const res = await fetch(`${BASE_URL}/imports/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ rows: rowsToImport, filename, account_targets }),
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

  const applyGlobalAccount = (accountId: string) => {
    setGlobalAccount(accountId)
    if (accountId) {
      setPreviewRows(prev => prev.map(r => ({ ...r, account_id: Number(accountId) })))
    }
  }

  const reset = () => {
    setStep('upload')
    setFilename(''); setColumns([]); setRawRows([])
    setDateCol(''); setDescCol(''); setAmountCol('')
    setPreviewRows([]); setResult(null); setError(null)
    setGlobalAccount(''); setAccountTargets({})
    if (fileRef.current) fileRef.current.value = ''
  }

  // Derived counts
  const rowsToImport   = skipDuplicates ? previewRows.filter(r => !r.is_duplicate) : previewRows
  const duplicateCount = previewRows.filter(r => r.is_duplicate).length
  const incomeCount    = rowsToImport.filter(r => r.type === 'income').length
  const expenseCount   = rowsToImport.filter(r => r.type === 'expense').length
  const transferCount  = rowsToImport.filter(r => r.type === 'transfer').length

  // Distinct accounts used in the current preview rows (for balance targets)
  const usedAccountIds = [...new Set(rowsToImport.map(r => r.account_id).filter((id): id is number => id !== null))]
  const usedAccounts   = accounts.filter(a => usedAccountIds.includes(a.id))

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Import Transactions</h1>
          <p className="text-muted text-sm mt-1">Upload a CSV bank statement to import transactions</p>
        </div>
        <Link to="/import/history" className="text-muted text-sm hover:text-white transition-colors">
          View Import History →
        </Link>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => {
          const stepOrder = ['upload', 'map', 'preview', 'done']
          const currentIdx = stepOrder.indexOf(step)
          const isSkipped = format === 'standard_bank' && s === 'map'
          return (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                isSkipped ? 'bg-border text-muted opacity-40' :
                step === s ? 'bg-primary text-white' :
                currentIdx > i ? 'bg-success text-white' : 'bg-border text-muted'
              }`}>{i + 1}</div>
              <span className={`text-sm capitalize ${isSkipped ? 'text-muted opacity-40' : step === s ? 'text-white' : 'text-muted'}`}>{s}</span>
              {i < 3 && <span className="text-border mx-1">›</span>}
            </div>
          )
        })}
      </div>

      {error && <p className="text-danger mb-4 text-sm bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">{error}</p>}

      {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <Card>
          <p className="text-white font-medium mb-2">Upload CSV File</p>
          <p className="text-muted text-xs mb-4">Standard Bank statements are detected automatically — no column mapping needed.</p>
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary transition-colors">
            <p className="text-muted text-sm">Click to select a CSV file</p>
            <p className="text-muted text-xs mt-1">Max 5MB</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          {uploading && <p className="text-muted text-sm mt-3">Parsing…</p>}
        </Card>
      )}

      {/* ── Step 2: Map columns (generic only) ─────────────────────────────── */}
      {step === 'map' && (
        <Card>
          <p className="text-white font-medium mb-1">Map Columns</p>
          <p className="text-muted text-xs mb-4">{filename} — {rawRows.length} rows detected</p>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Date column',        value: dateCol,   setter: setDateCol   },
              { label: 'Description column', value: descCol,   setter: setDescCol   },
              { label: 'Amount column',      value: amountCol, setter: setAmountCol },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="text-muted text-xs block mb-1">{label}</label>
                <select value={value} onChange={e => setter(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                  <option value="">Select…</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>
          {dateCol && descCol && amountCol && (
            <div className="mb-4 overflow-x-auto">
              <p className="text-muted text-xs mb-2">Preview (first 3 rows):</p>
              <table className="w-full text-xs">
                <thead><tr className="border-b border-border">
                  <th className="py-1.5 px-2 text-left text-muted">Date</th>
                  <th className="py-1.5 px-2 text-left text-muted">Description</th>
                  <th className="py-1.5 px-2 text-right text-muted">Amount</th>
                </tr></thead>
                <tbody>
                  {rawRows.slice(0, 3).map((r, i) => (
                    <tr key={i} className="border-b border-border">
                      <td className="py-1.5 px-2 text-muted">{r[dateCol]}</td>
                      <td className="py-1.5 px-2 text-muted">{r[descCol]}</td>
                      <td className="py-1.5 px-2 text-right text-muted">{r[amountCol]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={reset} className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">Back</button>
            <button onClick={handlePreview} disabled={previewing || !dateCol || !descCol || !amountCol}
              className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50">
              {previewing ? 'Loading…' : 'Preview Import →'}
            </button>
          </div>
        </Card>
      )}

      {/* ── Step 3: Preview ────────────────────────────────────────────────── */}
      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          {/* Summary + controls card */}
          <Card>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-white font-medium">{previewRows.length} transactions found</p>
                {format === 'standard_bank' && (
                  <p className="text-primary text-xs mt-0.5">✓ Standard Bank format — dates and amounts parsed automatically</p>
                )}
                {/* Row count summary */}
                <div className="flex flex-wrap gap-3 mt-2">
                  {incomeCount > 0   && <span className="text-success text-xs bg-success/10 px-2 py-0.5 rounded">{incomeCount} income</span>}
                  {expenseCount > 0  && <span className="text-muted text-xs bg-border/50 px-2 py-0.5 rounded">{expenseCount} expense</span>}
                  {transferCount > 0 && <span className="text-blue-400 text-xs bg-blue-400/10 px-2 py-0.5 rounded">{transferCount} transfer</span>}
                  {duplicateCount > 0 && skipDuplicates && (
                    <span className="text-warning text-xs bg-warning/10 px-2 py-0.5 rounded">{duplicateCount} duplicate{duplicateCount > 1 ? 's' : ''} skipped</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <input type="checkbox" id="skip-dupes" checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)} className="rounded" />
                <label htmlFor="skip-dupes" className="text-muted text-sm">Skip duplicates</label>
              </div>
            </div>

            {/* Global apply-to-all account */}
            <div className="mt-4 pt-4 border-t border-border">
              <label className="text-muted text-xs block mb-1">Apply one account to all rows (you can still override per row)</label>
              <select value={globalAccount} onChange={e => applyGlobalAccount(e.target.value)}
                className="w-full max-w-xs bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary">
                <option value="">Select account to apply to all…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>

            {/* Per-account balance target inputs */}
            {usedAccounts.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-muted text-xs font-medium mb-1">Set current balance target (optional)</p>
                <p className="text-muted text-xs mb-3">
                  Enter the real balance your bank shows today for each account. The app will automatically adjust the opening balance so the numbers stay correct after import.
                </p>
                <div className="flex flex-wrap gap-4">
                  {usedAccounts.map(a => (
                    <div key={a.id} className="flex items-center gap-2">
                      <label className="text-white text-xs whitespace-nowrap">{a.name}</label>
                      <span className="text-muted text-xs">(now: {formatCurrency(a.current_balance)})</span>
                      <span className="text-muted text-xs">→</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Target balance"
                        value={accountTargets[a.id] ?? ''}
                        onChange={e => setAccountTargets(prev => ({ ...prev, [a.id]: e.target.value }))}
                        className="w-36 bg-background border border-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Preview table */}
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider w-24">Date</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider">Description</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider w-24">Type</th>
                    <th className="py-2.5 px-3 text-right text-muted text-xs font-medium uppercase tracking-wider w-28">Amount</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider">From Account</th>
                    <th className="py-2.5 px-3 text-left text-muted text-xs font-medium uppercase tracking-wider">To / Category</th>
                    <th className="py-2.5 px-3 text-center text-muted text-xs font-medium uppercase tracking-wider w-20">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map(row => {
                    const isTransfer   = row.type === 'transfer'
                    const isDimmed     = row.is_duplicate && skipDuplicates
                    const rowBg        = isTransfer ? 'border-l-2 border-l-blue-500' : ''
                    const missingTo    = isTransfer && !row.to_account_id

                    let statusBadge: React.ReactNode
                    if (!row.account_id) {
                      statusBadge = <span className="text-danger text-xs">No account</span>
                    } else if (missingTo) {
                      statusBadge = <span className="text-warning text-xs">⚠ Needs to</span>
                    } else if (row.is_duplicate) {
                      statusBadge = <span className="text-warning text-xs">⚠ Dupe</span>
                    } else {
                      statusBadge = <span className="text-success text-xs">✓ Ready</span>
                    }

                    return (
                      <tr key={row.row_index}
                        className={`border-b border-border ${rowBg} ${isDimmed ? 'opacity-40' : ''}`}>
                        {/* Date — editable */}
                        <td className="py-2 px-3">
                          <input
                            type="date"
                            value={row.date}
                            onChange={e => updateRow(row.row_index, { date: e.target.value })}
                            className="bg-transparent text-muted text-xs focus:outline-none focus:text-white w-28"
                          />
                        </td>
                        {/* Description — editable */}
                        <td className="py-2 px-3 max-w-xs">
                          <input
                            type="text"
                            value={row.description}
                            onChange={e => updateRow(row.row_index, { description: e.target.value })}
                            title={row.description}
                            className="bg-transparent text-white text-xs focus:outline-none focus:border-b focus:border-primary w-full truncate"
                          />
                        </td>
                        {/* Type — editable dropdown */}
                        <td className="py-2 px-3">
                          <select
                            value={row.type}
                            onChange={e => {
                              const newType = e.target.value as PreviewRow['type']
                              updateRow(row.row_index, {
                                type: newType,
                                to_account_id: newType === 'transfer' ? row.to_account_id : null,
                              })
                            }}
                            className={`bg-background border rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-primary ${
                              row.type === 'income'   ? 'border-success/50 text-success' :
                              row.type === 'transfer' ? 'border-blue-500/50 text-blue-400' :
                                                        'border-border text-muted'
                            }`}
                          >
                            <option value="income">income</option>
                            <option value="expense">expense</option>
                            <option value="transfer">transfer</option>
                          </select>
                        </td>
                        {/* Amount — editable */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount}
                            onChange={e => updateRow(row.row_index, { amount: Math.abs(parseFloat(e.target.value) || 0) })}
                            className={`bg-transparent text-xs text-right focus:outline-none focus:border-b focus:border-primary w-24 ${
                              row.type === 'income' ? 'text-success' : row.type === 'transfer' ? 'text-blue-400' : 'text-white'
                            }`}
                          />
                        </td>
                        {/* From account */}
                        <td className="py-2 px-3">
                          <select
                            value={row.account_id ?? ''}
                            onChange={e => updateRow(row.row_index, { account_id: e.target.value ? Number(e.target.value) : null })}
                            className="bg-background border border-border rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-primary w-32"
                          >
                            <option value="">— None —</option>
                            {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                          </select>
                        </td>
                        {/* To account (transfer) or Category (income/expense) */}
                        <td className="py-2 px-3">
                          {isTransfer ? (
                            <select
                              value={row.to_account_id ?? ''}
                              onChange={e => updateRow(row.row_index, { to_account_id: e.target.value ? Number(e.target.value) : null })}
                              className={`bg-background border rounded px-2 py-1 text-xs focus:outline-none w-32 ${
                                missingTo ? 'border-warning text-warning' : 'border-border text-white focus:border-primary'
                              }`}
                            >
                              <option value="">— To account —</option>
                              {accounts.filter(a => a.id !== row.account_id).map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                              ))}
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
                        <td className="py-2 px-3 text-center">{statusBadge}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => format === 'standard_bank' ? reset() : setStep('map')}
              className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">
              Back
            </button>
            <button onClick={handleConfirm} disabled={confirming}
              className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50">
              {confirming ? 'Importing…' : `Import ${rowsToImport.length} transaction${rowsToImport.length !== 1 ? 's' : ''} →`}
            </button>
          </div>
        </div>
      )}

      {/* ── Step 4: Done ───────────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <Card className="py-8">
          <div className="text-center">
            <p className="text-5xl mb-4">✅</p>
            <p className="text-white text-xl font-bold mb-2">Import complete!</p>
            <p className="text-muted">{result.inserted} transaction{result.inserted !== 1 ? 's' : ''} imported, {result.skipped} skipped</p>
          </div>
          {result.adjusted_accounts.length > 0 && (
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-muted text-xs font-medium uppercase tracking-wider mb-3">Opening balances adjusted</p>
              <div className="flex flex-col gap-2">
                {result.adjusted_accounts.map(a => (
                  <div key={a.account_id} className="flex items-center justify-between text-sm bg-background rounded-lg px-4 py-2">
                    <span className="text-white font-medium">{a.account_name}</span>
                    <span className="text-muted text-xs">
                      Opening balance set to {formatCurrency(a.new_opening_balance)} → current balance = {formatCurrency(a.target_balance)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={reset} className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm">
              Import another file
            </button>
            <Link to="/transactions" className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">
              View Transactions
            </Link>
            <Link to="/import/history" className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">
              Import History
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
