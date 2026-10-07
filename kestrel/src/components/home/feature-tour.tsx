import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { cn, fmtCompact, fmtCpp, fmtInt, fmtUsd } from "@/lib/utils";
import type { TransferLink } from "@/lib/types";
import { getAirline } from "@/data/airlines";
import { getProgram } from "@/data/programs";
import { transferLink, transfersTo } from "@/data/transfers";
import { HOTELS } from "@/data/hotels";
import { AirlineTail, CityPostcard, RadarRings, type PostcardMotif } from "@/components/art";
import { BoardingPass, RouteLine } from "@/components/viz";
import { Badge, CabinBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { focusRing } from "@/components/ui/tokens";
import { DemoCalendar } from "./demo-calendar";
import { CheckGlyph, PLANE_GLYPH } from "./glyphs";
import { Accent, HomeSection } from "./home-section";
import { Reveal } from "./reveal";

type Tone = "signal" | "aurora" | "violet" | "gold" | "sky";
const EYEBROW: Record<Tone, string> = {
  signal: "text-signal",
  aurora: "text-aurora",
  violet: "text-violet",
  gold: "text-gold",
  sky: "text-sky",
};

// ─── Row ──────────────────────────────────────────────────────

function TourRow({
  eyebrow,
  title,
  body,
  cta,
  tone = "signal",
  flip,
  visual,
}: {
  eyebrow: string;
  title: ReactNode;
  body: string;
  cta: { label: string; href: string };
  tone?: Tone;
  /** Visual on the left on desktop */
  flip?: boolean;
  visual: ReactNode;
}) {
  return (
    <Reveal as="article" className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={cn("max-w-lg", flip && "lg:order-2")}>
        <p className={cn("font-mono text-[11px] uppercase tracking-[0.2em]", EYEBROW[tone])}>{eyebrow}</p>
        <h3 className="mt-3 font-display text-2xl leading-[1.08] tracking-tight text-fg sm:text-3xl lg:text-4xl balance-text">
          {title}
        </h3>
        <p className="mt-4 text-[15px] leading-relaxed text-fg-muted pretty-text">{body}</p>
        <Button href={cta.href} variant="secondary" className="mt-6" trailing={<ArrowRight />}>
          {cta.label}
        </Button>
      </div>
      <div className={cn("min-w-0", flip && "lg:order-1")}>{visual}</div>
    </Reveal>
  );
}

// ─── Wallet-aware boarding pass ───────────────────────────────

/** The cheapest active way into a program from a bank currency, preferring a live bonus. */
function bestTransferInto(programId: string, today: string): { link: TransferLink; pct: number } | null {
  const links = transfersTo(programId);
  if (!links.length) return null;
  const active = (l: TransferLink) =>
    l.bonus && l.bonus.startsAt <= today && today <= l.bonus.endsAt ? l.bonus.percent : 0;
  const best =
    [...links].sort((a, b) => active(b) - active(a)).find((l) => active(l) > 0) ??
    links.find((l) => l.from === "amex-mr") ??
    links[0];
  return { link: best, pct: active(best) };
}

function WalletVisual({ today }: { today: string }) {
  const lh = getAirline("LH");
  const aeroplan = getProgram("aeroplan")?.shortName ?? "Aeroplan";
  // Aeroplan's 4,001–6,000-mile Atlantic band after the June 2026 chart: EWR–FRA business one-way.
  const miles = 75_000;
  const taxes = 104;
  const cash = 3_180;
  const cpp = ((cash - taxes) / miles) * 100;
  const t = bestTransferInto("aeroplan", today);
  const bank = t ? getProgram(t.link.from)?.shortName : undefined;
  const needed = t
    ? Math.ceil((miles * t.link.ratio[0]) / t.link.ratio[1] / (1 + t.pct / 100) / 1000) * 1000
    : miles;

  return (
    <BoardingPass
      id="home-sample-lh403"
      carrierColor={lh?.color}
      label="Sample fare"
      barcodeText="KSTRL7"
      carrier={
        <>
          <AirlineTail code="LH" color={lh?.color} size={22} showCode={false} />
          <span className="truncate">Lufthansa · LH 403</span>
        </>
      }
      main={
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <RouteLine origin="EWR" destination="FRA" durationMin={455} carrierColor={lh?.color} />
          <div className="sm:text-right">
            <div className="font-mono text-3xl font-semibold leading-none tnum">{fmtInt(miles)}</div>
            <div className="mt-1.5 text-xs text-fg-muted">
              {aeroplan} points + {fmtUsd(taxes)} taxes
            </div>
            <CabinBadge cabin="business" size="sm" className="mt-2.5" />
          </div>
        </div>
      }
      stub={
        <div className="font-mono text-[11px] leading-5 text-fg-subtle">
          <div>
            SEAT <span className="text-fg">2A</span>
          </div>
          <div>
            CABIN <span className="text-fg">J</span>
          </div>
          <div>
            VALUE <span className="text-aurora">{fmtCpp(cpp)}</span>
          </div>
        </div>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <Badge variant={t && t.pct > 0 ? "violet" : "aurora"} dot size="sm" caps>
            {t && t.pct > 0 ? `+${t.pct}% bonus` : "Covered"}
          </Badge>
          <span>
            Book it with{" "}
            <strong className="font-medium text-fg">
              {bank ?? "your points"} → {aeroplan}
            </strong>
            : <span className="font-mono text-fg tnum">{fmtInt(needed)}</span> points from your wallet.
          </span>
        </div>
      }
    />
  );
}

// ─── Hotels ───────────────────────────────────────────────────

const PICKS: { name: string; city: string; motif: PostcardMotif; fallback: [string, string] }[] = [
  { name: "Park Hyatt Tokyo", city: "Tokyo", motif: "skyline", fallback: ["#141a33", "#d96b8a"] },
  { name: "Park Hyatt Maldives Hadahaa", city: "Maldives", motif: "island", fallback: ["#0a6f8c", "#aee6f0"] },
  { name: "Alila Ventana Big Sur", city: "Big Sur", motif: "coast", fallback: ["#1f3a2e", "#8fb98a"] },
];

function HotelsVisual() {
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
      {PICKS.map((p) => {
        const h = HOTELS.find((x) => x.name === p.name);
        const program = h ? getProgram(h.programId) : undefined;
        const [from, to] = h ? [h.art.from, h.art.to] : p.fallback;
        const points = h?.avgPointsPerNight;
        return (
          <figure key={p.name} className="w-[16rem] shrink-0 snap-start sm:w-auto">
            <CityPostcard
              name={p.city}
              motif={p.motif}
              from={from}
              to={to}
              size="md"
              className="w-full"
              subtitle={program?.shortName ?? h?.brand ?? "Hotel award"}
            >
              {points != null && (
                <div className="absolute right-2.5 top-2.5 rounded-full border border-panel-border-strong bg-bg/70 px-2.5 py-1 font-mono text-[11px] text-fg backdrop-blur-md tnum">
                  {fmtCompact(points).toUpperCase()} pts/night
                </div>
              )}
            </CityPostcard>
            <figcaption className="mt-2.5 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate font-medium text-fg">{h?.name ?? p.name}</span>
              {h && <span className="shrink-0 font-mono text-fg-subtle tnum">~{fmtUsd(h.avgCashUsd)} cash</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}

// ─── Live flights ─────────────────────────────────────────────

const PLANES = [
  { x: 118, y: 150, a: 52, call: "DLH400", color: "var(--aurora)" },
  { x: 236, y: 92, a: 78, call: "UAL14", color: "var(--fg)" },
  { x: 318, y: 206, a: -118, call: "SIA21", color: "var(--signal)" },
];

function LiveVisual() {
  return (
    <div className="dot-grid relative aspect-[4/3] overflow-hidden rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 shadow-panel">
      <div className="absolute inset-0 grid place-items-center">
        <RadarRings size={300} tone="aurora" />
      </div>
      <svg viewBox="0 0 400 300" className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
        <path d="M-10 236 Q150 40 410 70" stroke="var(--panel-border-strong)" strokeDasharray="3 6" />
        <path d="M-10 120 Q210 10 410 190" stroke="var(--panel-border-strong)" strokeDasharray="3 6" />
        <path d="M40 310 Q240 250 410 20" stroke="var(--panel-border-strong)" strokeDasharray="3 6" />
        {PLANES.map((p) => (
          <g key={p.call} transform={`translate(${p.x} ${p.y})`}>
            <circle r={13} fill="var(--bg-elev-1)" opacity={0.85} />
            <path d={PLANE_GLYPH} transform={`rotate(${p.a}) translate(-12 -12)`} fill={p.color} />
            <text x={17} y={4} fontSize={10} fill="var(--fg-muted)" style={{ fontFamily: "var(--font-mono)" }}>
              {p.call}
            </text>
          </g>
        ))}
      </svg>
      <div className="absolute left-4 top-4 flex items-center gap-2">
        <Badge variant="sky" dot caps size="sm">
          Preview
        </Badge>
        <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">OpenSky feed · North Atlantic</span>
      </div>
      <div className="absolute inset-x-4 bottom-4 flex items-center justify-between font-mono text-[11px] text-fg-muted tnum">
        <span>DLH400 · FL380 · 487 kt</span>
        <span>Drag, zoom, tap a plane</span>
      </div>
    </div>
  );
}

// ─── Concierge ────────────────────────────────────────────────

function Bubble({ side, children }: { side: "user" | "ai"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "max-w-[88%] rounded-[18px] px-4 py-2.5 text-sm leading-relaxed text-fg",
        side === "user"
          ? "self-end rounded-br-[6px] bg-bg-elev-3"
          : "self-start rounded-bl-[6px] border border-violet/20 bg-violet-soft",
      )}
    >
      {children}
    </div>
  );
}

function ToolChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-violet/25 bg-violet-soft px-2.5 py-1 font-mono text-[11px] text-violet">
      <CheckGlyph className="size-3" />
      {children}
    </span>
  );
}

function ConciergeVisual({ today }: { today: string }) {
  const vs = transferLink("amex-mr", "virgin-atlantic-flying-club");
  const pct = vs?.bonus && vs.bonus.startsAt <= today && today <= vs.bonus.endsAt ? vs.bonus.percent : 0;
  const holding = 180_000;
  const perSeat = 60_000;
  const after = Math.round(holding * (1 + pct / 100));

  return (
    <Panel grain as="div" padding="md" className="border-violet/25">
      <div className="flex items-center gap-3 border-b border-panel-border pb-3">
        <span className="grid size-9 place-items-center rounded-full bg-violet-soft text-violet">
          <Sparkles className="size-4" aria-hidden="true" />
        </span>
        <div>
          <p className="text-sm font-medium text-fg">Kestrel concierge</p>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">Sample conversation</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <Bubble side="user">
          Business to Tokyo in May for two. I&apos;ve got {fmtCompact(holding)} Amex points.
        </Bubble>
        <div className="flex flex-wrap gap-1.5 pl-1">
          <ToolChip>Searched JFK→HND · 2 results</ToolChip>
          <ToolChip>
            Checked transfers · Amex → Virgin Atlantic{pct ? ` +${pct}%` : ""}
          </ToolChip>
        </div>
        <Bubble side="ai">
          Two ways in for 14 May.{" "}
          <strong className="font-medium">ANA &ldquo;The Room&rdquo; via Virgin Atlantic</strong> at {fmtInt(perSeat)}{" "}
          points each plus $48 in taxes —{" "}
          {pct
            ? `with this month's ${pct}% bonus your ${fmtCompact(holding)} Amex becomes ${fmtCompact(after)} Virgin, so`
            : "your Amex transfers 1:1, so"}{" "}
          both seats are covered. Or <strong className="font-medium">Aeroplan at 75,000 each</strong> if you want a
          stopover on the way. Want me to set an alert for the 14th?
        </Bubble>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Set the alert", "Show the Aeroplan option"].map((s) => (
          <Link
            key={s}
            href="/concierge"
            className={cn(
              "rounded-full border border-panel-border bg-bg-elev-1 px-3 py-1.5 text-xs text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
              focusRing,
            )}
          >
            {s}
          </Link>
        ))}
      </div>
    </Panel>
  );
}

// ─── Section ──────────────────────────────────────────────────

export function FeatureTour({ today }: { today: string }) {
  const hotelCount = Math.floor(HOTELS.length / 10) * 10;
  return (
    <HomeSection
      id="tour"
      eyebrow="The product"
      title={
        <>
          Everything an award expert does, <Accent className="text-signal">built into one search.</Accent>
        </>
      }
      description="Each piece stands on its own. Together they turn a vague wish — business class to Japan, sometime in spring — into a booked seat and a number you can defend."
    >
      <div className="space-y-20 sm:space-y-28">
        <TourRow
          eyebrow="Wallet-aware"
          tone="violet"
          title="Results priced in the points you actually have."
          body="Add your balances once. Every fare then shows the cheapest way in from your wallet: which bank currency to move, at what ratio, and whether this week's transfer bonus closes the gap. No spreadsheet."
          cta={{ label: "Open your wallet", href: "/wallet" }}
          visual={<WalletVisual today={today} />}
        />
        <TourRow
          flip
          eyebrow="Availability calendar"
          tone="aurora"
          title="Two months of inventory, one glance."
          body="Dynamic pricing hides the cheap days. The heat calendar lays out every date on a route with miles and seat counts, so you book the 60k Tuesday instead of the 110k Friday."
          cta={{ label: "Explore routes", href: "/explore" }}
          visual={
            <Panel grain as="div" padding="md">
              <DemoCalendar from={today} />
            </Panel>
          }
        />
        <TourRow
          eyebrow="Hotels"
          tone="gold"
          title="Points nights, priced like a pro."
          body={`Category charts, dynamic pricing, fifth-night-free and peak dates for ${hotelCount}+ properties across Hyatt, Marriott, Hilton, IHG and Accor — plus which card points get you there.`}
          cta={{ label: "Browse hotel awards", href: "/hotels" }}
          visual={<HotelsVisual />}
        />
        <TourRow
          flip
          eyebrow="Live flights"
          tone="sky"
          title="Watch the plane you're about to book."
          body="Every airborne aircraft on a procedural map, with routes, callsigns and status. Pair it with the status feed to see how your award flight is actually running before you leave for the airport."
          cta={{ label: "Open the live map", href: "/live" }}
          visual={<LiveVisual />}
        />
        <TourRow
          eyebrow="AI concierge"
          tone="violet"
          title="Ask in plain English. Get a bookable answer."
          body="The concierge parses your trip, runs the search, checks your transfer options and comes back with specific flights and the exact points to move. It shows its work as tool calls — never a guess."
          cta={{ label: "Try the concierge", href: "/concierge" }}
          visual={<ConciergeVisual today={today} />}
        />
      </div>
    </HomeSection>
  );
}
