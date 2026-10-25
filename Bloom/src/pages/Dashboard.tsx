import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Baby, Bell, CalendarDays, Droplets, Minus, Plus, Sparkles, Stethoscope } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Badge, Chip } from '@/components/ui/Chip'
import { EmptyState } from '@/components/ui/EmptyState'
import { ReminderRow } from '@/components/ReminderRow'
import { MealCard } from '@/components/MealCard'
import { RecipeModal } from '@/components/RecipeModal'
import { usePregnancy } from '@/hooks/usePregnancy'
import { useNow } from '@/hooks/useToday'
import { useMealPlan } from '@/hooks/useMealPlan'
import { useProfileStore } from '@/store/profile'
import { useReminderStore } from '@/store/reminders'
import { useLogStore, emptyLog } from '@/store/logs'
import { useAppointmentStore } from '@/store/appointments'
import { useChecklistStore } from '@/store/checklists'
import { getWeekGuide } from '@/data/weeks'
import { SYMPTOM_BY_ID } from '@/data/symptoms'
import { APPOINTMENT_SUGGESTIONS } from '@/data/appointmentSchedule'
import { CHECKLISTS } from '@/data/checklists'
import { statusesForDate } from '@/lib/reminders'
import { TRIMESTER_LABEL, formatGA } from '@/lib/pregnancy'
import { formatBabyLength, formatBabyWeight } from '@/lib/weight'
import { formatLong, formatMedium, formatTime, relativeDay } from '@/lib/dates'
import type { Mood, Recipe } from '@/types'
import { cn } from '@/lib/cn'

const MOODS: { value: Mood; emoji: string; label: string }[] = [
  { value: 1, emoji: '😞', label: 'Rough' },
  { value: 2, emoji: '😕', label: 'Low' },
  { value: 3, emoji: '😐', label: 'Okay' },
  { value: 4, emoji: '🙂', label: 'Good' },
  { value: 5, emoji: '😄', label: 'Great' },
]

function greeting(now: Date, name?: string) {
  const h = now.getHours()
  const part = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${part}, ${name}` : part
}

export default function Dashboard() {
  const preg = usePregnancy()
  const now = useNow()
  const profile = useProfileStore((s) => s.profile)!
  const reminders = useReminderStore((s) => s.reminders)
  const log = useLogStore((s) => (preg ? s.logs[preg.today] : undefined)) ?? emptyLog(preg?.today ?? '')
  const setWater = useLogStore((s) => s.setWater)
  const setMood = useLogStore((s) => s.setMood)
  const toggleSymptom = useLogStore((s) => s.toggleSymptom)
  const toggleMealEaten = useLogStore((s) => s.toggleMealEaten)
  const appointments = useAppointmentStore((s) => s.appointments)
  const dismissed = useAppointmentStore((s) => s.dismissedSuggestions)
  const checked = useChecklistStore((s) => s.checked)
  const plan = useMealPlan()
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null)

  const today = preg?.today ?? ''
  const guideWeek = preg?.ga.guideWeek ?? 1

  const upcoming = useMemo(
    () =>
      appointments
        .filter((a) => !a.done && a.date >= today)
        .toSorted((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))
        .slice(0, 2),
    [appointments, today],
  )
  const checklistTotals = useMemo(() => {
    const groups = CHECKLISTS.filter((g) => !g.fromWeek || guideWeek >= g.fromWeek)
    const total = groups.reduce((n, g) => n + g.items.length, 0)
    const done = groups.reduce((n, g) => n + g.items.filter((i) => checked[i.id]).length, 0)
    return { total, done }
  }, [checked, guideWeek])

  if (!preg) return null
  const { ga, dueDate } = preg
  const guide = getWeekGuide(ga.guideWeek)
  const statuses = statusesForDate(reminders, today, now)
  const pending = statuses.filter((s) => !s.completed)
  const doneCount = statuses.length - pending.length
  const todayMeals = plan.byDate[today]?.meals ?? []
  const suggestion = APPOINTMENT_SUGGESTIONS.find(
    (s) => ga.guideWeek >= s.fromWeek && ga.guideWeek <= s.toWeek && !dismissed.includes(s.id) && !appointments.some((a) => a.title === s.title),
  )

  const daysLabel = ga.isOverdue
    ? `${-ga.daysUntilDue} day${ga.daysUntilDue === -1 ? '' : 's'} past due`
    : `${ga.daysUntilDue} day${ga.daysUntilDue === 1 ? '' : 's'} to go`

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-secondary">{formatLong(today)}</p>
        <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{greeting(now, profile.name || undefined)}</h1>
      </div>

      {/* Hero */}
      <section className="card overflow-hidden bg-gradient-to-br from-rose-50 via-surface-raised to-sand-50 p-6 dark:from-rose-950/40 dark:via-surface-raised dark:to-sand-900/20 sm:p-8">
        <div className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <ProgressRing value={ga.progress} size={168} label={`${Math.round(ga.progress * 100)}% of the way to your due date`}>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Week</p>
              <p className="text-5xl font-semibold leading-none">{ga.guideWeek}</p>
              <p className="mt-1 text-xs text-ink-secondary">{formatGA(ga)}</p>
            </div>
          </ProgressRing>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="rose">{TRIMESTER_LABEL[ga.trimester]}</Badge>
              <Badge tone="neutral">{daysLabel}</Badge>
              {guide.milestone && <Badge tone="sand">✦ {guide.milestone}</Badge>}
            </div>
            <h2 className="mt-3 text-2xl font-semibold leading-tight sm:text-3xl">{guide.title}</h2>
            <p className="mt-2 text-ink-secondary">
              Baby is about the size of <span className="font-medium text-ink">{guide.babySize.comparison}</span>
              {guide.babySize.lengthCm > 0 && (
                <>
                  {' '}
                  · {formatBabyLength(guide.babySize.lengthCm, profile.units)} · {formatBabyWeight(guide.babySize.weightG, profile.units)}
                </>
              )}
            </p>
            <p className="mt-3 line-clamp-3 text-sm text-ink-secondary">{guide.baby}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to={`/journey/${ga.guideWeek}`}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700"
              >
                <Baby className="h-4 w-4" /> This week in detail
              </Link>
              <span className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-surface-raised/70 px-3 text-sm text-ink-secondary">
                <CalendarDays className="h-4 w-4" /> Due {formatMedium(dueDate)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Reminders */}
        <Card className="lg:col-span-1">
          <CardHeader
            title="Today's reminders"
            subtitle={statuses.length ? `${doneCount} of ${statuses.length} done` : 'Nothing scheduled today'}
            action={
              <Link to="/reminders" className="text-sm font-medium text-rose-600 hover:text-rose-700">
                Manage
              </Link>
            }
          />
          {statuses.length === 0 ? (
            <EmptyState
              icon={<Bell className="h-5 w-5" />}
              title="No reminders yet"
              description="Add a prenatal vitamin or hydration nudge to get started."
              action={
                <Link to="/reminders">
                  <Button size="sm">Add reminder</Button>
                </Link>
              }
            />
          ) : (
            <div className="-mx-2 space-y-0.5">
              {statuses.map((s) => (
                <ReminderRow key={s.reminder.id} status={s} date={today} />
              ))}
            </div>
          )}
        </Card>

        {/* Quick log */}
        <Card className="lg:col-span-2">
          <CardHeader
            title="How are you today?"
            subtitle="A 10-second check-in builds a picture for your next appointment."
            action={
              <Link to={`/track/${today}`} className="text-sm font-medium text-rose-600 hover:text-rose-700">
                Full log
              </Link>
            }
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <p className="label mb-2">Mood</p>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Mood">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={log.mood === m.value}
                    aria-label={m.label}
                    onClick={() => setMood(today, log.mood === m.value ? undefined : m.value)}
                    className={cn(
                      'flex h-12 flex-1 flex-col items-center justify-center rounded-xl border text-xl transition-all',
                      log.mood === m.value ? 'border-rose-500 bg-rose-50 scale-105 dark:bg-rose-900/30' : 'border-line hover:border-rose-200',
                    )}
                  >
                    {m.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="label mb-2">Water</p>
              <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="icon"
                  aria-label="Remove a glass"
                  onClick={() => setWater(today, log.waterGlasses - 1)}
                  disabled={log.waterGlasses === 0}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-semibold">
                      {log.waterGlasses}
                      <span className="text-sm font-normal text-ink-muted"> / {profile.waterGoal} glasses</span>
                    </span>
                    <Droplets className={cn('h-5 w-5', log.waterGlasses >= profile.waterGoal ? 'text-sage-500' : 'text-rose-300')} />
                  </div>
                  <div
                    className="mt-1.5 h-2 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-900/40"
                    role="progressbar"
                    aria-valuenow={log.waterGlasses}
                    aria-valuemin={0}
                    aria-valuemax={profile.waterGoal}
                    aria-label="Water intake"
                  >
                    <div
                      className={cn('h-full rounded-full transition-all', log.waterGlasses >= profile.waterGoal ? 'bg-sage-500' : 'bg-rose-500')}
                      style={{ width: `${Math.min(100, (log.waterGlasses / profile.waterGoal) * 100)}%` }}
                    />
                  </div>
                </div>
                <Button variant="primary" size="icon" aria-label="Add a glass" onClick={() => setWater(today, log.waterGlasses + 1)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="mt-5">
            <p className="label mb-2">Common this week · tap what you feel</p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set([...guide.commonSymptoms, ...log.symptoms])).map((id) => {
                const s = SYMPTOM_BY_ID[id]
                if (!s) return null
                return (
                  <Chip key={id} active={log.symptoms.includes(id)} onClick={() => toggleSymptom(today, id)}>
                    <span aria-hidden>{s.emoji}</span> {s.label}
                  </Chip>
                )
              })}
              <Link
                to={`/track/${today}`}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-line px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
              >
                More <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </Card>
      </div>

      {/* Meals */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-semibold">Today's meals</h2>
            <p className="text-sm text-ink-secondary">
              Built for the {TRIMESTER_LABEL[ga.trimester].toLowerCase()}
              {profile.diet.length ? ` · ${profile.diet.join(', ')}` : ''}
            </p>
          </div>
          <Link to="/meals" className="text-sm font-medium text-rose-600 hover:text-rose-700">
            Week plan & groceries
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {todayMeals.map((m) => (
            <MealCard
              key={m.slot}
              slot={m.slot}
              recipe={m.recipe}
              swapped={m.swapped}
              eaten={m.recipe ? log.mealsEaten.includes(m.recipe.id) : false}
              onToggleEaten={m.recipe ? () => toggleMealEaten(today, m.recipe!.id) : undefined}
              onOpen={() => setOpenRecipe(m.recipe)}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title="Appointments"
            action={
              <Link to="/appointments" className="text-sm font-medium text-rose-600 hover:text-rose-700">
                All
              </Link>
            }
          />
          {upcoming.length === 0 && !suggestion ? (
            <EmptyState icon={<Stethoscope className="h-5 w-5" />} title="Nothing booked" description="Add your next check-up so Bloom can remind you." />
          ) : (
            <ul className="space-y-3">
              {upcoming.map((a) => (
                <li key={a.id} className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                    <span className="text-xs font-semibold uppercase leading-none">{formatMedium(a.date).split(' ')[0].replace(',', '')}</span>
                    <span className="text-base font-semibold leading-none">{a.date.slice(8)}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{a.title}</p>
                    <p className="text-xs text-ink-muted">
                      {relativeDay(a.date, today)}
                      {a.time ? ` · ${formatTime(a.time)}` : ''}
                      {a.location ? ` · ${a.location}` : ''}
                    </p>
                  </div>
                </li>
              ))}
              {suggestion && (
                <li className="rounded-xl border border-dashed border-sand-300 bg-sand-50/60 p-3 text-sm dark:bg-sand-900/20">
                  <p className="font-medium">
                    <Sparkles className="mr-1 inline h-4 w-4 text-sand-600" />
                    Typically around now: {suggestion.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-secondary">{suggestion.description}</p>
                  <Link to="/appointments" className="mt-2 inline-block text-xs font-medium text-rose-600">
                    Schedule it
                  </Link>
                </li>
              )}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title={`Tips for week ${ga.guideWeek}`} />
          <ul className="space-y-2.5">
            {guide.tips.map((t) => (
              <li key={t} className="flex gap-2.5 text-sm text-ink-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" />
                {t}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Checklists"
            subtitle={`${checklistTotals.done} of ${checklistTotals.total} done`}
            action={
              <Link to="/checklists" className="text-sm font-medium text-rose-600 hover:text-rose-700">
                Open
              </Link>
            }
          />
          <div className="h-2 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900/40">
            <div
              className="h-full rounded-full bg-sage-500 transition-all"
              style={{ width: `${checklistTotals.total ? (checklistTotals.done / checklistTotals.total) * 100 : 0}%` }}
            />
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {CHECKLISTS.filter((g) => !g.fromWeek || ga.guideWeek >= g.fromWeek).map((g) => {
              const done = g.items.filter((i) => checked[i.id]).length
              return (
                <li key={g.id} className="flex items-center justify-between">
                  <span className="text-ink-secondary">{g.title}</span>
                  <span className="tabular-nums text-ink-muted">
                    {done}/{g.items.length}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <RecipeModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} />
    </div>
  )
}
