import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Info, RefreshCw, Search, ShieldCheck, ShoppingBasket } from 'lucide-react'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge, Chip } from '@/components/ui/Chip'
import { Input } from '@/components/ui/Field'
import { Modal } from '@/components/ui/Modal'
import { Segmented } from '@/components/ui/Segmented'
import { Checkbox } from '@/components/ui/Checkbox'
import { PageHeader } from '@/components/ui/PageHeader'
import { MealCard } from '@/components/MealCard'
import { RecipeModal } from '@/components/RecipeModal'
import { useMealPlan } from '@/hooks/useMealPlan'
import { usePregnancy } from '@/hooks/usePregnancy'
import { useMealStore } from '@/store/meals'
import { useLogStore } from '@/store/logs'
import { useProfileStore } from '@/store/profile'
import { RECIPES } from '@/data/recipes'
import { FOOD_SAFETY } from '@/data/foodSafety'
import { NUTRIENT_INFO } from '@/data/nutrients'
import { getWeekGuide } from '@/data/weeks'
import { groceryList, recipeMatchesDiet, SLOT_LABEL } from '@/lib/mealPlan'
import { formatMedium, formatShort, shiftISO, todayISO } from '@/lib/dates'
import { TRIMESTER_LABEL } from '@/lib/pregnancy'
import type { GroceryCategory, MealSlot, Recipe } from '@/types'
import { cn } from '@/lib/cn'
import { toast } from '@/store/ui'

type Tab = 'plan' | 'groceries' | 'safety'
const CATEGORY_ORDER: GroceryCategory[] = ['produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other']
const NONE: string[] = []
const CATEGORY_LABEL: Record<GroceryCategory, string> = {
  produce: 'Produce',
  protein: 'Meat, fish & protein',
  dairy: 'Dairy & alternatives',
  grains: 'Grains & bread',
  pantry: 'Pantry',
  frozen: 'Frozen',
  other: 'Other',
}

export default function Meals() {
  const preg = usePregnancy()
  const today = preg?.today ?? todayISO()
  const profile = useProfileStore((s) => s.profile)!
  const [anchor, setAnchor] = useState(today)
  const [tab, setTab] = useState<Tab>('plan')
  const [selectedDate, setSelectedDate] = useState(today)
  const plan = useMealPlan(anchor)
  const { reshuffle, swap, clearSwap, toggleGrocery, clearGrocery, toggleFavourite } = useMealStore()
  const favourites = useMealStore((s) => s.favourites)
  const groceryChecked = useMealStore((s) => s.groceryChecked[plan.weekKey]) ?? NONE
  const logs = useLogStore((s) => s.logs)
  const toggleMealEaten = useLogStore((s) => s.toggleMealEaten)
  const [openRecipe, setOpenRecipe] = useState<Recipe | null>(null)
  const [swapping, setSwapping] = useState<{ date: string; slot: MealSlot } | null>(null)
  const [query, setQuery] = useState('')

  const activeDate = plan.dates.includes(selectedDate) ? selectedDate : plan.dates.includes(today) ? today : plan.dates[0]
  const day = plan.byDate[activeDate]
  const guide = getWeekGuide(preg?.ga.guideWeek ?? 1)

  const groceries = useMemo(() => {
    const recipes = plan.days.flatMap((d) => d.meals.map((m) => m.recipe)).filter((r): r is Recipe => !!r)
    const unique = Array.from(new Map(recipes.map((r) => [r.id, r])).values())
    return groceryList(unique)
  }, [plan])
  const groceryGroups = useMemo(() => {
    const groups = new Map<GroceryCategory, typeof groceries>()
    for (const line of groceries) groups.set(line.category, [...(groups.get(line.category) ?? []), line])
    return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => [c, groups.get(c)!] as const)
  }, [groceries])

  const swapCandidates = useMemo(() => {
    if (!swapping) return []
    const q = query.trim().toLowerCase()
    return RECIPES.filter(
      (r) =>
        r.slots.includes(swapping.slot) &&
        recipeMatchesDiet(r, profile.diet) &&
        (!q || r.name.toLowerCase().includes(q) || r.nutrients.some((n) => NUTRIENT_INFO[n].label.toLowerCase().includes(q))),
    ).toSorted((a, b) => Number(favourites.includes(b.id)) - Number(favourites.includes(a.id)))
  }, [swapping, query, profile.diet, favourites])

  const weekNutrients = useMemo(() => {
    const counts = new Map<string, number>()
    for (const d of plan.days) for (const m of d.meals) for (const n of m.recipe?.nutrients ?? []) counts.set(n, (counts.get(n) ?? 0) + 1)
    return Array.from(counts.entries())
      .toSorted((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [plan])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Meal plan"
        subtitle={`Nutrient-focused recipes for the ${TRIMESTER_LABEL[preg?.ga.trimester ?? 2].toLowerCase()}${profile.diet.length ? ` · ${profile.diet.join(', ')}` : ''}.`}
        action={
          <Segmented
            ariaLabel="Meal views"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'plan', label: 'Plan' },
              { value: 'groceries', label: 'Groceries' },
              { value: 'safety', label: 'Food safety' },
            ]}
          />
        }
      />

      {tab !== 'safety' && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Previous week" onClick={() => setAnchor((a) => shiftISO(a, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-sm font-medium">
              {formatShort(plan.dates[0])} – {formatShort(plan.dates[6])}
            </span>
            <Button variant="secondary" size="icon" aria-label="Next week" onClick={() => setAnchor((a) => shiftISO(a, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!plan.dates.includes(today) && (
              <Button variant="soft" size="sm" onClick={() => setAnchor(today)}>
                This week
              </Button>
            )}
          </div>
          {tab === 'plan' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                reshuffle(plan.weekKey)
                toast({ title: 'New plan generated', description: 'Your manual swaps were kept.' })
              }}
            >
              <RefreshCw className="h-4 w-4" /> Shuffle week
            </Button>
          )}
        </div>
      )}

      {tab === 'plan' && (
        <>
          <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Days">
            {plan.dates.map((d) => {
              const eaten = (logs[d]?.mealsEaten ?? []).length
              return (
                <button
                  key={d}
                  type="button"
                  role="tab"
                  aria-selected={d === activeDate}
                  onClick={() => setSelectedDate(d)}
                  className={cn(
                    'flex min-w-[76px] flex-1 flex-col items-center rounded-xl border px-2 py-2.5 text-sm transition-colors',
                    d === activeDate
                      ? 'border-rose-600 bg-rose-600 text-white'
                      : d === today
                        ? 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200'
                        : 'border-line hover:border-rose-200',
                  )}
                >
                  <span className="text-[11px] uppercase tracking-wide opacity-80">{formatMedium(d).slice(0, 3)}</span>
                  <span className="font-semibold">{Number(d.slice(8))}</span>
                  {eaten > 0 && <span className={cn('mt-1 h-1 w-1 rounded-full', d === activeDate ? 'bg-white' : 'bg-sage-500')} />}
                </button>
              )
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {day?.meals.map((m) => (
              <MealCard
                key={m.slot}
                slot={m.slot}
                recipe={m.recipe}
                swapped={m.swapped}
                eaten={m.recipe ? (logs[activeDate]?.mealsEaten ?? []).includes(m.recipe.id) : false}
                onToggleEaten={m.recipe && activeDate <= today ? () => toggleMealEaten(activeDate, m.recipe!.id) : undefined}
                onOpen={() => setOpenRecipe(m.recipe)}
                onSwap={() => {
                  setQuery('')
                  setSwapping({ date: activeDate, slot: m.slot })
                }}
                favourite={m.recipe ? favourites.includes(m.recipe.id) : false}
                onFavourite={m.recipe ? () => toggleFavourite(m.recipe!.id) : undefined}
              />
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="This week's focus" subtitle={`What week ${guide.week} asks for and how often the plan delivers it.`} />
              <ul className="space-y-3">
                {guide.nutritionFocus.map((n) => (
                  <li key={n} className="text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{NUTRIENT_INFO[n].label}</span>
                      <Badge tone="sage">{weekNutrients.find(([k]) => k === n)?.[1] ?? 0} meals</Badge>
                    </div>
                    <p className="text-ink-secondary">{NUTRIENT_INFO[n].why}</p>
                  </li>
                ))}
              </ul>
            </Card>
            <Card>
              <CardHeader title="How the plan works" />
              <ul className="space-y-2 text-sm text-ink-secondary">
                <li className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> Recipes rotate so nothing repeats within a week, and the plan is stable until you
                  shuffle or swap.
                </li>
                <li className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> First-trimester plans lean on ginger and bland, easy foods; third-trimester plans
                  favour smaller, fibre-rich portions.
                </li>
                <li className="flex gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" /> Every recipe follows pregnancy food-safety rules: fully cooked eggs and meat,
                  pasteurised dairy, low-mercury fish.
                </li>
              </ul>
            </Card>
          </div>
        </>
      )}

      {tab === 'groceries' && (
        <Card>
          <CardHeader
            title={
              <span className="flex items-center gap-2">
                <ShoppingBasket className="h-5 w-5 text-rose-500" /> Grocery list
              </span>
            }
            subtitle={`${groceryChecked.length} of ${groceries.length} items ticked · generated from this week's plan`}
            action={
              groceryChecked.length > 0 && (
                <Button variant="ghost" size="sm" onClick={() => clearGrocery(plan.weekKey)}>
                  Reset
                </Button>
              )
            }
          />
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {groceryGroups.map(([category, lines]) => (
              <div key={category}>
                <p className="label mb-1">{CATEGORY_LABEL[category]}</p>
                <div className="divide-y divide-line">
                  {lines.map((line) => (
                    <Checkbox
                      key={line.key}
                      checked={groceryChecked.includes(line.key)}
                      onChange={() => toggleGrocery(plan.weekKey, line.key)}
                      label={line.item}
                      hint={`${line.quantities.join(' + ')} · ${line.recipes.length} recipe${line.recipes.length === 1 ? '' : 's'}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'safety' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-sand-200 bg-sand-50 p-4 text-sm text-sand-900 dark:border-sand-800 dark:bg-sand-900/20 dark:text-sand-100">
            <p className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" /> General guidance
            </p>
            <p className="mt-1">Recommendations vary slightly between countries. When in doubt, ask your provider or dietitian.</p>
          </div>
          {(['avoid', 'limit', 'caution'] as const).map((level) => (
            <Card key={level}>
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    <AlertTriangle className={cn('h-5 w-5', level === 'avoid' ? 'text-red-500' : level === 'limit' ? 'text-sand-500' : 'text-ink-muted')} />
                    {level === 'avoid' ? 'Avoid' : level === 'limit' ? 'Limit' : 'Use caution'}
                  </span>
                }
              />
              <ul className="divide-y divide-line">
                {FOOD_SAFETY.filter((f) => f.level === level).map((f) => (
                  <li key={f.id} className="py-3 text-sm">
                    <p className="font-medium">{f.name}</p>
                    <p className="text-ink-secondary">{f.reason}</p>
                    {f.alternative && <p className="mt-0.5 text-xs text-sage-700 dark:text-sage-300">Try instead: {f.alternative}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      )}

      <RecipeModal recipe={openRecipe} onClose={() => setOpenRecipe(null)} />

      <Modal
        open={!!swapping}
        onClose={() => setSwapping(null)}
        title={swapping ? `Swap ${SLOT_LABEL[swapping.slot].toLowerCase()}` : ''}
        description={swapping ? formatMedium(swapping.date) : undefined}
        size="lg"
      >
        {swapping && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or nutrient…"
                className="pl-9"
                autoFocus
                aria-label="Search recipes"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                onClick={() => {
                  clearSwap(swapping.date, swapping.slot)
                  setSwapping(null)
                }}
              >
                Reset to suggested
              </Chip>
            </div>
            <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
              {swapCandidates.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      swap(swapping.date, swapping.slot, r.id)
                      setSwapping(null)
                      toast({ title: 'Meal swapped', description: r.name, tone: 'success' })
                    }}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-line p-3 text-left hover:border-rose-300 hover:bg-rose-50/40 dark:hover:bg-rose-900/10"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {favourites.includes(r.id) && <span aria-label="Favourite">♥ </span>}
                        {r.name}
                      </p>
                      <p className="line-clamp-1 text-xs text-ink-muted">{r.description}</p>
                    </div>
                    <span className="shrink-0 text-xs text-ink-muted">
                      {r.prepMinutes} min · {r.calories} kcal
                    </span>
                  </button>
                </li>
              ))}
              {swapCandidates.length === 0 && <li className="py-6 text-center text-sm text-ink-muted">No recipes match.</li>}
            </ul>
          </div>
        )}
      </Modal>
    </div>
  )
}
