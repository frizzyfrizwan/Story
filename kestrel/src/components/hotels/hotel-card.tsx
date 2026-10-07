"use client";

import Link from "next/link";
import { ArrowUpRight, Bookmark, CalendarSearch, Check, CircleAlert } from "lucide-react";
import type { CSSProperties } from "react";
import { Badge, ProgramChip } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { Tooltip } from "@/components/ui/tooltip";
import { NumberRoll } from "@/components/viz/number-roll";
import { CppBar } from "@/components/viz/value-meter";
import { cn, fmtCompact, fmtInt, fmtUsd } from "@/lib/utils";
import { ART_INK, ART_INK_MUTED, HotelArt, Stars } from "./hotel-art";
import {
  SEASON_LABEL,
  SEASON_TONE,
  TIER_LABEL,
  badgeTone,
  cardBadges,
  hotelDetailHref,
  programShort,
  type HotelResult,
  type ResolvedTransfer,
  type StayParams,
  type WalletPlan,
} from "./model";
import { useSaveToTrip } from "./use-save-to-trip";

export interface HotelCardProps {
  result: HotelResult;
  stay: StayParams;
  compare?: { selected: boolean; disabled: boolean; onToggle: () => void };
  onTryOtherDates?: () => void;
  /** Mount stagger index for the rise animation. */
  index?: number;
  className?: string;
}

/** "Chase UR" → "Chase"; the bank suffix is noise in a chip. */
function bankLabel(short: string): string {
  return short.replace(/ (MR|UR|TY)$/, "");
}

function transferTitle(t: ResolvedTransfer, programName: string): string {
  const ratio = t.ratio[0] === t.ratio[1] ? "1:1" : `${t.ratio[0]}:${t.ratio[1]}`;
  const bonus = t.bonusPercent ? ` · ${t.bonusPercent}% bonus` : "";
  return `${fmtInt(t.bankPointsNeeded)} ${t.bankName} → ${programName} (${ratio}${bonus}, ${t.transferTime})`;
}

function TransferChips({ transfers, programName, programLabel }: { transfers: ResolvedTransfer[]; programName: string; programLabel: string }) {
  if (!transfers.length) return null;
  const shown = transfers.slice(0, 3);
  const rest = transfers.slice(3);
  return (
    <ul className="flex flex-wrap items-center gap-1.5" aria-label="Transfer partners">
      {shown.map((t) => (
        <li
          key={t.bankId}
          title={transferTitle(t, programName)}
          className="inline-flex h-6 items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-2 px-2 text-[11px] text-fg-muted"
        >
          <span aria-hidden="true" className="size-1.5 rounded-full" style={{ background: t.color }} />
          <span className="font-mono tnum text-fg">{fmtCompact(t.bankPointsNeeded)}</span>
          <span>
            {bankLabel(t.bankShort)} → {programLabel}
          </span>
          {t.bonusPercent ? <span className="font-mono text-[10px] text-signal">+{t.bonusPercent}%</span> : null}
        </li>
      ))}
      {rest.length > 0 && (
        <li
          className="inline-flex h-6 items-center rounded-full px-1.5 text-[11px] text-fg-subtle"
          title={rest.map((t) => transferTitle(t, programName)).join("\n")}
        >
          +{rest.length} more
        </li>
      )}
    </ul>
  );
}

function WalletLine({ plan, currency }: { plan: WalletPlan; currency: string }) {
  if (plan.affordable) {
    const parts = [
      ...(plan.direct > 0 ? [`${fmtCompact(plan.direct)} in wallet`] : []),
      ...plan.transfers.map((t) => `${fmtCompact(t.sourcePoints)} from ${t.fromShort}`),
    ];
    return (
      <p className="flex items-start gap-1.5 text-[13px] leading-snug text-aurora">
        <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          <span className="font-medium">You can book this</span>
          {parts.length > 0 && <span className="text-fg-muted"> — {parts.join(" + ")}</span>}
        </span>
      </p>
    );
  }
  return (
    <p className="flex items-start gap-1.5 text-[13px] leading-snug text-fg-muted">
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-rose" aria-hidden="true" />
      <span>
        <span className="font-medium text-rose">Short {fmtCompact(plan.shortfall)} {currency}</span>
        {plan.direct > 0 || plan.transfers.length > 0 ? (
          <span>
            {" "}
            after {[
              ...(plan.direct > 0 ? [`${fmtCompact(plan.direct)} in wallet`] : []),
              ...plan.transfers.map((t) => `${fmtCompact(t.sourcePoints)} from ${t.fromShort}`),
            ].join(" + ")}
          </span>
        ) : null}
      </span>
    </p>
  );
}

const LABEL = "font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle";

/** Result card: postcard art, points-vs-cash at a glance, value bar, transfers, actions. */
export function HotelCard({ result, stay, compare, onTryOtherDates, index = 0, className }: HotelCardProps) {
  const { quote, property, program, transfers, plan } = result;
  const { save, savingId } = useSaveToTrip();
  const detailsHref = hotelDetailHref(property.id, stay);
  const label = programShort(program);
  const badges = cardBadges(result.badges);
  const soldOut = !quote.available;
  const isHyatt = program.chartType === "category" && property.category != null;

  return (
    <article
      aria-label={property.name}
      data-available={quote.available}
      style={{ animationDelay: `${Math.min(index, 11) * 45}ms` } as CSSProperties}
      className={cn(
        "group/card flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 shadow-panel animate-rise",
        "transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-panel-border-strong",
        compare?.selected && "border-signal/50 shadow-glow-signal",
        className,
      )}
    >
      <HotelArt name={property.name} art={property.art} className="rounded-none">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <ProgramChip id={program.id} name={program.name} color={program.color} size="sm" />
          {compare && (
            <label
              className={cn(
                "inline-flex h-7 cursor-pointer items-center gap-2 rounded-full border border-white/15 bg-black/45 pl-2 pr-2.5 text-[11px] font-medium text-white backdrop-blur-md transition-colors hover:bg-black/60",
                compare.disabled && "cursor-not-allowed opacity-60",
              )}
            >
              <Checkbox
                size="sm"
                checked={compare.selected}
                disabled={compare.disabled}
                onCheckedChange={() => compare.onToggle()}
                aria-label={`Compare ${property.name}`}
              />
              Compare
            </label>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4">
          <div className="min-w-0">
            <p className={cn("truncate font-mono text-[10px] uppercase tracking-[0.2em]", ART_INK_MUTED)}>
              {property.brand}
            </p>
            <h3 className={cn("mt-0.5 font-display text-xl leading-[1.1] tracking-tight balance-text", ART_INK)}>
              <Link href={detailsHref} className={cn("rounded-[4px]", focusRing)}>
                {property.name}
              </Link>
            </h3>
          </div>
          {quote.tier && (
            <Badge variant={SEASON_TONE[quote.tier]} size="sm" caps className="shrink-0 backdrop-blur-md">
              {SEASON_LABEL[quote.tier]}
            </Badge>
          )}
        </div>
        {soldOut && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-bg/35">
            <Badge variant="rose" size="lg" caps dot className="bg-bg-elev-1/90 shadow-panel">
              Sold out
            </Badge>
          </div>
        )}
      </HotelArt>

      <div className={cn("flex flex-1 flex-col gap-4 p-4 sm:p-5", soldOut && "opacity-70")}>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-xs text-fg-muted">
          <Stars count={property.stars} />
          <span aria-hidden="true" className="text-fg-faint">
            ·
          </span>
          <span>{TIER_LABEL[property.tier]}</span>
          {isHyatt && (
            <Badge variant="violet" size="sm">
              Cat {property.category}
            </Badge>
          )}
          {quote.fifthNightFreeApplied && (
            <Badge variant="violet" size="sm" caps>
              5th night free
            </Badge>
          )}
          <span className="ml-auto truncate text-fg-subtle">{property.city}</span>
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0">
            <p className={LABEL}>Points / night</p>
            <NumberRoll
              value={quote.pointsPerNight}
              format="int"
              animateOnMount
              className="mt-1 text-[1.65rem] font-semibold text-fg"
            />
            <p className="mt-1 text-xs text-fg-subtle">
              <span className="font-mono tnum text-fg-muted">{fmtInt(quote.totalPoints)}</span> for {quote.nights}{" "}
              {quote.nights === 1 ? "night" : "nights"}
            </p>
          </div>
          <div className="flex flex-col items-center gap-1 self-stretch" aria-hidden="true">
            <span className="w-px flex-1 bg-panel-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-faint">vs</span>
            <span className="w-px flex-1 bg-panel-border" />
          </div>
          <div className="min-w-0 text-right">
            <p className={LABEL}>Cash / night</p>
            <p className="mt-1 font-mono text-[1.65rem] font-semibold leading-none tnum text-fg-muted">
              {fmtUsd(quote.cashPerNightUsd)}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              <span className="font-mono tnum text-fg-muted">{fmtUsd(quote.totalCashUsd)}</span> total
            </p>
          </div>
        </div>

        <CppBar cpp={quote.cpp} benchmark={program.valuationCpp} />

        {badges.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Value notes">
            {badges.map((b) => (
              <li key={b}>
                <Badge variant={badgeTone(b)} size="sm">
                  {b}
                </Badge>
              </li>
            ))}
          </ul>
        )}

        <TransferChips transfers={transfers} programName={program.name} programLabel={label} />

        {plan && <WalletLine plan={plan} currency={program.currency.replace(/ points$/, "")} />}

        <div className="mt-auto flex items-center gap-2 pt-1">
          {quote.available ? (
            <Button
              variant="aurora"
              size="sm"
              href={program.bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              trailing={<ArrowUpRight />}
            >
              Book on {label}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" leading={<CalendarSearch />} onClick={onTryOtherDates}>
              Try other dates
            </Button>
          )}
          <Button variant="secondary" size="sm" href={detailsHref}>
            Details
          </Button>
          <Tooltip content="Save to trip">
            <IconButton
              label={`Save ${property.name} to a trip`}
              size="sm"
              className="ml-auto"
              loading={savingId === property.id}
              onClick={() => save(result)}
            >
              <Bookmark />
            </IconButton>
          </Tooltip>
        </div>
      </div>
    </article>
  );
}

/** Placeholder shaped like the card so the grid doesn't jump when results land. */
export function HotelCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1", className)}
    >
      <Skeleton className="aspect-[16/10] w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-12" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2 h-7 w-24" />
            <Skeleton className="mt-2 h-2.5 w-28" />
          </div>
          <div className="flex flex-col items-end">
            <Skeleton className="h-2.5 w-20" />
            <Skeleton className="mt-2 h-7 w-20" />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </div>
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
        <div className="flex gap-1.5">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="mt-auto flex gap-2">
          <Skeleton className="h-9 w-28 rounded-full" />
          <Skeleton className="h-9 w-20 rounded-full" />
        </div>
      </div>
    </div>
  );
}
