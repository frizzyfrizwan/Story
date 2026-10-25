import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Reminder, ReminderTemplate } from '@/types'
import { uid } from '@/lib/ids'

export type ReminderInput = Omit<Reminder, 'id' | 'completedOn' | 'createdAt'>

interface ReminderState {
  reminders: Reminder[]
  /** reminderId → ISO date it last fired, prevents duplicate notifications. */
  firedOn: Record<string, string>
  add: (input: ReminderInput) => Reminder
  addFromTemplate: (t: ReminderTemplate) => Reminder
  update: (id: string, patch: Partial<ReminderInput>) => void
  remove: (id: string) => void
  toggleEnabled: (id: string) => void
  complete: (id: string, date: string) => void
  uncomplete: (id: string, date: string) => void
  snooze: (id: string, minutes: number) => void
  markFired: (id: string, date: string) => void
  replaceAll: (reminders: Reminder[]) => void
  clear: () => void
}

export const useReminderStore = create<ReminderState>()(
  persist(
    (set) => ({
      reminders: [],
      firedOn: {},
      add: (input) => {
        const reminder: Reminder = { ...input, id: uid(), completedOn: [], createdAt: new Date().toISOString() }
        set((s) => ({ reminders: [...s.reminders, reminder] }))
        return reminder
      },
      addFromTemplate: (t) => {
        const reminder: Reminder = {
          id: uid(),
          title: t.title,
          note: t.note,
          category: t.category,
          time: t.time,
          recurrence: t.recurrence,
          enabled: true,
          completedOn: [],
          createdAt: new Date().toISOString(),
        }
        set((s) => ({ reminders: [...s.reminders, reminder] }))
        return reminder
      },
      update: (id, patch) => set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, ...patch, snoozedUntil: undefined } : r)) })),
      remove: (id) => set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) })),
      toggleEnabled: (id) => set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)) })),
      complete: (id, date) =>
        set((s) => ({
          reminders: s.reminders.map((r) =>
            r.id === id && !r.completedOn.includes(date) ? { ...r, completedOn: [...r.completedOn, date], snoozedUntil: undefined } : r,
          ),
        })),
      uncomplete: (id, date) =>
        set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? { ...r, completedOn: r.completedOn.filter((d) => d !== date) } : r)) })),
      snooze: (id, minutes) =>
        set((s) => ({
          reminders: s.reminders.map((r) => (r.id === id ? { ...r, snoozedUntil: new Date(Date.now() + minutes * 60_000).toISOString() } : r)),
          firedOn: Object.fromEntries(Object.entries(s.firedOn).filter(([k]) => k !== id)),
        })),
      markFired: (id, date) => set((s) => ({ firedOn: { ...s.firedOn, [id]: date } })),
      replaceAll: (reminders) => set({ reminders, firedOn: {} }),
      clear: () => set({ reminders: [], firedOn: {} }),
    }),
    { name: 'bloom:reminders', version: 1 },
  ),
)
