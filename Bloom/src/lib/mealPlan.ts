import type { DietTag, MealSlot, Nutrient, Recipe, Trimester } from '@/types'

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack']

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export type DayPlan = Record<MealSlot, string | null>

/** Deterministic 32-bit hash → [0,1) PRNG (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function recipeMatchesDiet(recipe: Recipe, diet: DietTag[]): boolean {
  return diet.every((d) => recipe.tags.includes(d))
}

export function eligibleRecipes(recipes: Recipe[], slot: MealSlot, diet: DietTag[], trimester: Trimester): Recipe[] {
  const strict = recipes.filter((r) => r.slots.includes(slot) && recipeMatchesDiet(r, diet) && r.trimesters.includes(trimester))
  if (strict.length >= 3) return strict
  // Relax the trimester preference before relaxing diet (diet is a hard constraint).
  return recipes.filter((r) => r.slots.includes(slot) && recipeMatchesDiet(r, diet))
}

/**
 * Build a 7-day plan keyed by ISO date. Deterministic for a given
 * (weekKey, seed, diet, trimester) so the plan is stable across reloads,
 * and avoids repeating a recipe within the same week where possible.
 */
export function buildWeekPlan(params: {
  recipes: Recipe[]
  dates: string[]
  diet: DietTag[]
  trimester: Trimester
  seed: number
  /** Nutrients to emphasise this week; matching recipes are scheduled first. */
  focus?: Nutrient[]
}): Record<string, DayPlan> {
  const { recipes, dates, diet, trimester, seed, focus = [] } = params
  const weekKey = dates[0] ?? ''
  const random = rng(hashString(weekKey) ^ seed)
  const plan: Record<string, DayPlan> = {}

  const buildPool = (slot: MealSlot) => prioritise(shuffle(eligibleRecipes(recipes, slot, diet, trimester), random), focus)
  const pools: Record<MealSlot, Recipe[]> = {
    breakfast: buildPool('breakfast'),
    lunch: buildPool('lunch'),
    dinner: buildPool('dinner'),
    snack: buildPool('snack'),
  }
  const cursors: Record<MealSlot, number> = { breakfast: 0, lunch: 0, dinner: 0, snack: 0 }

  for (const date of dates) {
    const day: DayPlan = { breakfast: null, lunch: null, dinner: null, snack: null }
    const usedToday = new Set<string>()
    for (const slot of MEAL_SLOTS) {
      const pool = pools[slot]
      if (pool.length === 0) continue
      let pick: Recipe | undefined
      for (let i = 0; i < pool.length; i++) {
        const candidate = pool[(cursors[slot] + i) % pool.length]
        if (!usedToday.has(candidate.id)) {
          pick = candidate
          cursors[slot] = (cursors[slot] + i + 1) % pool.length
          break
        }
      }
      pick ??= pool[cursors[slot] % pool.length]
      usedToday.add(pick.id)
      day[slot] = pick.id
    }
    plan[date] = day
  }
  return plan
}

/** Stable partition: recipes that hit more focus nutrients come first, order within a tier is kept. */
function prioritise(recipes: Recipe[], focus: Nutrient[]): Recipe[] {
  if (focus.length === 0) return recipes
  const score = (r: Recipe) => r.nutrients.filter((n) => focus.includes(n)).length
  return recipes
    .map((r, i) => ({ r, i, s: score(r) }))
    .toSorted((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.r)
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export interface GroceryLine {
  key: string
  item: string
  category: Recipe['ingredients'][number]['category']
  /** Quantities from each recipe; shown joined since units vary. */
  quantities: string[]
  recipes: string[]
}

/** Aggregate ingredients across a set of recipes, grouped by item name. */
export function groceryList(recipes: Recipe[]): GroceryLine[] {
  const map = new Map<string, GroceryLine>()
  for (const r of recipes) {
    for (const ing of r.ingredients) {
      const key = `${ing.category}:${ing.item.trim().toLowerCase()}`
      const line = map.get(key) ?? { key, item: ing.item, category: ing.category, quantities: [], recipes: [] }
      line.quantities.push(ing.qty)
      if (!line.recipes.includes(r.name)) line.recipes.push(r.name)
      map.set(key, line)
    }
  }
  return Array.from(map.values()).toSorted((a, b) => a.category.localeCompare(b.category) || a.item.localeCompare(b.item))
}
