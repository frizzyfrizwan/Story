import { describe, expect, it } from 'vitest'
import { WEEKS, getWeekGuide } from './weeks'
import { SYMPTOM_BY_ID } from './symptoms'
import { NUTRIENT_INFO } from './nutrients'
import { CHECKLISTS } from './checklists'
import { FOOD_SAFETY } from './foodSafety'
import { APPOINTMENT_SUGGESTIONS } from './appointmentSchedule'

describe('week guide data', () => {
  it('covers weeks 1–42 in order with correct trimesters', () => {
    expect(WEEKS).toHaveLength(42)
    WEEKS.forEach((w, i) => {
      expect(w.week).toBe(i + 1)
      expect(w.trimester).toBe(w.week <= 13 ? 1 : w.week <= 27 ? 2 : 3)
      expect(w.tips.length).toBeGreaterThanOrEqual(3)
      for (const s of w.commonSymptoms) expect(SYMPTOM_BY_ID[s], `symptom ${s} in week ${w.week}`).toBeDefined()
      for (const n of w.nutritionFocus) expect(NUTRIENT_INFO[n], `nutrient ${n} in week ${w.week}`).toBeDefined()
    })
  })
  it('has growing baby sizes after the first weeks', () => {
    for (let i = 5; i < WEEKS.length - 1; i++) {
      expect(WEEKS[i + 1].babySize.weightG).toBeGreaterThanOrEqual(WEEKS[i].babySize.weightG)
    }
  })
  it('clamps lookups', () => {
    expect(getWeekGuide(0).week).toBe(1)
    expect(getWeekGuide(99).week).toBe(42)
  })
})

describe('other content', () => {
  it('checklist item ids are globally unique', () => {
    const ids = CHECKLISTS.flatMap((g) => g.items.map((i) => i.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
  it('food safety and appointment ids are unique', () => {
    for (const list of [FOOD_SAFETY, APPOINTMENT_SUGGESTIONS]) {
      const ids = list.map((x) => x.id)
      expect(new Set(ids).size).toBe(ids.length)
    }
  })
})
