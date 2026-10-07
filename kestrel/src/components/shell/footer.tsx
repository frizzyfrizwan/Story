"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { KestrelLockup } from "@/components/brand/logo";
import { focusRing } from "@/components/ui/tokens";

const COLUMNS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Award search", href: "/search" },
      { label: "Explore routes", href: "/explore" },
      { label: "Hotel awards", href: "/hotels" },
      { label: "Live flights", href: "/live" },
      { label: "Wallet", href: "/wallet" },
      { label: "Community finds", href: "/finds" },
      { label: "AI concierge", href: "/concierge" },
      { label: "Alerts", href: "/alerts" },
    ],
  },
  {
    title: "Programs",
    links: [
      { label: "Aeroplan", href: "/programs/aeroplan" },
      { label: "ANA Mileage Club", href: "/programs/ana-mileage-club" },
      { label: "Avianca LifeMiles", href: "/programs/avianca-lifemiles" },
      { label: "Flying Blue", href: "/programs/flying-blue" },
      { label: "Virgin Atlantic", href: "/programs/virgin-atlantic-flying-club" },
      { label: "World of Hyatt", href: "/programs/world-of-hyatt" },
      { label: "All programs", href: "/programs" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
      { label: "Blog", href: "/blog" },
      { label: "Contact", href: "/contact" },
      { label: "Status", href: "/status" },
    ],
  },
];

const LEGAL = [
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
  { label: "Cookies", href: "/cookies" },
];

const link = cn("rounded-[4px] text-sm text-fg-muted transition-colors hover:text-fg", focusRing);

/** Editorial footer: lockup + three link columns, legal line, live UTC clock. Hidden on the home page by the shell. */
export function Footer({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <footer className={cn("relative border-t border-panel-border bg-bg-elev-1/40", className)}>
      <div className="mx-auto max-w-7xl px-4 pb-24 pt-12 sm:px-6 lg:pb-12">
        <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-[1.5fr_repeat(3,1fr)]">
          <div className="sm:col-span-2 md:col-span-1">
            <KestrelLockup />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-fg-muted pretty-text">
              See every award seat. Spend fewer points. Live search across 40+ programs, transfer-partner intelligence
              and an AI concierge.
            </p>
            <UtcClock className="mt-5" />
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className={link}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-panel-border pt-6 text-xs text-fg-subtle sm:flex-row sm:items-center sm:justify-between">
          <p className="pretty-text">
            © {year} Kestrel. Award data is informational; confirm pricing and availability with the program before
            booking.
          </p>
          <ul className="flex items-center gap-4">
            {LEGAL.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className={cn("rounded-[4px] transition-colors hover:text-fg", focusRing)}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

/** Departure-board style UTC clock — the one time zone every flight shares. */
function UtcClock({ className }: { className?: string }) {
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date().toISOString().slice(11, 19));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 font-mono text-[11px] tnum tracking-[0.12em] text-fg-subtle",
        className,
      )}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-aurora motion-safe:animate-pulse-soft" />
      <span>
        UTC <span className="text-fg-muted">{now ?? "--:--:--"}</span>
      </span>
    </p>
  );
}
