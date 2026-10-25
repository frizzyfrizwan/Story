import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Appointment } from '@/types'
import { uid } from '@/lib/ids'

export type AppointmentInput = Omit<Appointment, 'id'>

interface AppointmentState {
  appointments: Appointment[]
  dismissedSuggestions: string[]
  add: (input: AppointmentInput) => Appointment
  update: (id: string, patch: Partial<AppointmentInput>) => void
  remove: (id: string) => void
  toggleDone: (id: string) => void
  dismissSuggestion: (id: string) => void
  replaceAll: (appointments: Appointment[]) => void
  clear: () => void
}

export const useAppointmentStore = create<AppointmentState>()(
  persist(
    (set) => ({
      appointments: [],
      dismissedSuggestions: [],
      add: (input) => {
        const appt: Appointment = { ...input, id: uid() }
        set((s) => ({ appointments: [...s.appointments, appt] }))
        return appt
      },
      update: (id, patch) => set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      remove: (id) => set((s) => ({ appointments: s.appointments.filter((a) => a.id !== id) })),
      toggleDone: (id) => set((s) => ({ appointments: s.appointments.map((a) => (a.id === id ? { ...a, done: !a.done } : a)) })),
      dismissSuggestion: (id) => set((s) => ({ dismissedSuggestions: [...new Set([...s.dismissedSuggestions, id])] })),
      replaceAll: (appointments) => set({ appointments }),
      clear: () => set({ appointments: [], dismissedSuggestions: [] }),
    }),
    { name: 'bloom:appointments', version: 1 },
  ),
)
