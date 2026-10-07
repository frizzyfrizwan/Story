import { ArrowUpRight, Sparkles } from "lucide-react";
import { cn, fmtCpp } from "@/lib/utils";
import { Card } from "@/components/ui/panel";
import { ProgramLogo } from "@/components/art/program-logo";
import { Tooltip } from "@/components/ui/tooltip";
import { bankLabel } from "@/components/transfers/transfer-utils";
import { AllianceBadge, ChartBadge, SurchargeIndicator, type ProgramSummary } from "./program-meta";

/** Tiny lettered coin for a bank; aurora ring when a bonus is running. */
export function BankCoin({ id, bonus, size = "sm" }: { id: string; bonus?: boolean; size?: "sm" | "md" }) {
  const label = bankLabel(id);
  const letters = id === "capital-one" ? "C1" : id === "wells-fargo" ? "WF" : label.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full border font-mono font-semibold leading-none text-fg-muted",
        size === "sm" ? "size-6 text-[9px]" : "size-7 text-[10px]",
        bonus ? "border-aurora/60 bg-aurora-soft text-aurora" : "border-panel-border-strong bg-bg-elev-2",
      )}
      title={bonus ? `${label} — transfer bonus running` : label}
    >
      {letters}
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function ProgramCard({ program, className }: { program: ProgramSummary; className?: string }) {
  const p = program;
  return (
    <Card
      href={`/programs/${p.id}`}
      padding="sm"
      as="article"
      className={cn("group flex h-full flex-col gap-3 p-4 hover:border-panel-border-strong", className)}
    >
      <div className="flex items-start gap-3">
        <ProgramLogo id={p.id} name={p.shortName} color={p.color} size={40} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-[17px] leading-tight tracking-tight text-fg">{p.name}</h3>
          <p className="mt-0.5 truncate text-xs text-fg-subtle">{p.currency}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-mono tnum text-lg font-medium leading-none text-fg">{fmtCpp(p.valuationCpp)}</div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">per pt</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <ChartBadge chartType={p.chartType} />
        <AllianceBadge alliance={p.alliance} />
      </div>

      <div className="mt-auto flex items-end justify-between gap-3 border-t border-panel-border pt-3">
        <div className="flex flex-col gap-1.5">
          {p.kind !== "bank" && <SurchargeIndicator level={p.surcharges} />}
          <span className="inline-flex items-center gap-1 text-[11px] text-fg-subtle">
            <Sparkles className="size-3 text-signal" aria-hidden="true" />
            {p.sweetSpots} sweet {p.sweetSpots === 1 ? "spot" : "spots"}
            {p.kind === "airline" && p.carriers > 0 && <span className="text-fg-faint"> · {p.carriers} carriers</span>}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {p.banks.length > 0 ? (
            <Tooltip content={`Transfer in from ${p.banks.map(bankLabel).join(", ")}`}>
              <span className="flex -space-x-1.5">
                {p.banks.slice(0, 6).map((b) => (
                  <BankCoin key={b} id={b} bonus={p.bonusBanks.includes(b)} />
                ))}
              </span>
            </Tooltip>
          ) : p.kind === "bank" ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">Source</span>
          ) : (
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-fg-faint">No bank transfers</span>
          )}
          <ArrowUpRight className="ml-1 size-4 text-fg-faint transition-colors group-hover:text-signal" aria-hidden="true" />
        </div>
      </div>
    </Card>
  );
}
