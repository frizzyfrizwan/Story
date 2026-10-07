"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { TransferLink } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/tokens";
import type { ProgramLite } from "./transfer-cell";
import { BANK_ORDER, fmtRatio, isBonusActive, uniquePartners } from "./transfer-utils";

/** One panel per bank: partner counts, partners nobody else offers, richest ratios. */
export function BankExplainer({ links, programs, asOf }: { links: TransferLink[]; programs: Record<string, ProgramLite>; asOf: string }) {
  const unique = uniquePartners(links);
  return (
    <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {BANK_ORDER.map((bankId) => {
        const bank = programs[bankId];
        if (!bank) return null;
        const mine = links.filter((l) => l.from === bankId && programs[l.to]);
        const airlines = mine.filter((l) => programs[l.to].kind === "airline").length;
        const hotels = mine.filter((l) => programs[l.to].kind === "hotel").length;
        const instant = mine.filter((l) => l.transferTime === "instant").length;
        const bonuses = mine.filter((l) => isBonusActive(l, asOf)).length;
        const only = (unique.get(bankId) ?? []).map((id) => programs[id]).filter(Boolean);
        const rich = mine
          .filter((l) => l.ratio[1] / l.ratio[0] > 1)
          .sort((a, b) => b.ratio[1] / b.ratio[0] - a.ratio[1] / a.ratio[0])
          .slice(0, 3);
        return (
          <li key={bankId} className="flex flex-col gap-4 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5 shadow-panel">
            <div className="flex items-center gap-3">
              <ProgramLogo id={bank.id} name={bank.shortName} color={bank.color} size={40} />
              <div className="min-w-0 flex-1">
                <Link href={`/programs/${bank.id}`} className={cn("inline-flex items-center gap-1 rounded-full font-display text-lg leading-tight text-fg hover:text-signal", focusRing)}>
                  {bank.shortName}
                  <ArrowUpRight className="size-3.5 text-fg-faint" aria-hidden="true" />
                </Link>
                <p className="font-mono text-[11px] tnum text-fg-subtle">
                  {mine.length} partners · {airlines} air · {hotels} hotel · {instant} instant
                </p>
              </div>
              {bonuses > 0 && (
                <Badge variant="aurora" size="sm" dot pulse>
                  {bonuses} {bonuses === 1 ? "bonus" : "bonuses"}
                </Badge>
              )}
            </div>

            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Only from {bank.shortName}</p>
              {only.length ? (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {only.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/programs/${p.id}`}
                        className={cn(
                          "inline-flex h-7 items-center gap-1.5 rounded-full border border-signal/30 bg-signal-soft pl-1 pr-2.5 text-xs font-medium text-fg transition-colors hover:border-signal/60",
                          focusRing,
                        )}
                      >
                        <ProgramLogo id={p.id} name={p.shortName} color={p.color} size={20} />
                        {p.shortName}
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-xs text-fg-muted">Every partner is reachable from at least one other bank.</p>
              )}
            </div>

            {rich.length > 0 && (
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-fg-subtle">Richest ratios</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {rich.map((l) => (
                    <li key={l.to} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-2 pl-1 pr-2.5 text-xs text-fg">
                      <ProgramLogo id={l.to} name={programs[l.to].shortName} color={programs[l.to].color} size={20} />
                      {programs[l.to].shortName}
                      <span className="font-mono tnum text-aurora">{fmtRatio(l.ratio)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
