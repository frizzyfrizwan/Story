import { useEffect } from 'react'
import { useReminderStore } from '@/store/reminders'
import { useProfileStore } from '@/store/profile'
import { toast } from '@/store/ui'
import { dueNow } from '@/lib/reminders'
import { todayISO } from '@/lib/dates'
import { showNotification } from '@/lib/notifications'
import { REMINDER_CATEGORY_INFO } from '@/data/reminderTemplates'

const TICK_MS = 20_000

/**
 * Polls reminders while the app is open and surfaces due ones as an
 * in-app toast plus (if permitted) a system notification.
 */
export function useReminderScheduler() {
  useEffect(() => {
    const tick = () => {
      const { reminders, firedOn, markFired, complete } = useReminderStore.getState()
      const notificationsEnabled = useProfileStore.getState().profile?.notificationsEnabled ?? false
      const now = new Date()
      const date = todayISO(now)
      for (const r of dueNow(reminders, date, now, firedOn)) {
        markFired(r.id, date)
        const emoji = REMINDER_CATEGORY_INFO[r.category].emoji
        toast({
          title: `${emoji} ${r.title}`,
          description: r.note,
          action: { label: 'Done', onClick: () => complete(r.id, date) },
        })
        if (notificationsEnabled) {
          void showNotification(r.title, { body: r.note ?? 'Tap to open Bloom', tag: `reminder-${r.id}-${date}` })
        }
      }
    }
    tick()
    const id = window.setInterval(tick, TICK_MS)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])
}
