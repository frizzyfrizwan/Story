"use client";

/**
 * The result list: optional per-date groups (flexible searches), light virtualisation
 * (first 30, then "Show more"), stagger-in on mount.
 */

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { fmtDate, pluralize } from "@/lib/utils";
import { groupByDate, type VisibleResult } from "./derive";
import { ResultCard, type ResultCardContext } from "./result-card";

export const PAGE_SIZE = 30;

export interface ResultsProps {
  /** Already filtered and sorted. */
  items: VisibleResult[];
  /** Group by departure date (flexible searches). */
  grouped: boolean;
  /** Changing this resets pagination (e.g. a new query). */
  resetKey: string;
  context: ResultCardContext;
  /** Dim while a refetch is in flight. */
  stale?: boolean;
}

export function Results({ items, grouped, resetKey, context, stale }: ResultsProps) {
  // Reset the page when the result set changes, without an effect.
  const [page, setPage] = useState({ key: resetKey, limit: PAGE_SIZE });
  const limit = page.key === resetKey ? page.limit : PAGE_SIZE;
  const shown = items.slice(0, limit);
  const remaining = items.length - shown.length;

  const totals = new Map(groupByDate(items).map((g) => [g.date, g.items.length]));
  const groups = grouped ? groupByDate(shown) : [{ date: "", items: shown }];
  let index = 0;

  return (
    <div className={stale ? "opacity-60 transition-opacity duration-300" : "transition-opacity duration-300"} aria-busy={stale || undefined}>
      <div className="flex flex-col gap-7">
        {groups.map((g) => (
          <section key={g.date || "all"} aria-label={g.date ? fmtDate(g.date) : "Results"}>
            {grouped && (
              <h3 className="mb-3 flex items-baseline gap-2 px-1 font-display text-lg tracking-tight text-fg">
                {fmtDate(g.date)}
                <span className="font-sans text-sm font-normal text-fg-subtle">— {pluralize(totals.get(g.date) ?? g.items.length, "option")}</span>
              </h3>
            )}
            <ul className="flex flex-col gap-4">
              {g.items.map((item) => {
                const delay = Math.min(index++, 8) * 45;
                return (
                  <li key={item.id} id={`itin-${item.id}`} className="animate-rise scroll-mt-32" style={{ animationDelay: `${delay}ms` }}>
                    <ResultCard item={item} context={context} />
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {remaining > 0 && (
        <div className="mt-6 flex flex-col items-center gap-2">
          <Button variant="secondary" leading={<ChevronDown aria-hidden="true" />} onClick={() => setPage({ key: resetKey, limit: limit + PAGE_SIZE })}>
            Show {Math.min(PAGE_SIZE, remaining)} more
          </Button>
          <span className="font-mono text-[11px] tnum text-fg-subtle">
            {shown.length} of {items.length}
          </span>
        </div>
      )}
    </div>
  );
}
