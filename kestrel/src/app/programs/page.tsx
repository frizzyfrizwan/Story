import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowLeftRight } from "lucide-react";
import { PROGRAMS } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { fmtInt, todayISO } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProgramIndex } from "@/components/programs/program-index";
import { toProgramSummary } from "@/components/programs/program-meta";
import { isBonusActive } from "@/components/transfers/transfer-utils";

export const metadata: Metadata = {
  title: "Loyalty programs",
  description:
    "Every airline, hotel and bank currency Kestrel prices: valuations, award chart types, fuel surcharges, transfer partners and the sweet spots worth knowing for each.",
  alternates: { canonical: "/programs" },
  openGraph: { title: "Loyalty programs · Kestrel", description: "Valuations, award charts, surcharges and sweet spots for 49 programs." },
};

export const revalidate = 3600;

export default function ProgramsPage() {
  const asOf = todayISO();
  const summaries = PROGRAMS.map((p) => toProgramSummary(p, TRANSFER_LINKS, (l) => isBonusActive(l, asOf)));
  const counts = {
    bank: summaries.filter((p) => p.kind === "bank").length,
    airline: summaries.filter((p) => p.kind === "airline").length,
    hotel: summaries.filter((p) => p.kind === "hotel").length,
    sweetSpots: summaries.reduce((n, p) => n + p.sweetSpots, 0),
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Programs</p>
          <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl balance-text">
            Every currency, <span className="text-gradient-signal">priced honestly.</span>
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-fg-muted pretty-text">
            {counts.bank} bank currencies, {counts.airline} airline programs and {counts.hotel} hotel programs with editorial
            valuations, chart types, surcharge exposure and {fmtInt(counts.sweetSpots)} documented sweet spots. Every page is
            kept in step with the transfer matrix.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button href="/transfers" variant="secondary" leading={<ArrowLeftRight />}>
            Transfer partners
          </Button>
          <Button href="/search" variant="primary" trailing={<ArrowRight />}>
            Search awards
          </Button>
        </div>
      </header>

      <ProgramIndex programs={summaries} />

      <p className="mt-12 text-xs text-fg-subtle">
        Valuations are Kestrel&apos;s editorial cents-per-point estimates, verified October 2026. Program rules change often —
        check the{" "}
        <Link href="/transfers" className="text-sky underline-offset-4 hover:underline">
          live transfer matrix
        </Link>{" "}
        before moving points.
      </p>
    </div>
  );
}
