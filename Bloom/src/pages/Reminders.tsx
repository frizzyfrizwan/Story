import { useMemo, useState } from 'react'
import { Bell, BellOff, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, Chip } from '@/components/ui/Chip'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { Switch } from '@/components/ui/Switch'
import { Segmented } from '@/components/ui/Segmented'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReminderRow } from '@/components/ReminderRow'
import { useReminderStore, type ReminderInput } from '@/store/reminders'
import { useProfileStore } from '@/store/profile'
import { usePregnancy } from '@/hooks/usePregnancy'
import { useNow } from '@/hooks/useToday'
import { REMINDER_CATEGORY_INFO, REMINDER_TEMPLATES } from '@/data/reminderTemplates'
import { describeRecurrence, statusesForDate, WEEKDAY_SHORT } from '@/lib/reminders'
import { formatTime, todayISO } from '@/lib/dates'
import { notificationPermission, requestNotificationPermission } from '@/lib/notifications'
import type { Recurrence, Reminder, ReminderCategory, Weekday } from '@/types'
import { toast } from '@/store/ui'
import { cn } from '@/lib/cn'

type Kind = Recurrence['kind']
const CATEGORIES = Object.keys(REMINDER_CATEGORY_INFO) as ReminderCategory[]

function ReminderForm({ initial, onSubmit, onClose }: { initial?: Reminder; onSubmit: (input: ReminderInput) => void; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [category, setCategory] = useState<ReminderCategory>(initial?.category ?? 'custom')
  const [time, setTime] = useState(initial?.time ?? '09:00')
  const [kind, setKind] = useState<Kind>(initial?.recurrence.kind ?? 'daily')
  const [days, setDays] = useState<Weekday[]>(initial?.recurrence.kind === 'weekly' ? initial.recurrence.days : [1, 2, 3, 4, 5])
  const [once, setOnce] = useState(initial?.recurrence.kind === 'once' ? initial.recurrence.date : todayISO())
  const valid = title.trim().length > 0 && /^\d{2}:\d{2}$/.test(time) && (kind !== 'weekly' || days.length > 0) && (kind !== 'once' || !!once)

  function submit() {
    const recurrence: Recurrence = kind === 'daily' ? { kind: 'daily' } : kind === 'weekly' ? { kind: 'weekly', days } : { kind: 'once', date: once }
    onSubmit({ title: title.trim(), note: note.trim() || undefined, category, time, recurrence, enabled: initial?.enabled ?? true })
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (valid) submit()
      }}
    >
      <Field label="Title" htmlFor="r-title">
        <Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Take prenatal vitamin" required maxLength={80} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category" htmlFor="r-cat">
          <Select id="r-cat" value={category} onChange={(e) => setCategory(e.target.value as ReminderCategory)}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {REMINDER_CATEGORY_INFO[c].emoji} {REMINDER_CATEGORY_INFO[c].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Time" htmlFor="r-time">
          <Input id="r-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
        </Field>
      </div>
      <Field label="Repeat" htmlFor="r-kind">
        <Segmented
          ariaLabel="Repeat"
          value={kind}
          onChange={setKind}
          options={[
            { value: 'daily', label: 'Every day' },
            { value: 'weekly', label: 'Some days' },
            { value: 'once', label: 'Once' },
          ]}
        />
      </Field>
      {kind === 'weekly' && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Days of the week">
          {([1, 2, 3, 4, 5, 6, 0] as Weekday[]).map((d) => (
            <Chip key={d} active={days.includes(d)} onClick={() => setDays((cur) => (cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]))}>
              {WEEKDAY_SHORT[d]}
            </Chip>
          ))}
        </div>
      )}
      {kind === 'once' && (
        <Field label="Date" htmlFor="r-once">
          <Input id="r-once" type="date" value={once} min={todayISO()} onChange={(e) => setOnce(e.target.value)} required />
        </Field>
      )}
      <Field label="Note (optional)" htmlFor="r-note">
        <Textarea
          id="r-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="With food, after breakfast…"
          maxLength={200}
          className="min-h-[64px]"
        />
      </Field>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {initial ? 'Save changes' : 'Add reminder'}
        </Button>
      </div>
    </form>
  )
}

export default function Reminders() {
  const preg = usePregnancy()
  const now = useNow()
  const today = preg?.today ?? todayISO()
  const week = preg?.ga.guideWeek ?? 1
  const reminders = useReminderStore((s) => s.reminders)
  const { add, update, remove, toggleEnabled, addFromTemplate } = useReminderStore()
  const profile = useProfileStore((s) => s.profile)!
  const updateProfile = useProfileStore((s) => s.updateProfile)
  const [editing, setEditing] = useState<Reminder | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<Reminder | null>(null)
  const permission = notificationPermission()

  const statuses = statusesForDate(reminders, today, now)
  const suggestions = useMemo(
    () => REMINDER_TEMPLATES.filter((t) => (t.fromWeek ?? 0) <= week && !reminders.some((r) => r.title === t.title)),
    [reminders, week],
  )
  const sorted = useMemo(() => [...reminders].toSorted((a, b) => a.time.localeCompare(b.time)), [reminders])

  async function enableNotifications(on: boolean) {
    if (!on) {
      updateProfile({ notificationsEnabled: false })
      return
    }
    const result = await requestNotificationPermission()
    if (result === 'granted') {
      updateProfile({ notificationsEnabled: true })
      toast({ title: 'Notifications on', description: 'Bloom will notify you when a reminder is due while the app is open or installed.', tone: 'success' })
    } else {
      toast({
        title: result === 'unsupported' ? 'Not supported here' : 'Permission not granted',
        description: 'You will still get in-app reminders while Bloom is open.',
        tone: 'warning',
      })
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reminders"
        subtitle="Vitamins, water, movement, appointments. Gentle and on your schedule."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus className="h-4 w-4" /> New reminder
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Today"
              subtitle={statuses.length ? `${statuses.filter((s) => s.completed).length} of ${statuses.length} done` : 'Nothing due today'}
            />
            {statuses.length === 0 ? (
              <EmptyState icon={<Bell className="h-5 w-5" />} title="A quiet day" description="Reminders scheduled for today will appear here." />
            ) : (
              <div className="-mx-2 space-y-0.5">
                {statuses.map((s) => (
                  <ReminderRow key={s.reminder.id} status={s} date={today} />
                ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="All reminders" subtitle={`${reminders.filter((r) => r.enabled).length} active`} />
            {sorted.length === 0 ? (
              <EmptyState
                icon={<BellOff className="h-5 w-5" />}
                title="No reminders yet"
                description="Pick a suggestion on the right or create your own."
                action={
                  <Button size="sm" onClick={() => setCreating(true)}>
                    Create one
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {sorted.map((r) => (
                  <li key={r.id} className={cn('flex items-center gap-3 py-3', !r.enabled && 'opacity-60')}>
                    <span className="text-xl" aria-hidden>
                      {REMINDER_CATEGORY_INFO[r.category].emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-xs text-ink-muted">
                        {formatTime(r.time)} · {describeRecurrence(r.recurrence)}
                        {r.note ? ` · ${r.note}` : ''}
                      </p>
                    </div>
                    <Switch checked={r.enabled} onChange={() => toggleEnabled(r.id)} label={`${r.enabled ? 'Disable' : 'Enable'} ${r.title}`} />
                    <Button variant="ghost" size="icon" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Delete ${r.title}`} onClick={() => setDeleting(r)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Notifications" />
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">System notifications</p>
                <p className="text-xs text-ink-muted">
                  {permission === 'unsupported'
                    ? 'Not supported in this browser.'
                    : permission === 'denied'
                      ? 'Blocked in browser settings.'
                      : 'Shown when a reminder is due while Bloom is open or installed.'}
                </p>
              </div>
              <Switch
                checked={profile.notificationsEnabled && permission === 'granted'}
                onChange={enableNotifications}
                disabled={permission === 'unsupported' || permission === 'denied'}
                label="System notifications"
              />
            </div>
            <p className="mt-3 text-xs text-ink-muted">In-app reminders always appear at the top of the screen while Bloom is open.</p>
          </Card>

          {suggestions.length > 0 && (
            <Card>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-sand-500" /> Suggested for week {week}
                  </span>
                }
              />
              <ul className="space-y-2">
                {suggestions.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 rounded-xl border border-line p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {REMINDER_CATEGORY_INFO[t.category].emoji} {t.title}
                      </p>
                      <p className="text-xs text-ink-muted">
                        {formatTime(t.time)} · {describeRecurrence(t.recurrence)}
                      </p>
                      {t.fromWeek && (
                        <Badge tone="sand" className="mt-1">
                          From week {t.fromWeek}
                        </Badge>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="soft"
                      onClick={() => {
                        addFromTemplate(t)
                        toast({ title: 'Reminder added', description: t.title, tone: 'success' })
                      }}
                    >
                      Add
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      <Modal open={creating} onClose={() => setCreating(false)} title="New reminder">
        <ReminderForm
          onClose={() => setCreating(false)}
          onSubmit={(input) => {
            add(input)
            setCreating(false)
            toast({ title: 'Reminder added', description: `${input.title} at ${formatTime(input.time)}`, tone: 'success' })
          }}
        />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit reminder">
        {editing && (
          <ReminderForm
            initial={editing}
            onClose={() => setEditing(null)}
            onSubmit={(input) => {
              update(editing.id, input)
              setEditing(null)
            }}
          />
        )}
      </Modal>
      <ConfirmModal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting.id)}
        title="Delete reminder?"
        description={`"${deleting?.title}" will be removed along with its history.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
