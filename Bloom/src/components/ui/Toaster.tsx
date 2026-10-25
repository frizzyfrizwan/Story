import { useEffect } from 'react'
import { X } from 'lucide-react'
import { useUIStore, type Toast } from '@/store/ui'
import { cn } from '@/lib/cn'

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useUIStore((s) => s.dismissToast)
  useEffect(() => {
    const id = window.setTimeout(() => dismiss(toast.id), toast.action ? 12_000 : 5_000)
    return () => window.clearTimeout(id)
  }, [toast, dismiss])
  return (
    <div
      role="status"
      className={cn(
        'card pointer-events-auto flex items-start gap-3 p-4 pr-3 shadow-lift animate-fade-up',
        toast.tone === 'success' && 'border-sage-300',
        toast.tone === 'warning' && 'border-sand-300',
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{toast.title}</p>
        {toast.description && <p className="text-sm text-ink-secondary mt-0.5">{toast.description}</p>}
        {toast.action && (
          <button
            type="button"
            className="mt-2 text-sm font-medium text-rose-600 hover:text-rose-700"
            onClick={() => {
              toast.action?.onClick()
              dismiss(toast.id)
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)} className="rounded-md p-1 text-ink-muted hover:text-ink">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

export function Toaster() {
  const toasts = useUIStore((s) => s.toasts)
  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-50 flex flex-col items-center gap-2 px-3 sm:items-end sm:right-4 sm:left-auto sm:w-96">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
