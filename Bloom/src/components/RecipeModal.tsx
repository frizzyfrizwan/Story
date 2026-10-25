import { Clock, Flame, Leaf } from 'lucide-react'
import type { Recipe } from '@/types'
import { Modal } from './ui/Modal'
import { Badge } from './ui/Chip'
import { NUTRIENT_INFO } from '@/data/nutrients'

export function RecipeModal({ recipe, onClose }: { recipe: Recipe | null; onClose: () => void }) {
  return (
    <Modal open={!!recipe} onClose={onClose} title={recipe?.name ?? ''} description={recipe?.description} size="lg">
      {recipe && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-3 text-sm text-ink-secondary">
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" /> {recipe.prepMinutes} min
            </span>
            <span className="flex items-center gap-1">
              <Flame className="h-4 w-4" /> {recipe.calories} kcal
            </span>
            {recipe.tags.map((t) => (
              <Badge key={t} tone="neutral">
                <Leaf className="mr-1 h-3 w-3" /> {t}
              </Badge>
            ))}
          </div>
          <div className="rounded-xl bg-sage-50 p-4 text-sm text-sage-900 dark:bg-sage-900/30 dark:text-sage-100">
            <p className="font-medium">Why it helps</p>
            <p className="mt-0.5">{recipe.benefit}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {recipe.nutrients.map((n) => (
                <Badge key={n} tone="sage">
                  {NUTRIENT_INFO[n].label}
                </Badge>
              ))}
            </div>
          </div>
          <div className="grid gap-6 sm:grid-cols-[1fr_1.4fr]">
            <div>
              <h3 className="mb-2 font-semibold">Ingredients</h3>
              <ul className="space-y-1.5 text-sm">
                {recipe.ingredients.map((i) => (
                  <li key={i.item} className="flex justify-between gap-2 border-b border-line pb-1.5 last:border-0">
                    <span>{i.item}</span>
                    <span className="shrink-0 text-ink-muted">{i.qty}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Method</h3>
              <ol className="space-y-2.5 text-sm">
                {recipe.steps.map((s, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-100 text-xs font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{s}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
