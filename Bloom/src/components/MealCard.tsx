import { Check, Clock, Flame, Heart, RefreshCw } from 'lucide-react'
import type { MealSlot, Recipe } from '@/types'
import { SLOT_LABEL } from '@/lib/mealPlan'
import { NUTRIENT_INFO } from '@/data/nutrients'
import { cn } from '@/lib/cn'
import { Badge } from './ui/Chip'

export function MealCard({
  slot,
  recipe,
  eaten,
  onToggleEaten,
  onOpen,
  onSwap,
  favourite,
  onFavourite,
  swapped,
}: {
  slot: MealSlot
  recipe: Recipe | null
  eaten?: boolean
  onToggleEaten?: () => void
  onOpen?: () => void
  onSwap?: () => void
  favourite?: boolean
  onFavourite?: () => void
  swapped?: boolean
}) {
  if (!recipe) {
    return (
      <div className="well p-4 text-sm text-ink-muted">
        <p className="label mb-1">{SLOT_LABEL[slot]}</p>No recipe matches your preferences for this slot.
      </div>
    )
  }
  return (
    <div className={cn('card group relative flex flex-col gap-2 p-4 transition-shadow hover:shadow-lift', eaten && 'border-sage-300')}>
      <div className="flex items-start justify-between gap-2">
        <p className="label">
          {SLOT_LABEL[slot]}
          {swapped && <span className="ml-1.5 normal-case tracking-normal text-rose-500">· swapped</span>}
        </p>
        <div className="flex gap-1">
          {onFavourite && (
            <button
              type="button"
              aria-label={favourite ? 'Remove from favourites' : 'Add to favourites'}
              aria-pressed={favourite}
              onClick={onFavourite}
              className="rounded-md p-1 text-ink-muted hover:text-rose-600"
            >
              <Heart className={cn('h-4 w-4', favourite && 'fill-rose-500 text-rose-500')} />
            </button>
          )}
          {onSwap && (
            <button type="button" aria-label="Swap meal" onClick={onSwap} className="rounded-md p-1 text-ink-muted hover:text-ink">
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      <button type="button" onClick={onOpen} className="text-left">
        <h3 className="font-semibold leading-snug text-ink group-hover:text-rose-700 dark:group-hover:text-rose-300">{recipe.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm text-ink-secondary">{recipe.description}</p>
      </button>
      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
        {recipe.nutrients.slice(0, 3).map((n) => (
          <Badge key={n} tone="sage">
            {NUTRIENT_INFO[n].label}
          </Badge>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" /> {recipe.prepMinutes} min
          </span>
          <span className="flex items-center gap-1">
            <Flame className="h-3.5 w-3.5" /> {recipe.calories} kcal
          </span>
        </span>
        {onToggleEaten && (
          <button
            type="button"
            onClick={onToggleEaten}
            aria-pressed={eaten}
            className={cn(
              'flex items-center gap-1 rounded-full border px-2.5 py-1 font-medium transition-colors',
              eaten ? 'border-sage-500 bg-sage-500 text-white' : 'border-line hover:border-sage-400 hover:text-ink',
            )}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={3} /> {eaten ? 'Eaten' : 'Mark eaten'}
          </button>
        )}
      </div>
    </div>
  )
}
