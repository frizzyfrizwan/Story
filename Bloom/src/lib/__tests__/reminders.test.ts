import { describe, expect, it } from 'vitest'
import type { Reminder } from '@/types'
import { appliesOn, describeRecurrence, dueNow, statusesForDate } from '../reminders'

const base: Reminder = {
  id: 'r1',
  title: 'Vitamin',
  category: 'vitamin',
  time: '08:30',
  recurrence: { kind: 'daily' },
  enabled: true,
  completedOn: [],
  createdAt: '2026-01-01T00:00:00.000Z',
}
const at = (iso: string, h: number, m = 0) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setHours(h, m)
  return d
}

describe('appliesOn', () => {
  it('daily always applies', () => expect(appliesOn(base, '2026-05-05')).toBe(true))
  it('weekly checks the weekday', () => {
    const weekly: Reminder = { ...base, recurrence: { kind: 'weekly', days: [1, 3] } }
    expect(appliesOn(weekly, '2026-05-04')).toBe(true) // Monday
    expect(appliesOn(weekly, '2026-05-05')).toBe(false) // Tuesday
  })
  it('once matches a single date', () => {
    const once: Reminder = { ...base, recurrence: { kind: 'once', date: '2026-05-05' } }
    expect(appliesOn(once, '2026-05-05')).toBe(true)
    expect(appliesOn(once, '2026-05-06')).toBe(false)
  })
})

describe('statusesForDate', () => {
  it('marks overdue only after the scheduled time', () => {
    expect(statusesForDate([base], '2026-05-05', at('2026-05-05', 8, 0))[0].overdue).toBe(false)
    expect(statusesForDate([base], '2026-05-05', at('2026-05-05', 8, 30))[0].overdue).toBe(true)
  })
  it('completed reminders are never overdue', () => {
    const done = { ...base, completedOn: ['2026-05-05'] }
    const s = statusesForDate([done], '2026-05-05', at('2026-05-05', 12))[0]
    expect(s.completed).toBe(true)
    expect(s.overdue).toBe(false)
  })
  it('skips disabled reminders and sorts by time', () => {
    const late = { ...base, id: 'r2', time: '20:00' }
    const off = { ...base, id: 'r3', enabled: false }
    const out = statusesForDate([late, base, off], '2026-05-05', at('2026-05-05', 7))
    expect(out.map((s) => s.reminder.id)).toEqual(['r1', 'r2'])
  })
})

describe('dueNow', () => {
  it('fires once per day', () => {
    const now = at('2026-05-05', 9)
    expect(dueNow([base], '2026-05-05', now, {})).toHaveLength(1)
    expect(dueNow([base], '2026-05-05', now, { r1: '2026-05-05' })).toHaveLength(0)
    expect(dueNow([base], '2026-05-05', now, { r1: '2026-05-04' })).toHaveLength(1)
  })
  it('respects snooze until it elapses', () => {
    const now = at('2026-05-05', 9)
    const snoozed = { ...base, snoozedUntil: at('2026-05-05', 9, 30).toISOString() }
    expect(dueNow([snoozed], '2026-05-05', now, {})).toHaveLength(0)
    expect(dueNow([snoozed], '2026-05-05', at('2026-05-05', 9, 31), {})).toHaveLength(1)
  })
})

describe('describeRecurrence', () => {
  it('names common patterns', () => {
    expect(describeRecurrence({ kind: 'daily' })).toBe('Every day')
    expect(describeRecurrence({ kind: 'weekly', days: [1, 2, 3, 4, 5] })).toBe('Weekdays')
    expect(describeRecurrence({ kind: 'weekly', days: [0, 6] })).toBe('Sat, Sun')
    expect(describeRecurrence({ kind: 'once', date: '2026-01-01' })).toBe('Once')
  })
})
