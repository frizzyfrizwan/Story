import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

export function Chip({ active, className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
        active ? 'border-rose-600 bg-rose-600 text-white' : 'border-line bg-surface-raised text-ink-secondary hover:border-rose-300 hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: 'neutral' | 'rose' | 'sage' | 'sand' | 'red'
  className?: string
  children: ReactNode
}) {
  const tones = {
    neutral: 'bg-surface-sunken text-ink-secondary',
    rose: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
    sage: 'bg-sage-100 text-sage-800 dark:bg-sage-900/40 dark:text-sage-200',
    sand: 'bg-sand-100 text-sand-800 dark:bg-sand-900/40 dark:text-sand-200',
    red: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200',
  }
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone], className)}>{children}</span>
}
