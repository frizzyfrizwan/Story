import { cn } from '@/lib/cn'

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  ariaLabel,
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: string }[]
  className?: string
  ariaLabel: string
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn('inline-flex rounded-xl bg-surface-sunken p-1 gap-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          type="button"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors whitespace-nowrap',
            value === o.value ? 'bg-surface-raised text-ink shadow-soft' : 'text-ink-secondary hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
