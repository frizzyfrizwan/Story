import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Activity, Footprints, Play, Plus, Scale, Square, Timer, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { Field, Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { StatTile } from '@/components/ui/StatTile'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'
import { WeightChart, type WeightPoint } from '@/components/charts/WeightChart'
import { WaterChart } from '@/components/charts/WaterChart'
import { SymptomChart } from '@/components/charts/SymptomChart'
import { useLogStore } from '@/store/logs'
import { useProfileStore } from '@/store/profile'
import { usePregnancy } from '@/hooks/usePregnancy'
import { SYMPTOM_BY_ID } from '@/data/symptoms'
import { bmi, bmiCategory, BMI_LABEL, expectedGainAtWeek, formatWeight, gainGuide, lbToKg, kgToLb } from '@/lib/weight'
import { gestationalAge } from '@/lib/pregnancy'
import { formatMedium, shiftISO, todayISO } from '@/lib/dates'
import { toast } from '@/store/ui'
import { cn } from '@/lib/cn'

/** Current time, refreshed every second while `active`. */
function useTicker(active: boolean): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active])
  return now
}

function fmtDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export default function Health() {
  const preg = usePregnancy()
  const today = preg?.today ?? todayISO()
  const profile = useProfileStore((s) => s.profile)!
  const logs = useLogStore((s) => s.logs)
  const contractions = useLogStore((s) => s.contractions)
  const { patchLog, startKickSession, addKick, endKickSession, deleteKickSession, startContraction, endContraction, deleteContraction, clearContractions } =
    useLogStore()
  const [weightOpen, setWeightOpen] = useState(false)
  const [weightInput, setWeightInput] = useState('')
  const [weightDate, setWeightDate] = useState(today)

  // --- Weight -------------------------------------------------------------
  const weightEntries = Object.values(logs)
    .filter((l) => l.weightKg)
    .toSorted((a, b) => a.date.localeCompare(b.date))
  const latest = weightEntries.at(-1)
  const pre = profile.prePregnancyWeightKg
  const category = pre && profile.heightCm ? bmiCategory(bmi(pre, profile.heightCm)) : undefined
  const guide = category ? gainGuide(category, profile.multiples) : undefined
  const chartData: WeightPoint[] | null = (() => {
    if (!preg || !pre || !category) return null
    const byWeek = new Map<number, number>()
    for (const e of weightEntries) {
      const w = gestationalAge(preg.dueDate, e.date).weeks
      if (w >= 0 && w <= 42) byWeek.set(w, e.weightKg! - pre)
    }
    return Array.from({ length: 41 }, (_, week) => {
      const { min, max } = expectedGainAtWeek(week, category, profile.multiples)
      return { week, min, max, gain: byWeek.get(week) }
    })
  })()
  const currentGain = latest && pre ? latest.weightKg! - pre : undefined
  const expectedNow = preg && category ? expectedGainAtWeek(preg.ga.weeks, category, profile.multiples) : undefined
  const gainStatus =
    currentGain !== undefined && expectedNow ? (currentGain < expectedNow.min ? 'below' : currentGain > expectedNow.max ? 'above' : 'within') : undefined

  // --- Water & symptoms ---------------------------------------------------
  const waterData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = shiftISO(today, i - 6)
        return { label: formatMedium(d).slice(0, 3), glasses: logs[d]?.waterGlasses ?? 0 }
      }),
    [logs, today],
  )
  const symptomData = useMemo(() => {
    const counts = new Map<string, number>()
    for (let i = 0; i < 30; i++) for (const s of logs[shiftISO(today, -i)]?.symptoms ?? []) counts.set(s, (counts.get(s) ?? 0) + 1)
    return Array.from(counts.entries())
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, days]) => ({ label: SYMPTOM_BY_ID[id as keyof typeof SYMPTOM_BY_ID]?.label ?? id, days }))
  }, [logs, today])
  const moodAvg = useMemo(() => {
    const moods = Array.from({ length: 7 }, (_, i) => logs[shiftISO(today, -i)]?.mood).filter((m): m is NonNullable<typeof m> => !!m)
    return moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : undefined
  }, [logs, today])
  const sleepAvg = useMemo(() => {
    const hours = Array.from({ length: 7 }, (_, i) => logs[shiftISO(today, -i)]?.sleepHours).filter((h): h is number => typeof h === 'number')
    return hours.length ? hours.reduce((a, b) => a + b, 0) / hours.length : undefined
  }, [logs, today])

  // --- Kicks --------------------------------------------------------------
  const todayLog = logs[today]
  const activeKick = todayLog?.kicks.find((k) => !k.endedAt)
  const kickNow = useTicker(!!activeKick)
  const recentKicks = useMemo(
    () =>
      Object.values(logs)
        .flatMap((l) => l.kicks.filter((k) => k.endedAt).map((k) => ({ ...k, date: l.date })))
        .toSorted((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 6),
    [logs],
  )

  // --- Contractions -------------------------------------------------------
  const activeContraction = contractions.find((c) => !c.endedAt)
  const contractionNow = useTicker(!!activeContraction)
  const recentContractions = useMemo(() => [...contractions].toSorted((a, b) => b.startedAt.localeCompare(a.startedAt)).slice(0, 8), [contractions])
  const contractionStats = useMemo(() => {
    const done = contractions
      .filter((c) => c.endedAt)
      .toSorted((a, b) => a.startedAt.localeCompare(b.startedAt))
      .slice(-6)
    if (done.length < 2) return null
    const durations = done.map((c) => new Date(c.endedAt!).getTime() - new Date(c.startedAt).getTime())
    const intervals = done.slice(1).map((c, i) => new Date(c.startedAt).getTime() - new Date(done[i].startedAt).getTime())
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length
    return { duration: avg(durations), interval: avg(intervals), count: done.length }
  }, [contractions])
  const show511 = contractionStats && contractionStats.interval <= 5 * 60_000 && contractionStats.duration >= 60_000 && contractionStats.count >= 6

  function saveWeight() {
    const v = Number(weightInput)
    if (!v || v <= 0) return
    const kg = Math.round((profile.units === 'metric' ? v : lbToKg(v)) * 10) / 10
    patchLog(weightDate, { weightKg: kg })
    setWeightOpen(false)
    setWeightInput('')
    toast({ title: 'Weight logged', description: `${formatWeight(kg, profile.units)} on ${formatMedium(weightDate)}`, tone: 'success' })
  }

  const week = preg?.ga.guideWeek ?? 1

  return (
    <div className="space-y-6">
      <PageHeader title="Health" subtitle="Trends from your daily logs, plus tools for the third trimester." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Current weight"
          value={latest ? (profile.units === 'metric' ? latest.weightKg!.toFixed(1) : kgToLb(latest.weightKg!).toFixed(1)) : '—'}
          unit={profile.units === 'metric' ? 'kg' : 'lb'}
          hint={latest ? `Logged ${formatMedium(latest.date)}` : 'Log your first weight'}
          icon={<Scale className="h-4 w-4" />}
        />
        <StatTile
          label="Gain so far"
          value={
            currentGain !== undefined
              ? `${currentGain >= 0 ? '+' : ''}${profile.units === 'metric' ? currentGain.toFixed(1) : kgToLb(currentGain).toFixed(1)}`
              : '—'
          }
          unit={profile.units === 'metric' ? 'kg' : 'lb'}
          hint={
            gainStatus ? (
              <span className={cn('font-medium', gainStatus === 'within' ? 'text-sage-700 dark:text-sage-300' : 'text-sand-700 dark:text-sand-300')}>
                {gainStatus === 'within' ? 'Within the typical range' : gainStatus === 'below' ? 'Below the typical range' : 'Above the typical range'}
              </span>
            ) : pre ? (
              'Add height in Settings for a range'
            ) : (
              'Add pre-pregnancy weight in Settings'
            )
          }
          icon={<Activity className="h-4 w-4" />}
        />
        <StatTile
          label="Mood (7 days)"
          value={moodAvg ? ['😞', '😕', '😐', '🙂', '😄'][Math.round(moodAvg) - 1] : '—'}
          hint={moodAvg ? `Average ${moodAvg.toFixed(1)} of 5` : 'Log your mood on the Today page'}
        />
        <StatTile
          label="Sleep (7 days)"
          value={sleepAvg ? sleepAvg.toFixed(1) : '—'}
          unit="hrs"
          hint={sleepAvg ? 'Average per night' : 'Add sleep in the daily log'}
        />
      </div>

      <Card>
        <CardHeader
          title="Weight gain"
          subtitle={
            guide && category
              ? `${BMI_LABEL[category]} pre-pregnancy BMI${profile.multiples ? ', twins' : ''}: typical total gain ${formatWeight(guide.totalMin, profile.units, 0)}–${formatWeight(guide.totalMax, profile.units, 0)}`
              : 'Add height and pre-pregnancy weight in Settings to see your personalised range.'
          }
          action={
            <Button size="sm" onClick={() => setWeightOpen(true)}>
              <Plus className="h-4 w-4" /> Log weight
            </Button>
          }
        />
        {chartData ? (
          <>
            <WeightChart data={chartData} units={profile.units} />
            <p className="mt-2 text-xs text-ink-muted">
              Shaded band shows the typical cumulative gain by week (Institute of Medicine). Your provider's advice always comes first.
            </p>
          </>
        ) : weightEntries.length === 0 ? (
          <EmptyState
            icon={<Scale className="h-5 w-5" />}
            title="No weights yet"
            description="Weigh in once a week, same time of day, for the clearest trend."
            action={
              <Button size="sm" variant="soft" onClick={() => setWeightOpen(true)}>
                Log weight
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line text-sm">
            {weightEntries
              .slice(-8)
              .toReversed()
              .map((e) => (
                <li key={e.date} className="flex justify-between py-2">
                  <span className="text-ink-muted">{formatMedium(e.date)}</span>
                  <span className="font-medium">{formatWeight(e.weightKg!, profile.units)}</span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Water this week" subtitle={`Goal ${profile.waterGoal} glasses a day`} />
          <WaterChart data={waterData} goal={profile.waterGoal} />
        </Card>
        <Card>
          <CardHeader title="Symptoms, last 30 days" subtitle="Days each symptom was logged" />
          {symptomData.length ? (
            <SymptomChart data={symptomData} />
          ) : (
            <EmptyState
              title="Nothing logged yet"
              description="Tap symptoms on the Today page and trends will appear here."
              action={
                <Link to="/track">
                  <Button size="sm" variant="soft">
                    Open daily log
                  </Button>
                </Link>
              }
            />
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Footprints className="h-5 w-5 text-rose-500" /> Kick counter
              </span>
            }
            subtitle={
              week < 28
                ? 'Most providers suggest daily counts from 28 weeks.'
                : 'Lie on your side after a meal and count movements. Ten in two hours is typical.'
            }
          />
          {activeKick ? (
            <div className="text-center">
              <p className="text-6xl font-semibold tabular-nums">{activeKick.count}</p>
              <p className="text-sm text-ink-muted">kicks · {fmtDuration(kickNow - new Date(activeKick.startedAt).getTime())}</p>
              <div className="mt-4 flex justify-center gap-2">
                <Button size="lg" onClick={() => addKick(today, activeKick.id)} className="min-w-[160px]">
                  <Plus className="h-5 w-5" /> Kick
                </Button>
                <Button size="lg" variant="secondary" onClick={() => endKickSession(today, activeKick.id)}>
                  <Square className="h-4 w-4" /> Finish
                </Button>
              </div>
              {activeKick.count >= 10 && (
                <Badge tone="sage" className="mt-3">
                  Ten movements reached. You can finish whenever you like.
                </Badge>
              )}
            </div>
          ) : (
            <div className="text-center">
              <Button size="lg" onClick={() => startKickSession(today)}>
                <Play className="h-4 w-4" /> Start a session
              </Button>
            </div>
          )}
          {recentKicks.length > 0 && (
            <ul className="mt-5 divide-y divide-line text-sm">
              {recentKicks.map((k) => (
                <li key={k.id} className="flex items-center justify-between py-2">
                  <span className="text-ink-muted">{formatMedium(k.date)}</span>
                  <span>
                    <span className="font-medium">{k.count} kicks</span> in {fmtDuration(new Date(k.endedAt!).getTime() - new Date(k.startedAt).getTime())}
                  </span>
                  <button type="button" aria-label="Delete session" onClick={() => deleteKickSession(k.date, k.id)} className="text-ink-muted hover:text-ink">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-xs text-ink-muted">
            A noticeable drop in your baby's usual pattern should always be checked promptly with your maternity unit.
          </p>
        </Card>

        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Timer className="h-5 w-5 text-rose-500" /> Contraction timer
              </span>
            }
            subtitle="Tap start when one begins and stop when it eases."
            action={
              contractions.length > 0 && (
                <Button variant="ghost" size="sm" onClick={clearContractions}>
                  Clear
                </Button>
              )
            }
          />
          <div className="text-center">
            {activeContraction ? (
              <>
                <p className="text-5xl font-semibold tabular-nums">{fmtDuration(contractionNow - new Date(activeContraction.startedAt).getTime())}</p>
                <Button size="lg" variant="secondary" className="mt-3" onClick={() => endContraction(activeContraction.id)}>
                  <Square className="h-4 w-4" /> Contraction ended
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={() => startContraction()}>
                <Play className="h-4 w-4" /> Contraction started
              </Button>
            )}
          </div>
          {contractionStats && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div className="well p-3">
                <p className="text-xs text-ink-muted">Avg duration</p>
                <p className="text-lg font-semibold tabular-nums">{fmtDuration(contractionStats.duration)}</p>
              </div>
              <div className="well p-3">
                <p className="text-xs text-ink-muted">Avg interval</p>
                <p className="text-lg font-semibold tabular-nums">{fmtDuration(contractionStats.interval)}</p>
              </div>
            </div>
          )}
          {show511 && (
            <div className="mt-3 rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900 dark:bg-rose-900/30 dark:text-rose-100">
              Contractions are about 5 minutes apart and lasting a minute or more. This is a common point to call your maternity unit.
            </div>
          )}
          {recentContractions.length > 0 && (
            <ul className="mt-4 divide-y divide-line text-sm">
              {recentContractions.map((c, i) => {
                const next = recentContractions[i + 1]
                const interval = next ? new Date(c.startedAt).getTime() - new Date(next.startedAt).getTime() : null
                return (
                  <li key={c.id} className="flex items-center justify-between py-2 tabular-nums">
                    <span className="text-ink-muted">{new Date(c.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{c.endedAt ? fmtDuration(new Date(c.endedAt).getTime() - new Date(c.startedAt).getTime()) : 'in progress'}</span>
                    <span className="text-ink-muted">{interval !== null ? `${fmtDuration(interval)} apart` : ''}</span>
                    <button type="button" aria-label="Delete contraction" onClick={() => deleteContraction(c.id)} className="text-ink-muted hover:text-ink">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>

      <Modal open={weightOpen} onClose={() => setWeightOpen(false)} title="Log weight" size="sm">
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            saveWeight()
          }}
        >
          <Field label={`Weight (${profile.units === 'metric' ? 'kg' : 'lb'})`} htmlFor="w-val">
            <Input
              id="w-val"
              type="number"
              inputMode="decimal"
              step="0.1"
              min={30}
              max={300}
              value={weightInput}
              onChange={(e) => setWeightInput(e.target.value)}
              autoFocus
              required
            />
          </Field>
          <Field label="Date" htmlFor="w-date">
            <Input id="w-date" type="date" value={weightDate} max={today} onChange={(e) => setWeightDate(e.target.value)} required />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setWeightOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
