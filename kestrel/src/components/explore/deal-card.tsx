"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Users, Wallet } from "lucide-react";
import { AirlineTail, CityPostcard } from "@/components/art";
import { Badge, CabinBadge, ProgramChip, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { getAirline } from "@/data/airlines";
import { getProgram } from "@/data/programs";
import type { Deal } from "@/lib/types";
import type { PaymentPlan } from "@/lib/wallet/affordability";
import { cn, fmtCompact, fmtCpp, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";
import { exploreHref, searchHref } from "./format";
import { postcardFor } from "./postcard";

export const DEAL_BADGE: Record<Deal["badge"], { label: string; variant: NonNullable<BadgeProps["variant"]> }> = {
  "sweet-spot": { label: "Sweet spot", variant: "signal" },
  "transfer-bonus": { label: "Transfer bonus", variant: "sky" },
  rare: { label: "Rare", variant: "rose" },
  "wide-open": { label: "Wide open", variant: "aurora" },
  "ai-pick": { label: "AI pick", variant: "violet" },
};

export interface DealCardProps {
  deal: Deal;
  /** Wallet plan when the "only with my points" filter is on. */
  plan?: PaymentPlan | null;
  className?: string;
}

/** Postcard-topped deal card: route in mono, program, miles + taxes, cpp, savings, up to three dates. */
export function DealCard({ deal, plan, className }: DealCardProps) {
  const art = postcardFor(deal.destination);
  const airline = getAirline(deal.carrier);
  const program = getProgram(deal.programId);
  const badge = DEAL_BADGE[deal.badge];
  const savings = Math.round(deal.savingsPct);
  const firstDate = deal.dates[0];
  const primaryHref = searchHref({ from: deal.origin, to: deal.destination, date: firstDate, cabin: deal.cabin });
  const via = plan?.transfers.map((t) => getProgram(t.from)?.shortName ?? t.from).filter(Boolean) ?? [];

  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 shadow-panel transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-panel-border-strong animate-rise",
        className,
      )}
      data-deal={deal.id}
    >
      <Link href={primaryHref} className={cn("relative block", focusRing)} aria-label={`${deal.title} — search ${firstDate ? fmtDate(firstDate) : "dates"}`}>
        <CityPostcard
          name={art.name}
          motif={art.motif}
          from={art.from}
          to={art.to}
          subtitle={art.subtitle}
          size="md"
          className="w-full aspect-[16/8] rounded-none"
        >
          <div className="flex items-start justify-between p-3">
            <Badge variant={badge.variant} size="sm" caps dot>
              {badge.label}
            </Badge>
            <CabinBadge cabin={deal.cabin} short size="sm" className="bg-bg/60 backdrop-blur" />
          </div>
        </CityPostcard>
      </Link>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-sm font-semibold tracking-wide text-fg">
            {deal.origin}
            <span className="mx-1.5 text-fg-subtle">→</span>
            {deal.destination}
          </span>
          <AirlineTail code={deal.carrier} color={airline?.color} size={22} />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono tnum text-[1.65rem] font-medium leading-none tracking-tight text-fg">
              {fmtCompact(deal.miles).toUpperCase()}
              <span className="ml-1 text-xs font-normal text-fg-subtle">miles</span>
            </div>
            <div className="mt-1.5 font-mono text-[11px] tnum text-fg-muted">
              + {fmtUsd(deal.taxesUsd)} taxes · {fmtCpp(deal.cpp)}/pt
            </div>
          </div>
          {program && <ProgramChip id={program.id} name={program.shortName} color={program.color} size="sm" />}
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
          <span className={cn("font-medium", savings > 0 ? "text-aurora" : "text-fg-subtle")}>
            {savings > 0 ? `${savings}% below typical` : "At typical price"}
          </span>
          <span className="inline-flex items-center gap-1 text-fg-subtle">
            <Users className="size-3" aria-hidden="true" />
            {deal.seats > 0 ? `${fmtInt(deal.seats)} seat${deal.seats === 1 ? "" : "s"}` : "seats unknown"}
          </span>
          {plan?.affordable && (
            <span className="inline-flex items-center gap-1 text-aurora">
              <Wallet className="size-3" aria-hidden="true" />
              {via.length ? `Bookable via ${via.join(" + ")}` : "Bookable with your balance"}
            </span>
          )}
        </div>

        {deal.dates.length > 0 && (
          <ul className="flex flex-wrap items-center gap-1.5" aria-label="Dates with space">
            {deal.dates.slice(0, 3).map((d) => (
              <li key={d}>
                <Link
                  href={searchHref({ from: deal.origin, to: deal.destination, date: d, cabin: deal.cabin })}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border border-panel-border bg-bg-elev-2 px-2.5 font-mono text-[11px] tnum text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
                    focusRing,
                  )}
                >
                  {fmtDate(d, { weekday: undefined })}
                </Link>
              </li>
            ))}
            {deal.dates.length > 3 && (
              <li className="font-mono text-[11px] text-fg-subtle">+{deal.dates.length - 3} more</li>
            )}
          </ul>
        )}

        {deal.note && <p className="truncate text-xs text-fg-subtle">{deal.note}</p>}
      </div>

      <footer className="flex items-center justify-between border-t border-panel-border px-3 py-2">
        <Link
          href={exploreHref({ view: "calendar", from: deal.origin, to: deal.destination, cabin: deal.cabin })}
          className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-2 text-xs text-fg-muted transition-colors hover:text-fg", focusRing)}
        >
          <CalendarDays className="size-3.5" aria-hidden="true" />
          Calendar
        </Link>
        <Button size="sm" variant="ghost" href={primaryHref} trailing={<ArrowRight />}>
          Search
        </Button>
      </footer>
    </article>
  );
}

/** Placeholder shaped like a DealCard. */
export function DealCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-[var(--radius)] border border-panel-border bg-bg-elev-1">
      <Skeleton className="aspect-[16/8] w-full rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-10" />
        </div>
        <div className="flex justify-between">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
        <Skeleton className="h-3 w-2/3" />
        <div className="flex gap-1.5">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-16 rounded-full" />
        </div>
      </div>
    </div>
  );
}
