"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import type { Alliance, ChartType, ProgramKind } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { ProgramCard } from "./program-card";
import { ALLIANCE_META, CHART_META, KIND_META, KIND_ORDER, SURCHARGE_META, type ProgramSummary, type SurchargeLevel } from "./program-meta";

type AllianceFilter = "all" | Alliance;
type ChartFilter = "all" | ChartType;
type SurchargeFilter = "all" | SurchargeLevel;
type KindFilter = "all" | ProgramKind;
type Sort = "valuation" | "name" | "sweet-spots" | "partners";

const SORTS: { value: Sort; label: string; description: string }[] = [
  { value: "valuation", label: "Valuation", description: "Highest cents per point first" },
  { value: "sweet-spots", label: "Sweet spots", description: "Most documented plays first" },
  { value: "partners", label: "Transfer partners", description: "Most banks feeding it first" },
  { value: "name", label: "Name", description: "A → Z" },
];

export function ProgramIndex({ programs }: { programs: ProgramSummary[] }) {
  const [query, setQuery] = useState("");
  const q = useDeferredValue(query.trim().toLowerCase());
  const [kind, setKind] = useState<KindFilter>("all");
  const [alliance, setAlliance] = useState<AllianceFilter>("all");
  const [chart, setChart] = useState<ChartFilter>("all");
  const [surcharge, setSurcharge] = useState<SurchargeFilter>("all");
  const [sort, setSort] = useState<Sort>("valuation");

  const filtered = useMemo(() => {
    const list = programs.filter((p) => {
      if (kind !== "all" && p.kind !== kind) return false;
      if (alliance !== "all" && (p.kind !== "airline" || (p.alliance ?? "none") !== alliance)) return false;
      if (chart !== "all" && p.chartType !== chart) return false;
      if (surcharge !== "all" && p.surcharges !== surcharge) return false;
      if (q && !`${p.name} ${p.shortName} ${p.currency} ${p.id}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const cmp: Record<Sort, (a: ProgramSummary, b: ProgramSummary) => number> = {
      valuation: (a, b) => b.valuationCpp - a.valuationCpp || a.name.localeCompare(b.name),
      name: (a, b) => a.name.localeCompare(b.name),
      "sweet-spots": (a, b) => b.sweetSpots - a.sweetSpots || a.name.localeCompare(b.name),
      partners: (a, b) => b.banks.length - a.banks.length || a.name.localeCompare(b.name),
    };
    return list.sort(cmp[sort]);
  }, [programs, kind, alliance, chart, surcharge, q, sort]);

  const groups = KIND_ORDER.map((k) => ({ kind: k, items: filtered.filter((p) => p.kind === k) })).filter((g) => g.items.length);
  const active = [kind, alliance, chart, surcharge].filter((v) => v !== "all").length + (q ? 1 : 0);

  const reset = () => {
    setQuery("");
    setKind("all");
    setAlliance("all");
    setChart("all");
    setSurcharge("all");
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="sticky top-16 z-30 -mx-4 bg-bg/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search programs, currencies…"
            aria-label="Search programs"
            wrapperClassName="lg:max-w-xs"
            size="sm"
          />
          <SegmentedControl<KindFilter>
            value={kind}
            onChange={setKind}
            size="sm"
            aria-label="Program kind"
            options={[
              { value: "all", label: "All" },
              { value: "bank", label: "Banks" },
              { value: "airline", label: "Airlines" },
              { value: "hotel", label: "Hotels" },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
            <Select<AllianceFilter>
              value={alliance}
              onValueChange={setAlliance}
              size="sm"
              aria-label="Alliance"
              className="w-[11rem]"
              options={[
                { value: "all", label: "Any alliance" },
                ...(Object.keys(ALLIANCE_META) as Alliance[]).map((a) => ({ value: a, label: ALLIANCE_META[a].label })),
              ]}
            />
            <Select<ChartFilter>
              value={chart}
              onValueChange={setChart}
              size="sm"
              aria-label="Chart type"
              className="w-[11rem]"
              options={[
                { value: "all", label: "Any chart" },
                ...(Object.keys(CHART_META) as ChartType[]).map((c) => ({ value: c, label: CHART_META[c].label, description: CHART_META[c].hint })),
              ]}
            />
            <Select<SurchargeFilter>
              value={surcharge}
              onValueChange={setSurcharge}
              size="sm"
              aria-label="Surcharges"
              className="w-[11rem]"
              options={[
                { value: "all", label: "Any surcharges" },
                ...(Object.keys(SURCHARGE_META) as SurchargeLevel[]).map((s) => ({ value: s, label: SURCHARGE_META[s].label })),
              ]}
            />
            <Select<Sort>
              value={sort}
              onValueChange={setSort}
              size="sm"
              aria-label="Sort"
              className="w-[11rem]"
              options={SORTS.map((s) => ({ value: s.value, label: `Sort: ${s.label}`, description: s.description }))}
            />
            {active > 0 && (
              <Button variant="ghost" size="sm" onClick={reset} leading={<SlidersHorizontal />}>
                Clear {active}
              </Button>
            )}
          </div>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="No programs match"
          description="Loosen a filter — every currency Kestrel prices is in here somewhere."
          action={
            <Button variant="secondary" onClick={reset}>
              Clear filters
            </Button>
          }
        />
      ) : (
        groups.map((g) => (
          <section key={g.kind} aria-labelledby={`programs-${g.kind}`}>
            <div className="mb-4 flex items-baseline gap-3">
              <h2 id={`programs-${g.kind}`} className="font-display text-2xl tracking-tight text-fg">
                {KIND_META[g.kind].plural}
              </h2>
              <span className="font-mono text-xs tnum text-fg-subtle">{g.items.length}</span>
              <span className="hairline flex-1 self-center" aria-hidden="true" />
            </div>
            <ul className={cn("grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4")}>
              {g.items.map((p) => (
                <li key={p.id} className="animate-rise">
                  <ProgramCard program={p} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
