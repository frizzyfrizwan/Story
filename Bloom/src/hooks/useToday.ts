import { useEffect, useState } from 'react'
import { todayISO } from '@/lib/dates'

/** Today's ISO date; re-evaluates each minute so the app rolls over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(() => todayISO())
  useEffect(() => {
    const id = window.setInterval(() => {
      const next = todayISO()
      setToday((prev) => (prev === next ? prev : next))
    }, 60_000)
    return () => window.clearInterval(id)
  }, [])
  return today
}

/** Current Date, ticking at the given interval. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return now
}
