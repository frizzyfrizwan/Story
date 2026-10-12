import { describe, expect, it } from 'vitest'
import { daysBetween, formatTime, isValidISODate, relativeDay, shiftISO, weekDates } from '../dates'

describe('dates', () => {
  it('validates ISO dates strictly', () => {
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2028-02-29')).toBe(true)
    expect(isValidISODate('2026-1-1')).toBe(false)
    expect(isValidISODate(undefined)).toBe(false)
  })
  it('shifts and diffs across DST and month ends', () => {
    expect(shiftISO('2026-03-28', 3)).toBe('2026-03-31')
    expect(shiftISO('2026-01-31', 1)).toBe('2026-02-01')
    expect(daysBetween('2026-03-01', '2026-04-01')).toBe(31)
  })
  it('builds Monday-first weeks', () => {
    const w = weekDates('2026-06-10') // Wednesday
    expect(w[0]).toBe('2026-06-08')
    expect(w[6]).toBe('2026-06-14')
  })
  it('formats time and relative days', () => {
    expect(formatTime('00:05')).toBe('12:05 am')
    expect(formatTime('13:00')).toBe('1:00 pm')
    expect(relativeDay('2026-06-10', '2026-06-10')).toBe('Today')
    expect(relativeDay('2026-06-11', '2026-06-10')).toBe('Tomorrow')
    expect(relativeDay('2026-06-13', '2026-06-10')).toBe('In 3 days')
  })
})
