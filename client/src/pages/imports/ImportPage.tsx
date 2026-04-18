import { useState, useEffect, useRef } from 'react'
import type { Account } from '../../types'
import { accountsApi } from '../../api/accounts'
import { BASE_URL } from '../../api/client'
import { Card } from '../../components/ui/Card'

interface RawRow { [key: string]: string }

interface PreviewRow {
  row_index: number
  date: string
  description: string
  amount: number
  is_duplicate: boolean
}

type Step = 'upload' | 'map' | 'preview' | 'done'

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-ZA', { style: 'currency', currency: 'ZAR', minimumFractionDigits: 2 }).format(n)
}

export function ImportPage() {
  const [step, setStep]                     = useState<Step>('upload')
  const [accounts, setAccounts]             = useState<Account[]>([])
  const [selectedAccount, setSelectedAccount] = useState<string>('')

  // Step 1 state
  const [filename, setFilename]             = useState<string>('')
  const [columns, setColumns]               = useState<string[]>([])
  const [rawRows, setRawRows]               = useState<RawRow[]>([])
  const [uploading, setUploading]           = useState(false)
  const fileRef                             = useRef<HTMLInputElement>(null)

  // Step 2 state
  const [dateCol, setDateCol]               = useState<string>('')
  const [descCol, setDescCol]               = useState<string>('')
  const [amountCol, setAmountCol]           = useState<string>('')

  // Step 3 state
  const [previewRows, setPreviewRows]       = useState<PreviewRow[]>([])
  const [skipDuplicates, setSkipDuplicates] = useState(true)
  const [previewing, setPreviewing]         = useState(false)

  // Step 4 state
  const [confirming, setConfirming]         = useState(false)
  const [result, setResult]                 = useState<{ inserted: number; skipped: number } | null>(null)
  const [error, setError]                   = useState<string | null>(null)

  useEffect(() => {
    accountsApi.getAll().then(setAccounts).catch(() => {})
  }, [])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${BASE_URL}/imports/upload`, { method: 'POST', body: formData })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Upload failed')
      }
      const data = await res.json()
      setFilename(data.filename)
      setColumns(data.columns)
      setRawRows(data.rows)
      // Auto-guess columns
      const cols: string[] = data.columns
      setDateCol(cols.find(c => /date/i.test(c)) ?? cols[0] ?? '')
      setDescCol(cols.find(c => /desc|narr|ref|detail/i.test(c)) ?? cols[1] ?? '')
      setAmountCol(cols.find(c => /amount|debit|credit/i.test(c)) ?? cols[2] ?? '')
      setStep('map')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handlePreview = async () => {
    if (!dateCol || !descCol || !amountCol) { setError('Map all three columns'); return }
    setError(null)
    setPreviewing(true)
    try {
      const res = await fetch(`${BASE_URL}/imports/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: rawRows, date_col: dateCol, description_col: descCol, amount_col: amountCol }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Preview failed')
      setPreviewRows(data.rows)
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed')
    } finally {
      setPreviewing(false)
    }
  }

  const handleConfirm = async () => {
    if (!selectedAccount) { setError('Select an account to import into'); return }
    setError(null)
    setConfirming(true)
    try {
      const res = await fetch(`${BASE_URL}/imports/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: previewRows,
          account_id: Number(selectedAccount),
          filename,
          skip_duplicates: skipDuplicates,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Import failed')
      setResult({ inserted: data.inserted, skipped: data.skipped })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setConfirming(false)
    }
  }

  const reset = () => {
    setStep('upload')
    setFilename(''); setColumns([]); setRawRows([])
    setDateCol(''); setDescCol(''); setAmountCol('')
    setPreviewRows([]); setResult(null); setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const duplicateCount = previewRows.filter(r => r.is_duplicate).length
  const toInsert = skipDuplicates ? previewRows.filter(r => !r.is_duplicate).length : previewRows.length

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Import Transactions</h1>
        <p className="text-muted text-sm mt-1">Upload a CSV bank statement to import transactions</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['upload', 'map', 'preview', 'done'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
              step === s ? 'bg-primary text-white' :
              (['upload','map','preview','done'].indexOf(step) > i) ? 'bg-success text-white' :
              'bg-border text-muted'
            }`}>
              {i + 1}
            </div>
            <span className={`text-sm capitalize ${step === s ? 'text-white' : 'text-muted'}`}>{s}</span>
            {i < 3 && <span className="text-border mx-1">›</span>}
          </div>
        ))}
      </div>

      {error && <p className="text-danger mb-4 text-sm">{error}</p>}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <Card>
          <p className="text-white font-medium mb-4">Upload CSV File</p>
          <label className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary transition-colors">
            <p className="text-muted text-sm">Click to select a CSV file</p>
            <p className="text-muted text-xs mt-1">Max 5MB</p>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileUpload} disabled={uploading} />
          </label>
          {uploading && <p className="text-muted text-sm mt-3">Uploading…</p>}
        </Card>
      )}

      {/* Step 2: Map columns */}
      {step === 'map' && (
        <Card>
          <p className="text-white font-medium mb-1">Map Columns</p>
          <p className="text-muted text-xs mb-4">{filename} — {rawRows.length} rows detected</p>

          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: 'Date column', value: dateCol, setter: setDateCol },
              { label: 'Description column', value: descCol, setter: setDescCol },
              { label: 'Amount column', value: amountCol, setter: setAmountCol },
            ].map(({ label, value, setter }) => (
              <div key={label}>
                <label className="text-muted text-xs block mb-1">{label}</label>
                <select
                  value={value}
                  onChange={e => setter(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
                >
                  <option value="">Select…</option>
                  {columns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
          </div>

          {/* Preview of first 3 raw rows */}
          {dateCol && descCol && amountCol && (
            <div className="mb-4 overflow-x-auto">
              <p className="text-muted text-xs mb-2">Preview (first 3 rows):</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="py-1.5 px-2 text-left text-muted">Date</th>
                    <th className="py-1.5 px-2 text-left text-muted">Description</th>
                    <th className="py-1.5 px-2 text-right text-muted">Amount</th>
                  </tr>
                </thead>
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
            <button
              onClick={handlePreview}
              disabled={previewing || !dateCol || !descCol || !amountCol}
              className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50"
            >
              {previewing ? 'Loading…' : 'Preview Import →'}
            </button>
          </div>
        </Card>
      )}

      {/* Step 3: Preview */}
      {step === 'preview' && (
        <div className="flex flex-col gap-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-white font-medium">{previewRows.length} transactions found</p>
                {duplicateCount > 0 && (
                  <p className="text-warning text-sm mt-1">⚠️ {duplicateCount} possible duplicate{duplicateCount > 1 ? 's' : ''} detected</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="skip-dupes"
                  checked={skipDuplicates}
                  onChange={e => setSkipDuplicates(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="skip-dupes" className="text-muted text-sm">Skip duplicates</label>
              </div>
            </div>

            <div className="mb-4">
              <label className="text-muted text-xs block mb-1">Import into account</label>
              <select
                value={selectedAccount}
                onChange={e => setSelectedAccount(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-primary"
              >
                <option value="">Select account…</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </div>
          </Card>

          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2.5 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Date</th>
                  <th className="py-2.5 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Description</th>
                  <th className="py-2.5 px-4 text-right text-muted text-xs font-medium uppercase tracking-wider">Amount</th>
                  <th className="py-2.5 px-4 text-center text-muted text-xs font-medium uppercase tracking-wider">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(row => (
                  <tr key={row.row_index} className={`border-b border-border ${row.is_duplicate ? 'opacity-60' : ''}`}>
                    <td className="py-2.5 px-4 text-muted">{row.date}</td>
                    <td className="py-2.5 px-4 text-white">{row.description}</td>
                    <td className="py-2.5 px-4 text-right text-white">{formatCurrency(row.amount)}</td>
                    <td className="py-2.5 px-4 text-center">
                      {row.is_duplicate
                        ? <span className="text-warning text-xs">⚠️ Duplicate</span>
                        : <span className="text-success text-xs">✓ New</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setStep('map')} className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">Back</button>
            <button
              onClick={handleConfirm}
              disabled={confirming || !selectedAccount}
              className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm disabled:opacity-50"
            >
              {confirming ? 'Importing…' : `Import ${toInsert} transaction${toInsert !== 1 ? 's' : ''} →`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Done */}
      {step === 'done' && result && (
        <Card className="text-center py-8">
          <p className="text-5xl mb-4">✅</p>
          <p className="text-white text-xl font-bold mb-2">Import complete!</p>
          <p className="text-muted">{result.inserted} transactions imported, {result.skipped} skipped</p>
          <div className="flex justify-center gap-3 mt-6">
            <button onClick={reset} className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm">
              Import another file
            </button>
            <a href="/transactions" className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">
              View Transactions
            </a>
          </div>
        </Card>
      )}
    </div>
  )
}
