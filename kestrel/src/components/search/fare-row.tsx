"use client";

/**
 * Pieces shared by the boarding-pass stub and the expanded fare list:
 * seat badges, transfer chips, the wallet payment-plan line and the AI note.
 */

import { BadgeCheck, CircleAlert, ExternalLink, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { ProgramLogo } from "@/components/art";
import { Badge, Button, SkeletonText, type BadgeProps } from "@/components/ui";
import { getProgram } from "@/data/programs";
import type { AwardFare, TransferOption } from "@/lib/types";
import type { PaymentPlan } from "@/lib/wallet/affordability";
import { cn, fmtCpp, fmtInt, fmtUsd } from "@/lib/utils";
import { fmtK } from "./derive";

// ─── Badges ─────────────────────────────────────────────────────

const BADGE_TONE: Record<string, BadgeProps["variant"]> = {
  "Sweet spot": "signal",
  "Low taxes": "aurora",
  "Wide open": "aurora",
  Nonstop: "sky",
  Rare: "gold",
  "Surcharge heavy": "rose",
};

export function badgeTone(label: string): BadgeProps["variant"] {
  return BADGE_TONE[label] ?? "neutral";
}

export function SeatsBadge({ seats, size = "md", className }: { seats: number | null; size?: BadgeProps["size"]; className?: string }) {
  if (seats == null) {
    return (
      <Badge variant="outline" size={size} className={className} title="This program does not expose seat counts">
        Seats n/a
      </Badge>
    );
  }
  if (seats <= 0) {
    return (
      <Badge variant="rose" size={size} className={className}>
        Sold out
      </Badge>
    );
  }
  return (
    <Badge variant={seats === 1 ? "rose" : "aurora"} size={size} dot className={className}>
      {seats >= 9 ? "9+" : seats} {seats === 1 ? "seat" : "seats"}
    </Badge>
  );
}

// ─── Transfer chips ─────────────────────────────────────────────

export function TransferChip({ option, passengers }: { option: TransferOption; passengers: number }) {
  const bank = getProgram(option.bankProgramId);
  const points = option.bankPointsNeeded * Math.max(1, passengers);
  const bonus = option.bonusPercent ? ` +${option.bonusPercent}%` : "";
  const title = `${bank?.name ?? option.bankProgramId} → ${option.ratio[0]}:${option.ratio[1]}${bonus} · ${option.transferTime}`;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border pl-1.5 pr-2 font-mono text-[11px] tnum text-fg",
        option.bonusPercent ? "border-aurora/30 bg-aurora-soft" : "border-panel-border bg-bg-elev-2",
      )}
    >
      <span aria-hidden="true" className="size-2 rounded-full" style={{ background: bank?.color ?? "var(--fg-subtle)" }} />
      {fmtK(points)} {bank?.shortName ?? option.bankProgramId}
      <span className={option.bonusPercent ? "text-aurora" : "text-fg-subtle"}>
        ({option.ratio[0]}:{option.ratio[1]}
        {bonus})
      </span>
    </span>
  );
}

export function TransferChips({ options, passengers, max = 4 }: { options: TransferOption[]; passengers: number; max?: number }) {
  if (!options.length) return null;
  const shown = options.slice(0, max);
  const rest = options.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((o) => (
        <TransferChip key={o.bankProgramId} option={o} passengers={passengers} />
      ))}
      {rest > 0 && (
        <span className="text-[11px] text-fg-subtle" title={options.slice(max).map((o) => getProgram(o.bankProgramId)?.shortName ?? o.bankProgramId).join(", ")}>
          +{rest} more
        </span>
      )}
    </div>
  );
}

// ─── Wallet plan ────────────────────────────────────────────────

export function describePlan(plan: PaymentPlan): string {
  const program = getProgram(plan.programId);
  const parts: string[] = [];
  if (plan.direct > 0) parts.push(`use ${fmtK(plan.direct)} ${program?.shortName ?? plan.programId}`);
  for (const t of plan.transfers) {
    const bank = getProgram(t.from)?.shortName ?? t.from;
    parts.push(`transfer ${fmtK(t.sourcePoints)} from ${bank}${t.bonusPercent ? ` (+${t.bonusPercent}% bonus)` : ""}`);
  }
  if (!parts.length) return "";
  const text = parts.join(" + ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function WalletPlanLine({ plan, alternative, className }: { plan: PaymentPlan; alternative?: ReactNode; className?: string }) {
  const program = getProgram(plan.programId);
  const detail = describePlan(plan);
  if (plan.affordable) {
    return (
      <div className={cn("flex items-start gap-2 rounded-[10px] border border-aurora/25 bg-aurora-soft px-3 py-2 text-xs leading-relaxed", className)}>
        <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-aurora" aria-hidden="true" />
        <p className="min-w-0">
          <span className="font-medium text-aurora">You can book this</span>
          {detail && <span className="text-fg-muted"> · {detail}</span>}
        </p>
      </div>
    );
  }
  return (
    <div className={cn("flex items-start gap-2 rounded-[10px] border border-rose/25 bg-rose-soft px-3 py-2 text-xs leading-relaxed", className)}>
      <CircleAlert className="mt-0.5 size-3.5 shrink-0 text-rose" aria-hidden="true" />
      <p className="min-w-0">
        <span className="font-medium text-rose">Short {fmtK(plan.shortfall)}</span>
        <span className="text-fg-muted">
          {detail
            ? ` · ${detail}, still ${fmtK(plan.shortfall)} short`
            : ` · No ${program?.shortName ?? "program"} balance or transferable partner in your wallet`}
        </span>
        {alternative}
      </p>
    </div>
  );
}

// ─── AI note ────────────────────────────────────────────────────

export type ExplainState = { status: "loading" } | { status: "done"; text: string } | { status: "error"; message: string };

export function AiNote({ state, className }: { state: ExplainState; className?: string }) {
  return (
    <div
      className={cn("rounded-[12px] border border-violet/25 bg-violet-soft px-3.5 py-3 text-sm leading-relaxed text-fg", className)}
      aria-live="polite"
    >
      <div className="mb-1.5 flex items-center gap-2">
        <Badge variant="violet" size="sm" caps icon={<Sparkles aria-hidden="true" />}>
          AI
        </Badge>
        <span className="text-[11px] text-fg-subtle">Why this redemption works</span>
      </div>
      {state.status === "loading" && <SkeletonText lines={2} className="mt-2" />}
      {state.status === "done" && <p className="pretty-text text-fg-muted">{state.text}</p>}
      {state.status === "error" && <p className="text-rose">{state.message}</p>}
    </div>
  );
}

// ─── Fare row ───────────────────────────────────────────────────

export interface FareRowProps {
  fare: AwardFare;
  passengers: number;
  isBest: boolean;
  plan: PaymentPlan | null;
  explanation?: ExplainState;
  onExplain: (fare: AwardFare) => void;
}

export function FareRow({ fare, passengers, isBest, plan, explanation, onExplain }: FareRowProps) {
  const program = getProgram(fare.programId);
  const name = program?.shortName ?? fare.programId;
  const bookUrl = fare.bookUrl ?? program?.bookingUrl;
  const total = fare.miles * Math.max(1, passengers);
  const visibleBadges = fare.badges.filter((b) => b !== "Nonstop").slice(0, 3);

  return (
    <li className="py-3 first:pt-2">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
        <ProgramLogo id={fare.programId} name={program?.name ?? fare.programId} color={program?.color} size={34} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-fg">{name}</span>
            {isBest && (
              <Badge variant="signal" size="sm">
                Best
              </Badge>
            )}
            <SeatsBadge seats={fare.seats} size="sm" />
            {fare.mixedCabin && (
              <Badge variant="gold" size="sm">
                Mixed cabin
              </Badge>
            )}
            {visibleBadges.map((b) => (
              <Badge key={b} variant={badgeTone(b)} size="sm">
                {b}
              </Badge>
            ))}
          </div>
          <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs text-fg-muted">
            <span>
              <span className="font-mono text-base font-semibold tnum text-fg">{fmtInt(fare.miles)}</span>
              <span className="ml-1">{program?.kind === "airline" ? "per person" : "points"}</span>
            </span>
            {passengers > 1 && (
              <span className="font-mono tnum">
                × {passengers} = {fmtK(total)}
              </span>
            )}
            <span className="font-mono tnum">+ {fmtUsd(fare.taxesUsd)} taxes</span>
            {fare.cpp != null && fare.cpp > 0 && <span className="font-mono tnum">{fmtCpp(fare.cpp)}/pt</span>}
          </div>
        </div>
        <div className="col-span-2 flex items-center gap-1.5 sm:col-span-1">
          {bookUrl ? (
            <Button variant="secondary" size="sm" href={bookUrl} target="_blank" rel="noopener noreferrer" trailing={<ExternalLink aria-hidden="true" />}>
              Book on {name}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              No booking link
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            leading={<Sparkles className="text-violet" aria-hidden="true" />}
            loading={explanation?.status === "loading"}
            onClick={() => onExplain(fare)}
            aria-label={`Explain the ${name} fare`}
          >
            Explain
          </Button>
        </div>
      </div>

      {fare.transferOptions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:pl-[46px]">
          <span className="mr-0.5 text-[11px] text-fg-subtle">Transfer from</span>
          <TransferChips options={fare.transferOptions} passengers={passengers} />
        </div>
      )}
      {plan && <WalletPlanLine plan={plan} className="mt-2 sm:ml-[46px]" />}
      {explanation && <AiNote state={explanation} className="mt-2 sm:ml-[46px]" />}
    </li>
  );
}
