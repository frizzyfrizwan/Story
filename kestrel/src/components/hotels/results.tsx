"use client";

import { RotateCw, SlidersHorizontal, Wallet, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { ProgramLogo } from "@/components/art";
import { Badge, SourceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { focusRing } from "@/components/ui/tokens";
import { HOTEL_PROGRAMS } from "@/data/hotel-programs";
import { loginHref } from "@/lib/client/api";
import type { HotelProperty } from "@/lib/types";
import { cn, fmtCompact, fmtInt } from "@/lib/utils";
import { CityThumb } from "./hotel-art";
import { HotelCard, HotelCardSkeleton } from "./hotel-card";
import {
  COMPARE_MAX,
  EMPTY_FILTERS,
  SORT_OPTIONS,
  TIER_LABEL,
  activeFilterCount,
  applyFilters,
  fmtNights,
  hotelSearchHref,
  nightsOf,
  pointsCeiling,
  programShort,
  sortResults,
  stayLabel,
  toggleIn,
  type CitySuggestion,
  type HotelFilters,
  type HotelResult,
  type HotelSearchParams,
  type HotelSearchResult,
  type HotelSort,
} from "./model";

const LABEL = "font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle";

// ─── Filters ──────────────────────────────────────────────────

interface FiltersPanelProps {
  filters: HotelFilters;
  onChange: (next: HotelFilters) => void;
  results: HotelResult[];
}

function countBy<T extends string | number>(results: HotelResult[], pick: (r: HotelResult) => T): Map<T, number> {
  const m = new Map<T, number>();
  for (const r of results) m.set(pick(r), (m.get(pick(r)) ?? 0) + 1);
  return m;
}

function ToggleChip({
  pressed,
  disabled,
  onClick,
  children,
}: {
  pressed: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1 rounded-full border px-3 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
        pressed
          ? "border-signal/40 bg-signal-soft text-fg"
          : "border-panel-border bg-bg-elev-1 text-fg-muted hover:border-panel-border-strong hover:text-fg",
        focusRing,
      )}
    >
      {children}
    </button>
  );
}

function FiltersPanel({ filters, onChange, results }: FiltersPanelProps) {
  const byProgram = countBy(results, (r) => r.program.id);
  const byTier = countBy(results, (r) => r.property.tier);
  const byStars = countBy(results, (r) => r.property.stars);
  const ceiling = pointsCeiling(results);
  const sliderValue = Math.min(filters.maxPointsPerNight ?? ceiling, ceiling);
  const active = activeFilterCount(filters);

  return (
    <div className="flex flex-col gap-6">
      <fieldset>
        <legend className={LABEL}>Program</legend>
        <ul className="mt-2 flex flex-col">
          {HOTEL_PROGRAMS.map((p) => {
            const count = byProgram.get(p.id) ?? 0;
            const checked = filters.programs.includes(p.id);
            return (
              <li key={p.id}>
                <label
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2.5 rounded-[8px] px-1 text-sm text-fg transition-colors hover:bg-fg/5",
                    count === 0 && !checked && "cursor-not-allowed opacity-45",
                  )}
                >
                  <Checkbox
                    size="sm"
                    checked={checked}
                    disabled={count === 0 && !checked}
                    onCheckedChange={() => onChange({ ...filters, programs: toggleIn(filters.programs, p.id) })}
                  />
                  <ProgramLogo id={p.id} name={p.name} color={p.color} size={20} />
                  <span className="flex-1 truncate">{programShort(p)}</span>
                  <span className="font-mono text-xs tnum text-fg-subtle">{count}</span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>Tier</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(TIER_LABEL) as HotelProperty["tier"][]).map((t) => (
            <ToggleChip
              key={t}
              pressed={filters.tiers.includes(t)}
              disabled={(byTier.get(t) ?? 0) === 0 && !filters.tiers.includes(t)}
              onClick={() => onChange({ ...filters, tiers: toggleIn(filters.tiers, t) })}
            >
              {TIER_LABEL[t]}
              <span className="font-mono text-[11px] tnum text-fg-subtle">{byTier.get(t) ?? 0}</span>
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className={LABEL}>Stars</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {([5, 4, 3] as const).map((s) => (
            <ToggleChip
              key={s}
              pressed={filters.stars.includes(s)}
              disabled={(byStars.get(s) ?? 0) === 0 && !filters.stars.includes(s)}
              onClick={() => onChange({ ...filters, stars: toggleIn(filters.stars, s) })}
            >
              <span className="font-mono tnum">{s}</span>
              <span className="text-gold" aria-hidden="true">
                ★
              </span>
              <span className="sr-only">star</span>
            </ToggleChip>
          ))}
        </div>
      </fieldset>

      <Slider
        label="Max points / night"
        min={5_000}
        max={ceiling}
        step={5_000}
        value={[sliderValue]}
        formatValue={(v) => (v >= ceiling ? "Any" : fmtCompact(v))}
        onValueChange={([v]) => onChange({ ...filters, maxPointsPerNight: v >= ceiling ? null : v })}
      />

      <div className="flex flex-col divide-y divide-panel-border border-y border-panel-border">
        <Switch
          size="sm"
          label="5th night free only"
          description="Stays where a night was waived"
          checked={filters.fifthNightOnly}
          onCheckedChange={(v) => onChange({ ...filters, fifthNightOnly: v })}
        />
        <Switch
          size="sm"
          label="Available only"
          description="Hide sold-out dates"
          checked={filters.availableOnly}
          onCheckedChange={(v) => onChange({ ...filters, availableOnly: v })}
        />
      </div>

      {active > 0 && (
        <Button variant="ghost" size="sm" leading={<X />} onClick={() => onChange(EMPTY_FILTERS)} className="self-start">
          Clear {active} {active === 1 ? "filter" : "filters"}
        </Button>
      )}
    </div>
  );
}

// ─── Empty states ─────────────────────────────────────────────

function CitySuggestions({ cities, onPick }: { cities: CitySuggestion[]; onPick: (city: string) => void }) {
  if (!cities.length) return null;
  return (
    <ul className="mt-6 grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {cities.map((c) => (
        <li key={c.name}>
          <button
            type="button"
            onClick={() => onPick(c.name)}
            className={cn(
              "flex w-full items-center gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-2 pr-3 text-left transition-colors hover:border-panel-border-strong hover:bg-bg-elev-2",
              focusRing,
            )}
          >
            <CityThumb name={c.name} art={c.art} className="w-16" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{c.name}</span>
              <span className="block truncate text-xs text-fg-subtle">
                {c.distanceMiles != null && <span className="font-mono tnum">{fmtInt(c.distanceMiles)} mi · </span>}
                {c.hotelCount} {c.hotelCount === 1 ? "hotel" : "hotels"}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Results ──────────────────────────────────────────────────

export interface HotelResultsProps {
  query: HotelSearchParams;
  data: HotelSearchResult | undefined;
  /** No data yet — first load for this query. */
  loading: boolean;
  /** Background refresh (new dates/city) while older data stays on screen. */
  fetching: boolean;
  error: string | null;
  signedIn: boolean;
  compareIds: string[];
  onToggleCompare: (result: HotelResult) => void;
  onPickCity: (city: string) => void;
  onTryOtherDates: () => void;
  onRetry: () => void;
}

/** Controls (sort, filters), count line and the card grid, plus every empty state. */
export function HotelResults({
  query,
  data,
  loading,
  fetching,
  error,
  signedIn,
  compareIds,
  onToggleCompare,
  onPickCity,
  onTryOtherDates,
  onRetry,
}: HotelResultsProps) {
  const [sort, setSort] = useState<HotelSort>("value");
  const [filters, setFilters] = useState<HotelFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  const results = useMemo(() => data?.results ?? [], [data]);
  const visible = useMemo(() => sortResults(applyFilters(results, filters), sort), [results, filters, sort]);
  const activeFilters = activeFilterCount(filters);
  const nights = nightsOf(query);
  const cityName = data?.city?.name ?? query.city;
  const wallet = data?.wallet ?? { signedIn, hasBalances: false };

  const walletHint = !wallet.signedIn ? (
    <>
      <a href={loginHref(hotelSearchHref(query))} className="font-medium text-fg underline-offset-4 hover:underline">
        Sign in
      </a>{" "}
      to see which of these you can book with the points you hold.
    </>
  ) : !wallet.hasBalances ? (
    <>
      <a href="/wallet" className="font-medium text-fg underline-offset-4 hover:underline">
        Add your balances
      </a>{" "}
      and every card will tell you whether you can book it.
    </>
  ) : null;

  let body: ReactNode;
  if (error) {
    body = (
      <EmptyState
        title="The search hit turbulence"
        description={error}
        action={
          <Button leading={<RotateCw />} onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  } else if (loading) {
    body = (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading hotels">
        {Array.from({ length: 6 }, (_, i) => (
          <HotelCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (results.length === 0) {
    body = (
      <EmptyState
        title={`No award hotels in “${query.city}” yet`}
        description={
          data?.city
            ? "Every property we track in this city is a points play, but none are listed here yet. These are the nearest cities with award hotels."
            : "We couldn't match that to a city we cover. Try one of these instead, or search by airport code."
        }
      >
        <CitySuggestions cities={data?.nearby ?? []} onPick={onPickCity} />
      </EmptyState>
    );
  } else if (visible.length === 0) {
    body = (
      <EmptyState
        compact
        title="Nothing matches these filters"
        description={`${results.length} ${results.length === 1 ? "hotel" : "hotels"} in ${cityName} are hidden by your filters.`}
        action={
          <Button variant="secondary" leading={<X />} onClick={() => setFilters(EMPTY_FILTERS)}>
            Clear filters
          </Button>
        }
      />
    );
  } else {
    body = (
      <ul
        className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity duration-200", fetching && "opacity-60")}
        aria-busy={fetching || undefined}
      >
        {visible.map((r, i) => {
          const selected = compareIds.includes(r.property.id);
          return (
            <li key={r.property.id} className="min-w-0">
              <HotelCard
                result={r}
                stay={query}
                index={i}
                compare={{
                  selected,
                  disabled: !selected && compareIds.length >= COMPARE_MAX,
                  onToggle: () => onToggleCompare(r),
                }}
                onTryOtherDates={onTryOtherDates}
              />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-6">
      <aside className="hidden lg:block" aria-label="Filters">
        <div className="sticky top-24 rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 p-4 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-tight text-fg">Filters</h2>
            {activeFilters > 0 && (
              <Badge variant="signal" size="sm">
                {activeFilters}
              </Badge>
            )}
          </div>
          <FiltersPanel filters={filters} onChange={setFilters} results={results} />
        </div>
      </aside>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-fg-muted">
              {loading ? (
                <span>Pricing hotels in {query.city}…</span>
              ) : (
                <>
                  <span>
                    <span className="font-medium text-fg">
                      {visible.length} {visible.length === 1 ? "hotel" : "hotels"}
                    </span>
                    {visible.length !== results.length && ` of ${results.length}`} in{" "}
                    <span className="text-fg">{cityName}</span>
                  </span>
                  <span aria-hidden="true" className="text-fg-faint">
                    ·
                  </span>
                  <span className="font-mono text-[13px] tnum">{stayLabel(query, { short: true })}</span>
                  <span aria-hidden="true" className="text-fg-faint">
                    ·
                  </span>
                  <span>{fmtNights(nights)}</span>
                  {data && <SourceBadge source={data.source} />}
                </>
              )}
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            leading={<SlidersHorizontal />}
            className="lg:hidden"
            onClick={() => setSheetOpen(true)}
          >
            Filters
            {activeFilters > 0 && (
              <Badge variant="signal" size="sm">
                {activeFilters}
              </Badge>
            )}
          </Button>
          <Select<HotelSort>
            value={sort}
            onValueChange={setSort}
            options={SORT_OPTIONS}
            size="sm"
            aria-label="Sort hotels"
            className="w-44"
          />
        </div>

        {walletHint && !loading && results.length > 0 && (
          <p className="mt-3 flex items-start gap-2 text-[13px] text-fg-subtle">
            <Wallet className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>{walletHint}</span>
          </p>
        )}

        <div className="mt-4">{body}</div>
      </div>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="right"
          title="Filters"
          eyebrow={`${results.length} hotels`}
          footer={
            <Button onClick={() => setSheetOpen(false)} className="w-full sm:w-auto">
              Show {visible.length} {visible.length === 1 ? "hotel" : "hotels"}
            </Button>
          }
        >
          <FiltersPanel filters={filters} onChange={setFilters} results={results} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
