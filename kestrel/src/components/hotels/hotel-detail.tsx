"use client";

import Link from "next/link";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, Bookmark, Check, CircleAlert, Plane, Search, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ProgramLogo } from "@/components/art";
import { Badge, ProgramChip, SourceBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DateRangePicker, type DateRange } from "@/components/ui/date-picker";
import { Panel, Section } from "@/components/ui/panel";
import { StatTile, type StatTone } from "@/components/ui/stat";
import { NumberStepper } from "@/components/ui/stepper";
import { focusRing } from "@/components/ui/tokens";
import { NumberRoll } from "@/components/viz/number-roll";
import { CppBar, ValueMeter, valueVerdict } from "@/components/viz/value-meter";
import {
  ACCOR_EUR_PER_BLOCK,
  ACCOR_POINTS_PER_BLOCK,
  CHOICE_LEVELS,
  DYNAMIC_PRICING,
  HYATT_CATEGORY_CHART,
  USD_TO_EUR,
  WYNDHAM_TIERS,
} from "@/data/hotel-programs";
import { apiGet, loginHref } from "@/lib/client/api";
import type { NightQuote } from "@/lib/hotels/engine";
import { cn, fmtCompact, fmtCpp, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";
import { ART_INK, ART_INK_MUTED, HotelArt, Stars } from "./hotel-art";
import { HotelCard } from "./hotel-card";
import {
  SEASON_LABEL,
  SEASON_TONE,
  TIER_LABEL,
  countryName,
  fmtNights,
  hotelDetailHref,
  hotelSearchHref,
  parseStayParams,
  programShort,
  stayKey,
  type HotelDetailPayload,
  type ResolvedTransfer,
  type SeasonTier,
  type StayParams,
  type WalletContext,
  type WalletPlan,
} from "./model";
import { useSaveToTrip } from "./use-save-to-trip";

const LABEL = "font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthList(months: number[] | undefined): string {
  if (!months?.length) return "—";
  const names = [...months].sort((a, b) => a - b).map((m) => MONTHS[m - 1]);
  return names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function toneFor(score: number): StatTone {
  const v = valueVerdict(score);
  return v.label === "Good deal" ? "aurora" : v.label === "Fair" ? "gold" : "rose";
}

const TONE_DOT: Record<StatTone, string> = {
  signal: "bg-signal",
  aurora: "bg-aurora",
  violet: "bg-violet",
  gold: "bg-gold",
  sky: "bg-sky",
  rose: "bg-rose",
};

// ─── Night-by-night ───────────────────────────────────────────

function NightsTable({ nights, detail }: { nights: NightQuote[]; detail: HotelDetailPayload }) {
  const q = detail.result.quote;
  const anySoldOut = nights.some((n) => !n.available);
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6 scrollbar-thin">
      <table className="w-full min-w-[480px] border-separate border-spacing-0 text-sm">
        <caption className="sr-only">Nightly pricing</caption>
        <thead>
          <tr className={LABEL}>
            <th scope="col" className="px-5 pb-2 text-left font-medium sm:px-6">
              Night
            </th>
            <th scope="col" className="px-3 pb-2 text-left font-medium">
              Season
            </th>
            <th scope="col" className="px-3 pb-2 text-right font-medium">
              Points
            </th>
            <th scope="col" className="px-3 pb-2 text-right font-medium">
              Cash
            </th>
            <th scope="col" className="px-5 pb-2 text-right font-medium sm:px-6">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {nights.map((n) => (
            <tr key={n.date} className={cn(!n.available && "opacity-70")}>
              <td className="border-t border-panel-border px-5 py-2.5 sm:px-6">
                <span className="font-mono text-[13px] tnum text-fg">{fmtDate(n.date)}</span>
                {n.weekend && <span className="ml-1.5 text-[11px] text-fg-subtle">wknd</span>}
              </td>
              <td className="border-t border-panel-border px-3 py-2.5">
                <Badge variant={SEASON_TONE[n.tier]} size="sm" caps>
                  {SEASON_LABEL[n.tier]}
                </Badge>
                {n.holiday && <span className="mt-1 block text-[11px] text-rose">{n.holiday}</span>}
              </td>
              <td className="border-t border-panel-border px-3 py-2.5 text-right font-mono tnum">
                {n.free ? (
                  <span className="inline-flex items-center gap-1.5">
                    <s className="text-fg-subtle">{fmtInt(n.points)}</s>
                    <Badge variant="violet" size="sm" caps>
                      Free
                    </Badge>
                  </span>
                ) : (
                  <span className="text-fg">{fmtInt(n.points)}</span>
                )}
              </td>
              <td className="border-t border-panel-border px-3 py-2.5 text-right font-mono tnum text-fg-muted">
                {fmtUsd(n.cashUsd)}
              </td>
              <td className="border-t border-panel-border px-5 py-2.5 text-right sm:px-6">
                {n.available ? (
                  <span className="inline-flex items-center gap-1 text-aurora">
                    <Check className="size-4" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only sm:text-xs">Open</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-rose">
                    <X className="size-4" aria-hidden="true" />
                    <span className="sr-only sm:not-sr-only sm:text-xs">Sold out</span>
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="font-medium">
            <td colSpan={2} className="border-t border-panel-border-strong px-5 py-3 text-fg sm:px-6">
              {fmtNights(q.nights)}
              {detail.freeNights > 0 && (
                <span className="text-fg-muted">
                  {" "}
                  · {detail.freeNights} free ({fmtInt(detail.freePoints)} pts waived)
                </span>
              )}
            </td>
            <td className="border-t border-panel-border-strong px-3 py-3 text-right font-mono tnum text-fg">
              {fmtInt(q.totalPoints)}
            </td>
            <td className="border-t border-panel-border-strong px-3 py-3 text-right font-mono tnum text-fg-muted">
              {fmtUsd(q.totalCashUsd)}
            </td>
            <td className="border-t border-panel-border-strong px-5 py-3 text-right text-xs sm:px-6">
              {anySoldOut ? <span className="text-rose">Partly sold out</span> : <span className="text-aurora">Available</span>}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─── Why this price ───────────────────────────────────────────

function Formula({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-[10px] border border-panel-border bg-bg-elev-2 px-3.5 py-2.5 font-mono text-[13px] tnum text-fg">
      {children}
    </p>
  );
}

function WhyThisPrice({ detail }: { detail: HotelDetailPayload }) {
  const { property, program, quote } = detail.result;
  const nights = detail.nights;
  const tiers: SeasonTier[] = ["off-peak", "standard", "peak"];
  const count = (t: SeasonTier) => nights.filter((n) => n.tier === t).length;

  if (program.chartType === "category") {
    const cat = Math.min(8, Math.max(1, property.category ?? 1));
    const chart = HYATT_CATEGORY_CHART[cat];
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-muted pretty-text">
          {property.name} is <span className="font-medium text-fg">Category {cat}</span> on the World of Hyatt award chart, so a
          standard room costs a fixed number of points per season — cash rates don&apos;t move it. Holidays always
          price as peak; so do {monthList(detail.city?.peakMonths)}. Weeknights in {monthList(detail.city?.lowMonths)} drop
          to off-peak.
        </p>
        <ul className="grid grid-cols-3 gap-2" aria-label={`Category ${cat} chart`}>
          {tiers.map((t) => {
            const n = count(t);
            return (
              <li
                key={t}
                className={cn(
                  "rounded-[10px] border px-3 py-3 text-center",
                  n > 0 ? "border-signal/40 bg-signal-soft" : "border-panel-border bg-bg-elev-2",
                )}
              >
                <p className={LABEL}>{SEASON_LABEL[t]}</p>
                <p className="mt-1 font-mono text-lg tnum text-fg">{fmtInt(chart[t])}</p>
                <p className="mt-0.5 text-[11px] text-fg-subtle">
                  {n === 0 ? "no nights" : `${n} ${n === 1 ? "night" : "nights"}`}
                </p>
              </li>
            );
          })}
        </ul>
        <Formula>
          {tiers
            .filter((t) => count(t) > 0)
            .map((t) => `${count(t)} × ${fmtInt(chart[t])}`)
            .join(" + ")}{" "}
          = {fmtInt(quote.totalPoints)} points
        </Formula>
      </div>
    );
  }

  if (program.chartType === "dynamic") {
    const cfg = DYNAMIC_PRICING[program.id];
    const anchor = property.avgCashUsd > 0 ? property.avgPointsPerNight / property.avgCashUsd : (cfg?.k ?? 100);
    const rate = cfg ? (cfg.k + anchor) / 2 : anchor;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-muted pretty-text">
          {program.name} prices awards dynamically: roughly{" "}
          <span className="font-medium text-fg">cash × {Math.round(rate)} points per dollar</span> (about{" "}
          {fmtCpp(100 / rate)} per point), blended with this property&apos;s usual {fmtInt(property.avgPointsPerNight)}-point
          rate, then nudged up to ±15% by nightly demand
          {cfg ? ` and rounded to the nearest ${fmtInt(cfg.step)}. Awards floor at ${fmtInt(cfg.floor)} and cap at ${fmtInt(cfg.ceiling)}` : ""}
          . Expensive nights cost more points, which is why the cents-per-point barely moves.
        </p>
        <Formula>
          {fmtUsd(quote.cashPerNightUsd)} × {Math.round(rate)} ≈ {fmtInt(quote.pointsPerNight)} points / night
        </Formula>
      </div>
    );
  }

  // Fixed-value programs.
  if (program.id === "accor-all") {
    const cpp = ((ACCOR_EUR_PER_BLOCK / USD_TO_EUR) * 100) / ACCOR_POINTS_PER_BLOCK;
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-muted pretty-text">
          Accor points are a fixed-value currency: every {fmtInt(ACCOR_POINTS_PER_BLOCK)} points takes €{ACCOR_EUR_PER_BLOCK}{" "}
          off a cash booking. We convert the nightly rate to euros at {USD_TO_EUR} and round up to the next block, so points
          track cash exactly and the return is always about {fmtCpp(cpp)} per point — dependable, never a bargain.
        </p>
        <Formula>
          {fmtUsd(quote.cashPerNightUsd)} × {USD_TO_EUR} ÷ €{ACCOR_EUR_PER_BLOCK} → {fmtInt(quote.pointsPerNight)} points /
          night
        </Formula>
      </div>
    );
  }
  if (program.id === "wyndham-rewards") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-muted pretty-text">
          Wyndham&apos;s go free chart has three tiers — {WYNDHAM_TIERS.map(fmtInt).join(", ")} points a night — every
          night of the year, so a pricier cash night is pure upside for points.
        </p>
        <Formula>Tier {fmtInt(quote.pointsPerNight)} × {fmtNights(quote.nights)} = {fmtInt(quote.totalPoints)} points</Formula>
      </div>
    );
  }
  if (program.id === "choice-privileges") {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-fg-muted pretty-text">
          Choice prices in {CHOICE_LEVELS.length} levels from {fmtInt(CHOICE_LEVELS[0])} to{" "}
          {fmtInt(CHOICE_LEVELS[CHOICE_LEVELS.length - 1])} points. This property sits at {fmtInt(property.avgPointsPerNight)}{" "}
          and moves one level up on peak dates and one down off-peak.
        </p>
        <Formula>{fmtInt(quote.totalPoints)} points for {fmtNights(quote.nights)}</Formula>
      </div>
    );
  }
  return (
    <p className="text-sm leading-relaxed text-fg-muted">
      {program.name} uses a fixed award rate for this property: {fmtInt(quote.pointsPerNight)} points a night.
    </p>
  );
}

// ─── Aside pieces ─────────────────────────────────────────────

function TransferList({ transfers, programName }: { transfers: ResolvedTransfer[]; programName: string }) {
  if (!transfers.length) {
    return <p className="text-sm text-fg-subtle">No bank currency transfers into {programName}.</p>;
  }
  return (
    <ul className="flex flex-col divide-y divide-panel-border">
      {transfers.map((t) => {
        const ratio = t.ratio[0] === t.ratio[1] ? "1:1" : `${t.ratio[0]}:${t.ratio[1]}`;
        return (
          <li key={t.bankId} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
            <ProgramLogo id={t.bankId} name={t.bankName} color={t.color} size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-fg">
                <span className="font-mono font-semibold tnum">{fmtInt(t.bankPointsNeeded)}</span> {t.bankShort}
              </p>
              <p className="text-xs text-fg-subtle">
                {ratio} · {t.transferTime}
              </p>
            </div>
            {t.bonusPercent ? (
              <Badge variant="signal" size="sm">
                +{t.bonusPercent}%
              </Badge>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

function WalletPanel({
  plan,
  wallet,
  currency,
  returnTo,
}: {
  plan: WalletPlan | null;
  wallet: WalletContext;
  currency: string;
  /** Where sign-in should land — passed explicitly so server and client render the same href. */
  returnTo: string;
}) {
  if (!wallet.signedIn) {
    return (
      <Panel eyebrow="Your wallet" title="Can you book this?">
        <p className="text-sm text-fg-muted">Sign in and we&apos;ll check this stay against the points you hold.</p>
        <Button href={loginHref(returnTo)} variant="secondary" size="sm" className="mt-3">
          Sign in
        </Button>
      </Panel>
    );
  }
  if (!plan) {
    return (
      <Panel eyebrow="Your wallet" title="Add your balances">
        <p className="text-sm text-fg-muted">
          Tell Kestrel what you hold and every hotel will say whether you can book it, transfers included.
        </p>
        <Button href="/wallet" variant="secondary" size="sm" className="mt-3">
          Open wallet
        </Button>
      </Panel>
    );
  }
  const lines = [
    ...(plan.direct > 0 ? [`${fmtInt(plan.direct)} ${currency} already in your wallet`] : []),
    ...plan.transfers.map(
      (t) =>
        `${fmtInt(t.sourcePoints)} ${t.fromShort} → ${fmtInt(t.destPoints)} ${currency}${t.bonusPercent ? ` (+${t.bonusPercent}% bonus)` : ""} · ${t.transferTime}`,
    ),
  ];
  return (
    <Panel
      eyebrow="Your wallet"
      title={plan.affordable ? "You can book this" : `Short ${fmtCompact(plan.shortfall)} ${currency}`}
      className={plan.affordable ? "border-aurora/30" : "border-rose/30"}
    >
      <ul className="flex flex-col gap-2 text-sm text-fg-muted">
        {lines.map((l) => (
          <li key={l} className="flex items-start gap-2">
            {plan.affordable ? (
              <Check className="mt-0.5 size-4 shrink-0 text-aurora" aria-hidden="true" />
            ) : (
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-rose" aria-hidden="true" />
            )}
            <span>{l}</span>
          </li>
        ))}
        {lines.length === 0 && <li>None of your balances transfer into this program.</li>}
      </ul>
    </Panel>
  );
}

// ─── Detail ───────────────────────────────────────────────────

export interface HotelDetailProps {
  initial: HotelDetailPayload;
}

/** Property page body: hero, stat tiles, breakdown, explainer, transfers, wallet, nearby. */
export function HotelDetail({ initial }: HotelDetailProps) {
  const searchParams = useSearchParams();
  const stay = useMemo(() => parseStayParams(searchParams), [searchParams]);
  const key = stayKey(stay);
  const id = initial.result.property.id;

  const query = useQuery({
    queryKey: ["hotel", id, key],
    queryFn: () =>
      apiGet<HotelDetailPayload>(`/api/hotels/${encodeURIComponent(id)}`, {
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: stay.guests,
      }),
    initialData: key === stayKey(initial.stay) ? initial : undefined,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
  const detail = query.data ?? initial;
  const refreshing = query.isFetching && stayKey(detail.stay) !== key;

  const setStay = (next: StayParams) => {
    const sp = new URLSearchParams({ checkIn: next.checkIn, checkOut: next.checkOut, guests: String(next.guests) });
    window.history.replaceState(null, "", `${window.location.pathname}?${sp.toString()}`);
  };
  const [range, setRange] = useState<DateRange>({ from: stay.checkIn, to: stay.checkOut });
  useEffect(() => {
    setRange({ from: stay.checkIn, to: stay.checkOut });
  }, [stay.checkIn, stay.checkOut]);

  const { save, savingId } = useSaveToTrip();

  const { result, nights, city, nearby, wallet } = detail;
  const { property, program, quote, transfers, plan } = result;
  const label = programShort(program);
  const currency = program.currency.replace(/ points$/, "");
  const verdict = valueVerdict(quote.valueScore);
  const tone = toneFor(quote.valueScore);
  const backHref = hotelSearchHref({ city: property.city, ...stay, programs: [] });

  return (
    <article className="mx-auto max-w-7xl px-4 pb-24 pt-5 sm:px-6">
      <nav aria-label="Breadcrumb" className="mb-4">
        <Link
          href={backHref}
          className={cn("inline-flex items-center gap-1.5 rounded-full text-sm text-fg-muted hover:text-fg", focusRing)}
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Hotels in {property.city}
        </Link>
      </nav>

      <HotelArt name={property.name} art={property.art} className="aspect-[4/3] rounded-[var(--radius-xl)] sm:aspect-[21/9] animate-rise">
        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <ProgramChip id={program.id} name={program.name} color={program.color} />
            <SourceBadge source={quote.source} />
          </div>
          {quote.tier && (
            <Badge variant={SEASON_TONE[quote.tier]} size="md" caps className="backdrop-blur-md">
              {SEASON_LABEL[quote.tier]} dates
            </Badge>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6 lg:p-8">
          <p className={cn("font-mono text-[11px] uppercase tracking-[0.24em]", ART_INK_MUTED)}>{property.brand}</p>
          <h1 className={cn("mt-1.5 max-w-3xl font-display text-3xl leading-[1.02] tracking-tight sm:text-5xl balance-text", ART_INK)}>
            {property.name}
          </h1>
          <div className={cn("mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px]", ART_INK_MUTED)}>
            <Stars count={property.stars} />
            <span>{TIER_LABEL[property.tier]}</span>
            {program.chartType === "category" && property.category != null && (
              <Badge variant="violet" size="sm">
                Cat {property.category}
              </Badge>
            )}
            <span className="inline-flex items-center gap-1">
              {property.city}, {countryName(property.countryCode)}
            </span>
            {city && (
              <span className="inline-flex items-center gap-1 font-mono tracking-wide">
                <Plane className="size-3.5" aria-hidden="true" />
                {city.airport}
              </span>
            )}
          </div>
        </div>
      </HotelArt>

      <div className={cn("mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity", refreshing && "opacity-60")}>
        <StatTile
          label="Points / night"
          tone="signal"
          value={<NumberRoll value={quote.pointsPerNight} format="int" animateOnMount />}
          hint={`${fmtInt(quote.totalPoints)} for ${fmtNights(quote.nights)}${detail.freeNights ? ` · ${detail.freeNights} free` : ""}`}
        />
        <StatTile label="Cash / night" tone="sky" value={quote.cashPerNightUsd} format={fmtUsd} hint={`${fmtUsd(quote.totalCashUsd)} total`} />
        <StatTile
          label="Cents per point"
          tone={tone}
          value={quote.cpp}
          format={fmtCpp}
          hint={`vs ${fmtCpp(program.valuationCpp)} typical for ${label}`}
        />
        <div className="relative flex flex-col items-center gap-2 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-5 shadow-panel">
          <div className={cn("flex w-full items-center gap-2", LABEL)}>
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
            Kestrel score
          </div>
          <ValueMeter
            score={quote.valueScore}
            cpp={quote.cpp}
            benchmark={program.valuationCpp}
            size={168}
            caption={`${quote.valueScore}/100 · vs ${fmtCpp(program.valuationCpp)} typical`}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel
            eyebrow="Breakdown"
            title="Night by night"
            description="Season tiers, holidays and the fifth-night-free rule, exactly as the engine priced them."
          >
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <div className="w-full sm:w-auto sm:min-w-[300px]">
                <DateRangePicker
                  size="sm"
                  value={range}
                  showNights
                  onChange={(r) => {
                    setRange(r);
                    if (r.from && r.to) setStay({ ...stay, checkIn: r.from, checkOut: r.to });
                  }}
                />
              </div>
              <NumberStepper
                size="sm"
                label="Guests"
                value={stay.guests}
                min={1}
                max={6}
                unit={stay.guests === 1 ? "guest" : "guests"}
                onChange={(guests) => setStay({ ...stay, guests })}
              />
              {refreshing && <span className="text-xs text-fg-subtle">Repricing…</span>}
            </div>
            <div className={cn("transition-opacity", refreshing && "opacity-60")}>
              <NightsTable nights={nights} detail={detail} />
            </div>
          </Panel>

          <Panel eyebrow={program.name} title="Why this price">
            <WhyThisPrice detail={detail} />
          </Panel>

          <Panel eyebrow={property.brand} title="About the property">
            <p className="text-sm leading-relaxed text-fg-muted pretty-text">{property.description}</p>
            <h4 className={cn("mt-5", LABEL)}>Amenities</h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {property.amenities.map((a) => (
                <li
                  key={a}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-2 px-2.5 text-xs text-fg"
                >
                  <Check className="size-3 text-aurora" aria-hidden="true" />
                  {a}
                </li>
              ))}
            </ul>
            <h4 className={cn("mt-5", LABEL)}>Vibe</h4>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {property.vibe.map((v) => (
                <li key={v}>
                  <Badge variant="outline" size="md">
                    #{v.replace(/\s+/g, "-")}
                  </Badge>
                </li>
              ))}
            </ul>
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-24 lg:self-start">
          <Panel eyebrow="Value" title={`${verdict.label} at ${fmtCpp(quote.cpp)}`}>
            <CppBar cpp={quote.cpp} benchmark={program.valuationCpp} />
            <p className="mt-3 text-sm leading-relaxed text-fg-muted pretty-text">
              {quote.cpp >= program.valuationCpp
                ? `Points beat cash here: each ${currency} point returns ${fmtCpp(quote.cpp)} against the ${fmtCpp(program.valuationCpp)} we'd expect.`
                : `Cash is the better buy: ${fmtCpp(quote.cpp)} per point is under the ${fmtCpp(program.valuationCpp)} these points usually fetch.`}
            </p>
          </Panel>

          <Panel eyebrow="Transfer in" title={`Top up ${label} from a bank`}>
            <TransferList transfers={transfers} programName={program.name} />
          </Panel>

          <WalletPanel plan={plan} wallet={wallet} currency={currency} returnTo={hotelDetailHref(property.id, stay)} />

          <div className="flex flex-col gap-2">
            {quote.available ? (
              <Button
                variant="aurora"
                size="lg"
                href={program.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                trailing={<ArrowUpRight />}
                className="w-full"
              >
                Book on {label}
              </Button>
            ) : (
              <Button variant="secondary" size="lg" disabled className="w-full">
                Sold out on these dates
              </Button>
            )}
            <Button
              variant="secondary"
              leading={<Bookmark />}
              loading={savingId === property.id}
              onClick={() => save(result)}
              className="w-full"
            >
              Save to trip
            </Button>
            <Button variant="ghost" href={backHref} leading={<Search />} className="w-full">
              More hotels in {property.city}
            </Button>
          </div>
        </aside>
      </div>

      {nearby.length > 0 && (
        <Section
          eyebrow="Nearby"
          title="Within 15 miles"
          description={`Same dates and guests, priced the same way — ${nearby.map((r) => programShort(r.program)).filter((v, i, a) => a.indexOf(v) === i).join(", ")}.`}
          className="mt-14"
        >
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {nearby.map((r, i) => (
              <li key={r.property.id} className="min-w-0">
                <HotelCard result={r} stay={stay} index={i} />
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
