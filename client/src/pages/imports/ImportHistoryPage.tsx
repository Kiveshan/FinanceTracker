import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { BASE_URL, getAuthHeaders } from '../../api/client'
import { Card } from '../../components/ui/Card'
import { formatDateTime } from '../../utils/format'
import { useModalClose } from '../../hooks/useModalClose'
import { Spinner } from '../../components/ui/Spinner'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'

interface ImportRecord {
  id: number
  filename: string
  status: 'pending' | 'processing' | 'complete' | 'failed' | 'rolled_back'
  transaction_count: number
  duplicate_count: number
  error_message: string | null
  created_at: string
  updated_at: string
}

interface ConfirmModalProps {
  record: ImportRecord
  onConfirm: () => void
  onCancel: () => void
  rolling: boolean
}

function ConfirmModal({ record, onConfirm, onCancel, rolling }: ConfirmModalProps) {
  useModalClose(onCancel)
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onCancel}>
      <div className="bg-surface border border-border rounded-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="p-6 border-b border-border">
          <h2 className="text-white font-semibold">Roll Back Import?</h2>
        </div>
        <div className="p-6">
          <p className="text-muted text-sm mb-2">
            This will soft-delete all <span className="text-white font-medium">{record.transaction_count}</span> transactions
            from <span className="text-white font-medium">{record.filename}</span>.
          </p>
          <p className="text-muted text-sm">
            They will no longer appear in your analytics or balances. This cannot be undone through the UI.
          </p>
        </div>
        <div className="p-6 pt-0 flex gap-3 justify-end">
          <button onClick={onCancel} disabled={rolling}
            className="px-4 py-2 border border-border rounded-lg text-muted hover:text-white transition-colors text-sm">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={rolling}
            className="px-4 py-2 bg-danger rounded-lg text-white font-medium hover:bg-red-600 transition-colors text-sm disabled:opacity-50">
            {rolling ? 'Rolling back…' : 'Yes, roll back'}
          </button>
        </div>
      </div>
    </div>
  )
}

const STATUS_STYLES: Record<ImportRecord['status'], { label: string; className: string }> = {
  complete:     { label: 'Complete',     className: 'bg-success/20 text-success' },
  rolled_back:  { label: 'Rolled back',  className: 'bg-border text-muted' },
  failed:       { label: 'Failed',       className: 'bg-danger/20 text-danger' },
  processing:   { label: 'Processing',   className: 'bg-warning/20 text-warning' },
  pending:      { label: 'Pending',      className: 'bg-border text-muted' },
}

export function ImportHistoryPage() {
  useDocumentTitle('Import History')
  const [imports, setImports]         = useState<ImportRecord[]>([])
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState<string | null>(null)
  const [confirming, setConfirming]   = useState<ImportRecord | null>(null)
  const [rolling, setRolling]         = useState(false)
  const [successMsg, setSuccessMsg]   = useState<string | null>(null)

  const authHeaders = getAuthHeaders()

  const fetchImports = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${BASE_URL}/imports`, { headers: authHeaders })
      if (!res.ok) throw new Error('Failed to load import history')
      setImports(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchImports() }, [fetchImports])

  const handleRollback = async () => {
    if (!confirming) return
    setRolling(true)
    try {
      const res = await fetch(`${BASE_URL}/imports/${confirming.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Rollback failed')
      setSuccessMsg(`Rolled back ${data.rolled_back} transaction${data.rolled_back !== 1 ? 's' : ''} from "${confirming.filename}"`)
      setConfirming(null)
      await fetchImports()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rollback failed')
      setConfirming(null)
    } finally {
      setRolling(false)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-white text-2xl font-bold">Import History</h1>
          <p className="text-muted text-sm mt-1">Review past imports and roll back if needed</p>
        </div>
        <Link to="/import" className="px-4 py-2 bg-primary rounded-lg text-white font-medium hover:bg-indigo-500 transition-colors text-sm">
          + New Import
        </Link>
      </div>

      {successMsg && (
        <div className="mb-4 bg-success/10 border border-success/30 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-success text-sm">{successMsg}</p>
          <button onClick={() => setSuccessMsg(null)} className="text-muted hover:text-white text-xs ml-4">✕</button>
        </div>
      )}

      {error && (
        <div className="mb-4 bg-danger/10 border border-danger/30 rounded-lg px-4 py-3">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size={32} />
        </div>
      ) : imports.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-muted">No imports yet.</p>
          <Link to="/import" className="text-primary text-sm mt-2 inline-block hover:underline">
            Import your first file →
          </Link>
        </Card>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">File</th>
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Date</th>
                <th className="py-3 px-4 text-right text-muted text-xs font-medium uppercase tracking-wider">Imported</th>
                <th className="py-3 px-4 text-right text-muted text-xs font-medium uppercase tracking-wider">Skipped</th>
                <th className="py-3 px-4 text-left text-muted text-xs font-medium uppercase tracking-wider">Status</th>
                <th className="py-3 px-4 text-center text-muted text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {imports.map(imp => {
                const style = STATUS_STYLES[imp.status] ?? STATUS_STYLES.pending
                const canRollback = imp.status === 'complete'
                return (
                  <tr key={imp.id} className="border-b border-border hover:bg-background/40 transition-colors">
                    <td className="py-3 px-4">
                      <span className="text-white text-xs font-medium">{imp.filename}</span>
                    </td>
                    <td className="py-3 px-4 text-muted text-xs whitespace-nowrap">{formatDateTime(imp.created_at)}</td>
                    <td className="py-3 px-4 text-right text-white text-xs">{imp.transaction_count}</td>
                    <td className="py-3 px-4 text-right text-muted text-xs">{imp.duplicate_count}</td>
                    <td className="py-3 px-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.className}`}>{style.label}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {canRollback ? (
                        <button
                          onClick={() => { setSuccessMsg(null); setError(null); setConfirming(imp) }}
                          className="text-danger text-xs hover:underline"
                        >
                          Roll back
                        </button>
                      ) : (
                        <span className="text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {confirming && (
        <ConfirmModal
          record={confirming}
          onConfirm={handleRollback}
          onCancel={() => setConfirming(null)}
          rolling={rolling}
        />
      )}
    </div>
  )
}
