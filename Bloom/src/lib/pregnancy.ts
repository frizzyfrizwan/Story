import type { Trimester } from '@/types'
import { daysBetween, shiftISO } from './dates'

/** Full-term pregnancy length counted from the first day of the last period. */
export const GESTATION_DAYS = 280
export const MAX_WEEK = 42

export function dueDateFromLMP(lmpISO: string): string {
  return shiftISO(lmpISO, GESTATION_DAYS)
}

export function dueDateFromConception(conceptionISO: string): string {
  return shiftISO(conceptionISO, GESTATION_DAYS - 14)
}

export function lmpFromDueDate(dueISO: string): string {
  return shiftISO(dueISO, -GESTATION_DAYS)
}

export interface GestationalAge {
  /** Days since the (estimated) first day of the last period. May be negative before LMP. */
  totalDays: number
  /** Completed weeks, clamped 0..45. */
  weeks: number
  /** Remaining days after completed weeks, 0..6. */
  days: number
  /** The guide week to show (1..42): completed weeks, clamped. */
  guideWeek: number
  trimester: Trimester
  daysUntilDue: number
  /** 0..1 progress toward the due date. */
  progress: number
  isOverdue: boolean
}

export function trimesterOf(week: number): Trimester {
  if (week <= 13) return 1
  if (week <= 27) return 2
  return 3
}

export function gestationalAge(dueISO: string, todayISO: string): GestationalAge {
  const daysUntilDue = daysBetween(todayISO, dueISO)
  const totalDays = GESTATION_DAYS - daysUntilDue
  const clamped = Math.max(0, totalDays)
  const weeks = Math.min(45, Math.floor(clamped / 7))
  const days = clamped % 7
  const guideWeek = Math.min(MAX_WEEK, Math.max(1, weeks))
  return {
    totalDays,
    weeks,
    days,
    guideWeek,
    trimester: trimesterOf(guideWeek),
    daysUntilDue,
    progress: Math.min(1, Math.max(0, totalDays / GESTATION_DAYS)),
    isOverdue: daysUntilDue < 0,
  }
}

/** ISO date on which gestational `week` begins. */
export function dateOfWeekStart(dueISO: string, week: number): string {
  return shiftISO(lmpFromDueDate(dueISO), week * 7)
}

export const TRIMESTER_LABEL: Record<Trimester, string> = {
  1: 'First trimester',
  2: 'Second trimester',
  3: 'Third trimester',
}

export function formatGA(ga: GestationalAge): string {
  if (ga.totalDays < 0) return 'Before conception'
  return `${ga.weeks}w ${ga.days}d`
}
