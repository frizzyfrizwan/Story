import { describe, expect, it } from 'vitest'
import { bmi, bmiCategory, expectedGainAtWeek, formatBabyWeight, formatWeight, gainGuide, kgToLb, lbToKg } from '../weight'

describe('BMI', () => {
  it('computes and categorises', () => {
    expect(bmi(60, 165)).toBeCloseTo(22.04, 1)
    expect(bmiCategory(17)).toBe('underweight')
    expect(bmiCategory(22)).toBe('normal')
    expect(bmiCategory(27)).toBe('overweight')
    expect(bmiCategory(31)).toBe('obese')
  })
})

describe('expected gain', () => {
  it('starts at zero and grows monotonically', () => {
    let prev = expectedGainAtWeek(0, 'normal')
    expect(prev.min).toBe(0)
    expect(prev.max).toBe(0)
    for (let w = 1; w <= 40; w++) {
      const cur = expectedGainAtWeek(w, 'normal')
      expect(cur.min).toBeGreaterThanOrEqual(prev.min)
      expect(cur.max).toBeGreaterThanOrEqual(prev.max)
      expect(cur.max).toBeGreaterThan(cur.min)
      prev = cur
    }
  })
  it('never exceeds the recommended total', () => {
    for (const cat of ['underweight', 'normal', 'overweight', 'obese'] as const) {
      const g = gainGuide(cat)
      const at40 = expectedGainAtWeek(40, cat)
      expect(at40.min).toBeLessThanOrEqual(g.totalMin)
      expect(at40.max).toBeLessThanOrEqual(g.totalMax)
    }
  })
  it('uses higher targets for multiples', () => {
    expect(gainGuide('normal', true).totalMax).toBeGreaterThan(gainGuide('normal').totalMax)
  })
})

describe('units', () => {
  it('converts both ways', () => {
    expect(lbToKg(kgToLb(70))).toBeCloseTo(70, 6)
    expect(formatWeight(70, 'metric')).toBe('70.0 kg')
    expect(formatWeight(70, 'imperial')).toBe('154.3 lb')
    expect(formatBabyWeight(300, 'metric')).toBe('300 g')
    expect(formatBabyWeight(3450, 'metric')).toBe('3.45 kg')
    expect(formatBabyWeight(3450, 'imperial')).toBe('7 lb 10 oz')
  })
})
