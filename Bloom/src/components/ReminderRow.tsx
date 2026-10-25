import { Check, Clock } from 'lucide-react'
import { cn } from '@/lib/cn'
import { formatTime } from '@/lib/dates'
import { REMINDER_CATEGORY_INFO } from '@/data/reminderTemplates'
import type { ReminderStatus } from '@/lib/reminders'
import { useReminderStore } from '@/store/reminders'

export function ReminderRow({ status, date, compact }: { status: ReminderStatus; date: string; compact?: boolean }) {
  const { reminder, completed, overdue, snoozed } = status
  const complete = useReminderStore((s) => s.complete)
  const uncomplete = useReminderStore((s) => s.uncomplete)
  const snooze = useReminderStore((s) => s.snooze)
  const info = REMINDER_CATEGORY_INFO[reminder.category]
  return (
    <div className={cn('flex items-center gap-3 rounded-xl px-2 py-2 transition-colors', !compact && 'hover:bg-surface-sunken')}>
      <button
        type="button"
        onClick={() => (completed ? uncomplete(reminder.id, date) : complete(reminder.id, date))}
        aria-label={completed ? `Mark ${reminder.title} as not done` : `Mark ${reminder.title} as done`}
        aria-pressed={completed}
        className={cn(
          'grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition-colors',
          completed ? 'border-sage-500 bg-sage-500 text-white' : overdue ? 'border-rose-400 hover:bg-rose-50' : 'border-line hover:border-rose-300',
        )}
      >
        {completed && <Check className="h-4 w-4" strokeWidth={3} />}
      </button>
      <span className="text-lg leading-none" aria-hidden>
        {info.emoji}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-sm font-medium', completed && 'text-ink-muted line-through')}>{reminder.title}</p>
        {!compact && reminder.note && <p className="truncate text-xs text-ink-muted">{reminder.note}</p>}
      </div>
      <div className="flex items-center gap-2 text-xs text-ink-muted">
        <span className={cn('tabular-nums', overdue && 'font-medium text-rose-600')}>{formatTime(reminder.time)}</span>
        {snoozed && <Clock className="h-3.5 w-3.5" aria-label="Snoozed" />}
        {overdue && !compact && (
          <button type="button" onClick={() => snooze(reminder.id, 30)} className="rounded-md px-1.5 py-0.5 hover:bg-surface-sunken hover:text-ink">
            Snooze
          </button>
        )}
      </div>
    </div>
  )
}
