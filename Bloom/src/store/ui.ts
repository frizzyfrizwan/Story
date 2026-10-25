import { create } from 'zustand'
import { uid } from '@/lib/ids'

export interface Toast {
  id: string
  title: string
  description?: string
  tone?: 'neutral' | 'success' | 'warning'
  action?: { label: string; onClick: () => void }
}

interface UIState {
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => string
  dismissToast: (id: string) => void
}

export const useUIStore = create<UIState>()((set) => ({
  toasts: [],
  toast: (t) => {
    const id = uid()
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }))
    return id
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = (t: Omit<Toast, 'id'>) => useUIStore.getState().toast(t)
