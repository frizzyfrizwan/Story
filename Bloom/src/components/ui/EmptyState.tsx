import type { ReactNode } from 'react'

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-10 px-6">
      {icon && <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-900/30">{icon}</div>}
      <h3 className="font-semibold text-ink">{title}</h3>
      {description && <p className="text-sm text-ink-secondary mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
