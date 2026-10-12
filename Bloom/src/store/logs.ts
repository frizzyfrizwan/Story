import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Contraction, DailyLog, KickSession, Mood, SymptomId } from '@/types'
import { uid } from '@/lib/ids'

interface LogState {
  logs: Record<string, DailyLog>
  contractions: Contraction[]
  getLog: (date: string) => DailyLog
  patchLog: (date: string, patch: Partial<Omit<DailyLog, 'date' | 'updatedAt'>>) => void
  toggleSymptom: (date: string, id: SymptomId) => void
  setWater: (date: string, glasses: number) => void
  setMood: (date: string, mood: Mood | undefined) => void
  toggleMealEaten: (date: string, recipeId: string) => void
  startKickSession: (date: string) => string
  addKick: (date: string, sessionId: string) => void
  endKickSession: (date: string, sessionId: string) => void
  deleteKickSession: (date: string, sessionId: string) => void
  startContraction: () => string
  endContraction: (id: string) => void
  deleteContraction: (id: string) => void
  clearContractions: () => void
  replaceAll: (logs: Record<string, DailyLog>, contractions: Contraction[]) => void
  clear: () => void
}

export function emptyLog(date: string): DailyLog {
  return { date, waterGlasses: 0, symptoms: [], kicks: [], mealsEaten: [], updatedAt: new Date(0).toISOString() }
}

export const useLogStore = create<LogState>()(
  persist(
    (set, get) => {
      const update = (date: string, fn: (log: DailyLog) => DailyLog) =>
        set((s) => {
          const current = s.logs[date] ?? emptyLog(date)
          return { logs: { ...s.logs, [date]: { ...fn(current), updatedAt: new Date().toISOString() } } }
        })
      return {
        logs: {},
        contractions: [],
        getLog: (date) => get().logs[date] ?? emptyLog(date),
        patchLog: (date, patch) => update(date, (l) => ({ ...l, ...patch })),
        toggleSymptom: (date, id) =>
          update(date, (l) => ({
            ...l,
            symptoms: l.symptoms.includes(id) ? l.symptoms.filter((s) => s !== id) : [...l.symptoms, id],
          })),
        setWater: (date, glasses) => update(date, (l) => ({ ...l, waterGlasses: Math.max(0, Math.min(30, glasses)) })),
        setMood: (date, mood) => update(date, (l) => ({ ...l, mood })),
        toggleMealEaten: (date, recipeId) =>
          update(date, (l) => ({
            ...l,
            mealsEaten: l.mealsEaten.includes(recipeId) ? l.mealsEaten.filter((m) => m !== recipeId) : [...l.mealsEaten, recipeId],
          })),
        startKickSession: (date) => {
          const session: KickSession = { id: uid(), startedAt: new Date().toISOString(), count: 0 }
          update(date, (l) => ({ ...l, kicks: [...l.kicks, session] }))
          return session.id
        },
        addKick: (date, sessionId) => update(date, (l) => ({ ...l, kicks: l.kicks.map((k) => (k.id === sessionId ? { ...k, count: k.count + 1 } : k)) })),
        endKickSession: (date, sessionId) =>
          update(date, (l) => ({
            ...l,
            kicks: l.kicks.map((k) => (k.id === sessionId && !k.endedAt ? { ...k, endedAt: new Date().toISOString() } : k)),
          })),
        deleteKickSession: (date, sessionId) => update(date, (l) => ({ ...l, kicks: l.kicks.filter((k) => k.id !== sessionId) })),
        startContraction: () => {
          const c: Contraction = { id: uid(), startedAt: new Date().toISOString() }
          set((s) => ({ contractions: [...s.contractions, c] }))
          return c.id
        },
        endContraction: (id) =>
          set((s) => ({ contractions: s.contractions.map((c) => (c.id === id && !c.endedAt ? { ...c, endedAt: new Date().toISOString() } : c)) })),
        deleteContraction: (id) => set((s) => ({ contractions: s.contractions.filter((c) => c.id !== id) })),
        clearContractions: () => set({ contractions: [] }),
        replaceAll: (logs, contractions) => set({ logs, contractions }),
        clear: () => set({ logs: {}, contractions: [] }),
      }
    },
    { name: 'bloom:logs', version: 1 },
  ),
)
