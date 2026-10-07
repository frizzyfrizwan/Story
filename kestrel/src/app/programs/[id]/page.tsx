import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, ArrowRight, BedDouble, CalendarClock, ExternalLink, Route, Search, Sparkles } from "lucide-react";
import type { Cabin } from "@/lib/types";
import { PROGRAMS, PROGRAM_BY_ID, getProgram } from "@/data/programs";
import { TRANSFER_LINKS, transfersFrom, transfersTo } from "@/data/transfers";
import { getAirline } from "@/data/airlines";
import { airportDistanceMiles, getAirport } from "@/data/airports";
import { getHotelProgram } from "@/data/hotel-programs";
import { priceAward } from "@/lib/awards";
import { addDays, cn, fmtCpp, fmtUsd, todayISO } from "@/lib/utils";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, Section } from "@/components/ui/panel";
import { StatTile } from "@/components/ui/stat";
import { focusRing } from "@/components/ui/tokens";
import { CarrierGrid } from "@/components/programs/carrier-grid";
import { PartnerList } from "@/components/programs/partner-list";
import { PricingSamples, type PricingSampleRow } from "@/components/programs/pricing-samples";
import { ProgramCard } from "@/components/programs/program-card";
import { AllianceBadge, ALLIANCE_META, CHART_META, ChartBadge, KIND_META, SURCHARGE_META, toProgramSummary } from "@/components/programs/program-meta";
import { SweetSpotCard } from "@/components/programs/sweet-spot-card";
import { TransferInTable } from "@/components/programs/transfer-in-table";
import { isBonusActive } from "@/components/transfers/transfer-utils";

type Params = { id: string };

export const dynamicParams = false;
export const revalidate = 3600;

export function generateStaticParams(): Params[] {
  return PROGRAMS.map((p) => ({ id: p.id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const p = getProgram(id);
  if (!p) return { title: "Program not found" };
  const description = `${p.name}: ${fmtCpp(p.valuationCpp)} per point, ${CHART_META[p.chartType].label.toLowerCase()}, ${SURCHARGE_META[p.surcharges].label.toLowerCase()}. ${p.summary.split(". ")[0]}.`;
  return {
    title: p.name,
    description,
    alternates: { canonical: `/programs/${p.id}` },
    openGraph: { title: `${p.name} · Kestrel`, description, type: "article" },
  };
}

/** Six marquee routes priced on every airline program page; the first bookable carrier in the list is used. */
const SAMPLE_ROUTES: { origin: string; destination: string; carriers: string[] }[] = [
  { origin: "JFK", destination: "LHR", carriers: ["BA", "VS", "AA", "DL", "B6"] },
  { origin: "JFK", destination: "NRT", carriers: ["JL", "NH", "AA", "UA", "DL"] },
  { origin: "SFO", destination: "SIN", carriers: ["SQ", "UA"] },
  { origin: "LAX", destination: "SYD", carriers: ["QF", "DL", "AA", "UA", "VA"] },
  { origin: "ORD", destination: "FRA", carriers: ["LH", "UA", "AA"] },
  { origin: "JFK", destination: "DOH", carriers: ["QR"] },
];

const SAMPLE_CABINS: ("economy" | "business" | "first")[] = ["economy", "business", "first"];

function buildPricingRows(programId: string, ownCarrier: string | undefined, bookable: string[], date: string): PricingSampleRow[] {
  const rows: PricingSampleRow[] = [];
  for (const r of SAMPLE_ROUTES) {
    const origin = getAirport(r.origin);
    const destination = getAirport(r.destination);
    if (!origin || !destination) continue;
    const preferred = ownCarrier && r.carriers.includes(ownCarrier) ? ownCarrier : r.carriers.find((c) => bookable.includes(c));
    if (!preferred) continue;
    const carrier = getAirline(preferred);
    if (!carrier) continue;
    const distanceMiles = airportDistanceMiles(origin, destination);
    const cells = {} as PricingSampleRow["cells"];
    let any = false;
    for (const cabin of SAMPLE_CABINS) {
      const quote = priceAward({
        programId,
        carrier: carrier.iata,
        origin: origin.iata,
        destination: destination.iata,
        originRegion: origin.region,
        destinationRegion: destination.region,
        distanceMiles,
        cabin: cabin as Cabin,
        date,
      });
      cells[cabin] = quote ? { miles: quote.miles, taxesUsd: quote.taxesUsd, peak: quote.peak, basis: quote.basis } : null;
      if (quote) any = true;
    }
    if (any) rows.push({ origin, destination, carrier, distanceMiles, cells });
  }
  return rows;
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="mb-1 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">{children}</p>;
}

export default async function ProgramPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const program = getProgram(id);
  if (!program) notFound();

  const asOf = todayISO();
  const sampleDate = addDays(asOf, 75);
  const incoming = transfersTo(program.id);
  const outgoing = transfersFrom(program.id);
  const own = program.airline ? getAirline(program.airline) : undefined;
  const hotel = program.kind === "hotel" ? getHotelProgram(program.id) : undefined;
  const pricing = program.kind === "airline" ? buildPricingRows(program.id, program.airline, program.bookableCarriers, sampleDate) : [];
  const related = PROGRAMS.filter((p) => {
    if (p.id === program.id) return false;
    if (program.kind === "airline") return p.kind === "airline" && p.alliance === program.alliance;
    return p.kind === program.kind;
  })
    .sort((a, b) => b.valuationCpp - a.valuationCpp)
    .slice(0, 4)
    .map((p) => toProgramSummary(p, TRANSFER_LINKS, (l) => isBonusActive(l, asOf)));

  const searchHref = `/search?programs=${program.id}&from=JFK&cabin=business`;
  const surcharge = SURCHARGE_META[program.surcharges];
  const surchargeTone = program.surcharges === "none" ? "aurora" : program.surcharges === "low" ? "sky" : program.surcharges === "medium" ? "gold" : "rose";
  const activeBonuses = incoming.filter((l) => isBonusActive(l, asOf));

  return (
    <article>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="aurora-bg relative overflow-hidden">
        <div className="dot-grid absolute inset-0 opacity-50" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14">
          <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-fg-subtle">
            <Link href="/programs" className={cn("rounded-full hover:text-fg", focusRing)}>
              Programs
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-fg-muted">{KIND_META[program.kind].label}</span>
            {program.alliance && program.kind === "airline" && (
              <>
                <span aria-hidden="true">/</span>
                <span className="text-fg-muted">{ALLIANCE_META[program.alliance].label}</span>
              </>
            )}
          </nav>

          <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              <ProgramLogo id={program.id} name={program.shortName} color={program.color} size={96} className="size-20 sm:size-24" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge variant="neutral" size="sm" caps>
                    {KIND_META[program.kind].label}
                  </Badge>
                  <AllianceBadge alliance={program.alliance} />
                  <ChartBadge chartType={program.chartType} />
                  {activeBonuses.length > 0 && (
                    <Badge variant="aurora" size="sm" dot pulse>
                      {activeBonuses.length === 1 ? "Transfer bonus live" : `${activeBonuses.length} transfer bonuses live`}
                    </Badge>
                  )}
                </div>
                <h1 className="mt-3 font-display text-4xl leading-[1.02] tracking-tight text-fg sm:text-5xl balance-text">{program.name}</h1>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-fg-subtle">
                  {program.currency}
                  {own && <> · {own.name}</>}
                </p>
                <p className="mt-5 text-[15px] leading-relaxed text-fg-muted pretty-text">{program.summary}</p>
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
              <Button href={searchHref} variant="primary" size="lg" leading={<Search />}>
                Search awards with {program.shortName}
              </Button>
              {program.kind === "hotel" ? (
                <Button href="/hotels" variant="secondary" size="lg" leading={<BedDouble />}>
                  Hotel award search
                </Button>
              ) : (
                <Button href="/transfers" variant="secondary" size="lg" leading={<ArrowLeftRight />}>
                  Transfer matrix
                </Button>
              )}
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Kestrel valuation" value={program.valuationCpp} format={fmtCpp} tone="signal" hint="per point, editorial" animate />
            <StatTile label="Change fee" value={program.changeFeeUsd} format={fmtUsd} tone="sky" hint={program.changeFeeUsd === 0 ? "free changes" : "per award ticket"} />
            <StatTile label="Cancel fee" value={program.cancelFeeUsd} format={fmtUsd} tone="violet" hint={program.cancelFeeUsd === 0 ? "free redeposit" : "to redeposit"} />
            <StatTile
              label="Fuel surcharges"
              value={<span className={cn("text-[1.5rem]", surcharge.text)}>{surcharge.label.replace(" surcharges", "")}</span>}
              tone={surchargeTone}
              hint={program.kind === "bank" ? "bank points carry none" : `typical business award taxes ${fmtUsd(program.typicalTaxesUsd.business)}`}
            />
          </div>
        </div>
      </section>

      <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 py-12 sm:px-6 sm:py-16">
        {/* ── Hotel facts ──────────────────────────────────── */}
        {hotel && (
          <Section eyebrow="Hotel program" title="How the chart works" description={hotel.summary}>
            <div className="grid gap-3 sm:grid-cols-3">
              <Panel padding="sm">
                <Eyebrow>Chart type</Eyebrow>
                <p className="font-display text-xl text-fg capitalize">{hotel.chartType}</p>
                <p className="mt-1 text-xs text-fg-subtle">
                  {hotel.chartType === "category"
                    ? "Published categories with off-peak / standard / peak"
                    : hotel.chartType === "dynamic"
                      ? "Nightly rates move with cash prices"
                      : "Points are worth a set amount against any rate"}
                </p>
              </Panel>
              <Panel padding="sm">
                <Eyebrow>5th night free</Eyebrow>
                <p className={cn("font-display text-xl", hotel.fifthNightFree ? "text-aurora" : "text-fg")}>{hotel.fifthNightFree ? "Yes" : "No"}</p>
                <p className="mt-1 text-xs text-fg-subtle">{hotel.fifthNightFree ? "On award stays of five nights or more" : "Pay every night in points"}</p>
              </Panel>
              <Panel padding="sm">
                <Eyebrow>Valuation</Eyebrow>
                <p className="font-mono tnum font-display text-xl text-fg">{fmtCpp(hotel.valuationCpp)}</p>
                <p className="mt-1 text-xs text-fg-subtle">per point · benchmark for value scores</p>
              </Panel>
            </div>
            <div className="mt-4">
              <Button href="/hotels" variant="secondary" trailing={<ArrowRight />}>
                Price a stay with {program.shortName}
              </Button>
            </div>
          </Section>
        )}

        {/* ── Sweet spots ──────────────────────────────────── */}
        {program.sweetSpots.length > 0 && (
          <Section
            eyebrow="Sweet spots"
            title={`Where ${program.shortName} ${program.kind === "bank" ? "points" : "miles"} go furthest`}
            description="Editorial plays verified October 2026. Prices are one-way per passenger unless noted."
          >
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {program.sweetSpots.map((s, i) => (
                <li key={s.title}>
                  <SweetSpotCard spot={s} index={i} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* ── Transfers ────────────────────────────────────── */}
        {program.kind === "bank" ? (
          <Section
            eyebrow="Transfer partners"
            title={`Where ${program.shortName} points can go`}
            description={`${outgoing.length} partners. Ratios are bank points to destination points; aurora pills mark bonuses running today.`}
            actions={
              <Button href="/transfers" variant="secondary" size="sm" leading={<ArrowLeftRight />}>
                Full matrix
              </Button>
            }
          >
            <PartnerList links={outgoing} programs={PROGRAM_BY_ID} asOf={asOf} />
          </Section>
        ) : (
          <Section
            eyebrow="Transfer in"
            title={`Banks that feed ${program.shortName}`}
            description={
              incoming.length
                ? "Ratios, running bonuses, posting times and the minimum each bank will move."
                : undefined
            }
            actions={
              incoming.length ? (
                <Button href="/transfers" variant="secondary" size="sm" leading={<ArrowLeftRight />}>
                  Full matrix
                </Button>
              ) : undefined
            }
          >
            <TransferInTable program={program} links={incoming} programs={PROGRAM_BY_ID} asOf={asOf} />
          </Section>
        )}

        {/* ── Pricing samples ──────────────────────────────── */}
        {pricing.length > 0 && (
          <Section
            eyebrow="Pricing samples"
            title="What marquee routes cost"
            description={`Six benchmark routes priced from ${program.shortName}'s chart on the first bookable carrier for each. Taxes are estimates; peak dates are flagged.`}
          >
            <PricingSamples rows={pricing} programId={program.id} date={sampleDate} />
          </Section>
        )}

        {/* ── Bookable carriers ────────────────────────────── */}
        {program.kind === "airline" && program.bookableCarriers.length > 0 && (
          <Section
            eyebrow="Bookable carriers"
            title={`${program.bookableCarriers.length} airlines you can book`}
            description="Alliance partners plus bilateral agreements. The program's own carrier is highlighted."
          >
            <CarrierGrid codes={program.bookableCarriers} resolve={getAirline} ownCarrier={program.airline} />
          </Section>
        )}

        {/* ── Rules ────────────────────────────────────────── */}
        <Section eyebrow="Rules" title="The fine print that matters">
          <div className="grid gap-3 md:grid-cols-2">
            <Panel padding="sm" eyebrow="Award type" title={program.oneWay ? "One-way awards allowed" : "Round-trip only"}>
              <p className="text-sm leading-relaxed text-fg-muted">
                {program.oneWay
                  ? "Book each direction separately and mix programs across a trip."
                  : "Awards price as round-trips; one-ways are either unavailable or cost the same as a return."}
              </p>
            </Panel>
            <Panel padding="sm" eyebrow="Routing" title={<span className="inline-flex items-center gap-2"><Route className="size-4 text-signal" aria-hidden="true" />Stopovers &amp; open-jaws</span>}>
              <p className="text-sm leading-relaxed text-fg-muted">{program.routingRules}</p>
            </Panel>
            <Panel padding="sm" eyebrow="Expiration" title={<span className="inline-flex items-center gap-2"><CalendarClock className="size-4 text-signal" aria-hidden="true" />When points expire</span>}>
              <p className="text-sm leading-relaxed text-fg-muted">{program.expirationPolicy}</p>
            </Panel>
            <Panel padding="sm" eyebrow="Booking" title="Where to book">
              <p className="text-sm leading-relaxed text-fg-muted">
                {program.kind === "bank" ? "Transfers are made from the issuer's rewards portal." : "Partner awards book on the program's site or by phone, per the routing rules above."}
              </p>
              <a
                href={program.bookingUrl}
                target="_blank"
                rel="noreferrer noopener"
                className={cn("mt-3 inline-flex items-center gap-1.5 rounded-full text-sm text-sky underline-offset-4 hover:underline", focusRing)}
              >
                {program.bookingUrl.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}
                <ExternalLink className="size-3.5" aria-hidden="true" />
              </a>
            </Panel>
          </div>
        </Section>

        {/* ── Related ──────────────────────────────────────── */}
        {related.length > 0 && (
          <Section
            eyebrow="Related"
            title={
              program.kind === "airline" && program.alliance
                ? `More ${ALLIANCE_META[program.alliance].label} programs`
                : `Other ${KIND_META[program.kind].plural.toLowerCase()}`
            }
            actions={
              <Button href="/programs" variant="ghost" size="sm" trailing={<ArrowRight />}>
                All programs
              </Button>
            }
          >
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {related.map((p) => (
                <li key={p.id}>
                  <ProgramCard program={p} />
                </li>
              ))}
            </ul>
          </Section>
        )}

        <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">Ready?</p>
            <p className="mt-1 font-display text-xl text-fg">
              <Sparkles className="mr-2 inline size-4 text-signal" aria-hidden="true" />
              See every seat bookable with {program.shortName}.
            </p>
          </div>
          <Button href={searchHref} variant="primary" trailing={<ArrowRight />}>
            Search awards
          </Button>
        </div>
      </div>
    </article>
  );
}
