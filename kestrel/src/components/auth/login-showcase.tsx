"use client";

import { ArrowLeftRight, Bell, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { KestrelLockup } from "@/components/brand/logo";
import { DepartureBoard, type BoardRow } from "@/components/viz/split-flap";

const BULLETS = [
  {
    icon: Search,
    title: "Every award seat, one search",
    body: "40+ programs priced side by side, with the taxes and the transfer path spelled out.",
  },
  {
    icon: ArrowLeftRight,
    title: "Transfer math done for you",
    body: "See which bank points reach the seat fastest, bonuses included.",
  },
  {
    icon: Bell,
    title: "Alerts that fire when space opens",
    body: "Watch a route and a date window; we check it for you and ping you the moment seats appear.",
  },
] as const;

/** Illustrative rows — the real board lives on /search. */
const ROWS: BoardRow[] = [
  { time: "18:40", flight: "SQ 21", destination: "SINGAPORE", cabin: "F", miles: 132000, status: "AVAILABLE" },
  { time: "21:15", flight: "NH 9", destination: "TOKYO HND", cabin: "F", miles: 72500, status: "FEW SEATS" },
  { time: "09:30", flight: "LH 401", destination: "FRANKFURT", cabin: "J", miles: 70000, status: "WIDE OPEN" },
  { time: "22:05", flight: "QR 702", destination: "DOHA", cabin: "J", miles: 70000, status: "AVAILABLE" },
];

/** Left half of the login page: lockup, headline, three reasons to care, a small split-flap board. */
export function LoginShowcase({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-8 animate-rise", className)}>
      <KestrelLockup size="lg" />

      <div>
        <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl lg:text-[3.5rem] balance-text">
          Fly better <span className="text-gradient-signal">on points.</span>
        </h1>
        <p className="mt-4 max-w-md text-[15px] leading-relaxed text-fg-muted pretty-text">
          Kestrel is the award-travel engine: live seat search, transfer-partner intelligence and alerts, in one cockpit.
        </p>
      </div>

      <ul className="grid gap-4">
        {BULLETS.map((b) => (
          <li key={b.title} className="flex gap-3.5">
            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-panel-border bg-bg-elev-1 text-signal">
              <b.icon className="size-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-fg">{b.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-fg-muted pretty-text">{b.body}</p>
            </div>
          </li>
        ))}
      </ul>

      <DepartureBoard
        rows={ROWS}
        title="Award departures"
        subtitle="Illustrative"
        size="xs"
        live={false}
        columns={["time", "flight", "destination", "cabin", "status"]}
        className="hidden max-w-2xl lg:block"
      />
    </div>
  );
}
