import type { Metadata } from "next";
import { ArrowRight, Landmark } from "lucide-react";
import { PROGRAMS } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TransferMatrix } from "@/components/transfers/transfer-matrix";
import type { ProgramLite } from "@/components/transfers/transfer-cell";
import { isBonusActive } from "@/components/transfers/transfer-utils";

export const metadata: Metadata = {
  title: "Transfer partners",
  description:
    "The definitive bank-to-airline and bank-to-hotel transfer matrix: Amex, Chase, Citi, Capital One, Bilt and Wells Fargo ratios, posting times, minimums and every live transfer bonus.",
  alternates: { canonical: "/transfers" },
  openGraph: {
    title: "Transfer partners · Kestrel",
    description: "Every bank → airline and hotel transfer ratio, posting time and live bonus in one matrix.",
  },
};

export const revalidate = 600;

export default function TransfersPage() {
  const asOf = todayISO();
  const programs: Record<string, ProgramLite> = Object.fromEntries(
    PROGRAMS.map((p) => [p.id, { id: p.id, name: p.name, shortName: p.shortName, color: p.color, kind: p.kind, alliance: p.alliance }]),
  );
  const destinations = new Set(TRANSFER_LINKS.map((l) => l.to)).size;
  const banks = new Set(TRANSFER_LINKS.map((l) => l.from)).size;
  const bonuses = TRANSFER_LINKS.filter((l) => isBonusActive(l, asOf)).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Transfer partners</p>
          <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl balance-text">
            {banks} banks. {destinations} currencies. <span className="text-gradient-signal">One matrix.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted pretty-text">
            Ratios, posting times and minimums for every US transferable currency, verified October 2026.
            {bonuses > 0 ? ` ${bonuses} transfer ${bonuses === 1 ? "bonus is" : "bonuses are"} running today — aurora pills mark them.` : " Aurora pills mark bonuses when they run."}{" "}
            Click any cell for the maths.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/programs" variant="secondary" leading={<Landmark />}>
            Program guides
          </Button>
          <Button href="/wallet" variant="primary" trailing={<ArrowRight />}>
            What can my points book?
          </Button>
        </div>
      </header>

      <TransferMatrix initialLinks={TRANSFER_LINKS} programs={programs} />
    </div>
  );
}
