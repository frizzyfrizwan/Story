import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { Button } from './Button'

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'backdrop:bg-ink/40 backdrop:backdrop-blur-sm bg-transparent p-0 m-0 max-w-none max-h-none w-full h-full open:flex items-end sm:items-center justify-center',
      )}
    >
      {open && (
        <div
          role="document"
          className={cn(
            'card w-full animate-scale-in rounded-b-none sm:rounded-b-2xl max-h-[92dvh] flex flex-col',
            size === 'sm' && 'sm:max-w-md',
            size === 'md' && 'sm:max-w-lg',
            size === 'lg' && 'sm:max-w-2xl',
          )}
        >
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <div>
              <h2 className="text-xl font-semibold text-ink">{title}</h2>
              {description && <p className="text-sm text-ink-secondary mt-1">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close" className="-mr-2 -mt-1">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="px-5 pb-5 overflow-y-auto flex-1">{children}</div>
          {footer && <div className="px-5 py-4 border-t border-line flex justify-end gap-2 bg-surface-sunken/60 rounded-b-2xl">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export function ConfirmModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger,
}: {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm()
              onClose()
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-secondary">{description}</p>
    </Modal>
  )
}
