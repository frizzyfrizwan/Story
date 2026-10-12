import { Check } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Checkbox({
  checked,
  onChange,
  label,
  hint,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
  className?: string
}) {
  return (
    <label className={cn('flex items-start gap-3 cursor-pointer select-none group py-2', className)}>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        aria-hidden
        className={cn(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors',
          checked ? 'bg-rose-600 border-rose-600 text-white' : 'border-ink-muted/50 bg-surface-raised group-hover:border-rose-400',
        )}
      >
        {checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className={cn('block text-sm text-ink transition-colors', checked && 'line-through text-ink-muted')}>{label}</span>
        {hint && <span className="block text-xs text-ink-muted">{hint}</span>}
      </span>
    </label>
  )
}
