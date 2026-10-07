"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Plane, Sparkles } from "lucide-react";
import type { Balance, Deal, LoyaltyProgram, TransferLink } from "@/lib/types";
import { getAirline } from "@/data/airlines";
import { cn, fmtCpp, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";
import { planPayment, type PaymentPlan } from "@/lib/wallet/affordability";
import { AirlineTail, ProgramLogo } from "@/components/art/program-logo";
import { Badge, CabinBadge, SourceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { SkeletonCard } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";
import { useDeals } from "./use-wallet";
import { summarizePlan } from "./wallet-utils";

const DEAL_BADGE: Record<Deal["badge"], { label: string; variant: "aurora" | "signal" | "gold" | "violet" | "sky" }> = {
  "sweet-spot": { label: "Sweet spot", variant: "signal" },
  "transfer-bonus": { label: "Transfer bonus", variant: "aurora" },
  rare: { label: "Rare", variant: "gold" },
  "wide-open": { label: "Wide open", variant: "sky" },
  "ai-pick": { label: "AI pick", variant: "violet" },
};

export interface BookableNowProps {
  balances: Balance[];
  links: TransferLink[];
  programs: Record<string, LoyaltyProgram>;
  origin: string;
  limit?: number;
}

export function BookableNow({ balances, links, programs, origin, limit = 6 }: BookableNowProps) {
  const { data: deals, isPending, isError, refetch } = useDeals(origin);

  const affordable = useMemo(() => {
    if (!deals) return [];
    const out: { deal: Deal; plan: PaymentPlan }[] = [];
    for (const deal of deals) {
      if (!programs[deal.programId]) continue;
      const plan = planPayment(deal.programId, deal.miles, balances, links, programs);
      if (plan.affordable) out.push({ deal, plan });
    }
    return out.sort((a, b) => b.deal.savingsPct - a.deal.savingsPct || b.deal.cpp - a.deal.cpp).slice(0, limit);
  }, [deals, balances, links, programs, limit]);

  const simulated = affordable.some((d) => d.deal.source === "simulated");

  return (
    <Panel
      eyebrow="Bookable now"
      title="What you can book right now"
      description={`Live deals from ${origin} that your balances cover outright or with one transfer.`}
      actions={
        <span className="inline-flex items-center gap-2">
          {simulated && <SourceBadge source="simulated" />}
          <Button href={`/search?from=${origin}`} variant="ghost" size="sm" trailing={<ArrowRight />} className="hidden sm:inline-flex">
            Search
          </Button>
        </span>
      }
    >
      {isPending ? (
        <div className="grid gap-3">
          <SkeletonCard variant="row" />
          <SkeletonCard variant="row" />
          <SkeletonCard variant="row" />
        </div>
      ) : isError ? (
        <EmptyState
          compact
          illustration="none"
          title="Deals are unavailable"
          description="The award engine did not answer. Try again in a moment."
          action={
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      ) : affordable.length === 0 ? (
        <EmptyState
          compact
          title="Nothing affordable yet"
          description={balances.length ? `None of today's deals from ${origin} fit your balances. Add a bank currency to unlock transfers.` : "Add a balance and we'll match it to live deals."}
          action={
            <Button href={`/search?from=${origin}`} variant="secondary" size="sm" leading={<Plane />}>
              Search anyway
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {affordable.map(({ deal, plan }) => {
            const airline = getAirline(deal.carrier);
            const program = programs[deal.programId];
            const badge = DEAL_BADGE[deal.badge];
            const href = `/search?from=${deal.origin}&to=${deal.destination}&cabin=${deal.cabin}&date=${deal.dates[0] ?? ""}&programs=${deal.programId}`;
            return (
              <li key={deal.id}>
                <Link
                  href={href}
                  className={cn(
                    "group flex h-full flex-col gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-panel-border-strong",
                    focusRing,
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AirlineTail code={deal.carrier} color={airline?.color} size={24} showCode={false} />
                    <span className="min-w-0 flex-1 truncate text-xs text-fg-muted">{airline?.name ?? deal.carrier}</span>
                    <CabinBadge cabin={deal.cabin} short />
                    <Badge variant={badge.variant} size="sm">
                      {badge.label}
                    </Badge>
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <div className="font-mono tnum text-xl font-medium tracking-[0.04em] text-fg">
                        {deal.origin}
                        <span className="mx-1.5 text-fg-faint">→</span>
                        {deal.destination}
                      </div>
                      <div className="mt-0.5 text-xs text-fg-subtle">
                        {deal.dates.length ? fmtDate(deal.dates[0]) : "Flexible"}
                        {deal.dates.length > 1 && ` +${deal.dates.length - 1} dates`} · {deal.seats} {deal.seats === 1 ? "seat" : "seats"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono tnum text-lg leading-none text-fg">{fmtInt(deal.miles)}</div>
                      <div className="mt-1 font-mono tnum text-[11px] text-fg-subtle">
                        + {fmtUsd(deal.taxesUsd)} · {fmtCpp(deal.cpp)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 rounded-[var(--radius-sm)] border border-aurora/25 bg-aurora-soft px-2.5 py-2 text-xs text-fg">
                    <ProgramLogo id={deal.programId} name={program?.shortName ?? deal.programId} color={program?.color} size={18} />
                    <span className="min-w-0 flex-1 truncate">{summarizePlan(plan, programs)}</span>
                    <Sparkles className="size-3.5 shrink-0 text-aurora" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
