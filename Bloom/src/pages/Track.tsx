import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { addMonths, endOfDay, format, getDaysInMonth, startOfMonth } from 'date-fns'
import { ChevronLeft, ChevronRight, Minus, Plus, Save } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { PageHeader } from '@/components/ui/PageHeader'
import { ReminderRow } from '@/components/ReminderRow'
import { useLogStore, emptyLog } from '@/store/logs'
import { useProfileStore } from '@/store/profile'
import { useReminderStore } from '@/store/reminders'
import { usePregnancy } from '@/hooks/usePregnancy'
import { useNow, useToday } from '@/hooks/useToday'
import { useMealPlan } from '@/hooks/useMealPlan'
import { SYMPTOMS } from '@/data/symptoms'
import { statusesForDate } from '@/lib/reminders'
import { fromISODate, isValidISODate, formatLong, shiftISO, toISODate } from '@/lib/dates'
import { gestationalAge, formatGA } from '@/lib/pregnancy'
import { kgToLb, lbToKg } from '@/lib/weight'
import { SLOT_LABEL } from '@/lib/mealPlan'
import type { Mood } from '@/types'
import { cn } from '@/lib/cn'
import { toast } from '@/store/ui'

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

function MonthCalendar({
  selected,
  today,
  onSelect,
  loggedDates,
  dueDate,
}: {
  selected: string
  today: string
  onSelect: (d: string) => void
  loggedDates: Set<string>
  dueDate: string
}) {
  const [month, setMonth] = useState(() => startOfMonth(fromISODate(selected)))
  const days = getDaysInMonth(month)
  const firstDow = (month.getDay() + 6) % 7
  const cells: (string | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: days }, (_, i) => toISODate(new Date(month.getFullYear(), month.getMonth(), i + 1))),
  ]
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-semibold">{format(month, 'MMMM yyyy')}</p>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-ink-muted">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) =>
          d ? (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d)}
              aria-label={formatLong(d)}
              aria-current={d === today ? 'date' : undefined}
              aria-pressed={d === selected}
              disabled={d > today}
              className={cn(
                'relative grid aspect-square place-items-center rounded-lg text-sm transition-colors disabled:opacity-30',
                d === selected
                  ? 'bg-rose-600 text-white'
                  : d === today
                    ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                    : 'hover:bg-surface-sunken',
                d === dueDate && 'ring-2 ring-sand-400',
              )}
            >
              {Number(d.slice(8))}
              {loggedDates.has(d) && <span className={cn('absolute bottom-1 h-1 w-1 rounded-full', d === selected ? 'bg-white' : 'bg-sage-500')} />}
            </button>
          ) : (
            <span key={`e${i}`} />
          ),
        )}
      </div>
    </div>
  )
}

export default function Track() {
  const preg = usePregnancy()
  const now = useNow()
  const navigate = useNavigate()
  const params = useParams<{ date?: string }>()
  const profile = useProfileStore((s) => s.profile)!
  const fallbackToday = useToday()
  const today = preg?.today ?? fallbackToday
  const date = isValidISODate(params.date) && params.date <= today ? params.date : today
  const log = useLogStore((s) => s.logs[date]) ?? emptyLog(date)
  const logs = useLogStore((s) => s.logs)
  const { setMood, setWater, toggleSymptom, patchLog, toggleMealEaten } = useLogStore()
  const reminders = useReminderStore((s) => s.reminders)
  const plan = useMealPlan(date)

  const [weight, setWeight] = useState(() => (log.weightKg ? String(profile.units === 'metric' ? log.weightKg : Number(kgToLb(log.weightKg).toFixed(1))) : ''))
  const [sys, setSys] = useState(log.bloodPressure ? String(log.bloodPressure.systolic) : '')
  const [dia, setDia] = useState(log.bloodPressure ? String(log.bloodPressure.diastolic) : '')
  const [sleep, setSleep] = useState(log.sleepHours !== undefined ? String(log.sleepHours) : '')
  const [move, setMove] = useState(log.movementMinutes !== undefined ? String(log.movementMinutes) : '')
  const [note, setNote] = useState(log.note ?? '')

  const loggedDates = useMemo(
    () =>
      new Set(
        Object.values(logs)
          .filter((l) => l.mood || l.symptoms.length || l.waterGlasses || l.weightKg || l.note || l.kicks.length)
          .map((l) => l.date),
      ),
    [logs],
  )
  const ga = preg ? gestationalAge(preg.dueDate, date) : null
  const statuses = statusesForDate(reminders, date, date === today ? now : endOfDay(fromISODate(date)))
  const dayMeals = plan.byDate[date]?.meals ?? []

  function saveNumbers() {
    const w = Number(weight)
    const weightKg = weight && w > 0 ? Math.round((profile.units === 'metric' ? w : lbToKg(w)) * 10) / 10 : undefined
    const s = Number(sys)
    const d = Number(dia)
    patchLog(date, {
      weightKg,
      bloodPressure: sys && dia && s > 0 && d > 0 ? { systolic: s, diastolic: d } : undefined,
      sleepHours: sleep ? Math.max(0, Math.min(24, Number(sleep))) : undefined,
      movementMinutes: move ? Math.max(0, Number(move)) : undefined,
      note: note.trim() || undefined,
    })
    toast({ title: 'Saved', description: `Your log for ${formatLong(date)} is up to date.`, tone: 'success' })
  }

  function go(d: string) {
    navigate(`/track/${d}`)
    const l = logs[d] ?? emptyLog(d)
    setWeight(l.weightKg ? String(profile.units === 'metric' ? l.weightKg : Number(kgToLb(l.weightKg).toFixed(1))) : '')
    setSys(l.bloodPressure ? String(l.bloodPressure.systolic) : '')
    setDia(l.bloodPressure ? String(l.bloodPressure.diastolic) : '')
    setSleep(l.sleepHours !== undefined ? String(l.sleepHours) : '')
    setMove(l.movementMinutes !== undefined ? String(l.movementMinutes) : '')
    setNote(l.note ?? '')
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily log"
        subtitle="Capture how each day feels. Patterns show up in Health and make appointments easier."
        action={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Previous day" onClick={() => go(shiftISO(date, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="secondary" size="icon" aria-label="Next day" onClick={() => go(shiftISO(date, 1))} disabled={date >= today}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {date !== today && (
              <Button variant="soft" size="sm" onClick={() => go(today)}>
                Today
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-6">
          <Card>
            <MonthCalendar selected={date} today={today} onSelect={go} loggedDates={loggedDates} dueDate={profile.dueDate} />
          </Card>
          {statuses.length > 0 && (
            <Card>
              <CardHeader title="Reminders" subtitle={`${statuses.filter((s) => s.completed).length} of ${statuses.length} done`} />
              <div className="-mx-2 space-y-0.5">
                {statuses.map((s) => (
                  <ReminderRow key={s.reminder.id} status={s} date={date} compact />
                ))}
              </div>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold">{formatLong(date)}</h2>
            {ga && <p className="text-sm text-ink-secondary">{ga.totalDays >= 0 ? `${formatGA(ga)} pregnant` : 'Before your pregnancy began'}</p>}
          </div>

          <Card>
            <CardHeader title="Mood & energy" />
            <div className="flex gap-2" role="radiogroup" aria-label="Mood">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={log.mood === m.value}
                  onClick={() => setMood(date, log.mood === m.value ? undefined : m.value)}
                  className={cn(
                    'flex flex-1 flex-col items-center gap-1 rounded-xl border py-3 transition-all',
                    log.mood === m.value ? 'border-rose-500 bg-rose-50 dark:bg-rose-900/30' : 'border-line hover:border-rose-200',
                  )}
                >
                  <span className="text-2xl">{m.emoji}</span>
                  <span className="text-xs text-ink-secondary">{m.label}</span>
                </button>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader title="Symptoms" subtitle="Tap everything you noticed. Tap again to remove." />
            <div className="flex flex-wrap gap-2">
              {SYMPTOMS.map((s) => (
                <Chip key={s.id} active={log.symptoms.includes(s.id)} onClick={() => toggleSymptom(date, s.id)}>
                  <span aria-hidden>{s.emoji}</span> {s.label}
                </Chip>
              ))}
            </div>
            {log.symptoms.length > 0 && (
              <div className="mt-4 space-y-2 rounded-xl bg-surface-sunken p-4 text-sm">
                <p className="font-medium">Gentle relief ideas</p>
                {log.symptoms.slice(0, 4).map((id) => {
                  const s = SYMPTOMS.find((x) => x.id === id)!
                  return (
                    <p key={id} className="text-ink-secondary">
                      <span className="font-medium text-ink">{s.label}:</span> {s.relief}
                    </p>
                  )
                })}
              </div>
            )}
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader title="Water" subtitle={`Goal ${profile.waterGoal} glasses`} />
              <div className="flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Remove a glass"
                  onClick={() => setWater(date, log.waterGlasses - 1)}
                  disabled={!log.waterGlasses}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <span className="text-4xl font-semibold tabular-nums">{log.waterGlasses}</span>
                <Button size="icon" aria-label="Add a glass" onClick={() => setWater(date, log.waterGlasses + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex gap-1" aria-hidden>
                {Array.from({ length: Math.max(profile.waterGoal, log.waterGlasses) }, (_, i) => (
                  <span key={i} className={cn('h-2 flex-1 rounded-full', i < log.waterGlasses ? 'bg-rose-500' : 'bg-rose-100 dark:bg-rose-900/40')} />
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader title="Meals" subtitle="Tick what you ate from the plan" />
              <ul className="space-y-2">
                {dayMeals.map((m) =>
                  m.recipe ? (
                    <li key={m.slot}>
                      <label className="flex cursor-pointer items-center gap-3 text-sm">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-rose-600"
                          checked={log.mealsEaten.includes(m.recipe.id)}
                          onChange={() => toggleMealEaten(date, m.recipe!.id)}
                        />
                        <span className="text-ink-muted w-20 shrink-0">{SLOT_LABEL[m.slot]}</span>
                        <span className={cn('truncate', log.mealsEaten.includes(m.recipe.id) && 'text-ink-muted line-through')}>{m.recipe.name}</span>
                      </label>
                    </li>
                  ) : null,
                )}
              </ul>
            </Card>
          </div>

          <Card>
            <CardHeader title="Measurements & notes" subtitle="Optional. Saved when you press Save." />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label={`Weight (${profile.units === 'metric' ? 'kg' : 'lb'})`} htmlFor="weight">
                <Input id="weight" type="number" inputMode="decimal" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="—" />
              </Field>
              <Field label="Blood pressure" htmlFor="bp-sys" hint="systolic / diastolic">
                <div className="flex items-center gap-2">
                  <Input
                    id="bp-sys"
                    type="number"
                    inputMode="numeric"
                    value={sys}
                    onChange={(e) => setSys(e.target.value)}
                    placeholder="120"
                    aria-label="Systolic"
                  />
                  <span className="text-ink-muted">/</span>
                  <Input type="number" inputMode="numeric" value={dia} onChange={(e) => setDia(e.target.value)} placeholder="80" aria-label="Diastolic" />
                </div>
              </Field>
              <Field label="Sleep (hours)" htmlFor="sleep">
                <Input
                  id="sleep"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min={0}
                  max={24}
                  value={sleep}
                  onChange={(e) => setSleep(e.target.value)}
                  placeholder="7.5"
                />
              </Field>
              <Field label="Movement (minutes)" htmlFor="move">
                <Input id="move" type="number" inputMode="numeric" min={0} value={move} onChange={(e) => setMove(e.target.value)} placeholder="20" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Notes for the baby book or your next appointment" htmlFor="note">
                <Textarea
                  id="note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="First flutter? A question for the midwife? Anything goes."
                  maxLength={2000}
                />
              </Field>
            </div>
            <div className="mt-4 flex justify-end">
              <Button onClick={saveNumbers}>
                <Save className="h-4 w-4" /> Save
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
