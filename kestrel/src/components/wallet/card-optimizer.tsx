"use client";

import { useMemo, useState } from "react";
import { CreditCard as CreditCardIcon, Wallet } from "lucide-react";
import type { Balance, CreditCard, LoyaltyProgram, SpendCategory } from "@/lib/types";
import { cn, fmtCpp, fmtUsd } from "@/lib/utils";
import { CardArt } from "@/components/art/card-art";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SPEND_CATEGORIES, rankCards } from "./wallet-utils";

export interface CardOptimizerProps {
  cards: CreditCard[];
  balances: Balance[];
  programs: Record<string, LoyaltyProgram>;
}

const fmtMult = (m: number) => `${Number.isInteger(m) ? m : m.toFixed(2).replace(/0+$/, "")}×`;

export function CardOptimizer({ cards, balances, programs }: CardOptimizerProps) {
  const [category, setCategory] = useState<SpendCategory>("dining");
  const [monthly, setMonthly] = useState(1500);
  const [onlyHeld, setOnlyHeld] = useState(false);
  const held = useMemo(() => new Set(balances.map((b) => b.programId)), [balances]);
  const ranked = useMemo(() => {
    const list = rankCards(cards, category, monthly, programs, held);
    return onlyHeld ? list.filter((r) => r.held) : list;
  }, [cards, category, monthly, programs, held, onlyHeld]);
  const label = SPEND_CATEGORIES.find((c) => c.value === category)?.label.toLowerCase() ?? category;
  const top = ranked.slice(0, 3);
  const rest = ranked.slice(3, 10);

  if (!cards.length) {
    return (
      <Panel eyebrow="Card optimizer" title="Which card should you swipe?">
        <EmptyState
          compact
          icon={<CreditCardIcon />}
          title="Card data is on its way"
          description="The optimizer ranks every major rewards card by points × valuation for a spend category. It lights up as soon as the card catalogue lands."
        />
      </Panel>
    );
  }

  return (
    <Panel
      eyebrow="Card optimizer"
      title="Which card should you swipe?"
      description="Ranked by points earned × Kestrel valuation per dollar. Portal-only multipliers are noted."
    >
      <div className="grid gap-4 md:grid-cols-[14rem_1fr_auto] md:items-end">
        <Select<SpendCategory>
          value={category}
          onValueChange={setCategory}
          options={SPEND_CATEGORIES}
          aria-label="Spend category"
          size="sm"
        />
        <Slider
          label="Monthly spend"
          value={[monthly]}
          onValueChange={([v]) => setMonthly(v)}
          min={100}
          max={6000}
          step={50}
          formatValue={(v) => fmtUsd(v)}
          marks={[1000, 2500, 5000]}
        />
        <Switch size="sm" checked={onlyHeld} onCheckedChange={setOnlyHeld} label="Only currencies I hold" controlFirst className="min-h-9 md:pb-2" />
      </div>

      {ranked.length === 0 ? (
        <EmptyState compact illustration="none" icon={<Wallet />} title="No matching cards" description="Turn off the wallet filter to see every card." />
      ) : (
        <>
          <ol className="mt-6 grid gap-5 sm:grid-cols-3">
            {top.map((r, i) => {
              const program = programs[r.card.currency];
              return (
                <li key={r.card.id} className="flex flex-col gap-3">
                  <div className="relative">
                    <CardArt
                      name={r.card.name.replace(/ (Card|Credit Card)( from American Express)?$/i, "")}
                      issuer={r.card.issuer}
                      from={r.card.art.from}
                      to={r.card.art.to}
                      accent={r.card.art.accent}
                      network={r.card.network}
                      className="max-w-none"
                    />
                    <span className="pointer-events-none absolute -left-2 -top-2 grid size-7 place-items-center rounded-full border border-panel-border-strong bg-bg-elev-3 font-mono text-xs font-semibold text-fg shadow-panel">
                      {i + 1}
                    </span>
                    <span className="pointer-events-none absolute -right-2 -top-2 inline-flex items-center gap-1 rounded-full border border-signal/40 bg-signal-soft px-2 py-1 font-mono text-[11px] font-semibold text-signal shadow-panel backdrop-blur">
                      {fmtMult(r.earn.multiplier)} {label}
                    </span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-fg">{r.card.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-fg-subtle">
                        <ProgramLogo id={r.card.currency} name={program?.shortName ?? r.card.currency} color={program?.color} size={14} />
                        {program?.shortName ?? r.card.currency} @ {fmtCpp(r.cpp)}
                        {r.held && (
                          <Badge variant="aurora" size="sm">
                            In your wallet
                          </Badge>
                        )}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="font-mono tnum text-lg leading-none text-fg">{fmtUsd(r.monthlyValueUsd)}</div>
                      <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-fg-subtle">per month</div>
                    </div>
                  </div>
                  {r.earn.note && <p className="text-[11px] leading-snug text-fg-subtle">{r.earn.note}</p>}
                  <p className="font-mono text-[11px] tnum text-fg-subtle">
                    {fmtCpp(r.centsPerDollar)} per $ · {r.card.annualFeeUsd ? `${fmtUsd(r.card.annualFeeUsd)} fee` : "no fee"}
                  </p>
                </li>
              );
            })}
          </ol>

          {rest.length > 0 && (
            <ol className="mt-6 divide-y divide-panel-border rounded-[var(--radius)] border border-panel-border bg-bg-elev-1" start={4}>
              {rest.map((r, i) => {
                const program = programs[r.card.currency];
                return (
                  <li key={r.card.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <span className="w-5 font-mono text-xs tnum text-fg-subtle">{i + 4}</span>
                    <span
                      aria-hidden="true"
                      className="h-6 w-9 shrink-0 rounded-[4px] border border-panel-border"
                      style={{ background: `linear-gradient(135deg, ${r.card.art.from}, ${r.card.art.to})` }}
                    />
                    <span className="min-w-0 flex-1 truncate text-fg">{r.card.name}</span>
                    <span className="hidden items-center gap-1.5 text-xs text-fg-subtle sm:inline-flex">
                      <ProgramLogo id={r.card.currency} name={program?.shortName ?? r.card.currency} color={program?.color} size={14} />
                      {program?.shortName ?? r.card.currency}
                    </span>
                    {r.held && <span className="size-1.5 rounded-full bg-aurora" title="In your wallet" />}
                    <span className={cn("font-mono tnum text-xs", r.earn.via === category ? "text-fg" : "text-fg-subtle")}>{fmtMult(r.earn.multiplier)}</span>
                    <span className="w-16 text-right font-mono tnum text-fg">{fmtUsd(r.monthlyValueUsd)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </>
      )}
    </Panel>
  );
}
