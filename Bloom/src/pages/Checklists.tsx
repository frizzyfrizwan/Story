import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Checkbox } from '@/components/ui/Checkbox'
import { PageHeader } from '@/components/ui/PageHeader'
import { useChecklistStore } from '@/store/checklists'
import { usePregnancy } from '@/hooks/usePregnancy'
import { CHECKLISTS } from '@/data/checklists'
import { cn } from '@/lib/cn'

export default function Checklists() {
  const preg = usePregnancy()
  const week = preg?.ga.guideWeek ?? 1
  const checked = useChecklistStore((s) => s.checked)
  const customItems = useChecklistStore((s) => s.customItems)
  const { toggle, addCustom, removeCustom } = useChecklistStore()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [showUpcoming, setShowUpcoming] = useState(false)

  const groups = CHECKLISTS.map((g) => ({ ...g, items: [...g.items, ...(customItems[g.id] ?? [])], upcoming: !!g.fromWeek && week < g.fromWeek }))
  const visible = groups.filter((g) => showUpcoming || !g.upcoming)
  const hiddenCount = groups.length - groups.filter((g) => !g.upcoming).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Checklists"
        subtitle="Trimester to-dos, the hospital bag and newborn essentials. Add your own items anywhere."
        action={
          hiddenCount > 0 && (
            <Button variant="secondary" size="sm" onClick={() => setShowUpcoming((s) => !s)}>
              {showUpcoming ? 'Hide' : 'Show'} {hiddenCount} upcoming
            </Button>
          )
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {visible.map((g) => {
          const done = g.items.filter((i) => checked[i.id]).length
          const pct = g.items.length ? (done / g.items.length) * 100 : 0
          return (
            <Card key={g.id} className={cn(g.upcoming && 'opacity-80')}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {g.title}
                    {g.upcoming && <Badge tone="sand">From week {g.fromWeek}</Badge>}
                    {pct === 100 && <Badge tone="sage">Complete</Badge>}
                  </span>
                }
                subtitle={g.description}
                action={
                  <span className="text-sm tabular-nums text-ink-muted">
                    {done}/{g.items.length}
                  </span>
                }
              />
              <div
                className="mb-3 h-1.5 overflow-hidden rounded-full bg-sage-100 dark:bg-sage-900/40"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${g.title} progress`}
              >
                <div className="h-full rounded-full bg-sage-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="divide-y divide-line">
                {g.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox className="flex-1" checked={!!checked[item.id]} onChange={() => toggle(item.id)} label={item.label} hint={item.hint} />
                    {item.id.startsWith('custom-') && (
                      <button
                        type="button"
                        aria-label={`Remove ${item.label}`}
                        onClick={() => removeCustom(g.id, item.id)}
                        className="text-ink-muted hover:text-ink"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  const label = (drafts[g.id] ?? '').trim()
                  if (!label) return
                  addCustom(g.id, label)
                  setDrafts((d) => ({ ...d, [g.id]: '' }))
                }}
              >
                <Input
                  value={drafts[g.id] ?? ''}
                  onChange={(e) => setDrafts((d) => ({ ...d, [g.id]: e.target.value }))}
                  placeholder="Add your own item"
                  maxLength={120}
                  aria-label={`Add item to ${g.title}`}
                />
                <Button type="submit" variant="secondary" aria-label="Add item">
                  <Plus className="h-4 w-4" />
                </Button>
              </form>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
