"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import type { Balance, LoyaltyProgram, TransferLink } from "@/lib/types";
import { cn, fmtCompact, fmtInt } from "@/lib/utils";
import { reachByProgram } from "@/lib/wallet/affordability";
import { ProgramLogo } from "@/components/art/program-logo";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Tooltip } from "@/components/ui/tooltip";
import { focusRing } from "@/components/ui/tokens";
import { reachSentence } from "./wallet-utils";

export interface ReachPanelProps {
  balances: Balance[];
  links: TransferLink[];
  programs: Record<string, LoyaltyProgram>;
  asOf: string;
  limit?: number;
}

/** Top programs by total reach: a stacked bar of what is held directly vs reachable by transfer. */
export function ReachPanel({ balances, links, programs, asOf, limit = 8 }: ReachPanelProps) {
  const rows = useMemo(() => {
    const reach = reachByProgram(balances, links, asOf);
    return Object.entries(reach)
      .filter(([id]) => programs[id] && programs[id].kind !== "bank")
      .map(([id, r]) => ({ id, program: programs[id], ...r }))
      .sort((a, b) => b.total - a.total)
      .slice(0, limit);
  }, [balances, links, programs, asOf, limit]);
  const max = rows[0]?.total ?? 1;
  const sentence = reachSentence(balances, links, programs, asOf);

  return (
    <Panel
      eyebrow="Reach"
      title="Where your points can go"
      description={sentence ?? "Add a bank currency to see how far transfers take you."}
      actions={
        <Button href="/transfers" variant="ghost" size="sm" leading={<ArrowLeftRight />} className="hidden sm:inline-flex">
          Matrix
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyState compact illustration="none" title="No reach yet" description="Add balances and this fills in." />
      ) : (
        <>
          <div className="mb-3 flex items-center gap-4 font-mono text-[10.5px] uppercase tracking-[0.14em] text-fg-subtle" aria-hidden="true">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-aurora" /> Held directly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-sm bg-[repeating-linear-gradient(135deg,var(--aurora)_0_2px,transparent_2px_4px)] opacity-80" /> Via transfer
            </span>
          </div>
          <ol className="flex flex-col gap-2.5">
            {rows.map((r) => {
              const directPct = (r.direct / max) * 100;
              const viaPct = (r.viaTransfer / max) * 100;
              const sources = r.sources.map((s) => programs[s]?.shortName ?? s);
              return (
                <li key={r.id} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
                  <Link href={`/programs/${r.id}`} className={cn("flex min-w-0 items-center gap-2 rounded-full", focusRing)}>
                    <ProgramLogo id={r.id} name={r.program.shortName} color={r.program.color} size={26} />
                    <span className="truncate text-[13px] font-medium text-fg">{r.program.shortName}</span>
                  </Link>
                  <Tooltip
                    content={`${fmtInt(r.direct)} held · ${fmtInt(r.viaTransfer)} via ${sources.length ? sources.join(", ") : "transfer"}`}
                  >
                    <div
                      className="flex h-3 w-full items-center gap-[2px] rounded-full"
                      role="img"
                      aria-label={`${r.program.shortName}: ${fmtInt(r.direct)} held, ${fmtInt(r.viaTransfer)} via transfer`}
                    >
                      {r.direct > 0 && (
                        <span className="h-full rounded-full bg-aurora transition-[width] duration-500" style={{ width: `${directPct}%` }} />
                      )}
                      {r.viaTransfer > 0 && (
                        <span
                          className="h-full rounded-full bg-[repeating-linear-gradient(135deg,var(--aurora)_0_2px,transparent_2px_4px)] opacity-80 transition-[width] duration-500"
                          style={{ width: `${viaPct}%` }}
                        />
                      )}
                    </div>
                  </Tooltip>
                  <span className="font-mono tnum text-sm text-fg">{fmtCompact(r.total)}</span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Panel>
  );
}
