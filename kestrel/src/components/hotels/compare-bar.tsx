"use client";

import Link from "next/link";
import { ArrowUpRight, Check, Columns3, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge, ProgramChip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { focusRing } from "@/components/ui/tokens";
import { CppBar, ValueMeter, valueVerdict } from "@/components/viz/value-meter";
import { cn, fmtCpp, fmtInt, fmtUsd } from "@/lib/utils";
import { CityThumb, HotelArt, Stars } from "./hotel-art";
import { fmtNights, hotelDetailHref, programShort, stayLabel, type HotelResult, type StayParams } from "./model";

export interface CompareBarProps {
  items: HotelResult[];
  stay: StayParams;
  max: number;
  onRemove: (propertyId: string) => void;
  onClear: () => void;
}

const LABEL = "font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle";

const yes = (
  <span className="inline-flex items-center gap-1 text-aurora">
    <Check className="size-4" aria-hidden="true" />
    <span className="sr-only">Yes</span>
  </span>
);
const no = (
  <span className="inline-flex items-center gap-1 text-fg-faint">
    <X className="size-4" aria-hidden="true" />
    <span className="sr-only">No</span>
  </span>
);

function bestIndex(items: HotelResult[], pick: (r: HotelResult) => number, lowest = true): number {
  if (items.length < 2) return -1;
  let best = 0;
  items.forEach((r, i) => {
    if (lowest ? pick(r) < pick(items[best]) : pick(r) > pick(items[best])) best = i;
  });
  return best;
}

function Metric({ value, best, muted }: { value: string; best?: boolean; muted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-mono tnum", best ? "font-semibold text-aurora" : muted ? "text-fg-muted" : "text-fg")}>
      {value}
      {best && (
        <Badge variant="aurora" size="sm" caps>
          Best
        </Badge>
      )}
    </span>
  );
}

function CompareTable({
  items,
  stay,
  onRemove,
}: {
  items: HotelResult[];
  stay: StayParams;
  onRemove: (id: string) => void;
}) {
  const cheapestPoints = bestIndex(items, (r) => r.quote.totalPoints);
  const cheapestCash = bestIndex(items, (r) => r.quote.totalCashUsd);
  const bestCpp = bestIndex(items, (r) => r.quote.cpp, false);
  const amenities = Array.from(new Set(items.flatMap((r) => r.property.amenities))).sort((a, b) => a.localeCompare(b));

  const rows: { label: string; render: (r: HotelResult, i: number) => ReactNode }[] = [
    {
      label: "Program",
      render: (r) => <ProgramChip id={r.program.id} name={r.program.name} color={r.program.color} size="sm" />,
    },
    {
      label: "Award chart",
      render: (r) =>
        r.program.chartType === "category" && r.property.category ? (
          <Badge variant="violet" size="sm">
            Category {r.property.category}
          </Badge>
        ) : (
          <span className="capitalize text-fg-muted">{r.program.chartType}</span>
        ),
    },
    { label: "Stars", render: (r) => <Stars count={r.property.stars} /> },
    { label: "Points / night", render: (r) => <Metric value={fmtInt(r.quote.pointsPerNight)} /> },
    {
      label: "Total points",
      render: (r, i) => <Metric value={fmtInt(r.quote.totalPoints)} best={i === cheapestPoints} />,
    },
    { label: "Cash / night", render: (r) => <Metric value={fmtUsd(r.quote.cashPerNightUsd)} muted /> },
    {
      label: "Total cash",
      render: (r, i) => <Metric value={fmtUsd(r.quote.totalCashUsd)} best={i === cheapestCash} muted={i !== cheapestCash} />,
    },
    {
      label: "Cents per point",
      render: (r, i) => (
        <div className="flex flex-col gap-1">
          <Metric value={fmtCpp(r.quote.cpp)} best={i === bestCpp} />
          <CppBar cpp={r.quote.cpp} benchmark={r.program.valuationCpp} showLabel={false} className="max-w-[160px]" />
        </div>
      ),
    },
    {
      label: "Kestrel score",
      render: (r) => {
        const v = valueVerdict(r.quote.valueScore);
        return (
          <span className={cn("font-mono tnum", v.textClass)}>
            {r.quote.valueScore}
            <span className="text-fg-subtle">/100</span> · {v.label}
          </span>
        );
      },
    },
    { label: "5th night free", render: (r) => (r.quote.fifthNightFreeApplied ? yes : r.program.fifthNightFree ? <span className="text-xs text-fg-subtle">On 5+ nights</span> : no) },
    {
      label: "Availability",
      render: (r) =>
        r.quote.available ? (
          <Badge variant="aurora" size="sm" dot>
            Available
          </Badge>
        ) : (
          <Badge variant="rose" size="sm" dot>
            Sold out
          </Badge>
        ),
    },
    {
      label: "Transfer in from",
      render: (r) =>
        r.transfers.length ? (
          <span className="text-xs text-fg-muted">{r.transfers.map((t) => t.bankShort).join(", ")}</span>
        ) : (
          <span className="text-xs text-fg-subtle">No bank partners</span>
        ),
    },
  ];

  const cell = "border-t border-panel-border px-3 py-2.5 align-top text-sm";
  const head = "sticky left-0 z-10 bg-bg-elev-1/95 pr-4 text-left font-medium text-fg-muted";

  return (
    <div className="overflow-x-auto overscroll-x-contain px-5 pb-5 scrollbar-thin sm:px-6">
      <table className="w-full min-w-[640px] border-separate border-spacing-0">
        <caption className="sr-only">Hotel comparison</caption>
        <thead>
          <tr>
            <th scope="col" className={cn("w-40 pb-3 pr-4 text-left align-bottom", LABEL)}>
              Hotel
            </th>
            {items.map((r) => (
              <th key={r.property.id} scope="col" className="min-w-[200px] px-3 pb-3 text-left align-top font-normal">
                <div className="relative">
                  <HotelArt name={r.property.name} art={r.property.art} className="rounded-[10px]" scrim={false} />
                  <IconButton
                    label={`Remove ${r.property.name}`}
                    size="sm"
                    variant="secondary"
                    className="absolute right-2 top-2"
                    onClick={() => onRemove(r.property.id)}
                  >
                    <X />
                  </IconButton>
                </div>
                <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">{r.property.brand}</p>
                <Link
                  href={hotelDetailHref(r.property.id, { checkIn: r.quote.checkIn, checkOut: r.quote.checkOut, guests: stay.guests })}
                  className={cn("mt-0.5 block font-display text-base leading-tight text-fg hover:underline", focusRing)}
                >
                  {r.property.name}
                </Link>
                <p className="mt-0.5 font-mono text-[11px] tnum text-fg-subtle">
                  {stayLabel({ checkIn: r.quote.checkIn, checkOut: r.quote.checkOut, guests: stay.guests }, { short: true })} ·{" "}
                  {fmtNights(r.quote.nights)}
                </p>
              </th>
            ))}
          </tr>
          <tr>
            <th scope="row" className={cn(cell, head)}>
              Value
            </th>
            {items.map((r) => (
              <td key={r.property.id} className={cell}>
                <ValueMeter score={r.quote.valueScore} cpp={r.quote.cpp} benchmark={r.program.valuationCpp} size={150} />
              </td>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label}>
              <th scope="row" className={cn(cell, head)}>
                {row.label}
              </th>
              {items.map((r, i) => (
                <td key={r.property.id} className={cell}>
                  {row.render(r, i)}
                </td>
              ))}
            </tr>
          ))}
          {amenities.length > 0 && (
            <tr>
              <th scope="row" colSpan={items.length + 1} className={cn(cell, "pt-5", LABEL)}>
                Amenities
              </th>
            </tr>
          )}
          {amenities.map((a) => (
            <tr key={a}>
              <th scope="row" className={cn(cell, head, "font-normal")}>
                {a}
              </th>
              {items.map((r) => (
                <td key={r.property.id} className={cell}>
                  {r.property.amenities.includes(a) ? yes : no}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={cn(cell, head, "border-panel-border-strong")} />
            {items.map((r) => (
              <td key={r.property.id} className={cn(cell, "border-panel-border-strong")}>
                <Button
                  variant={r.quote.available ? "aurora" : "secondary"}
                  size="sm"
                  href={r.program.bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  trailing={<ArrowUpRight />}
                >
                  Book on {programShort(r.program)}
                </Button>
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/** Sticky bottom tray for the selected hotels; opens the side-by-side dialog. */
export function CompareBar({ items, stay, max, onRemove, onClear }: CompareBarProps) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;

  return (
    <>
      <div
        role="region"
        aria-label="Compare hotels"
        className="pointer-events-none fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 px-4 lg:bottom-6"
      >
        <div className="panel panel-strong pointer-events-auto mx-auto flex max-w-2xl items-center gap-3 p-2 pl-3 animate-rise">
          <ul className="flex shrink-0 -space-x-3" aria-hidden="true">
            {items.map((r) => (
              <li key={r.property.id} className="rounded-[7px] ring-2 ring-bg-elev-1">
                <CityThumb name={r.property.name} art={r.property.art} className="w-11" />
              </li>
            ))}
          </ul>
          <p className="min-w-0 flex-1 truncate text-sm text-fg-muted">
            <span className="font-medium text-fg">
              {items.length} of {max}
            </span>{" "}
            selected
            <span className="hidden sm:inline"> · {items.map((r) => r.property.name).join(" · ")}</span>
          </p>
          <Button variant="ghost" size="sm" onClick={onClear} className="hidden sm:inline-flex">
            Clear
          </Button>
          <Button size="sm" leading={<Columns3 />} disabled={items.length < 2} onClick={() => setOpen(true)}>
            Compare ({items.length})
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          size="xl"
          eyebrow="Compare"
          title="Side by side"
          description={`${stayLabel(stay)} · ${fmtNights(Math.max(1, items[0]?.quote.nights ?? 1))} · best in each row highlighted`}
          flush
        >
          <CompareTable
            items={items}
            stay={stay}
            onRemove={(id) => {
              onRemove(id);
              if (items.length <= 2) setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
