import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Airline, Airport, Cabin } from "@/lib/types";
import { cn, fmtInt, fmtUsd } from "@/lib/utils";
import { AirlineTail } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/tokens";

export interface PricingSampleCell {
  miles: number;
  taxesUsd: number;
  peak?: "off-peak" | "standard" | "peak";
  basis: "chart" | "dynamic" | "estimate";
}

export interface PricingSampleRow {
  origin: Airport;
  destination: Airport;
  carrier: Airline;
  distanceMiles: number;
  cells: Record<Extract<Cabin, "economy" | "business" | "first">, PricingSampleCell | null>;
}

const CABINS: { key: "economy" | "business" | "first"; label: string; code: string; tone: string }[] = [
  { key: "economy", label: "Economy", code: "Y", tone: "text-cabin-economy" },
  { key: "business", label: "Business", code: "J", tone: "text-cabin-business" },
  { key: "first", label: "First", code: "F", tone: "text-cabin-first" },
];

/** Server-safe pricing table for marquee routes. Rows the chart cannot price are omitted by the caller. */
export function PricingSamples({
  rows,
  programId,
  date,
  className,
}: {
  rows: PricingSampleRow[];
  programId: string;
  date: string;
  className?: string;
}) {
  const estimated = rows.some((r) => Object.values(r.cells).some((c) => c?.basis === "estimate"));
  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius)] border border-panel-border bg-bg-elev-1", className)}>
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-panel-border-strong font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">
            <th scope="col" className="px-4 py-3 text-left font-medium">Route</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Carrier</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Distance</th>
            {CABINS.map((c) => (
              <th key={c.key} scope="col" className="px-4 py-3 text-right font-medium">
                <span className={c.tone}>{c.code}</span> {c.label}
              </th>
            ))}
            <th scope="col" className="px-2 py-3">
              <span className="sr-only">Search</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={`${r.origin.iata}-${r.destination.iata}`} className="border-b border-panel-border last:border-b-0 hover:bg-fg/[0.03]">
              <td className="px-4 py-3">
                <div className="font-mono tnum text-[15px] font-medium tracking-[0.06em] text-fg">
                  {r.origin.iata}
                  <span className="mx-1.5 text-fg-faint">–</span>
                  {r.destination.iata}
                </div>
                <div className="text-xs text-fg-subtle">
                  {r.origin.city} → {r.destination.city}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center gap-2">
                  <AirlineTail code={r.carrier.iata} color={r.carrier.color} size={24} showCode={false} />
                  <span className="text-fg-muted">{r.carrier.name}</span>
                </span>
              </td>
              <td className="px-4 py-3 text-right font-mono tnum text-fg-muted">{fmtInt(r.distanceMiles)} mi</td>
              {CABINS.map((c) => {
                const cell = r.cells[c.key];
                return (
                  <td key={c.key} className="px-4 py-3 text-right align-top">
                    {cell ? (
                      <div>
                        <div className="font-mono tnum text-fg">{fmtInt(cell.miles)}</div>
                        <div className="font-mono tnum text-[11px] text-fg-subtle">
                          + {fmtUsd(cell.taxesUsd)}
                          {cell.peak && cell.peak !== "standard" && (
                            <span className={cn("ml-1", cell.peak === "peak" ? "text-rose" : "text-aurora")}>{cell.peak}</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-fg-faint">—</span>
                    )}
                  </td>
                );
              })}
              <td className="px-2 py-3 text-right">
                <Link
                  href={`/search?from=${r.origin.iata}&to=${r.destination.iata}&cabin=business&date=${date}&programs=${programId}`}
                  aria-label={`Search ${r.origin.iata} to ${r.destination.iata} awards`}
                  className={cn("inline-grid size-8 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-fg/8 hover:text-signal", focusRing)}
                >
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center gap-2 border-t border-panel-border px-4 py-2.5 text-xs text-fg-subtle">
        <span>One-way, one passenger, priced for {date} from the program&apos;s published chart.</span>
        {estimated && (
          <Badge variant="gold" size="sm" caps>
            estimate
          </Badge>
        )}
      </div>
    </div>
  );
}
