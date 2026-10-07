import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { LoyaltyProgram, TransferLink } from "@/lib/types";
import { cn, fmtInt } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { focusRing } from "@/components/ui/tokens";
import { TransferTimeIcon } from "@/components/transfers/transfer-time-icon";
import { TRANSFER_TIME_META, bonusLabel, bonusState, fmtRatio, linkRatio } from "@/components/transfers/transfer-utils";
import { AllianceBadge } from "./program-meta";

/** Every destination a bank currency feeds, airlines then hotels, with ratio / bonus / time. */
export function PartnerList({
  links,
  programs,
  asOf,
  className,
}: {
  links: TransferLink[];
  programs: Record<string, LoyaltyProgram>;
  asOf?: string;
  className?: string;
}) {
  const groups: { label: string; kind: "airline" | "hotel"; rows: TransferLink[] }[] = [
    { label: "Airline partners", kind: "airline", rows: [] },
    { label: "Hotel partners", kind: "hotel", rows: [] },
  ];
  for (const l of links) {
    const dest = programs[l.to];
    if (!dest) continue;
    groups.find((g) => g.kind === dest.kind)?.rows.push(l);
  }
  for (const g of groups) g.rows.sort((a, b) => (programs[a.to]?.name ?? a.to).localeCompare(programs[b.to]?.name ?? b.to));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {groups
        .filter((g) => g.rows.length)
        .map((g) => (
          <section key={g.kind} aria-label={g.label}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">{g.label}</h3>
              <span className="font-mono text-[10.5px] tnum text-fg-faint">{g.rows.length}</span>
              <span className="hairline flex-1" aria-hidden="true" />
            </div>
            <ul className="grid gap-2 sm:grid-cols-2">
              {g.rows.map((l) => {
                const dest = programs[l.to]!;
                const state = bonusState(l.bonus, asOf);
                const rich = linkRatio(l, asOf) > 1;
                return (
                  <li key={l.to}>
                    <Link
                      href={`/programs/${l.to}`}
                      className={cn(
                        "flex items-center gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 px-3 py-2.5 transition-colors hover:border-panel-border-strong",
                        focusRing,
                      )}
                    >
                      <ProgramLogo id={dest.id} name={dest.shortName} color={dest.color} size={32} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-fg">{dest.name}</span>
                          <AllianceBadge alliance={dest.alliance} short />
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-fg-subtle">
                          <span className="inline-flex items-center gap-1">
                            <TransferTimeIcon time={l.transferTime} />
                            {TRANSFER_TIME_META[l.transferTime].label}
                          </span>
                          <span>min {fmtInt(l.minimum)}</span>
                          {l.bonus && state === "active" && (
                            <Badge variant="aurora" size="sm" dot pulse>
                              {bonusLabel(l.bonus)}
                            </Badge>
                          )}
                          {l.bonus && state === "upcoming" && (
                            <Badge variant="sky" size="sm" dot>
                              {bonusLabel(l.bonus).replace(" to ", " from ")}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className={cn("font-mono tnum text-sm font-medium", rich ? "text-aurora" : "text-fg")}>{fmtRatio(l.ratio)}</span>
                      <ArrowUpRight className="size-4 shrink-0 text-fg-faint" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
    </div>
  );
}
