import { useMemo } from 'react'
import { RECIPES, RECIPE_BY_ID } from '@/data/recipes'
import { getWeekGuide } from '@/data/weeks'
import { buildWeekPlan, MEAL_SLOTS, type DayPlan } from '@/lib/mealPlan'
import { weekDates } from '@/lib/dates'
import { useProfileStore } from '@/store/profile'
import { useMealStore } from '@/store/meals'
import { usePregnancy } from './usePregnancy'
import { useToday } from './useToday'
import type { DietTag, Recipe, MealSlot } from '@/types'

const NO_DIET: DietTag[] = []

export interface ResolvedDay {
  date: string
  meals: { slot: MealSlot; recipe: Recipe | null; swapped: boolean }[]
}

/** The resolved 7-day plan for the week containing `anchorISO` (defaults to today). */
export function useMealPlan(anchorISO?: string) {
  const preg = usePregnancy()
  const diet = useProfileStore((s) => s.profile?.diet) ?? NO_DIET
  const seeds = useMealStore((s) => s.seeds)
  const overrides = useMealStore((s) => s.overrides)
  const today = useToday()
  const anchor = anchorISO ?? preg?.today ?? today
  const trimester = preg?.ga.trimester ?? 2
  const focus = getWeekGuide(preg?.ga.guideWeek ?? 1).nutritionFocus

  return useMemo(() => {
    const dates = weekDates(anchor)
    const weekKey = dates[0]
    const base = buildWeekPlan({ recipes: RECIPES, dates, diet, trimester, seed: seeds[weekKey] ?? 0, focus })
    const days: ResolvedDay[] = dates.map((date) => {
      const plan: DayPlan = base[date]
      const dayOverrides = overrides[date] ?? {}
      return {
        date,
        meals: MEAL_SLOTS.map((slot) => {
          const id = dayOverrides[slot] ?? plan[slot]
          return { slot, recipe: id ? (RECIPE_BY_ID[id] ?? null) : null, swapped: !!dayOverrides[slot] }
        }),
      }
    })
    return { weekKey, dates, days, byDate: Object.fromEntries(days.map((d) => [d.date, d])) as Record<string, ResolvedDay> }
  }, [anchor, diet, trimester, focus, seeds, overrides])
}
