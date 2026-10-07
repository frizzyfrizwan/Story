"use client";

import { useMemo, useState } from "react";
import { CalendarClock, FileSpreadsheet, Plus } from "lucide-react";
import type { Balance } from "@/lib/types";
import { CARDS } from "@/data/cards";
import { PROGRAMS, PROGRAM_BY_ID } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { fmtInt, fmtUsd, todayISO } from "@/lib/utils";
import { walletValueUsd } from "@/lib/wallet/affordability";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { StatTile } from "@/components/ui/stat";
import { KIND_META } from "@/components/programs/program-meta";
import { fmtShortDate } from "@/components/transfers/transfer-utils";
import { AddBalanceDialog } from "./add-balance-dialog";
import { BalanceCard } from "./balance-card";
import { BookableNow } from "./bookable-now";
import { CardOptimizer } from "./card-optimizer";
import { ImportCsvDialog } from "./import-csv-dialog";
import { ReachPanel } from "./reach-panel";
import { useBalances, useDeleteBalance, useImportCsv, useTransferLinks, useUpsertBalance } from "./use-wallet";
import { daysToExpiry, groupBalances, isExpiringSoon } from "./wallet-utils";

export interface WalletDashboardProps {
  initialBalances: Balance[];
  homeAirport: string;
  firstName?: string | null;
}

export function WalletDashboard({ initialBalances, homeAirport, firstName }: WalletDashboardProps) {
  const asOf = todayISO();
  const { data: balances = [] } = useBalances(initialBalances);
  const { links } = useTransferLinks(TRANSFER_LINKS);
  const upsert = useUpsertBalance();
  const remove = useDeleteBalance();
  const importCsv = useImportCsv();

  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Balance | null>(null);
  const [importOpen, setImportOpen] = useState(false);

  const totals = useMemo(() => {
    const points = balances.reduce((n, b) => n + b.amount, 0);
    const value = walletValueUsd(balances, PROGRAM_BY_ID);
    const expiring = balances.filter((b) => isExpiringSoon(b, asOf));
    const soonest = expiring.map((b) => ({ b, days: daysToExpiry(b, asOf) ?? 0 })).sort((a, b) => a.days - b.days)[0];
    return { points, value, programs: balances.length, expiring: expiring.length, soonest };
  }, [balances, asOf]);

  const { groups, unknown } = useMemo(() => groupBalances(balances, PROGRAM_BY_ID), [balances]);

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Wallet</p>
          <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl balance-text">
            {firstName ? `${firstName}'s points` : "Your points"}, <span className="text-gradient-signal">priced.</span>
          </h1>
          <p className="mt-3 max-w-xl text-[15px] text-fg-muted pretty-text">
            Balances stay private. Valuations are editorial, transfers use today&apos;s ratios and bonuses, and deals are matched from {homeAirport}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" leading={<FileSpreadsheet />} onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
          <Button
            variant="primary"
            leading={<Plus />}
            onClick={() => {
              setEditing(null);
              setAddOpen(true);
            }}
          >
            Add balance
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total points" value={totals.points} format={fmtInt} animate tone="signal" hint="across every program" />
        <StatTile label="Estimated value" value={totals.value} format={fmtUsd} animate tone="aurora" hint="at Kestrel valuations" />
        <StatTile
          label="Programs"
          value={totals.programs}
          format={fmtInt}
          tone="sky"
          hint={groups.map((g) => `${g.items.length} ${KIND_META[g.kind].label.split(" ")[0].toLowerCase()}`).join(" · ") || "none yet"}
        />
        <StatTile
          label="Expiring soon"
          value={totals.expiring}
          format={fmtInt}
          tone={totals.expiring ? "rose" : "aurora"}
          icon={<CalendarClock />}
          hint={
            totals.soonest
              ? `${PROGRAM_BY_ID[totals.soonest.b.programId]?.shortName ?? totals.soonest.b.programId} on ${fmtShortDate(totals.soonest.b.expiresAt!)}`
              : "nothing within 90 days"
          }
        />
      </div>

      {balances.length === 0 ? (
        <EmptyState
          title="Your wallet is empty"
          description="Add the programs you hold points in. Kestrel then shows what you can book today and how far transfers take you."
          action={
            <Button variant="primary" leading={<Plus />} onClick={() => setAddOpen(true)}>
              Add your first balance
            </Button>
          }
          secondaryAction={
            <Button variant="secondary" leading={<FileSpreadsheet />} onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {groups.map((g) => (
            <section key={g.kind} aria-labelledby={`wallet-${g.kind}`}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 id={`wallet-${g.kind}`} className="font-display text-xl tracking-tight text-fg">
                  {KIND_META[g.kind].plural}
                </h2>
                <span className="font-mono text-xs tnum text-fg-subtle">
                  {fmtInt(g.items.reduce((n, b) => n + b.amount, 0))} pts · {fmtUsd(walletValueUsd(g.items, PROGRAM_BY_ID))}
                </span>
                <span className="hairline flex-1 self-center" aria-hidden="true" />
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {g.items.map((b) => (
                  <li key={b.programId} className="animate-rise">
                    <BalanceCard
                      balance={b}
                      program={PROGRAM_BY_ID[b.programId]}
                      asOf={asOf}
                      saving={upsert.isPending && upsert.variables?.programId === b.programId}
                      onSaveAmount={(amount) => upsert.mutateAsync({ programId: b.programId, amount, status: b.status, expiresAt: b.expiresAt })}
                      onEdit={() => {
                        setEditing(b);
                        setAddOpen(true);
                      }}
                      onDelete={() => remove.mutate(b.programId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {unknown.length > 0 && (
            <section aria-label="Unrecognised programs">
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {unknown.map((b) => (
                  <li key={b.programId}>
                    <BalanceCard
                      balance={b}
                      program={undefined}
                      asOf={asOf}
                      onSaveAmount={(amount) => upsert.mutateAsync({ programId: b.programId, amount })}
                      onEdit={() => {
                        setEditing(b);
                        setAddOpen(true);
                      }}
                      onDelete={() => remove.mutate(b.programId)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <ReachPanel balances={balances} links={links} programs={PROGRAM_BY_ID} asOf={asOf} className="lg:col-span-2" />
        <div className="lg:col-span-3">
          <BookableNow balances={balances} links={links} programs={PROGRAM_BY_ID} origin={homeAirport} />
        </div>
      </div>

      <CardOptimizer cards={CARDS} balances={balances} programs={PROGRAM_BY_ID} />

      <AddBalanceDialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) setEditing(null);
        }}
        programs={PROGRAMS}
        initial={editing}
        pending={upsert.isPending}
        onSubmit={(input) => upsert.mutateAsync(input)}
      />
      <ImportCsvDialog open={importOpen} onOpenChange={setImportOpen} programs={PROGRAMS} pending={importCsv.isPending} onImport={(csv) => importCsv.mutateAsync(csv)} />
    </div>
  );
}
