import { useMemo, useState } from 'react'
import { CalendarPlus, Check, MapPin, Pencil, Plus, Sparkles, Stethoscope, Trash2, X } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { Modal, ConfirmModal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAppointmentStore, type AppointmentInput } from '@/store/appointments'
import { useReminderStore } from '@/store/reminders'
import { usePregnancy } from '@/hooks/usePregnancy'
import { APPOINTMENT_SUGGESTIONS } from '@/data/appointmentSchedule'
import { dateOfWeekStart, gestationalAge, formatGA } from '@/lib/pregnancy'
import { formatLong, formatMedium, formatShort, formatTime, relativeDay, todayISO } from '@/lib/dates'
import type { Appointment } from '@/types'
import { toast } from '@/store/ui'
import { cn } from '@/lib/cn'

function AppointmentForm({
  initial,
  defaults,
  onSubmit,
  onClose,
}: {
  initial?: Appointment
  defaults?: Partial<AppointmentInput>
  onSubmit: (a: AppointmentInput, remind: boolean) => void
  onClose: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? defaults?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? defaults?.date ?? todayISO())
  const [time, setTime] = useState(initial?.time ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const [provider, setProvider] = useState(initial?.provider ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? defaults?.notes ?? '')
  const [questions, setQuestions] = useState<string[]>(initial?.questions ?? [])
  const [newQ, setNewQ] = useState('')
  const [remind, setRemind] = useState(!initial)
  const valid = title.trim().length > 0 && !!date

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        onSubmit(
          {
            title: title.trim(),
            date,
            time: time || undefined,
            location: location.trim() || undefined,
            provider: provider.trim() || undefined,
            notes: notes.trim() || undefined,
            questions,
            done: initial?.done ?? false,
          },
          remind,
        )
      }}
    >
      <Field label="What is it?" htmlFor="a-title">
        <Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Anatomy scan" required maxLength={80} autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="a-date">
          <Input id="a-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </Field>
        <Field label="Time (optional)" htmlFor="a-time">
          <Input id="a-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <Field label="Where" htmlFor="a-loc">
          <Input id="a-loc" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Clinic or hospital" maxLength={120} />
        </Field>
        <Field label="With" htmlFor="a-prov">
          <Input id="a-prov" value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Dr Patel, midwife team…" maxLength={80} />
        </Field>
      </div>
      <Field label="Questions to ask" htmlFor="a-q" hint="Add them as they come to you during the week.">
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-surface-sunken px-3 py-2 text-sm">
              <span className="flex-1">{q}</span>
              <button
                type="button"
                aria-label={`Remove question: ${q}`}
                onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
                className="text-ink-muted hover:text-ink"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input
              id="a-q"
              value={newQ}
              onChange={(e) => setNewQ(e.target.value)}
              placeholder="Is this level of swelling normal?"
              maxLength={200}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (newQ.trim()) {
                    setQuestions((qs) => [...qs, newQ.trim()])
                    setNewQ('')
                  }
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (newQ.trim()) {
                  setQuestions((qs) => [...qs, newQ.trim()])
                  setNewQ('')
                }
              }}
            >
              Add
            </Button>
          </div>
        </div>
      </Field>
      <Field label="Notes" htmlFor="a-notes">
        <Textarea
          id="a-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Fasting required? Bring previous results?"
          maxLength={1000}
          className="min-h-[64px]"
        />
      </Field>
      {!initial && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-rose-600" checked={remind} onChange={(e) => setRemind(e.target.checked)} />
          Also create a reminder the day before
        </label>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!valid}>
          {initial ? 'Save changes' : 'Add appointment'}
        </Button>
      </div>
    </form>
  )
}

export default function Appointments() {
  const preg = usePregnancy()
  const today = preg?.today ?? todayISO()
  const week = preg?.ga.guideWeek ?? 1
  const appointments = useAppointmentStore((s) => s.appointments)
  const dismissed = useAppointmentStore((s) => s.dismissedSuggestions)
  const { add, update, remove, toggleDone, dismissSuggestion } = useAppointmentStore()
  const addReminder = useReminderStore((s) => s.add)
  const [creating, setCreating] = useState<Partial<AppointmentInput> | null>(null)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [deleting, setDeleting] = useState<Appointment | null>(null)

  const upcoming = useMemo(
    () => appointments.filter((a) => !a.done && a.date >= today).toSorted((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '')),
    [appointments, today],
  )
  const past = useMemo(() => appointments.filter((a) => a.done || a.date < today).toSorted((a, b) => b.date.localeCompare(a.date)), [appointments, today])
  const suggestions = useMemo(
    () =>
      APPOINTMENT_SUGGESTIONS.filter(
        (s) => s.toWeek >= week && s.fromWeek <= week + 6 && !dismissed.includes(s.id) && !appointments.some((a) => a.title === s.title),
      ),
    [week, dismissed, appointments],
  )

  function create(input: AppointmentInput, remind: boolean) {
    const appt = add(input)
    if (remind && input.date > today) {
      const d = new Date(input.date)
      d.setDate(d.getDate() - 1)
      const dayBefore = d.toISOString().slice(0, 10)
      addReminder({
        title: `Tomorrow: ${input.title}`,
        note: [input.time ? formatTime(input.time) : null, input.location].filter(Boolean).join(' · ') || undefined,
        category: 'appointment',
        time: '18:00',
        recurrence: { kind: 'once', date: dayBefore },
        enabled: true,
      })
    }
    setCreating(null)
    toast({ title: 'Appointment added', description: `${appt.title} · ${formatMedium(appt.date)}`, tone: 'success' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appointments"
        subtitle="Keep every scan and check-up in one place, with the questions you want answered."
        action={
          <Button onClick={() => setCreating({})}>
            <Plus className="h-4 w-4" /> Add appointment
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card>
            <CardHeader title="Upcoming" subtitle={upcoming.length ? `${upcoming.length} scheduled` : undefined} />
            {upcoming.length === 0 ? (
              <EmptyState
                icon={<Stethoscope className="h-5 w-5" />}
                title="Nothing scheduled"
                description="Add your next appointment, or pick a typical one from the timeline."
                action={
                  <Button size="sm" onClick={() => setCreating({})}>
                    Add appointment
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-3">
                {upcoming.map((a) => {
                  const ga = preg ? gestationalAge(preg.dueDate, a.date) : null
                  return (
                    <li key={a.id} className="flex gap-4 rounded-xl border border-line p-4">
                      <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                        <span className="text-[11px] font-semibold uppercase leading-none">{formatMedium(a.date).split(' ')[1]}</span>
                        <span className="text-xl font-semibold leading-tight">{Number(a.date.slice(8))}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{a.title}</h3>
                          <Badge tone="rose">{relativeDay(a.date, today)}</Badge>
                          {ga && ga.totalDays >= 0 && <Badge tone="neutral">{formatGA(ga)}</Badge>}
                        </div>
                        <p className="mt-0.5 text-sm text-ink-secondary">
                          {formatLong(a.date)}
                          {a.time ? ` · ${formatTime(a.time)}` : ''}
                          {a.provider ? ` · ${a.provider}` : ''}
                        </p>
                        {a.location && (
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-ink-muted">
                            <MapPin className="h-3.5 w-3.5" /> {a.location}
                          </p>
                        )}
                        {a.questions.length > 0 && (
                          <ul className="mt-2 space-y-1 text-sm">
                            {a.questions.map((q, i) => (
                              <li key={i} className="flex gap-2 text-ink-secondary">
                                <span className="text-rose-400">?</span> {q}
                              </li>
                            ))}
                          </ul>
                        )}
                        {a.notes && <p className="mt-2 text-sm text-ink-muted">{a.notes}</p>}
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" aria-label="Mark done" onClick={() => toggleDone(a.id)}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(a)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(a)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader title="Past" />
              <ul className="divide-y divide-line">
                {past.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <span
                      className={cn('grid h-6 w-6 place-items-center rounded-full', a.done ? 'bg-sage-500 text-white' : 'bg-surface-sunken text-ink-muted')}
                    >
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                    <span className="w-20 shrink-0 text-ink-muted">{formatShort(a.date)}</span>
                    <span className="flex-1 truncate">{a.title}</span>
                    {!a.done && (
                      <Button variant="ghost" size="sm" onClick={() => toggleDone(a.id)}>
                        Mark done
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => setEditing(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Delete" onClick={() => setDeleting(a)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <Card className="self-start">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-sand-500" /> Typical timeline
              </span>
            }
            subtitle="What usually happens around now. Tap to schedule."
          />
          {suggestions.length === 0 ? (
            <p className="text-sm text-ink-muted">You are up to date with the usual schedule.</p>
          ) : (
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li key={s.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">{s.title}</p>
                      <p className="text-xs text-ink-muted">
                        Weeks {s.fromWeek}–{s.toWeek}
                        {preg && ` · from ${formatShort(dateOfWeekStart(preg.dueDate, s.fromWeek))}`}
                      </p>
                    </div>
                    <button type="button" aria-label="Dismiss suggestion" onClick={() => dismissSuggestion(s.id)} className="text-ink-muted hover:text-ink">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-ink-secondary">{s.description}</p>
                  <Button
                    size="sm"
                    variant="soft"
                    className="mt-2"
                    onClick={() =>
                      setCreating({
                        title: s.title,
                        notes: s.description,
                        date: preg
                          ? dateOfWeekStart(preg.dueDate, Math.max(s.fromWeek, week)) > today
                            ? dateOfWeekStart(preg.dueDate, Math.max(s.fromWeek, week))
                            : today
                          : today,
                      })
                    }
                  >
                    <CalendarPlus className="h-4 w-4" /> Schedule
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={!!creating} onClose={() => setCreating(null)} title="Add appointment">
        {creating && <AppointmentForm defaults={creating} onSubmit={create} onClose={() => setCreating(null)} />}
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit appointment">
        {editing && (
          <AppointmentForm
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
        title="Delete appointment?"
        description={`"${deleting?.title}" will be removed.`}
        confirmLabel="Delete"
        danger
      />
    </div>
  )
}
