"use client";

/**
 * One itinerary as a boarding pass: carrier strip, route arc with times, the best fare in the
 * stub, and an expandable list of every program that can book it — wallet-aware throughout.
 */

import { AnimatePresence, motion } from "motion/react";
import { Bell, Bookmark, ChevronDown, ExternalLink, Share2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AirlineTail, ProgramLogo } from "@/components/art";
import { Badge, Button, IconButton, ProgressRing, Tooltip, toast } from "@/components/ui";
import { BoardingPass, NumberRoll, RouteLine, valueVerdict } from "@/components/viz";
import { getAirline } from "@/data/airlines";
import { PROGRAM_BY_ID, getProgram } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { ApiError, apiGet, apiPost, loginHref } from "@/lib/client/api";
import type { AwardFare, Balance } from "@/lib/types";
import { CABIN_LABEL } from "@/lib/types";
import { bestAffordableFare, planPayment, type PaymentPlan } from "@/lib/wallet/affordability";
import { cn, fmtCpp, fmtDate, fmtDuration, fmtTime, fmtUsd } from "@/lib/utils";
import { dayOffset, layoversOf, type VisibleResult } from "./derive";
import { AiNote, FareRow, SeatsBadge, TransferChips, WalletPlanLine, badgeTone, type ExplainState } from "./fare-row";
import type { SearchQueryState } from "./search-params";

export interface ResultCardContext {
  query: SearchQueryState;
  /** `null` while signed out or until the wallet loads. */
  balances: Balance[] | null;
  onAlert: (item: VisibleResult) => void;
}

export interface ResultCardProps {
  item: VisibleResult;
  context: ResultCardContext;
}

const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

function flightLabel(carrier: string, flightNumber: string): string {
  const n = flightNumber.trim();
  if (!n) return carrier;
  return n.toUpperCase().startsWith(carrier.toUpperCase()) ? n : `${carrier} ${n}`;
}

function TimeBlock({ time, sub, align }: { time: string; sub: string; align: "left" | "right" }) {
  return (
    <div className={cn("flex flex-col", align === "right" ? "items-end text-right" : "items-start")}>
      <span className="font-mono text-lg font-semibold leading-none tnum text-fg sm:text-xl">{time}</span>
      <span className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-fg-subtle">{sub}</span>
    </div>
  );
}

export function ResultCard({ item, context }: ResultCardProps) {
  const { result, fares, best } = item;
  const { itinerary, cashPriceUsd } = result;
  const { query, balances, onAlert } = context;
  const passengers = Math.max(1, query.passengers);

  const segments = itinerary.segments;
  const first = segments[0];
  const last = segments[segments.length - 1];
  const longest = segments.reduce((a, b) => (b.durationMin > a.durationMin ? b : a), first);
  const airline = getAirline(longest.carrier);
  const color = airline?.color;
  const program = getProgram(best.programId);
  const programName = program?.shortName ?? best.programId;
  const bookUrl = best.bookUrl ?? program?.bookingUrl;

  const layovers = useMemo(() => layoversOf(itinerary), [itinerary]);
  const offset = dayOffset(itinerary);
  const stops = segments.slice(0, -1).map((s) => s.destination);
  const aircraft = Array.from(new Set(segments.map((s) => s.aircraft).filter(Boolean))).join(" · ");
  const carriers = Array.from(new Set(segments.map((s) => s.carrier)));
  const flights = segments.map((s) => flightLabel(s.carrier, s.flightNumber)).join(" · ");
  const mixedCabin = fares.some((f) => f.mixedCabin);
  const caption =
    stops.length === 0
      ? `${fmtDuration(itinerary.totalDurationMin)} · Nonstop`
      : `${fmtDuration(itinerary.totalDurationMin)} · via ${layovers.map((l) => `${l.airport} ${fmtDuration(l.minutes)}`).join(", ")}`;

  const verdict = valueVerdict(best.valueScore);
  const ringTone = best.valueScore >= 70 ? "aurora" : best.valueScore >= 40 ? "gold" : "rose";
  const cpp = best.cpp ?? (cashPriceUsd && best.miles ? Math.max(0, ((cashPriceUsd - best.taxesUsd) / best.miles) * 100) : undefined);
  const visibleBadges = best.badges.filter((b) => b !== "Nonstop");

  // ─── Wallet ───────────────────────────────────────────────────
  const plans = useMemo(() => {
    if (!balances) return null;
    const map = new Map<string, PaymentPlan>();
    for (const f of fares) map.set(f.programId, planPayment(f.programId, f.miles * passengers, balances, TRANSFER_LINKS, PROGRAM_BY_ID));
    const alt = bestAffordableFare(fares, balances, TRANSFER_LINKS, PROGRAM_BY_ID, passengers);
    return { map, alternative: alt && alt.plan.affordable && alt.fare.programId !== best.programId ? alt.fare : null };
  }, [balances, fares, passengers, best.programId]);
  const bestPlan = plans?.map.get(best.programId) ?? null;

  // ─── Local state ──────────────────────────────────────────────
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [explanations, setExplanations] = useState<Record<string, ExplainState>>({});

  const explain = async (fare: AwardFare) => {
    if (explanations[fare.programId]?.status === "loading") return;
    setExplanations((s) => ({ ...s, [fare.programId]: { status: "loading" } }));
    try {
      const { text } = await apiPost<{ text: string }>("/api/ai/explain", { fare, itinerary, cashPriceUsd });
      setExplanations((s) => ({ ...s, [fare.programId]: { status: "done", text } }));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not explain this fare";
      setExplanations((s) => ({ ...s, [fare.programId]: { status: "error", message } }));
    }
  };

  const saveToTrip = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { trips } = await apiGet<{ trips: { id: string; title: string }[] }>("/api/trips");
      let trip = trips[0];
      if (!trip) {
        const created = await apiPost<{ trip: { id: string; title: string } }>("/api/trips", {
          action: "create",
          title: `${first.origin} → ${last.destination} · ${fmtDate(item.date, { weekday: undefined, year: "numeric" })}`,
        });
        trip = created.trip;
      }
      await apiPost("/api/trips", {
        action: "add",
        tripId: trip.id,
        kind: "flight",
        payload: { itinerary, fare: best, cashPriceUsd, query, savedAt: new Date().toISOString() },
      });
      toast.success(`Saved to ${trip.title}`, {
        description: `${first.origin} → ${last.destination} · ${programName}`,
        action: { label: "View trips", onClick: () => window.location.assign("/trips") },
      });
    } catch (err) {
      if (err instanceof ApiError && err.unauthenticated) {
        toast.error("Sign in to save trips", { action: { label: "Sign in", onClick: () => window.location.assign(loginHref()) } });
      } else {
        toast.error(err instanceof Error ? err.message : "Could not save this itinerary");
      }
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    const url = new URL(window.location.href);
    url.hash = `itin-${itinerary.id}`;
    const text = url.toString();
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copied", { description: "Filters and sort are included in the link." });
    } catch {
      toast.info("Copy this link", { description: text, duration: 10_000 });
    }
  };

  // ─── Slots ────────────────────────────────────────────────────
  const carrierSlot = (
    <>
      <AirlineTail code={longest.carrier} color={color} size={22} showCode={false} />
      <span className="truncate normal-case tracking-normal text-fg">
        {airline?.name ?? longest.carrier}
        {carriers.length > 1 && <span className="text-fg-subtle"> + {carriers.filter((c) => c !== longest.carrier).join(", ")}</span>}
      </span>
      <span className="hidden shrink-0 text-fg-subtle sm:inline">·</span>
      <span className="hidden shrink-0 tnum sm:inline">{flights}</span>
      {aircraft && <span className="hidden shrink-0 text-fg-subtle md:inline">· {aircraft}</span>}
    </>
  );

  const labelSlot = (
    <span className="flex items-center gap-2">
      <span className="tnum">{fmtDate(item.date)}</span>
      <span className="hidden text-fg-subtle sm:inline">· {CABIN_LABEL[best.cabin]}</span>
    </span>
  );

  const main = (
    <div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 sm:gap-5">
        <TimeBlock time={fmtTime(first.departure)} sub={fmtDate(item.date, { weekday: "short", month: "short", day: "numeric" })} align="left" />
        <RouteLine
          origin={first.origin}
          destination={last.destination}
          stops={stops}
          durationMin={itinerary.totalDurationMin}
          carrierColor={color}
          caption={caption}
          className="mx-auto"
        />
        <TimeBlock time={fmtTime(last.arrival)} sub={offset > 0 ? `+${offset} day${offset > 1 ? "s" : ""}` : "same day"} align="right" />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-fg-muted sm:hidden">
        <span className="tnum">{flights}</span>
        {aircraft && <span className="text-fg-subtle">{aircraft}</span>}
      </div>

      {(visibleBadges.length > 0 || mixedCabin || cashPriceUsd) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          {mixedCabin && (
            <Badge variant="gold" size="sm" title="One leg is in a lower cabin">
              Mixed cabin
            </Badge>
          )}
          {visibleBadges.map((b) => (
            <Badge key={b} variant={badgeTone(b)} size="sm">
              {b}
            </Badge>
          ))}
          {cashPriceUsd ? (
            <span className="text-xs text-fg-muted">
              vs <span className="font-mono tnum text-fg">{fmtUsd(cashPriceUsd)}</span> cash
              {cpp != null && cpp > 0 && (
                <>
                  {" · "}
                  <span className="font-mono tnum text-fg">{fmtCpp(cpp)}</span>/pt
                </>
              )}
            </span>
          ) : null}
        </div>
      )}

      {bestPlan && (
        <WalletPlanLine
          plan={bestPlan}
          className="mt-3"
          alternative={
            plans?.alternative ? (
              <>
                {" · "}
                <button type="button" onClick={() => setExpanded(true)} className={cn("font-medium text-aurora underline-offset-2 hover:underline", focusRing)}>
                  bookable via {getProgram(plans.alternative.programId)?.shortName ?? plans.alternative.programId}
                </button>
              </>
            ) : null
          }
        />
      )}
    </div>
  );

  const stub = (
    <div className="flex h-full flex-col gap-1 sm:gap-1.5">
      <div className="flex min-w-0 items-center gap-1.5">
        <ProgramLogo id={best.programId} name={program?.name ?? best.programId} color={program?.color} size={20} />
        <span className="truncate font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-fg">{programName}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <NumberRoll value={best.miles} format="int" className="text-[22px] font-semibold text-fg sm:text-2xl" />
        <span className="text-[10.5px] text-fg-subtle">pts</span>
        <span className="font-mono text-[11px] tnum text-fg-muted sm:hidden">+ {fmtUsd(best.taxesUsd)}</span>
      </div>
      <div className="hidden font-mono text-[11px] tnum text-fg-muted sm:block">+ {fmtUsd(best.taxesUsd)} taxes</div>
      <div className="mt-auto flex items-center justify-between gap-2">
        <SeatsBadge seats={best.seats} size="sm" />
        <Tooltip content={`Value score ${Math.round(best.valueScore)} · ${verdict.label}`}>
          <ProgressRing value={best.valueScore} size={34} strokeWidth={4} tone={ringTone} label="Value score" formatValue={(v) => String(Math.round(v))} />
        </Tooltip>
      </div>
    </div>
  );

  const bestExplanation = explanations[best.programId];

  const footer = (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg",
            focusRing,
          )}
        >
          <ChevronDown className={cn("size-4 transition-transform duration-200", expanded && "rotate-180")} aria-hidden="true" />
          {fares.length === 1 ? "Fare details" : `All ${fares.length} fares`}
        </button>

        <div className="flex items-center gap-0.5">
          <Tooltip content="Set alert for this route">
            <IconButton label="Set alert for this route" size="sm" onClick={() => onAlert(item)}>
              <Bell />
            </IconButton>
          </Tooltip>
          <Tooltip content="Save to trip">
            <IconButton label="Save to trip" size="sm" loading={saving} onClick={saveToTrip}>
              <Bookmark />
            </IconButton>
          </Tooltip>
          <Tooltip content="Copy link">
            <IconButton label="Share this search" size="sm" onClick={share}>
              <Share2 />
            </IconButton>
          </Tooltip>
          <Tooltip content="Explain this redemption">
            <IconButton
              label="Explain this redemption"
              size="sm"
              className="text-violet hover:text-violet"
              loading={bestExplanation?.status === "loading"}
              onClick={() => explain(best)}
            >
              <Sparkles />
            </IconButton>
          </Tooltip>
        </div>

        <div className="ml-auto">
          {bookUrl ? (
            <Button variant="aurora" size="sm" href={bookUrl} target="_blank" rel="noopener noreferrer" trailing={<ExternalLink aria-hidden="true" />}>
              Book on {programName}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              No booking link
            </Button>
          )}
        </div>
      </div>

      {!expanded && bestExplanation && <AiNote state={bestExplanation} className="mt-3" />}

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="fares"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 border-t border-panel-border pt-1">
              {fares.length > 1 && (
                <p className="pt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">
                  {fares.length} programs can book this{passengers > 1 ? ` · prices per person, totals for ${passengers}` : ""}
                </p>
              )}
              <ul className="divide-y divide-panel-border">
                {fares.map((f) => (
                  <FareRow
                    key={f.programId}
                    fare={f}
                    passengers={passengers}
                    isBest={f.programId === best.programId}
                    plan={plans?.map.get(f.programId) ?? null}
                    explanation={explanations[f.programId]}
                    onExplain={explain}
                  />
                ))}
              </ul>
              {fares.length === 1 && best.transferOptions.length > 0 && (
                <div className="sr-only">
                  <TransferChips options={best.transferOptions} passengers={passengers} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <BoardingPass
      id={itinerary.id}
      carrierColor={color}
      carrier={carrierSlot}
      label={labelSlot}
      main={main}
      stub={stub}
      footer={footer}
      barcodeText={itinerary.id.replace(/^sim-/, "").slice(0, 8).toUpperCase()}
      interactive
    />
  );
}
