import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function StatTile({
  label,
  value,
  unit,
  hint,
  icon,
  className,
}: {
  label: string
  value: ReactNode
  unit?: string
  hint?: ReactNode
  icon?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('card p-4 flex flex-col gap-1', className)}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-ink-muted">{label}</span>
        {icon && <span className="text-ink-muted">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold text-ink">{value}</span>
        {unit && <span className="text-sm text-ink-secondary">{unit}</span>}
      </div>
      {hint && <div className="text-xs text-ink-secondary">{hint}</div>}
    </div>
  )
}
