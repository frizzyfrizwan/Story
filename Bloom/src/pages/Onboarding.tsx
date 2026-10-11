import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell, Check, Leaf, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Chip'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { DEFAULT_PROFILE, useProfileStore } from '@/store/profile'
import { useReminderStore } from '@/store/reminders'
import { REMINDER_TEMPLATES } from '@/data/reminderTemplates'
import { dueDateFromConception, dueDateFromLMP, gestationalAge, formatGA, GESTATION_DAYS } from '@/lib/pregnancy'
import { isValidISODate, todayISO, formatLong, shiftISO } from '@/lib/dates'
import { inToCm, lbToKg } from '@/lib/weight'
import { requestNotificationPermission } from '@/lib/notifications'
import type { DietTag, Profile, Units } from '@/types'
import { cn } from '@/lib/cn'

type Method = Profile['dueDateSource']
const DIETS: { id: DietTag; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'nut-free', label: 'Nut-free' },
]

const STEPS = ['Welcome', 'Your dates', 'About you', 'Food', 'Reminders'] as const

export default function Onboarding() {
  const navigate = useNavigate()
  const setProfile = useProfileStore((s) => s.setProfile)
  const existing = useProfileStore((s) => s.profile)
  const addFromTemplate = useReminderStore((s) => s.addFromTemplate)
  const reminders = useReminderStore((s) => s.reminders)

  const [step, setStep] = useState(0)
  const [method, setMethod] = useState<Method>('due-date')
  const [dateInput, setDateInput] = useState('')
  const [name, setName] = useState(existing?.name ?? '')
  const [units, setUnits] = useState<Units>(existing?.units ?? 'metric')
  const [height, setHeight] = useState('')
  const [heightIn, setHeightIn] = useState('')
  const [weight, setWeight] = useState('')
  const [multiples, setMultiples] = useState(false)
  const [diet, setDiet] = useState<DietTag[]>(existing?.diet ?? [])
  const [waterGoal, setWaterGoal] = useState(8)
  const [notify, setNotify] = useState(false)
  const [seedTemplates, setSeedTemplates] = useState<string[]>(['prenatal-vitamin', 'morning-water', 'journal'])
  const today = todayISO()

  const dueDate = useMemo(() => {
    if (!isValidISODate(dateInput)) return null
    if (method === 'due-date') return dateInput
    if (method === 'lmp') return dueDateFromLMP(dateInput)
    return dueDateFromConception(dateInput)
  }, [dateInput, method])

  const dateError = useMemo(() => {
    if (!dateInput) return undefined
    if (!dueDate) return 'Enter a valid date'
    const ga = gestationalAge(dueDate, today)
    if (ga.totalDays < -14) return 'That due date is more than 42 weeks away. Double-check it?'
    if (ga.totalDays > GESTATION_DAYS + 21) return 'That date is more than three weeks past a typical due date.'
    return undefined
  }, [dueDate, dateInput, today])

  const canContinue = step !== 1 || (!!dueDate && !dateError)

  function toggleDiet(id: DietTag) {
    setDiet((d) => {
      let next = d.includes(id) ? d.filter((x) => x !== id) : [...d, id]
      // Vegan implies vegetarian and dairy-free; keep the selection coherent.
      if (next.includes('vegan')) next = Array.from(new Set([...next, 'vegetarian', 'dairy-free'])) as DietTag[]
      return next
    })
  }

  async function finish() {
    if (!dueDate) return
    let notificationsEnabled = false
    if (notify) notificationsEnabled = (await requestNotificationPermission()) === 'granted'

    const heightCm =
      units === 'metric' ? Number(height) || undefined : height || heightIn ? inToCm(Number(height || 0) * 12 + Number(heightIn || 0)) : undefined
    const weightKg = weight ? (units === 'metric' ? Number(weight) : lbToKg(Number(weight))) : undefined

    const profile: Profile = {
      ...DEFAULT_PROFILE,
      ...existing,
      name: name.trim(),
      dueDate,
      dueDateSource: method,
      heightCm: heightCm && heightCm > 0 ? Math.round(heightCm * 10) / 10 : undefined,
      prePregnancyWeightKg: weightKg && weightKg > 0 ? Math.round(weightKg * 10) / 10 : undefined,
      multiples,
      diet,
      waterGoal,
      units,
      notificationsEnabled,
      onboardedAt: new Date().toISOString(),
    }
    setProfile(profile)
    if (reminders.length === 0) {
      for (const t of REMINDER_TEMPLATES) if (seedTemplates.includes(t.id)) addFromTemplate(t)
    }
    navigate('/', { replace: true })
  }

  const preview = dueDate && !dateError ? gestationalAge(dueDate, today) : null

  return (
    <div className="min-h-dvh bg-gradient-to-b from-rose-50 via-surface to-surface dark:from-rose-950/30">
      <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 py-8 sm:py-14">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-rose-600 text-white shadow-soft">
              <Sparkles className="h-4 w-4" />
            </span>
            <span className="font-display text-2xl font-semibold tracking-tight">Bloom</span>
          </div>
          <ol className="flex gap-1.5" aria-label="Progress">
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? 'step' : undefined}
                className={cn('h-1.5 rounded-full transition-all', i <= step ? 'w-6 bg-rose-600' : 'w-3 bg-rose-200 dark:bg-rose-900/50')}
              />
            ))}
          </ol>
        </div>

        <div className="card flex-1 p-6 sm:p-8 animate-fade-up" key={step}>
          {step === 0 && (
            <div className="space-y-5">
              <p className="label">Welcome</p>
              <h1 className="text-4xl font-semibold leading-tight">A calm companion for the next nine months.</h1>
              <p className="text-ink-secondary">
                Bloom turns your due date into a day-by-day guide: what is happening with your baby, gentle reminders, a meal plan built around what your body
                needs now, and simple tracking that makes appointments easier.
              </p>
              <ul className="space-y-2 text-sm text-ink-secondary">
                {[
                  'Everything stays on this device. No account, no cloud, no tracking.',
                  'Export your data any time from Settings.',
                  'General guidance only. Your care provider always has the final say.',
                ].map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-sage-600" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <p className="label">Your dates</p>
              <h1 className="text-3xl font-semibold leading-tight">When is baby due?</h1>
              <Segmented
                ariaLabel="Date method"
                value={method}
                onChange={(m) => {
                  setMethod(m)
                  setDateInput('')
                }}
                options={[
                  { value: 'due-date', label: 'Due date' },
                  { value: 'lmp', label: 'Last period' },
                  { value: 'conception', label: 'Conception' },
                ]}
                className="w-full justify-between"
              />
              <Field
                label={method === 'due-date' ? 'Estimated due date' : method === 'lmp' ? 'First day of your last period' : 'Conception or transfer date'}
                htmlFor="date"
                error={dateError}
                hint={
                  method === 'lmp'
                    ? 'We add 40 weeks (280 days).'
                    : method === 'conception'
                      ? 'We add 38 weeks (266 days).'
                      : 'From your provider or a dating scan.'
                }
              >
                <Input
                  id="date"
                  type="date"
                  value={dateInput}
                  onChange={(e) => setDateInput(e.target.value)}
                  min={method === 'due-date' ? shiftISO(today, -21) : shiftISO(today, -300)}
                  max={method === 'due-date' ? shiftISO(today, 300) : today}
                  required
                />
              </Field>
              {preview && dueDate && (
                <div className="well p-4 text-sm">
                  <p className="font-medium text-ink">Due {formatLong(dueDate)}</p>
                  <p className="text-ink-secondary mt-0.5">{preview.totalDays < 0 ? 'Very early days.' : `You are ${formatGA(preview)} pregnant today.`}</p>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="label">About you</p>
              <h1 className="text-3xl font-semibold leading-tight">A few details for better guidance</h1>
              <p className="text-sm text-ink-secondary">Everything here is optional. Height and weight unlock personalised weight-gain ranges.</p>
              <Field label="What should we call you?" htmlFor="name">
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" autoComplete="given-name" />
              </Field>
              <Field label="Units" htmlFor="units">
                <Segmented
                  ariaLabel="Units"
                  value={units}
                  onChange={setUnits}
                  options={[
                    { value: 'metric', label: 'kg · cm' },
                    { value: 'imperial', label: 'lb · ft' },
                  ]}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                {units === 'metric' ? (
                  <Field label="Height" htmlFor="height" hint="cm">
                    <Input
                      id="height"
                      type="number"
                      inputMode="decimal"
                      min={100}
                      max={230}
                      value={height}
                      onChange={(e) => setHeight(e.target.value)}
                      placeholder="165"
                    />
                  </Field>
                ) : (
                  <Field label="Height" htmlFor="height" hint="ft and in">
                    <div className="flex gap-2">
                      <Input
                        id="height"
                        type="number"
                        inputMode="numeric"
                        min={3}
                        max={7}
                        value={height}
                        onChange={(e) => setHeight(e.target.value)}
                        placeholder="5"
                        aria-label="feet"
                      />
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={11}
                        value={heightIn}
                        onChange={(e) => setHeightIn(e.target.value)}
                        placeholder="5"
                        aria-label="inches"
                      />
                    </div>
                  </Field>
                )}
                <Field label="Pre-pregnancy weight" htmlFor="weight" hint={units === 'metric' ? 'kg' : 'lb'}>
                  <Input
                    id="weight"
                    type="number"
                    inputMode="decimal"
                    min={30}
                    max={300}
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    placeholder={units === 'metric' ? '62' : '137'}
                  />
                </Field>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div>
                  <p className="text-sm font-medium">Expecting twins or more</p>
                  <p className="text-xs text-ink-muted">Adjusts weight-gain guidance.</p>
                </div>
                <Switch checked={multiples} onChange={setMultiples} label="Expecting multiples" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <p className="label">Food</p>
              <h1 className="text-3xl font-semibold leading-tight">How do you like to eat?</h1>
              <p className="text-sm text-ink-secondary">Your meal plan only shows recipes that fit. Change this any time.</p>
              <div className="flex flex-wrap gap-2">
                {DIETS.map((d) => (
                  <Chip key={d.id} active={diet.includes(d.id)} onClick={() => toggleDiet(d.id)}>
                    <Leaf className="h-3.5 w-3.5" /> {d.label}
                  </Chip>
                ))}
              </div>
              <Field label="Daily water goal" htmlFor="water" hint="Glasses of 250 ml. Most guidance suggests 8–10 in pregnancy.">
                <Select id="water" value={waterGoal} onChange={(e) => setWaterGoal(Number(e.target.value))}>
                  {[6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} glasses ({(n * 0.25).toFixed(2)} L)
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <p className="label">Reminders</p>
              <h1 className="text-3xl font-semibold leading-tight">Gentle nudges, your way</h1>
              <p className="text-sm text-ink-secondary">Start with a few essentials. You can add, edit or silence any of them later.</p>
              <div className="space-y-2">
                {REMINDER_TEMPLATES.filter((t) => !t.fromWeek).map((t) => {
                  const on = seedTemplates.includes(t.id)
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSeedTemplates((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-colors',
                        on ? 'border-rose-400 bg-rose-50/60 dark:bg-rose-900/20' : 'border-line hover:border-rose-200',
                      )}
                      aria-pressed={on}
                    >
                      <span>
                        <span className="block text-sm font-medium">{t.title}</span>
                        <span className="block text-xs text-ink-muted">{t.note}</span>
                      </span>
                      <span
                        className={cn('grid h-6 w-6 place-items-center rounded-full border', on ? 'border-rose-600 bg-rose-600 text-white' : 'border-line')}
                      >
                        {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                      </span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-line p-4">
                <div className="flex items-start gap-3">
                  <Bell className="mt-0.5 h-5 w-5 text-rose-500" />
                  <div>
                    <p className="text-sm font-medium">Browser notifications</p>
                    <p className="text-xs text-ink-muted">Reminders pop up while Bloom is open or installed.</p>
                  </div>
                </div>
                <Switch checked={notify} onChange={setNotify} label="Enable notifications" />
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <Button variant="ghost" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button size="lg" onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Continue <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="lg" onClick={finish} disabled={!dueDate}>
              Open my dashboard <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
