import { describe, expect, it } from 'vitest'
import { RECIPES } from '@/data/recipes'
import { buildWeekPlan, eligibleRecipes, groceryList, MEAL_SLOTS } from '../mealPlan'
import { weekDates } from '../dates'
import type { DietTag, Trimester } from '@/types'

const dates = weekDates('2026-06-10')

describe('buildWeekPlan', () => {
  it('fills every slot for every day', () => {
    const plan = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 2, seed: 0 })
    for (const d of dates) for (const slot of MEAL_SLOTS) expect(plan[d][slot]).toBeTruthy()
  })
  it('is deterministic for the same inputs and changes with the seed', () => {
    const a = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 2, seed: 0 })
    const b = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 2, seed: 0 })
    const c = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 2, seed: 1 })
    expect(a).toEqual(b)
    expect(JSON.stringify(a)).not.toEqual(JSON.stringify(c))
  })
  it('does not repeat a recipe within a day and rarely within a week', () => {
    const plan = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 2, seed: 3 })
    for (const d of dates) {
      const ids = MEAL_SLOTS.map((s) => plan[d][s])
      expect(new Set(ids).size).toBe(ids.length)
    }
    const dinners = dates.map((d) => plan[d].dinner)
    expect(new Set(dinners).size).toBe(7)
  })
  it.each<[DietTag[], Trimester]>([
    [['vegan'], 1],
    [['vegan'], 3],
    [['gluten-free', 'dairy-free'], 2],
    [['vegetarian', 'nut-free'], 2],
    [['vegan', 'gluten-free'], 2],
  ])('respects diet %s in trimester %i', (diet, trimester) => {
    const plan = buildWeekPlan({ recipes: RECIPES, dates, diet, trimester, seed: 0 })
    for (const d of dates)
      for (const slot of MEAL_SLOTS) {
        const id = plan[d][slot]
        expect(id, `${slot} on ${d}`).toBeTruthy()
        const recipe = RECIPES.find((r) => r.id === id)!
        for (const tag of diet) expect(recipe.tags).toContain(tag)
      }
  })
})

describe('focus prioritisation', () => {
  it('schedules more focus-nutrient meals than an unfocused plan', () => {
    const count = (plan: ReturnType<typeof buildWeekPlan>, nutrient: 'omega3') =>
      dates.reduce((n, d) => n + MEAL_SLOTS.filter((s) => RECIPES.find((r) => r.id === plan[d][s])?.nutrients.includes(nutrient)).length, 0)
    const plain = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 3, seed: 0 })
    const focused = buildWeekPlan({ recipes: RECIPES, dates, diet: [], trimester: 3, seed: 0, focus: ['omega3'] })
    expect(count(focused, 'omega3')).toBeGreaterThanOrEqual(count(plain, 'omega3'))
    expect(count(focused, 'omega3')).toBeGreaterThan(3)
  })
})

describe('eligibleRecipes', () => {
  it('relaxes trimester but never diet', () => {
    const vegan = eligibleRecipes(RECIPES, 'dinner', ['vegan'], 1)
    expect(vegan.length).toBeGreaterThanOrEqual(3)
    expect(vegan.every((r) => r.tags.includes('vegan'))).toBe(true)
  })
})

describe('groceryList', () => {
  it('merges duplicate ingredients across recipes', () => {
    const list = groceryList(RECIPES.slice(0, 10))
    const keys = list.map((l) => l.key)
    expect(new Set(keys).size).toBe(keys.length)
    const multi = list.find((l) => l.quantities.length > 1)
    expect(multi?.recipes.length).toBeGreaterThan(1)
  })
})

describe('recipe data integrity', () => {
  it('has unique ids and sane fields', () => {
    const ids = RECIPES.map((r) => r.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const r of RECIPES) {
      expect(r.slots.length).toBeGreaterThan(0)
      expect(r.ingredients.length).toBeGreaterThanOrEqual(3)
      expect(r.steps.length).toBeGreaterThanOrEqual(3)
      expect(r.calories).toBeGreaterThan(50)
      if (r.tags.includes('vegan')) {
        expect(r.tags).toContain('vegetarian')
        expect(r.tags).toContain('dairy-free')
      }
    }
  })
})
