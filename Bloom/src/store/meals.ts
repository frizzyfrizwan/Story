import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { MealSlot } from '@/types'

interface MealState {
  /** Per-week reshuffle seed, keyed by the Monday ISO date. */
  seeds: Record<string, number>
  /** Manual swaps: date → slot → recipeId. */
  overrides: Record<string, Partial<Record<MealSlot, string>>>
  /** Grocery lines ticked off, keyed by week Monday → line keys. */
  groceryChecked: Record<string, string[]>
  favourites: string[]
  reshuffle: (weekKey: string) => void
  swap: (date: string, slot: MealSlot, recipeId: string) => void
  clearSwap: (date: string, slot: MealSlot) => void
  toggleGrocery: (weekKey: string, lineKey: string) => void
  clearGrocery: (weekKey: string) => void
  toggleFavourite: (recipeId: string) => void
  replaceAll: (state: Pick<MealState, 'seeds' | 'overrides' | 'groceryChecked' | 'favourites'>) => void
  clear: () => void
}

export const useMealStore = create<MealState>()(
  persist(
    (set) => ({
      seeds: {},
      overrides: {},
      groceryChecked: {},
      favourites: [],
      reshuffle: (weekKey) => set((s) => ({ seeds: { ...s.seeds, [weekKey]: (s.seeds[weekKey] ?? 0) + 1 } })),
      swap: (date, slot, recipeId) => set((s) => ({ overrides: { ...s.overrides, [date]: { ...s.overrides[date], [slot]: recipeId } } })),
      clearSwap: (date, slot) =>
        set((s) => {
          const day = { ...s.overrides[date] }
          delete day[slot]
          return { overrides: { ...s.overrides, [date]: day } }
        }),
      toggleGrocery: (weekKey, lineKey) =>
        set((s) => {
          const current = s.groceryChecked[weekKey] ?? []
          const next = current.includes(lineKey) ? current.filter((k) => k !== lineKey) : [...current, lineKey]
          return { groceryChecked: { ...s.groceryChecked, [weekKey]: next } }
        }),
      clearGrocery: (weekKey) => set((s) => ({ groceryChecked: { ...s.groceryChecked, [weekKey]: [] } })),
      toggleFavourite: (recipeId) =>
        set((s) => ({ favourites: s.favourites.includes(recipeId) ? s.favourites.filter((f) => f !== recipeId) : [...s.favourites, recipeId] })),
      replaceAll: (state) => set(state),
      clear: () => set({ seeds: {}, overrides: {}, groceryChecked: {}, favourites: [] }),
    }),
    { name: 'bloom:meals', version: 1 },
  ),
)
