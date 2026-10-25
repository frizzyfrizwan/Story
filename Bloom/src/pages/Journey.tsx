import { useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Stethoscope, Sparkles, Lightbulb, Apple } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Chip'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/ui/PageHeader'
import { usePregnancy } from '@/hooks/usePregnancy'
import { useProfileStore } from '@/store/profile'
import { WEEKS, getWeekGuide } from '@/data/weeks'
import { SYMPTOM_BY_ID } from '@/data/symptoms'
import { NUTRIENT_INFO } from '@/data/nutrients'
import { MAX_WEEK, TRIMESTER_LABEL, dateOfWeekStart } from '@/lib/pregnancy'
import { formatBabyLength, formatBabyWeight } from '@/lib/weight'
import { formatShort } from '@/lib/dates'
import { cn } from '@/lib/cn'

export default function Journey() {
  const preg = usePregnancy()
  const units = useProfileStore((s) => s.profile?.units ?? 'metric')
  const params = useParams<{ week?: string }>()
  const navigate = useNavigate()
  const currentWeek = preg?.ga.guideWeek ?? 1
  const week = Math.min(MAX_WEEK, Math.max(1, Number(params.week) || currentWeek))
  const guide = getWeekGuide(week)
  const stripRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = stripRef.current?.querySelector<HTMLElement>(`[data-week="${week}"]`)
    el?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [week])

  const range = useMemo(() => {
    if (!preg) return null
    return { start: dateOfWeekStart(preg.dueDate, week), end: dateOfWeekStart(preg.dueDate, week + 1) }
  }, [preg, week])

  const isCurrent = week === currentWeek
  const isPast = week < currentWeek

  return (
    <div className="space-y-6">
      <PageHeader
        title="Your journey"
        subtitle="Week by week: what's growing, what you might feel, and what to plan."
        action={
          !isCurrent && (
            <Button variant="soft" size="sm" onClick={() => navigate(`/journey/${currentWeek}`)}>
              Back to this week
            </Button>
          )
        }
      />

      {/* Week strip */}
      <div ref={stripRef} className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0" role="tablist" aria-label="Weeks">
        {WEEKS.map((w) => {
          const active = w.week === week
          const now = w.week === currentWeek
          return (
            <Link
              key={w.week}
              to={`/journey/${w.week}`}
              data-week={w.week}
              role="tab"
              aria-selected={active}
              className={cn(
                'flex h-14 w-12 shrink-0 flex-col items-center justify-center rounded-xl border text-sm transition-colors',
                active
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : now
                    ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                    : w.week < currentWeek
                      ? 'border-line bg-surface-sunken text-ink-muted'
                      : 'border-line text-ink-secondary hover:border-rose-200',
              )}
            >
              <span className="text-[10px] uppercase tracking-wide opacity-80">wk</span>
              <span className="font-semibold">{w.week}</span>
            </Link>
          )
        })}
      </div>

      <section className="card p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="rose">{TRIMESTER_LABEL[guide.trimester]}</Badge>
          {isCurrent && <Badge tone="sage">You are here</Badge>}
          {isPast && <Badge tone="neutral">Completed</Badge>}
          {range && (
            <span className="text-sm text-ink-muted">
              {formatShort(range.start)} – {formatShort(range.end)}
            </span>
          )}
        </div>
        <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-start">
          <div>
            <p className="label">Week {guide.week}</p>
            <h2 className="mt-1 text-3xl font-semibold leading-tight sm:text-4xl">{guide.title}</h2>
            {guide.milestone && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-xl bg-sand-50 px-3 py-2 text-sm font-medium text-sand-900 dark:bg-sand-900/30 dark:text-sand-100">
                <Sparkles className="h-4 w-4 text-sand-600" /> {guide.milestone}
              </p>
            )}
          </div>
          <div className="well flex items-center gap-4 p-4 md:min-w-[260px]">
            <div className="grid h-14 w-14 place-items-center rounded-2xl bg-rose-100 text-3xl dark:bg-rose-900/40" aria-hidden>
              🫘
            </div>
            <div>
              <p className="text-xs text-ink-muted">Baby is about the size of</p>
              <p className="font-semibold">{guide.babySize.comparison.charAt(0).toUpperCase() + guide.babySize.comparison.slice(1)}</p>
              {guide.babySize.lengthCm > 0 && (
                <p className="text-sm text-ink-secondary">
                  {formatBabyLength(guide.babySize.lengthCm, units)} · {formatBabyWeight(guide.babySize.weightG, units)}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="text-lg font-semibold">Your baby</h3>
            <p className="mt-2 leading-relaxed text-ink-secondary">{guide.baby}</p>
          </div>
          <div>
            <h3 className="text-lg font-semibold">Your body</h3>
            <p className="mt-2 leading-relaxed text-ink-secondary">{guide.body}</p>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-sand-500" /> Tips
              </span>
            }
          />
          <ul className="space-y-2.5">
            {guide.tips.map((t) => (
              <li key={t} className="flex gap-2.5 text-sm text-ink-secondary">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400" /> {t}
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Apple className="h-5 w-5 text-sage-600" /> Nutrition focus
              </span>
            }
          />
          <ul className="space-y-3">
            {guide.nutritionFocus.map((n) => (
              <li key={n} className="text-sm">
                <p className="font-medium">{NUTRIENT_INFO[n].label}</p>
                <p className="text-ink-secondary">{NUTRIENT_INFO[n].why}</p>
                <p className="text-xs text-ink-muted">Find it in: {NUTRIENT_INFO[n].sources}</p>
              </li>
            ))}
          </ul>
          <Link to="/meals" className="mt-4 inline-block text-sm font-medium text-rose-600 hover:text-rose-700">
            See this week's meal plan
          </Link>
        </Card>
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-rose-500" /> Care & symptoms
              </span>
            }
          />
          {guide.checkups?.length ? (
            <div className="mb-4">
              <p className="label mb-1.5">Typical this week</p>
              <ul className="space-y-1.5 text-sm text-ink-secondary">
                {guide.checkups.map((c) => (
                  <li key={c}>• {c}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="label mb-1.5">Common symptoms</p>
          <div className="flex flex-wrap gap-1.5">
            {guide.commonSymptoms.map((id) => (
              <Badge key={id} tone="neutral">
                {SYMPTOM_BY_ID[id].emoji} {SYMPTOM_BY_ID[id].label}
              </Badge>
            ))}
            {guide.commonSymptoms.length === 0 && <span className="text-sm text-ink-muted">Few noticeable symptoms yet.</span>}
          </div>
        </Card>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={() => navigate(`/journey/${week - 1}`)} disabled={week <= 1}>
          <ChevronLeft className="h-4 w-4" /> Week {week - 1}
        </Button>
        <Button variant="secondary" onClick={() => navigate(`/journey/${week + 1}`)} disabled={week >= MAX_WEEK}>
          Week {week + 1} <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
