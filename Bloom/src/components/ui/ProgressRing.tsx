import type { ReactNode } from 'react'

export function ProgressRing({
  value,
  size = 160,
  stroke = 10,
  children,
  trackClass = 'text-rose-100 dark:text-rose-900/40',
  fillClass = 'text-rose-500',
  label,
}: {
  /** 0..1 */
  value: number
  size?: number
  stroke?: number
  children?: ReactNode
  trackClass?: string
  fillClass?: string
  label: string
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className={trackClass} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - clamped)}
          className={`${fillClass} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}
