"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { BellPlus, RefreshCw } from "lucide-react";
import { SourceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentedControl } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";
import { PROGRAM_BY_ID } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { apiGet, loginHref } from "@/lib/client/api";
import type { Balance, Cabin, Deal } from "@/lib/types";
import { planPayment, type PaymentPlan } from "@/lib/wallet/affordability";
import { cn, fmtInt } from "@/lib/utils";
import { DealCard, DealCardSkeleton } from "./deal-card";
import { relativeTime } from "./format";

export type DealSort = "value" | "miles" | "savings";

export const DEAL_SORTS: readonly DealSort[] = ["value", "miles", "savings"] as const;

interface DealsPayload {
  deals: Deal[];
  generatedAt: string;
}

export interface DealsTabProps {
  origin: string;
  cabin: Cabin;
  sort: DealSort;
  onSortChange: (sort: DealSort) => void;
  mine: boolean;
  onMineChange: (mine: boolean) => void;
  onClearOrigin: () => void;
  signedIn: boolean;
}

const SORT_OPTIONS = [
  { value: "value" as const, label: "Best value" },
  { value: "miles" as const, label: "Fewest miles" },
  { value: "savings" as const, label: "Biggest savings" },
];

export function DealsTab({ origin, cabin, sort, onSortChange, mine, onMineChange, onClearOrigin, signedIn }: DealsTabProps) {
  const dealsQ = useQuery({
    queryKey: ["explore", "deals", origin || "all", cabin],
    queryFn: () => apiGet<DealsPayload>("/api/awards/deals", { origin: origin || undefined, cabin, limit: 36 }),
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  });
  const walletQ = useQuery({
    queryKey: ["wallet"],
    queryFn: () => apiGet<{ balances: Balance[] }>("/api/wallet"),
    enabled: signedIn && mine,
    staleTime: 60_000,
  });

  // Tick so "Refreshed 2 min ago" stays honest without refetching.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const balances = useMemo(() => walletQ.data?.balances ?? [], [walletQ.data]);
  const allDeals = useMemo(() => dealsQ.data?.deals ?? [], [dealsQ.data]);

  const plans = useMemo(() => {
    if (!mine || !signedIn) return new Map<string, PaymentPlan>();
    return new Map(allDeals.map((d) => [d.id, planPayment(d.programId, d.miles, balances, TRANSFER_LINKS, PROGRAM_BY_ID)]));
  }, [allDeals, balances, mine, signedIn]);

  const deals = useMemo(() => {
    const list = mine && signedIn ? allDeals.filter((d) => plans.get(d.id)?.affordable) : allDeals.slice();
    switch (sort) {
      case "miles":
        return list.sort((a, b) => a.miles - b.miles || b.cpp - a.cpp);
      case "savings":
        return list.sort((a, b) => b.savingsPct - a.savingsPct || b.cpp - a.cpp);
      default:
        return list.sort((a, b) => b.cpp - a.cpp || b.savingsPct - a.savingsPct);
    }
  }, [allDeals, plans, mine, signedIn, sort]);

  const source = allDeals[0]?.source ?? "simulated";
  const loading = dealsQ.isPending || (mine && signedIn && walletQ.isPending);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <SegmentedControl size="sm" value={sort} onChange={onSortChange} options={SORT_OPTIONS} />
        <div className="flex flex-wrap items-center gap-3">
          <label className={cn("flex items-center gap-2.5 text-sm text-fg", !signedIn && "text-fg-muted")}>
            <Switch
              size="sm"
              checked={mine && signedIn}
              onCheckedChange={onMineChange}
              disabled={!signedIn}
              aria-label="Only show deals bookable with my points"
            />
            Only with my points
          </label>
          {!signedIn && (
            <Button variant="link" size="sm" href={loginHref("/explore?view=deals&mine=1")}>
              Sign in to filter
            </Button>
          )}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle" aria-live="polite">
        {dealsQ.data ? (
          <>
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className={cn("size-3", dealsQ.isFetching && "animate-spin")} aria-hidden="true" />
              Refreshed {relativeTime(dealsQ.data.generatedAt, now)}
            </span>
            <span aria-hidden="true">·</span>
            <SourceBadge source={source} />
            <span aria-hidden="true">·</span>
            <span className="font-mono tnum">{fmtInt(deals.length)}</span>
            <span>
              {deals.length === 1 ? "deal" : "deals"} {origin ? `from ${origin}` : "worldwide"}
              {mine && signedIn ? " you can book" : ""}
            </span>
          </>
        ) : (
          <span>Scanning curated routes…</span>
        )}
      </p>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }, (_, i) => (
            <DealCardSkeleton key={i} />
          ))}
        </div>
      ) : dealsQ.isError ? (
        <EmptyState
          title="Couldn't load deals"
          description={dealsQ.error instanceof Error ? dealsQ.error.message : "Something went wrong while scanning."}
          action={
            <Button variant="secondary" onClick={() => dealsQ.refetch()} leading={<RefreshCw />}>
              Try again
            </Button>
          }
        />
      ) : deals.length === 0 ? (
        mine && signedIn && allDeals.length > 0 ? (
          <EmptyState
            title="Nothing bookable with your points yet"
            description="Today's deals need more than you hold. Turn the filter off to browse everything, or top up your balances."
            action={
              <Button variant="secondary" onClick={() => onMineChange(false)}>
                Show all deals
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" href="/wallet">
                Update wallet
              </Button>
            }
          />
        ) : origin ? (
          <EmptyState
            title={`No deals from ${origin} right now`}
            description="The scanner found nothing worth flagging from this airport today. Try a nearby hub, or clear the origin to see deals worldwide."
            action={
              <Button variant="secondary" onClick={onClearOrigin}>
                Show deals worldwide
              </Button>
            }
            secondaryAction={
              <Button variant="ghost" href={`/alerts?new=1&from=${origin}&cabin=${cabin}`} leading={<BellPlus />}>
                Alert me
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No deals to show yet"
            description="The deal scanner hasn't flagged anything today. Set an alert and we'll tell you the moment a sweet spot opens up."
            action={
              <Button href="/alerts?new=1" leading={<BellPlus />}>
                Create an alert
              </Button>
            }
          />
        )
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" aria-label="Award deals">
          {deals.map((deal, i) => (
            <li key={deal.id} className="min-w-0" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
              <DealCard deal={deal} plan={plans.get(deal.id)} className="h-full" />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
