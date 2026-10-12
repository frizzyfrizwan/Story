/**
 * Pregnancy weight-gain guidance based on the Institute of Medicine (2009)
 * recommendations. Educational only; a provider's personal advice always wins.
 */

export type BmiCategory = 'underweight' | 'normal' | 'overweight' | 'obese'

export function bmi(weightKg: number, heightCm: number): number {
  const m = heightCm / 100
  return weightKg / (m * m)
}

export function bmiCategory(value: number): BmiCategory {
  if (value < 18.5) return 'underweight'
  if (value < 25) return 'normal'
  if (value < 30) return 'overweight'
  return 'obese'
}

export const BMI_LABEL: Record<BmiCategory, string> = {
  underweight: 'Underweight',
  normal: 'Healthy range',
  overweight: 'Overweight',
  obese: 'Obese',
}

interface GainGuide {
  /** Total gain across pregnancy, kg. */
  totalMin: number
  totalMax: number
  /** Weekly rate in 2nd and 3rd trimesters, kg/week. */
  rateMin: number
  rateMax: number
}

const SINGLETON: Record<BmiCategory, GainGuide> = {
  underweight: { totalMin: 12.5, totalMax: 18, rateMin: 0.44, rateMax: 0.58 },
  normal: { totalMin: 11.5, totalMax: 16, rateMin: 0.35, rateMax: 0.5 },
  overweight: { totalMin: 7, totalMax: 11.5, rateMin: 0.23, rateMax: 0.33 },
  obese: { totalMin: 5, totalMax: 9, rateMin: 0.17, rateMax: 0.27 },
}

const TWINS: Record<BmiCategory, GainGuide> = {
  underweight: { totalMin: 17, totalMax: 25, rateMin: 0.6, rateMax: 0.85 },
  normal: { totalMin: 17, totalMax: 25, rateMin: 0.6, rateMax: 0.85 },
  overweight: { totalMin: 14, totalMax: 23, rateMin: 0.5, rateMax: 0.8 },
  obese: { totalMin: 11, totalMax: 19, rateMin: 0.4, rateMax: 0.65 },
}

export function gainGuide(category: BmiCategory, multiples = false): GainGuide {
  return (multiples ? TWINS : SINGLETON)[category]
}

/** First-trimester total gain is small and similar for everyone. */
const T1_MIN = 0.5
const T1_MAX = 2
const T1_WEEKS = 13

/** Expected cumulative gain (kg) range at a gestational week. */
export function expectedGainAtWeek(week: number, category: BmiCategory, multiples = false): { min: number; max: number } {
  const g = gainGuide(category, multiples)
  const w = Math.max(0, Math.min(40, week))
  if (w <= T1_WEEKS) {
    return { min: (T1_MIN * w) / T1_WEEKS, max: (T1_MAX * w) / T1_WEEKS }
  }
  const later = w - T1_WEEKS
  return {
    min: Math.min(g.totalMin, T1_MIN + g.rateMin * later),
    max: Math.min(g.totalMax, T1_MAX + g.rateMax * later),
  }
}

export const KG_PER_LB = 0.45359237
export const CM_PER_IN = 2.54

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB
}
export function lbToKg(lb: number): number {
  return lb * KG_PER_LB
}
export function cmToIn(cm: number): number {
  return cm / CM_PER_IN
}
export function inToCm(inches: number): number {
  return inches * CM_PER_IN
}

export function formatWeight(kg: number, units: 'metric' | 'imperial', digits = 1): string {
  return units === 'metric' ? `${kg.toFixed(digits)} kg` : `${kgToLb(kg).toFixed(digits)} lb`
}

export function formatLength(cm: number, units: 'metric' | 'imperial'): string {
  if (units === 'metric') return cm >= 100 ? `${(cm / 100).toFixed(2)} m` : `${cm.toFixed(1)} cm`
  const totalIn = cmToIn(cm)
  if (totalIn < 12) return `${totalIn.toFixed(1)} in`
  const ft = Math.floor(totalIn / 12)
  const inch = Math.round(totalIn - ft * 12)
  return `${ft} ft ${inch} in`
}

export function formatBabyWeight(grams: number, units: 'metric' | 'imperial'): string {
  if (grams <= 0) return '—'
  if (units === 'metric') return grams >= 1000 ? `${(grams / 1000).toFixed(2)} kg` : `${Math.round(grams)} g`
  const oz = grams / 28.349523125
  if (oz < 16) return `${oz.toFixed(oz < 1 ? 2 : 1)} oz`
  const lb = Math.floor(oz / 16)
  return `${lb} lb ${Math.round(oz - lb * 16)} oz`
}

export function formatBabyLength(cm: number, units: 'metric' | 'imperial'): string {
  if (cm <= 0) return '—'
  return units === 'metric' ? `${cm.toFixed(1)} cm` : `${cmToIn(cm).toFixed(1)} in`
}
