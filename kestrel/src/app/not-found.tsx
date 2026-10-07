import Link from "next/link";
import type { Metadata } from "next";
import { House, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { focusRing } from "@/components/ui/tokens";

export const metadata: Metadata = { title: "Gate not found" };

type Tone = "default" | "rose" | "aurora" | "gold";

const TONE: Record<Tone, string> = {
  default: "text-fg",
  rose: "text-rose",
  aurora: "text-aurora",
  gold: "text-gold",
};

/** A row of split-flap tiles. Each character flips in with a small stagger. */
function Flaps({ text, tone = "default", offset = 0 }: { text: string; tone?: Tone; offset?: number }) {
  return (
    <span className="inline-flex gap-[3px]">
      <span className="sr-only">{text}</span>
      {text.split("").map((ch, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            "inline-grid h-7 w-[17px] place-items-center rounded-[4px] bg-bg-elev-3 font-mono text-[11px] font-semibold uppercase leading-none [transform-style:preserve-3d] motion-safe:animate-flap sm:h-9 sm:w-6 sm:text-sm",
            ch === " " ? "bg-transparent" : "shadow-[inset_0_-1px_0_var(--panel-border)]",
            TONE[tone],
          )}
          style={{ animationDelay: `${(offset + i) * 35}ms` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );
}

const ROWS: { flight: string; destination: string; time: string; status: string; tone: Tone; href?: string }[] = [
  { flight: "KS404", destination: "GATE NOT FOUND", time: "--:--", status: "NO ROUTE", tone: "rose" },
  { flight: "KS001", destination: "SEARCH AWARDS", time: "NOW", status: "BOARDING", tone: "aurora", href: "/search" },
  { flight: "KS002", destination: "EXPLORE ROUTES", time: "NOW", status: "ON TIME", tone: "default", href: "/explore" },
  { flight: "KS003", destination: "CONCIERGE", time: "NOW", status: "ON TIME", tone: "default", href: "/concierge" },
];

export default function NotFound() {
  return (
    <section className="aurora-bg min-h-[70dvh] px-4 py-12 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl animate-rise">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-signal">Error 404 · Departures</p>

        <div className="panel panel-strong grain mt-4 overflow-x-auto p-4 scrollbar-none sm:p-6">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[72px_1fr_64px_96px] gap-4 border-b border-panel-border pb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle sm:grid-cols-[96px_1fr_80px_120px]">
              <span>Flight</span>
              <span>Destination</span>
              <span>Time</span>
              <span>Status</span>
            </div>
            {ROWS.map((row, r) => {
              const inner = (
                <>
                  <Flaps text={row.flight} offset={r * 8} />
                  <Flaps text={row.destination} offset={r * 8 + 5} />
                  <Flaps text={row.time} offset={r * 8 + 18} />
                  <Flaps text={row.status} tone={row.tone} offset={r * 8 + 22} />
                </>
              );
              const rowClass =
                "grid grid-cols-[72px_1fr_64px_96px] items-center gap-4 border-b border-panel-border py-3 last:border-b-0 sm:grid-cols-[96px_1fr_80px_120px]";
              return row.href ? (
                <Link
                  key={row.flight}
                  href={row.href}
                  className={cn(rowClass, "-mx-2 rounded-[8px] px-2 transition-colors hover:bg-fg/5", focusRing)}
                  aria-label={`${row.destination.toLowerCase()} — ${row.status.toLowerCase()}`}
                >
                  {inner}
                </Link>
              ) : (
                <div key={row.flight} className={rowClass}>
                  {inner}
                </div>
              );
            })}
          </div>
        </div>

        <h1 className="mt-10 font-display text-4xl leading-[1.02] tracking-tight sm:text-5xl balance-text">
          This gate isn&apos;t on the board.
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-muted pretty-text">
          The page you asked for isn&apos;t in the schedule. It may have moved, or the link was mistyped. The departures
          above still go somewhere useful.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Button href="/search" leading={<Search />}>
            Search awards
          </Button>
          <Button href="/" variant="secondary" leading={<House />}>
            Back to home
          </Button>
        </div>
      </div>
    </section>
  );
}
