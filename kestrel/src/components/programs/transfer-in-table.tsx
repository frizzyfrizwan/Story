import Link from "next/link";
import { ArrowRight, CalendarDays, Clock, Zap } from "lucide-react";
import type { LoyaltyProgram, TransferLink } from "@/lib/types";
import { cn, fmtInt } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { focusRing } from "@/components/ui/tokens";
import {
  BANK_ORDER,
  TRANSFER_TIME_META,
  bonusLabel,
  bonusState,
  exampleMath,
  fmtEffectiveRatio,
  fmtRatio,
} from "@/components/transfers/transfer-utils";

export function TransferTimeIcon({ time, className }: { time: TransferLink["transferTime"]; className?: string }) {
  const kind = TRANSFER_TIME_META[time].kind;
  const Icon = kind === "instant" ? Zap : kind === "hours" ? Clock : CalendarDays;
  return (
    <Icon
      className={cn("size-3.5 shrink-0", kind === "instant" ? "text-aurora" : kind === "hours" ? "text-sky" : "text-fg-subtle", className)}
      aria-hidden="true"
    />
  );
}

/**
 * Server-safe table of every bank that feeds a program. `programs` resolves bank names;
 * `asOf` fixes "today" so static pages stay deterministic.
 */
export function TransferInTable({
  program,
  links,
  programs,
  asOf,
  className,
}: {
  program: LoyaltyProgram;
  links: TransferLink[];
  programs: Record<string, LoyaltyProgram>;
  asOf?: string;
  className?: string;
}) {
  const order = new Map<string, number>(BANK_ORDER.map((b, i) => [b, i]));
  const rows = [...links].sort((a, b) => (order.get(a.from) ?? 99) - (order.get(b.from) ?? 99));

  if (!rows.length) {
    return (
      <EmptyState
        compact
        illustration="none"
        title="No bank transfers"
        description={`No US transferable currency feeds ${program.shortName}. Earn miles by flying, with a co-branded card, or buy them during a sale.`}
        className={className}
      />
    );
  }

  return (
    <div className={cn("overflow-x-auto rounded-[var(--radius)] border border-panel-border bg-bg-elev-1", className)}>
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-panel-border-strong font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">
            <th scope="col" className="px-4 py-3 text-left font-medium">From</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Ratio</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Bonus</th>
            <th scope="col" className="px-4 py-3 text-left font-medium">Time</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Minimum</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Example</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((l) => {
            const bank = programs[l.from];
            const state = bonusState(l.bonus, asOf);
            const ex = exampleMath(l, 60_000, asOf);
            return (
              <tr key={l.from} className="border-b border-panel-border last:border-b-0 hover:bg-fg/[0.03]">
                <td className="px-4 py-3">
                  <Link href={`/programs/${l.from}`} className={cn("inline-flex items-center gap-2.5 rounded-full", focusRing)}>
                    <ProgramLogo id={l.from} name={bank?.shortName ?? l.from} color={bank?.color} size={28} />
                    <span className="font-medium text-fg">{bank?.shortName ?? l.from}</span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-right font-mono tnum text-fg">
                  {fmtRatio(l.ratio)}
                  {state === "active" && <span className="ml-1.5 text-xs text-aurora">→ {fmtEffectiveRatio(l, asOf)}</span>}
                </td>
                <td className="px-4 py-3">
                  {l.bonus && state !== "expired" ? (
                    <Badge variant={state === "active" ? "aurora" : "sky"} size="sm" dot pulse={state === "active"}>
                      {state === "upcoming" ? `${bonusLabel(l.bonus).replace(" to ", " from ")}` : bonusLabel(l.bonus)}
                    </Badge>
                  ) : (
                    <span className="text-fg-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center gap-1.5 text-fg-muted">
                    <TransferTimeIcon time={l.transferTime} />
                    {TRANSFER_TIME_META[l.transferTime].label}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono tnum text-fg-muted">{fmtInt(l.minimum)}</td>
                <td className="px-4 py-3 text-right font-mono tnum text-xs text-fg-muted">
                  {fmtInt(ex.source)} <ArrowRight className="inline size-3 text-fg-faint" aria-hidden="true" />{" "}
                  <span className={state === "active" ? "text-aurora" : "text-fg"}>{fmtInt(ex.dest)}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
