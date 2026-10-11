import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Leaf, Moon, Shield, Sun, Trash2, Upload } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'
import { Field, Input, Select } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { Switch } from '@/components/ui/Switch'
import { ConfirmModal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { useProfileStore } from '@/store/profile'
import { clearAllData, createBackup, restoreBackup, validateBackup } from '@/store/backup'
import { dueDateFromLMP, lmpFromDueDate } from '@/lib/pregnancy'
import { isValidISODate, formatLong, todayISO } from '@/lib/dates'
import { cmToIn, inToCm, kgToLb, lbToKg } from '@/lib/weight'
import { notificationPermission, requestNotificationPermission } from '@/lib/notifications'
import type { DietTag, ThemePreference, Units } from '@/types'
import { toast } from '@/store/ui'

const DIETS: { id: DietTag; label: string }[] = [
  { id: 'vegetarian', label: 'Vegetarian' },
  { id: 'vegan', label: 'Vegan' },
  { id: 'gluten-free', label: 'Gluten-free' },
  { id: 'dairy-free', label: 'Dairy-free' },
  { id: 'nut-free', label: 'Nut-free' },
]

function exportData() {
  const blob = new Blob([JSON.stringify(createBackup(), null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `bloom-backup-${todayISO()}.json`
  a.click()
  URL.revokeObjectURL(url)
  toast({ title: 'Backup downloaded', description: 'Keep it somewhere safe. You can restore it on any device.', tone: 'success' })
}

async function importData(file: File) {
  try {
    const parsed: unknown = JSON.parse(await file.text())
    if (!validateBackup(parsed)) throw new Error('Not a Bloom backup file')
    restoreBackup(parsed)
    toast({ title: 'Backup restored', tone: 'success' })
  } catch (err) {
    toast({ title: 'Could not import', description: err instanceof Error ? err.message : 'Unknown error', tone: 'warning' })
  }
}

export default function Settings() {
  const navigate = useNavigate()
  const profile = useProfileStore((s) => s.profile)!
  const updateProfile = useProfileStore((s) => s.updateProfile)
  const fileRef = useRef<HTMLInputElement>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [dueDate, setDueDate] = useState(profile.dueDate)
  const [lmp, setLmp] = useState(lmpFromDueDate(profile.dueDate))
  const metric = profile.units === 'metric'

  function toggleDiet(id: DietTag) {
    let next = profile.diet.includes(id) ? profile.diet.filter((x) => x !== id) : [...profile.diet, id]
    if (next.includes('vegan')) next = Array.from(new Set([...next, 'vegetarian', 'dairy-free'])) as DietTag[]
    updateProfile({ diet: next })
  }

  async function setNotifications(on: boolean) {
    if (!on) return updateProfile({ notificationsEnabled: false })
    const result = await requestNotificationPermission()
    updateProfile({ notificationsEnabled: result === 'granted' })
    if (result !== 'granted') toast({ title: 'Notifications unavailable', description: 'Check your browser permission settings.', tone: 'warning' })
  }

  const permission = notificationPermission()

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Your details, preferences and data. Everything is stored only on this device." />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your pregnancy" />
          <div className="space-y-4">
            <Field label="Name" htmlFor="s-name">
              <Input id="s-name" value={profile.name} onChange={(e) => updateProfile({ name: e.target.value })} placeholder="Your first name" maxLength={40} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Due date" htmlFor="s-due" hint={isValidISODate(dueDate) ? formatLong(dueDate) : undefined}>
                <Input
                  id="s-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value)
                    if (isValidISODate(e.target.value)) {
                      updateProfile({ dueDate: e.target.value, dueDateSource: 'due-date' })
                      setLmp(lmpFromDueDate(e.target.value))
                    }
                  }}
                />
              </Field>
              <Field label="Or last period started" htmlFor="s-lmp" hint="Changing one updates the other.">
                <Input
                  id="s-lmp"
                  type="date"
                  value={lmp}
                  onChange={(e) => {
                    setLmp(e.target.value)
                    if (isValidISODate(e.target.value)) {
                      const due = dueDateFromLMP(e.target.value)
                      setDueDate(due)
                      updateProfile({ dueDate: due, dueDateSource: 'lmp' })
                    }
                  }}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-line p-4">
              <div>
                <p className="text-sm font-medium">Expecting twins or more</p>
                <p className="text-xs text-ink-muted">Adjusts weight-gain guidance.</p>
              </div>
              <Switch checked={profile.multiples} onChange={(v) => updateProfile({ multiples: v })} label="Expecting multiples" />
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Body & units" subtitle="Used for personalised weight-gain ranges." />
          <div className="space-y-4">
            <Field label="Units" htmlFor="s-units">
              <Segmented
                ariaLabel="Units"
                value={profile.units}
                onChange={(u: Units) => updateProfile({ units: u })}
                options={[
                  { value: 'metric', label: 'kg · cm' },
                  { value: 'imperial', label: 'lb · in' },
                ]}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={`Height (${metric ? 'cm' : 'in'})`} htmlFor="s-height">
                <Input
                  id="s-height"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={profile.heightCm ? (metric ? profile.heightCm : Math.round(cmToIn(profile.heightCm) * 10) / 10) : ''}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    updateProfile({ heightCm: v > 0 ? Math.round((metric ? v : inToCm(v)) * 10) / 10 : undefined })
                  }}
                  placeholder={metric ? '165' : '65'}
                />
              </Field>
              <Field label={`Pre-pregnancy weight (${metric ? 'kg' : 'lb'})`} htmlFor="s-weight">
                <Input
                  id="s-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  value={
                    profile.prePregnancyWeightKg ? (metric ? profile.prePregnancyWeightKg : Math.round(kgToLb(profile.prePregnancyWeightKg) * 10) / 10) : ''
                  }
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    updateProfile({ prePregnancyWeightKg: v > 0 ? Math.round((metric ? v : lbToKg(v)) * 10) / 10 : undefined })
                  }}
                  placeholder={metric ? '62' : '137'}
                />
              </Field>
            </div>
            <Field label="Daily water goal" htmlFor="s-water">
              <Select id="s-water" value={profile.waterGoal} onChange={(e) => updateProfile({ waterGoal: Number(e.target.value) })}>
                {[6, 7, 8, 9, 10, 11, 12].map((n) => (
                  <option key={n} value={n}>
                    {n} glasses ({(n * 0.25).toFixed(2)} L)
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Food preferences" subtitle="The meal plan only shows recipes that fit all selected diets." />
          <div className="flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip key={d.id} active={profile.diet.includes(d.id)} onClick={() => toggleDiet(d.id)}>
                <Leaf className="h-3.5 w-3.5" /> {d.label}
              </Chip>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="Appearance & notifications" />
          <div className="space-y-4">
            <Field label="Theme" htmlFor="s-theme">
              <Segmented
                ariaLabel="Theme"
                value={profile.theme}
                onChange={(t: ThemePreference) => updateProfile({ theme: t })}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </Field>
            <div className="flex items-center justify-between rounded-xl border border-line p-4">
              <div className="flex items-start gap-3">
                {profile.theme === 'dark' ? <Moon className="mt-0.5 h-5 w-5 text-rose-500" /> : <Sun className="mt-0.5 h-5 w-5 text-rose-500" />}
                <div>
                  <p className="text-sm font-medium">System notifications</p>
                  <p className="text-xs text-ink-muted">
                    {permission === 'unsupported'
                      ? 'Not supported in this browser.'
                      : permission === 'denied'
                        ? 'Blocked in browser settings.'
                        : 'For reminders while Bloom is open or installed.'}
                  </p>
                </div>
              </div>
              <Switch
                checked={profile.notificationsEnabled && permission === 'granted'}
                onChange={setNotifications}
                disabled={permission === 'unsupported' || permission === 'denied'}
                label="System notifications"
              />
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-sage-600" /> Your data
              </span>
            }
            subtitle="Bloom has no servers. Export a backup to move devices or keep a copy."
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={exportData}>
              <Download className="h-4 w-4" /> Export backup
            </Button>
            <Button variant="secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4" /> Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void importData(f)
                e.target.value = ''
              }}
            />
            <Button variant="danger" className="ml-auto" onClick={() => setResetOpen(true)}>
              <Trash2 className="h-4 w-4" /> Erase everything
            </Button>
          </div>
        </Card>
      </div>

      <p className="text-xs leading-relaxed text-ink-muted">
        Bloom provides general educational information about pregnancy and nutrition. It is not a substitute for professional medical advice, diagnosis or
        treatment. If you have any concerns about your health or your baby's, contact your care provider or maternity unit.
      </p>

      <ConfirmModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        onConfirm={() => {
          clearAllData()
          navigate('/welcome', { replace: true })
        }}
        title="Erase all data?"
        description="This permanently deletes your profile, logs, reminders, appointments and checklists from this device. Export a backup first if you might want them back."
        confirmLabel="Erase everything"
        danger
      />
    </div>
  )
}
