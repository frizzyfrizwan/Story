import type { Reminder, Weekday } from '@/types'
import { fromISODate } from './dates'

/** Does this reminder apply on the given ISO date? */
export function appliesOn(reminder: Reminder, dateISO: string): boolean {
  const rec = reminder.recurrence
  switch (rec.kind) {
    case 'daily':
      return true
    case 'weekly':
      return rec.days.includes(fromISODate(dateISO).getDay() as Weekday)
    case 'once':
      return rec.date === dateISO
  }
}

export function isCompletedOn(reminder: Reminder, dateISO: string): boolean {
  return reminder.completedOn.includes(dateISO)
}

/** Minutes since midnight for "HH:mm". */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export interface ReminderStatus {
  reminder: Reminder
  completed: boolean
  /** Scheduled time has passed and it is not done. */
  overdue: boolean
  snoozed: boolean
}

export function statusesForDate(reminders: Reminder[], dateISO: string, now: Date): ReminderStatus[] {
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return reminders
    .filter((r) => r.enabled && appliesOn(r, dateISO))
    .map((r) => {
      const completed = isCompletedOn(r, dateISO)
      const snoozed = !!r.snoozedUntil && new Date(r.snoozedUntil) > now
      return { reminder: r, completed, snoozed, overdue: !completed && !snoozed && minutesOf(r.time) <= nowMinutes }
    })
    .toSorted((a, b) => minutesOf(a.reminder.time) - minutesOf(b.reminder.time))
}

/** Reminders whose moment has arrived and that have not fired today. */
export function dueNow(reminders: Reminder[], dateISO: string, now: Date, firedOn: Record<string, string>): Reminder[] {
  return statusesForDate(reminders, dateISO, now)
    .filter(({ reminder, completed, overdue, snoozed }) => {
      if (completed) return false
      if (reminder.snoozedUntil) {
        const until = new Date(reminder.snoozedUntil)
        if (until > now) return false
        // Snooze elapsed: fire once regardless of the firedOn marker (snooze clears it).
        return !snoozed && firedOn[reminder.id] !== dateISO
      }
      return overdue && firedOn[reminder.id] !== dateISO
    })
    .map((s) => s.reminder)
}

export const WEEKDAY_SHORT: Record<Weekday, string> = { 0: 'Sun', 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat' }

export function describeRecurrence(r: Reminder['recurrence']): string {
  switch (r.kind) {
    case 'daily':
      return 'Every day'
    case 'weekly': {
      if (r.days.length === 7) return 'Every day'
      if (r.days.length === 0) return 'Never'
      const sorted = r.days.toSorted((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
      if (sorted.length === 5 && !sorted.includes(0) && !sorted.includes(6)) return 'Weekdays'
      return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ')
    }
    case 'once':
      return 'Once'
  }
}
