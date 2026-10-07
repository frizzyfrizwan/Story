"use client";

/**
 * Result filters — a left rail on desktop, a bottom sheet on phones. Every control reads from the
 * same `ResultFilters` and applies instantly on the client; counts answer "what would I see?".
 */

import { ListFilter, RotateCcw, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { AirlineTail, ProgramLogo } from "@/components/art";
import { Badge, Button, Checkbox, SegmentedControl, Sheet, SheetClose, SheetContent, SheetTrigger, Slider, Switch } from "@/components/ui";
import { getAirline } from "@/data/airlines";
import { getProgram } from "@/data/programs";
import { loginHref } from "@/lib/client/api";
import { clamp, cn } from "@/lib/utils";
import { fmtK, type Facets } from "./derive";
import { DEPARTURE_LABEL, DEPARTURE_WINDOWS, type DepartureWindow, type ResultFilters, type StopsFilter } from "./search-params";

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

export interface FiltersProps {
  filters: ResultFilters;
  facets: Facets;
  activeCount: number;
  resultCount: number;
  wallet: { signedIn: boolean; hasBalances: boolean };
  onChange: (patch: Partial<ResultFilters>) => void;
  onReset: () => void;
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2.5 flex w-full items-baseline justify-between font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">
        <span>{title}</span>
        {hint && <span className="normal-case tracking-normal">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

const MILES_STEP = 5_000;

export function FilterControls({ filters, facets, wallet, onChange }: Pick<FiltersProps, "filters" | "facets" | "wallet" | "onChange">) {
  const [allPrograms, setAllPrograms] = useState(false);
  const programs = allPrograms ? facets.programs : facets.programs.slice(0, 8);
  const hiddenPrograms = facets.programs.length - programs.length;

  const milesMin = facets.miles ? Math.floor(facets.miles.min / MILES_STEP) * MILES_STEP : 0;
  const milesMaxRaw = facets.miles ? Math.ceil(facets.miles.max / MILES_STEP) * MILES_STEP : 0;
  const milesMax = Math.max(milesMaxRaw, milesMin + MILES_STEP);
  const milesValue = clamp(filters.maxMiles ?? milesMax, milesMin, milesMax);

  return (
    <div className="flex flex-col gap-7">
      <Group title="Programs" hint={filters.programs.length ? `${filters.programs.length} selected` : "any"}>
        {facets.programs.length === 0 ? (
          <p className="text-xs text-fg-subtle">Programs appear once results load.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {programs.map(({ id, count }) => {
              const p = getProgram(id);
              const active = filters.programs.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange({ programs: toggle(filters.programs, id) })}
                  className={cn(
                    "inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-xs font-medium transition-colors",
                    active ? "border-signal/50 bg-signal-soft text-fg" : "border-panel-border bg-bg-elev-1 text-fg-muted hover:border-panel-border-strong hover:text-fg",
                    count === 0 && !active && "opacity-50",
                    focusRing,
                  )}
                >
                  <ProgramLogo id={id} name={p?.name ?? id} color={p?.color} size={22} />
                  <span className="truncate">{p?.shortName ?? id}</span>
                  <span className="font-mono text-[10.5px] tnum text-fg-subtle">{count}</span>
                </button>
              );
            })}
            {hiddenPrograms > 0 && (
              <button type="button" onClick={() => setAllPrograms(true)} className={cn("h-8 rounded-full px-2.5 text-xs text-fg-subtle hover:text-fg", focusRing)}>
                +{hiddenPrograms} more
              </button>
            )}
          </div>
        )}
      </Group>

      <Group title="Max miles" hint={filters.maxMiles == null ? "no cap" : fmtK(filters.maxMiles)}>
        <Slider
          label="Max miles"
          showValue={false}
          min={milesMin}
          max={milesMax}
          step={1_000}
          value={[milesValue]}
          disabled={!facets.miles}
          formatValue={fmtK}
          onValueChange={([v]) => onChange({ maxMiles: v >= milesMax ? null : v })}
          className="-mb-2"
        />
        <div className="flex justify-between font-mono text-[10.5px] tnum text-fg-subtle">
          <span>{facets.miles ? fmtK(milesMin) : "—"}</span>
          <span>{facets.miles ? fmtK(milesMax) : "—"}</span>
        </div>
      </Group>

      <Group title="Stops">
        <SegmentedControl<StopsFilter>
          size="sm"
          fullWidth
          aria-label="Stops"
          value={filters.stops}
          onChange={(stops) => onChange({ stops })}
          options={[
            { value: "any", label: `Any · ${facets.stops.any}` },
            { value: "0", label: `Nonstop · ${facets.stops["0"]}` },
            { value: "1", label: `≤1 stop · ${facets.stops["1"]}` },
          ]}
        />
      </Group>

      <Group title="Airlines" hint={filters.airlines.length ? `${filters.airlines.length} selected` : "any"}>
        {facets.airlines.length === 0 ? (
          <p className="text-xs text-fg-subtle">Carriers appear once results load.</p>
        ) : (
          <ul className="-my-1 flex flex-col">
            {facets.airlines.map(({ code, count }) => {
              const a = getAirline(code);
              const checked = filters.airlines.includes(code);
              return (
                <li key={code}>
                  <label className="flex min-h-10 cursor-pointer items-center gap-3 py-1">
                    <Checkbox size="sm" checked={checked} onCheckedChange={() => onChange({ airlines: toggle(filters.airlines, code) })} aria-label={a?.name ?? code} />
                    <AirlineTail code={code} color={a?.color} size={18} showCode={false} />
                    <span className="min-w-0 flex-1 truncate text-sm text-fg">{a?.name ?? code}</span>
                    <span className="font-mono text-[11px] tnum text-fg-subtle">{count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </Group>

      <Group title="Departure">
        <div className="flex flex-wrap gap-1.5">
          {DEPARTURE_WINDOWS.map((w: DepartureWindow) => {
            const active = filters.departure === w;
            const { label, hint } = DEPARTURE_LABEL[w];
            const count = facets.departure[w];
            return (
              <button
                key={w}
                type="button"
                aria-pressed={active}
                onClick={() => onChange({ departure: w })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-colors",
                  active ? "border-signal/50 bg-signal-soft text-fg" : "border-panel-border bg-bg-elev-1 text-fg-muted hover:border-panel-border-strong hover:text-fg",
                  focusRing,
                )}
              >
                {label}
                {hint && <span className="font-mono text-[10px] tnum text-fg-subtle">{hint}</span>}
                <span className="font-mono text-[10px] tnum text-fg-subtle">{count}</span>
              </button>
            );
          })}
        </div>
      </Group>

      <Group title="Cabin & wallet">
        <div className="-my-1 flex flex-col divide-y divide-panel-border">
          <Switch
            label="Mixed cabin"
            description="Allow a lower cabin on a short leg"
            checked={filters.mixed}
            onCheckedChange={(mixed) => onChange({ mixed })}
            size="sm"
          />
          <Switch
            label="Only what I can afford"
            description={
              wallet.signedIn ? (
                wallet.hasBalances ? (
                  "Uses your balances and transfer partners"
                ) : (
                  "Add balances to your wallet first"
                )
              ) : (
                <>
                  <a href={loginHref()} className="text-sky underline-offset-2 hover:underline">
                    Sign in
                  </a>{" "}
                  to use your wallet
                </>
              )
            }
            checked={filters.afford}
            disabled={!wallet.signedIn || !wallet.hasBalances}
            onCheckedChange={(afford) => onChange({ afford })}
            size="sm"
          />
        </div>
      </Group>
    </div>
  );
}

/** Desktop: sticky left rail. */
export function FilterRail(props: FiltersProps) {
  return (
    <aside className="hidden lg:block" aria-label="Filters">
      <div className="panel sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto px-5 py-5 scrollbar-thin">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg tracking-tight text-fg">
            <ListFilter className="size-4 text-fg-subtle" aria-hidden="true" />
            Filters
            {props.activeCount > 0 && (
              <Badge variant="signal" size="sm">
                {props.activeCount}
              </Badge>
            )}
          </h2>
          {props.activeCount > 0 && (
            <Button variant="ghost" size="sm" leading={<RotateCcw aria-hidden="true" />} onClick={props.onReset}>
              Reset
            </Button>
          )}
        </div>
        <FilterControls {...props} />
      </div>
    </aside>
  );
}

/** Phones and tablets: a button in the toolbar that opens a sheet. */
export function FilterSheet(props: FiltersProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm" leading={<SlidersHorizontal aria-hidden="true" />} className="lg:hidden">
          Filters
          {props.activeCount > 0 && (
            <Badge variant="signal" size="sm">
              {props.activeCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        title="Filters"
        description={`${props.resultCount} ${props.resultCount === 1 ? "itinerary" : "itineraries"} match`}
        footer={
          <>
            <Button variant="ghost" onClick={props.onReset} disabled={props.activeCount === 0} leading={<RotateCcw aria-hidden="true" />}>
              Reset
            </Button>
            <SheetClose asChild>
              <Button variant="primary">Show {props.resultCount} results</Button>
            </SheetClose>
          </>
        }
      >
        <FilterControls {...props} />
      </SheetContent>
    </Sheet>
  );
}
