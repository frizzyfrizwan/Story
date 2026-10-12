import { describe, expect, it } from 'vitest'
import { dateOfWeekStart, dueDateFromConception, dueDateFromLMP, formatGA, gestationalAge, lmpFromDueDate, trimesterOf } from '../pregnancy'

describe('due date maths', () => {
  it('adds 280 days to the last period', () => {
    expect(dueDateFromLMP('2026-01-01')).toBe('2026-10-08')
  })
  it('adds 266 days to conception', () => {
    expect(dueDateFromConception('2026-01-15')).toBe('2026-10-08')
  })
  it('round-trips LMP and due date', () => {
    expect(lmpFromDueDate(dueDateFromLMP('2026-03-14'))).toBe('2026-03-14')
  })
})

describe('gestationalAge', () => {
  const due = '2026-10-08' // LMP 2026-01-01
  it('is 0w0d on the LMP day', () => {
    const ga = gestationalAge(due, '2026-01-01')
    expect(ga.weeks).toBe(0)
    expect(ga.days).toBe(0)
    expect(ga.guideWeek).toBe(1)
    expect(ga.trimester).toBe(1)
  })
  it('counts completed weeks and remainder days', () => {
    const ga = gestationalAge(due, '2026-03-30') // 88 days
    expect(ga.totalDays).toBe(88)
    expect(ga.weeks).toBe(12)
    expect(ga.days).toBe(4)
    expect(formatGA(ga)).toBe('12w 4d')
  })
  it('is 40w0d and 0 days to go on the due date', () => {
    const ga = gestationalAge(due, due)
    expect(ga.weeks).toBe(40)
    expect(ga.daysUntilDue).toBe(0)
    expect(ga.progress).toBe(1)
    expect(ga.isOverdue).toBe(false)
  })
  it('flags overdue and clamps the guide week to 42', () => {
    const ga = gestationalAge(due, '2026-11-01')
    expect(ga.isOverdue).toBe(true)
    expect(ga.guideWeek).toBe(42)
  })
  it('handles dates before the LMP without crashing', () => {
    const ga = gestationalAge(due, '2025-12-20')
    expect(ga.totalDays).toBeLessThan(0)
    expect(ga.guideWeek).toBe(1)
    expect(ga.progress).toBe(0)
  })
  it('maps trimesters', () => {
    expect(trimesterOf(13)).toBe(1)
    expect(trimesterOf(14)).toBe(2)
    expect(trimesterOf(27)).toBe(2)
    expect(trimesterOf(28)).toBe(3)
  })
  it('computes the calendar start of a gestational week', () => {
    expect(dateOfWeekStart(due, 0)).toBe('2026-01-01')
    expect(dateOfWeekStart(due, 20)).toBe('2026-05-21')
  })
})
