import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChecklistItem } from '@/types'
import { uid } from '@/lib/ids'

interface ChecklistState {
  checked: Record<string, true>
  customItems: Record<string, ChecklistItem[]>
  toggle: (itemId: string) => void
  addCustom: (groupId: string, label: string) => void
  removeCustom: (groupId: string, itemId: string) => void
  replaceAll: (checked: Record<string, true>, customItems: Record<string, ChecklistItem[]>) => void
  clear: () => void
}

export const useChecklistStore = create<ChecklistState>()(
  persist(
    (set) => ({
      checked: {},
      customItems: {},
      toggle: (itemId) =>
        set((s) => {
          const next = { ...s.checked }
          if (next[itemId]) delete next[itemId]
          else next[itemId] = true
          return { checked: next }
        }),
      addCustom: (groupId, label) =>
        set((s) => ({ customItems: { ...s.customItems, [groupId]: [...(s.customItems[groupId] ?? []), { id: `custom-${uid()}`, label }] } })),
      removeCustom: (groupId, itemId) =>
        set((s) => {
          const checked = { ...s.checked }
          delete checked[itemId]
          return { checked, customItems: { ...s.customItems, [groupId]: (s.customItems[groupId] ?? []).filter((i) => i.id !== itemId) } }
        }),
      replaceAll: (checked, customItems) => set({ checked, customItems }),
      clear: () => set({ checked: {}, customItems: {} }),
    }),
    { name: 'bloom:checklists', version: 1 },
  ),
)
