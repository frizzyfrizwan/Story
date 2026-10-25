import { addDays, differenceInCalendarDays, format, isValid, parseISO, startOfDay } from 'date-fns'

export const ISO_DATE = 'yyyy-MM-dd'

/** Local-date ISO string (yyyy-MM-dd) for a Date. */
export function toISODate(d: Date): string {
  return format(d, ISO_DATE)
}

export function todayISO(now: Date = new Date()): string {
  return toISODate(now)
}

/** Parse a yyyy-MM-dd string as local midnight. */
export function fromISODate(iso: string): Date {
  return startOfDay(parseISO(iso))
}

export function isValidISODate(iso: string | undefined | null): iso is string {
  if (!iso) return false
  const d = parseISO(iso)
  return isValid(d) && /^\d{4}-\d{2}-\d{2}$/.test(iso)
}

export function shiftISO(iso: string, days: number): string {
  return toISODate(addDays(fromISODate(iso), days))
}

export function daysBetween(fromISO: string, toISO: string): number {
  return differenceInCalendarDays(fromISODate(toISO), fromISODate(fromISO))
}

export function formatLong(iso: string): string {
  return format(fromISODate(iso), 'EEEE, d MMMM yyyy')
}

export function formatMedium(iso: string): string {
  return format(fromISODate(iso), 'EEE, d MMM')
}

export function formatShort(iso: string): string {
  return format(fromISODate(iso), 'd MMM')
}

/** "HH:mm" → "9:05 am" style. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm
  const suffix = h >= 12 ? 'pm' : 'am'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`
}

export function nowHHMM(now: Date = new Date()): string {
  return format(now, 'HH:mm')
}

/** Relative wording for dates close to today. */
export function relativeDay(iso: string, today: string = todayISO()): string {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  if (diff > 1 && diff < 7) return `In ${diff} days`
  if (diff < -1 && diff > -7) return `${-diff} days ago`
  return formatMedium(iso)
}

/** The 7 ISO dates of the week containing `iso`, starting Monday. */
export function weekDates(iso: string): string[] {
  const d = fromISODate(iso)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  const monday = addDays(d, -dow)
  return Array.from({ length: 7 }, (_, i) => toISODate(addDays(monday, i)))
}
