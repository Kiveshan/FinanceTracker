import { useState, useEffect } from 'react'
import type { Category, CategoryType } from '../../types'
import { categoriesApi } from '../../api/categories'
import { Card } from '../../components/ui/Card'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { Spinner } from '../../components/ui/Spinner'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { toast } from 'sonner'

export function CategoriesPage() {
  useDocumentTitle('Categories')
  const [categories, setCategories]   = useState<Category[]>([])
  const [isLoading, setIsLoading]     = useState(true)
  const [error, setError]             = useState<string | null>(null)

  const [newName, setNewName]         = useState<Record<CategoryType, string>>({ income: '', expense: '' })
  const [adding, setAdding]           = useState<CategoryType | null>(null)
  const [editingId, setEditingId]     = useState<number | null>(null)
  const [editName, setEditName]       = useState<string>('')
  const [deletingCat, setDeletingCat] = useState<Category | null>(null)

  useEffect(() => {
    categoriesApi.getAll()
      .then(setCategories)
      .catch(() => setError('Failed to load categories'))
      .finally(() => setIsLoading(false))
  }, [])

  const handleAdd = async (type: CategoryType) => {
    const name = newName[type].trim()
    if (!name) return
    try {
      const created = await categoriesApi.create({ name, type })
      setCategories(prev => [...prev, created])
      setNewName(prev => ({ ...prev, [type]: '' }))
      setAdding(null)
      toast.success('Category created')
    } catch {
      toast.error('Failed to create category')
    }
  }

  const handleRename = async (id: number) => {
    const name = editName.trim()
    if (!name) return
    try {
      await categoriesApi.update(id, { name })
      setCategories(prev => prev.map(c => c.id === id ? { ...c, name } : c))
      setEditingId(null)
      toast.success('Category renamed')
    } catch {
      toast.error('Failed to update category')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await categoriesApi.delete(id)
      setCategories(prev => prev.filter(c => c.id !== id))
      toast.success('Category deleted')
    } catch {
      toast.error('Failed to delete category — it may be in use by transactions')
    }
  }

  const income  = categories.filter(c => c.type === 'income')
  const expense = categories.filter(c => c.type === 'expense')

  if (isLoading) return <div className="flex items-center justify-center h-64"><Spinner size={32} /></div>

  const Section = ({ type, list }: { type: CategoryType; list: Category[] }) => (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-white font-semibold capitalize">{type} Categories</h2>
        <button
          onClick={() => setAdding(type)}
          className="text-primary hover:text-indigo-400 text-sm transition-colors"
        >
          + Add
        </button>
      </div>

      {list.map(cat => (
        <div key={cat.id} className="flex items-center gap-2 group">
          {editingId === cat.id ? (
            <>
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleRename(cat.id); if (e.key === 'Escape') setEditingId(null) }}
                className="flex-1 bg-background border border-primary rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
              />
              <button onClick={() => handleRename(cat.id)} className="text-success text-xs">Save</button>
              <button onClick={() => setEditingId(null)} className="text-muted text-xs">Cancel</button>
            </>
          ) : (
            <>
              <span className="flex-1 text-white text-sm">{cat.name}</span>
              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => { setEditingId(cat.id); setEditName(cat.name) }}
                  className="text-muted hover:text-white text-xs transition-colors"
                >
                  Rename
                </button>
                <button
                  onClick={() => setDeletingCat(cat)}
                  className="text-muted hover:text-danger text-xs transition-colors"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      ))}

      {list.length === 0 && adding !== type && (
        <p className="text-muted text-sm">No {type} categories yet.</p>
      )}

      {adding === type && (
        <div className="flex items-center gap-2 mt-1">
          <input
            autoFocus
            value={newName[type]}
            onChange={e => setNewName(prev => ({ ...prev, [type]: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(type); if (e.key === 'Escape') setAdding(null) }}
            placeholder={`New ${type} category`}
            className="flex-1 bg-background border border-primary rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none"
          />
          <button onClick={() => handleAdd(type)} className="text-success text-xs">Add</button>
          <button onClick={() => setAdding(null)} className="text-muted text-xs">Cancel</button>
        </div>
      )}
    </Card>
  )

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-white text-2xl font-bold">Categories</h1>
        <p className="text-muted text-sm mt-1">Manage your income and expense categories</p>
      </div>

      {error && <p className="text-danger mb-4 text-sm">{error}</p>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Section type="income"  list={income}  />
        <Section type="expense" list={expense} />
      </div>

      {deletingCat && (
        <ConfirmDialog
          title="Delete Category"
          message={`Delete "${deletingCat.name}"? This will fail if any transactions use this category.`}
          confirmLabel="Delete"
          onConfirm={() => { const id = deletingCat.id; setDeletingCat(null); handleDelete(id) }}
          onCancel={() => setDeletingCat(null)}
        />
      )}
    </div>
  )
}
