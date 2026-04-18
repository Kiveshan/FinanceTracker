import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 p-4 rounded-full bg-border/50">
        <Icon size={32} className="text-muted" />
      </div>
      <p className="text-white text-lg font-medium">{title}</p>
      {description && <p className="text-muted text-sm mt-2 max-w-sm">{description}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 bg-primary rounded-lg text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
