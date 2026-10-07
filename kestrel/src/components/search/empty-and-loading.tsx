"use client";

/**
 * Loading, idle, error and empty states for the results column. Every suggestion in the empty
 * state is a real link, so a dead end is one click from a new search.
 */

import { ArrowRight, Bell, CalendarDays, Keyboard, MapPin, RotateCcw, Sparkles } from "lucide-react";
import Link from "next/link";
import { Button, EmptyState, Kbd, Skeleton, SkeletonCard } from "@/components/ui";
import { getAirport } from "@/data/airports";
import type { Cabin } from "@/lib/types";
import { CABINS, CABIN_LABEL } from "@/lib/types";
import { cn, fmtDate } from "@/lib/utils";
import { DEFAULT_FILTERS, searchHref, type SearchState } from "./search-params";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

// ─── Loading ────────────────────────────────────────────────────

export function ResultsSkeleton({ count = 4, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-4", className)} aria-busy="true" aria-label="Loading results">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} variant="boarding-pass" />
      ))}
    </div>
  );
}

export function FormSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("panel panel-strong p-4 sm:p-5", className)} aria-hidden="true">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(13rem,0.7fr)] md:items-end">
        <div>
          <Skeleton className="h-3 w-10" />
          <Skeleton className="mt-2 h-11 w-full" />
        </div>
        <Skeleton className="mx-auto size-9 rounded-full md:mb-1" />
        <div>
          <Skeleton className="h-3 w-6" />
          <Skeleton className="mt-2 h-11 w-full" />
        </div>
        <div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-2 h-11 w-full" />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Skeleton className="h-10 w-72 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="ml-auto h-11 w-32 rounded-full" />
      </div>
    </div>
  );
}

// ─── Idle (no route yet) ────────────────────────────────────────

const EXAMPLES: { label: string; href: string }[] = [
  { label: "JFK → LHR · Business", href: "/search?from=JFK&to=LHR&cabin=business&flex=3" },
  { label: "NYC → TYO · First", href: "/search?from=NYC&to=TYO&cabin=first&flex=3" },
  { label: "LAX → SYD · Business", href: "/search?from=LAX&to=SYD&cabin=business&flex=3" },
  { label: "SFO → SIN · Business", href: "/search?from=SFO&to=SIN&cabin=business" },
  { label: "ORD → CDG · Premium", href: "/search?from=ORD&to=PAR&cabin=premium" },
];

export function SearchIdle() {
  return (
    <EmptyState
      title="Where to?"
      description="Pick an origin and a destination above, or describe the trip in plain language. We search every program that can book the flight and show the fewest points first."
      className="py-12"
    >
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {EXAMPLES.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-1 px-3.5 font-mono text-xs text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
              focusRing,
            )}
          >
            {e.label}
            <ArrowRight className="size-3.5 text-fg-subtle" aria-hidden="true" />
          </Link>
        ))}
      </div>
      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-fg-subtle">
        <Keyboard className="size-3.5" aria-hidden="true" />
        Press <Kbd>/</Kbd> to jump to the search form
      </p>
    </EmptyState>
  );
}

// ─── Error ──────────────────────────────────────────────────────

export function SearchError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <EmptyState
      illustration="none"
      icon={<RotateCcw />}
      title="The search did not come back"
      description={message}
      action={
        <Button variant="secondary" onClick={onRetry} leading={<RotateCcw aria-hidden="true" />}>
          Try again
        </Button>
      }
    />
  );
}

// ─── Empty ──────────────────────────────────────────────────────

interface Suggestion {
  key: string;
  label: string;
  hint: string;
  href: string;
}

function metroFor(code: string): string | null {
  const a = getAirport(code);
  return a?.metro && a.metro !== code ? a.metro : null;
}

/** Real links that widen the search: ±3 days, metro expansions, other cabins. */
export function emptySuggestions(state: SearchState): Suggestion[] {
  const { query } = state;
  const out: Suggestion[] = [];
  const base: SearchState = { ...state, filters: { ...DEFAULT_FILTERS, sort: state.filters.sort } };

  if (query.flexDays < 3) {
    out.push({
      key: "flex",
      label: "Widen to ±3 days",
      hint: `${fmtDate(query.date)} ±3`,
      href: searchHref({ ...base, query: { ...query, flexDays: 3 } }),
    });
  } else if (query.flexDays < 7) {
    out.push({ key: "flex7", label: "Widen to ±7 days", hint: "a full week either side", href: searchHref({ ...base, query: { ...query, flexDays: 7 } }) });
  }

  const originMetro = query.origin.length === 1 ? metroFor(query.origin[0]) : null;
  const destMetro = query.destination.length === 1 ? metroFor(query.destination[0]) : null;
  if (originMetro || destMetro) {
    const origin = originMetro ? [originMetro] : query.origin;
    const destination = destMetro ? [destMetro] : query.destination;
    out.push({
      key: "metro",
      label: `Try all ${[originMetro, destMetro].filter(Boolean).join(" and ")} airports`,
      hint: `${origin.join("/")} → ${destination.join("/")}`,
      href: searchHref({ ...base, query: { ...query, origin, destination } }),
    });
  }

  for (const cabin of CABINS as readonly Cabin[]) {
    if (cabin === query.cabin) continue;
    out.push({
      key: `cabin-${cabin}`,
      label: `Look in ${CABIN_LABEL[cabin]}`,
      hint: cabin === "economy" ? "most seats" : cabin === "first" ? "fewest seats, best product" : "",
      href: searchHref({ ...base, query: { ...query, cabin } }),
    });
  }
  return out;
}

export function NoResults({ state, filtered, onClearFilters, onAlert }: { state: SearchState; filtered: boolean; onClearFilters: () => void; onAlert: () => void }) {
  const suggestions = emptySuggestions(state);
  if (filtered) {
    return (
      <EmptyState
        compact
        illustration="none"
        icon={<RotateCcw />}
        title="Nothing matches these filters"
        description="There is award space on this route — the filters are hiding it."
        action={
          <Button variant="secondary" onClick={onClearFilters} leading={<RotateCcw aria-hidden="true" />}>
            Clear filters
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      title="No award space found for these dates"
      description={`Nothing bookable for ${state.query.origin.join("/")} → ${state.query.destination.join("/")} in ${CABIN_LABEL[state.query.cabin].toLowerCase()} on ${fmtDate(state.query.date)}${state.query.flexDays ? ` ±${state.query.flexDays}` : ""}. Award seats open and close daily — try a wider net or let us watch it.`}
      action={
        <Button variant="primary" onClick={onAlert} leading={<Bell aria-hidden="true" />}>
          Alert me when seats open
        </Button>
      }
    >
      <ul className="mt-6 grid w-full max-w-2xl gap-2 text-left sm:grid-cols-2">
        {suggestions.map((s) => (
          <li key={s.key}>
            <Link
              href={s.href}
              className={cn(
                "group flex h-full items-center gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 px-4 py-3 transition-colors hover:border-panel-border-strong hover:bg-bg-elev-2",
                focusRing,
              )}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bg-elev-2 text-fg-subtle group-hover:text-signal [&_svg]:size-4">
                {s.key.startsWith("flex") ? <CalendarDays aria-hidden="true" /> : s.key === "metro" ? <MapPin aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-fg">{s.label}</span>
                {s.hint && <span className="block truncate font-mono text-[11px] text-fg-subtle">{s.hint}</span>}
              </span>
              <ArrowRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </EmptyState>
  );
}
