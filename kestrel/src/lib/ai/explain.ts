import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { AwardFare, AwardRegion, Cabin, Deal, Itinerary, LoyaltyProgram } from "@/lib/types";
import { CABIN_LABEL } from "@/lib/types";
import { getProgram } from "@/data/programs";
import { regionOf } from "@/data/airports";
import { transfersFrom } from "@/data/transfers";
import { cpp as calcCpp } from "@/lib/awards";
import { clamp, fmtCpp, fmtDuration, fmtInt, fmtUsd } from "@/lib/utils";
import { AI_FAST_MODEL, Anthropic, getAnthropic, KESTREL_SYSTEM_PROMPT } from "./client";
import { queryToSearchHref } from "./intent-heuristics";
import { BANK_PROGRAM_IDS, CANONICAL_PROGRAM_IDS, resolveProgramId } from "./program-synonyms";
import { recordAiUsage } from "./usage";

/** Options shared by every helper in this module. */
export interface AiCallOptions {
  /** Skip the LLM even when a key exists (tests). Default true. */
  llm?: boolean;
  /** Override the Anthropic client (tests). `null` forces the template path. */
  client?: Anthropic | null;
  userId?: string | null;
  signal?: AbortSignal;
}

function pickClient(opts: AiCallOptions): Anthropic | null {
  if (opts.llm === false) return null;
  return opts.client === undefined ? getAnthropic() : opts.client;
}

function logAiError(scope: string, err: unknown): void {
  if (err instanceof Anthropic.RateLimitError) console.warn(`[ai] ${scope}: rate limited, using template`);
  else if (err instanceof Anthropic.APIError) console.warn(`[ai] ${scope}: API error ${err.status ?? ""} ${err.message}`);
  else if (err instanceof Error && err.name === "AbortError") return;
  else console.warn(`[ai] ${scope}: failed`, err);
}

function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

// ─── explainRedemption ──────────────────────────────────────────

export interface ExplainContext {
  itinerary: Itinerary;
  cashPriceUsd?: number;
  program?: LoyaltyProgram;
}

function bankName(id: string): string {
  return getProgram(id)?.shortName ?? id;
}

/** Deterministic 3–5 sentence verdict built from cpp, badges, transfers and program rules. */
export function explainRedemptionTemplate(fare: AwardFare, ctx: ExplainContext): string {
  const program = ctx.program ?? getProgram(fare.programId);
  const name = program?.name ?? fare.programId;
  const currency = program?.currency ?? "miles";
  const segs = ctx.itinerary.segments;
  const route = segs.length ? `${segs[0].origin} → ${segs[segs.length - 1].destination}` : "this route";
  const carriers = Array.from(new Set(segs.map((s) => s.carrier))).join("/");
  const stops = ctx.itinerary.stops === 0 ? "nonstop" : `${ctx.itinerary.stops}-stop`;
  const cabin = CABIN_LABEL[fare.cabin].toLowerCase();
  const cppValue = fare.cpp ?? (ctx.cashPriceUsd ? calcCpp(fare.miles, fare.taxesUsd, ctx.cashPriceUsd) : undefined);
  const valuation = program?.valuationCpp;

  // 1. Price + verdict
  let verdict: string;
  if (cppValue !== undefined && valuation) {
    const ratio = cppValue / valuation;
    verdict = ratio >= 1.8 ? "an excellent redemption" : ratio >= 1.1 ? "a solid use of points" : ratio >= 0.8 ? "a fair but unremarkable redemption" : "a weak redemption — paying cash or saving the points is probably smarter";
  } else if (cppValue !== undefined) {
    verdict = cppValue >= 4 ? "an excellent redemption" : cppValue >= 2 ? "a solid use of points" : cppValue >= 1.2 ? "a fair redemption" : "a weak redemption";
  } else {
    verdict = fare.valueScore >= 75 ? "a strong redemption on our value score" : fare.valueScore >= 55 ? "a reasonable redemption" : "a below-average redemption";
  }
  const priceBit = `${fmtInt(fare.miles)} ${currency} plus ${fmtUsd(fare.taxesUsd)} in taxes`;
  const cppBit =
    cppValue !== undefined && ctx.cashPriceUsd
      ? ` — that's ${fmtCpp(cppValue)} per point against a ${fmtUsd(ctx.cashPriceUsd)} cash fare${valuation ? ` (we value ${currency} at ${fmtCpp(valuation)})` : ""}`
      : cppValue !== undefined
        ? ` — about ${fmtCpp(cppValue)} per point${valuation ? ` versus our ${fmtCpp(valuation)} valuation` : ""}`
        : "";
  const sentences: string[] = [`Flying ${route} ${stops} on ${carriers || "this carrier"} in ${cabin} through ${name} costs ${priceBit}${cppBit}, which makes this ${verdict}.`];

  // 2. Badges
  if (fare.badges.length) sentences.push(`Kestrel flags it as ${fare.badges.map((b) => b.toLowerCase()).join(", ")}${fare.mixedCabin ? ", though note it is a mixed-cabin itinerary" : ""}.`);
  else if (fare.mixedCabin) sentences.push("Note that this is a mixed-cabin itinerary, so not every segment is in the cabin you're paying for.");

  // 3. Which bank points to transfer
  if (fare.transferOptions.length) {
    const sorted = [...fare.transferOptions].sort((a, b) => a.bankPointsNeeded - b.bankPointsNeeded);
    const best = sorted[0];
    const alt = sorted.slice(1, 3).map((o) => `${fmtInt(o.bankPointsNeeded)} ${bankName(o.bankProgramId)}`);
    sentences.push(
      `The cheapest way in is transferring ${fmtInt(best.bankPointsNeeded)} ${bankName(best.bankProgramId)} points (${best.ratio[0]}:${best.ratio[1]}${best.bonusPercent ? `, with a ${best.bonusPercent}% bonus` : ""}, posting ${best.transferTime})${alt.length ? `, or ${alt.join(" / ")}` : ""}.`,
    );
  } else if (program?.kind === "airline" || program?.kind === "hotel") {
    sentences.push(`No bank currencies transfer into ${name} in our data, so you'd need ${currency} earned directly.`);
  }

  // 4. Taxes / surcharge warning
  if (fare.taxesUsd >= 300 || program?.surcharges === "high") {
    sentences.push(`Heads up: ${fmtUsd(fare.taxesUsd)} in taxes and fuel surcharges is on the high side${program ? ` — ${program.shortName} passes on carrier surcharges` : ""}, so a partner program that doesn't add YQ could be cheaper out of pocket.`);
  } else if (fare.taxesUsd <= 60) {
    sentences.push(`Taxes are minimal at ${fmtUsd(fare.taxesUsd)}, which is part of what makes the deal.`);
  }

  // 5. Booking tip
  const tips: string[] = [];
  if (fare.seats !== null && fare.seats <= 2) tips.push(`only ${fare.seats} seat${fare.seats === 1 ? "" : "s"} left at this price, so book promptly`);
  if (program) {
    tips.push(program.oneWay ? "one-way awards are allowed" : "this program prices round-trips only");
    if (program.changeFeeUsd === 0 && program.cancelFeeUsd === 0) tips.push("changes and cancellations are free");
    else tips.push(`changes run ${fmtUsd(program.changeFeeUsd)} and cancellations ${fmtUsd(program.cancelFeeUsd)}`);
  }
  if (tips.length) {
    const t = tips.join("; ");
    sentences.push(`${t.charAt(0).toUpperCase()}${t.slice(1)}${fare.bookUrl || program?.bookingUrl ? ` — book at ${fare.bookUrl ?? program?.bookingUrl}` : ""}.`);
  }

  return sentences.slice(0, 5).join(" ");
}

/** Plain-English verdict on a fare. LLM (fast model, low effort) when available, else the template. */
export async function explainRedemption(fare: AwardFare, ctx: ExplainContext, opts: AiCallOptions = {}): Promise<string> {
  const template = explainRedemptionTemplate(fare, ctx);
  const client = pickClient(opts);
  if (!client) return template;

  const program = ctx.program ?? getProgram(fare.programId);
  const facts = {
    route: ctx.itinerary.segments.map((s) => `${s.carrier}${s.flightNumber} ${s.origin}-${s.destination} ${s.departure} (${fmtDuration(s.durationMin)}${s.aircraft ? `, ${s.aircraft}` : ""})`),
    stops: ctx.itinerary.stops,
    totalDuration: fmtDuration(ctx.itinerary.totalDurationMin),
    cabin: fare.cabin,
    program: program ? { id: program.id, name: program.name, currency: program.currency, valuationCpp: program.valuationCpp, surcharges: program.surcharges, oneWay: program.oneWay, changeFeeUsd: program.changeFeeUsd, cancelFeeUsd: program.cancelFeeUsd, bookingUrl: program.bookingUrl, routingRules: program.routingRules } : fare.programId,
    miles: fare.miles,
    taxesUsd: fare.taxesUsd,
    seats: fare.seats,
    cpp: fare.cpp,
    cashPriceUsd: ctx.cashPriceUsd,
    valueScore: fare.valueScore,
    badges: fare.badges,
    mixedCabin: fare.mixedCabin ?? false,
    transferOptions: fare.transferOptions,
  };

  try {
    const response = await client.messages.create(
      {
        model: AI_FAST_MODEL,
        max_tokens: 400,
        system: `${KESTREL_SYSTEM_PROMPT}\nWrite a plain-English verdict on one award redemption in 3 to 5 sentences and nothing else: say whether it is good or bad and why (use the cents-per-point and valuation), which bank points to transfer if any, warn about taxes or surcharges when they matter, and end with one booking tip. No headings, no bullets, no markdown. Use only the facts provided.`,
        messages: [{ role: "user", content: `Facts:\n${JSON.stringify(facts, null, 1)}\n\nA rule-based draft you may improve on:\n${template}` }],
        output_config: { effort: "low" },
      },
      { signal: opts.signal },
    );
    void recordAiUsage({ userId: opts.userId, feature: "explain", model: AI_FAST_MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });
    if (response.stop_reason === "refusal") return template;
    const text = textOf(response);
    return text.length > 40 ? text : template;
  } catch (err) {
    logAiError("explain", err);
    return template;
  }
}

// ─── dealDigest ─────────────────────────────────────────────────

export function dealDigestTemplate(deals: Deal[]): string {
  if (!deals.length) return "## Award deals\n\nNothing standout right now — check back soon, or set an alert at /alerts so we ping you when space opens.";
  const ranked = [...deals].sort((a, b) => b.cpp - a.cpp || b.savingsPct - a.savingsPct);
  const top = ranked.slice(0, 6);
  const best = ranked[0];
  const lines = top.map((d) => {
    const prog = getProgram(d.programId)?.shortName ?? d.programId;
    const href = queryToSearchHref({ origin: [d.origin], destination: [d.destination], date: d.dates[0] ?? "", cabin: d.cabin });
    return `- **${d.title}** — ${d.origin}→${d.destination} in ${CABIN_LABEL[d.cabin].toLowerCase()} on ${d.carrier} via ${prog}: ${fmtInt(d.miles)} + ${fmtUsd(d.taxesUsd)} (${fmtCpp(d.cpp)}/pt, ${d.savingsPct}% below typical) · ${d.seats} seat${d.seats === 1 ? "" : "s"}${d.dates.length ? ` · ${d.dates.slice(0, 2).join(", ")}${d.dates.length > 2 ? "…" : ""}` : ""} · _${d.badge}_${d.note ? ` — ${d.note}` : ""} · [search](${href})`;
  });
  const simulated = deals.some((d) => d.source === "simulated");
  return [
    `## ${deals.length} award deal${deals.length === 1 ? "" : "s"} worth a look`,
    "",
    `Best value today: **${best.origin}→${best.destination} ${CABIN_LABEL[best.cabin].toLowerCase()}** at ${fmtCpp(best.cpp)} per point via ${getProgram(best.programId)?.shortName ?? best.programId}.`,
    "",
    ...lines,
    simulated ? "\n_Demo data — connect a live award provider for real inventory._" : "",
  ]
    .join("\n")
    .trim();
}

/** Short markdown digest of deals. LLM (fast model) when available, else the template. */
export async function dealDigest(deals: Deal[], opts: AiCallOptions = {}): Promise<string> {
  const template = dealDigestTemplate(deals);
  const client = pickClient(opts);
  if (!client || !deals.length) return template;
  try {
    const response = await client.messages.create(
      {
        model: AI_FAST_MODEL,
        max_tokens: 600,
        system: `${KESTREL_SYSTEM_PROMPT}\nWrite a markdown digest of award deals in at most 120 words: one headline line starting with "## ", then 3 to 5 bullets. Each bullet names the route, cabin, program, miles + taxes, cents-per-point and why it is good, and ends with a markdown link to its /search URL. Use only the facts provided; do not invent dates or seats.`,
        messages: [{ role: "user", content: `Deals (JSON):\n${JSON.stringify(deals.slice(0, 10))}\n\nDraft:\n${template}` }],
        output_config: { effort: "low" },
      },
      { signal: opts.signal },
    );
    void recordAiUsage({ userId: opts.userId, feature: "digest", model: AI_FAST_MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });
    if (response.stop_reason === "refusal") return template;
    const text = textOf(response);
    return text.length > 40 ? text : template;
  } catch (err) {
    logAiError("dealDigest", err);
    return template;
  }
}

// ─── tripIdeas ──────────────────────────────────────────────────

export interface TripIdeaInput {
  origin: string;
  points: { programId: string; amount: number }[];
  /** 1–12 or a month name; biases towards destinations in season. */
  month?: number | string;
}

export interface TripIdea {
  title: string;
  destination: string;
  region?: AwardRegion;
  cabin: Cabin;
  programId: string;
  miles: number;
  why: string;
  bestMonths: number[];
  href: string;
  /** True when the wallet (directly or via a bank transfer) covers `miles`. */
  affordable: boolean;
  /** Which bank currency to transfer, when the airline balance alone is short. */
  via?: string;
}

interface IdeaPrice {
  programId: string;
  miles: number;
}
interface IdeaDef {
  destination: string;
  city: string;
  region: AwardRegion;
  why: string;
  bestMonths: number[];
  prices: Partial<Record<Cabin, IdeaPrice[]>>;
}

/** Editorial one-way award prices from North America (approximate, saver level). */
const IDEAS: IdeaDef[] = [
  {
    destination: "TYO", city: "Tokyo", region: "north-asia", bestMonths: [3, 4, 10, 11],
    why: "ANA and JAL premium cabins are among the best in the sky, and partner charts price them far below cash.",
    prices: {
      economy: [{ programId: "aeroplan", miles: 37500 }, { programId: "american-aadvantage", miles: 35000 }],
      business: [{ programId: "virgin-atlantic-flying-club", miles: 47500 }, { programId: "alaska-mileage-plan", miles: 60000 }, { programId: "american-aadvantage", miles: 60000 }, { programId: "aeroplan", miles: 75000 }, { programId: "united-mileageplus", miles: 80000 }],
      first: [{ programId: "alaska-mileage-plan", miles: 70000 }, { programId: "virgin-atlantic-flying-club", miles: 72500 }],
    },
  },
  {
    destination: "LON", city: "London", region: "europe", bestMonths: [5, 6, 9, 12],
    why: "The most competitive transatlantic market: lots of lie-flat seats and frequent transfer bonuses.",
    prices: {
      economy: [{ programId: "flying-blue", miles: 25000 }, { programId: "british-airways-club", miles: 26000 }, { programId: "aeroplan", miles: 35000 }],
      business: [{ programId: "turkish-miles-smiles", miles: 45000 }, { programId: "virgin-atlantic-flying-club", miles: 47500 }, { programId: "american-aadvantage", miles: 57500 }, { programId: "aeroplan", miles: 60000 }, { programId: "flying-blue", miles: 60000 }, { programId: "united-mileageplus", miles: 70000 }],
      first: [{ programId: "british-airways-club", miles: 68000 }, { programId: "american-aadvantage", miles: 85000 }],
    },
  },
  {
    destination: "PAR", city: "Paris", region: "europe", bestMonths: [4, 5, 9, 10],
    why: "Air France's monthly Flying Blue promo awards make Paris one of the cheapest premium-cabin tickets across the Atlantic.",
    prices: {
      economy: [{ programId: "flying-blue", miles: 25000 }, { programId: "aeroplan", miles: 35000 }],
      business: [{ programId: "flying-blue", miles: 60000 }, { programId: "turkish-miles-smiles", miles: 45000 }, { programId: "aeroplan", miles: 60000 }],
    },
  },
  {
    destination: "ROM", city: "Rome", region: "europe", bestMonths: [4, 5, 9, 10],
    why: "Shoulder-season Italy with plenty of Star Alliance and oneworld business-class space via Europe's hubs.",
    prices: {
      economy: [{ programId: "aeroplan", miles: 35000 }, { programId: "flying-blue", miles: 25000 }],
      business: [{ programId: "turkish-miles-smiles", miles: 45000 }, { programId: "american-aadvantage", miles: 57500 }, { programId: "aeroplan", miles: 60000 }],
    },
  },
  {
    destination: "ATH", city: "Athens", region: "europe", bestMonths: [5, 6, 9, 10],
    why: "Greece in the shoulder season is cheap in miles and the islands are a short hop away.",
    prices: {
      economy: [{ programId: "flying-blue", miles: 25000 }, { programId: "aeroplan", miles: 35000 }],
      business: [{ programId: "turkish-miles-smiles", miles: 45000 }, { programId: "aeroplan", miles: 60000 }],
    },
  },
  {
    destination: "SIN", city: "Singapore", region: "southeast-asia", bestMonths: [2, 3, 7, 8],
    why: "Singapore Airlines releases saver business and Suites space to its own members that partners never see.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 70000 }, { programId: "aeroplan", miles: 87500 }, { programId: "singapore-krisflyer", miles: 99000 }],
      first: [{ programId: "singapore-krisflyer", miles: 140000 }],
    },
  },
  {
    destination: "BKK", city: "Bangkok", region: "southeast-asia", bestMonths: [11, 12, 1, 2],
    why: "Dry-season Thailand, with Star Alliance partners pricing business class far below Asia's cash fares.",
    prices: {
      economy: [{ programId: "aeroplan", miles: 45000 }, { programId: "american-aadvantage", miles: 40000 }],
      business: [{ programId: "turkish-miles-smiles", miles: 47500 }, { programId: "american-aadvantage", miles: 70000 }, { programId: "aeroplan", miles: 87500 }],
    },
  },
  {
    destination: "HKG", city: "Hong Kong", region: "north-asia", bestMonths: [10, 11, 12, 3],
    why: "Cathay Pacific business class from the West Coast is a classic Alaska Mileage Plan sweet spot.",
    prices: {
      business: [{ programId: "alaska-mileage-plan", miles: 50000 }, { programId: "american-aadvantage", miles: 70000 }, { programId: "cathay-asia-miles", miles: 85000 }],
      first: [{ programId: "alaska-mileage-plan", miles: 70000 }],
    },
  },
  {
    destination: "SEL", city: "Seoul", region: "north-asia", bestMonths: [4, 5, 9, 10],
    why: "Korean Air and Asiana both fly lie-flat seats nonstop from several US cities with wide-open space.",
    prices: {
      economy: [{ programId: "aeroplan", miles: 37500 }],
      business: [{ programId: "korean-air-skypass", miles: 62500 }, { programId: "aeroplan", miles: 75000 }, { programId: "asiana-club", miles: 80000 }],
    },
  },
  {
    destination: "TPE", city: "Taipei", region: "north-asia", bestMonths: [10, 11, 3, 4],
    why: "EVA Air's Royal Laurel business class is consistently bookable through Star Alliance partners.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 70000 }, { programId: "aeroplan", miles: 75000 }, { programId: "eva-infinity", miles: 75000 }],
    },
  },
  {
    destination: "SYD", city: "Sydney", region: "oceania", bestMonths: [10, 11, 3, 4],
    why: "Southern-hemisphere spring and autumn, with Qantas and partner business class bookable through AAdvantage and Alaska.",
    prices: {
      economy: [{ programId: "american-aadvantage", miles: 40000 }],
      business: [{ programId: "american-aadvantage", miles: 80000 }, { programId: "alaska-mileage-plan", miles: 85000 }, { programId: "united-mileageplus", miles: 88000 }],
      first: [{ programId: "american-aadvantage", miles: 110000 }],
    },
  },
  {
    destination: "AKL", city: "Auckland", region: "oceania", bestMonths: [11, 12, 1, 2, 3],
    why: "New Zealand summer; Air New Zealand and United business class open up on the long West Coast nonstops.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 80000 }, { programId: "united-mileageplus", miles: 88000 }],
    },
  },
  {
    destination: "NAN", city: "Nadi (Fiji)", region: "oceania", bestMonths: [5, 6, 7, 8, 9, 10],
    why: "Fiji Airways business class from LAX/SFO is a bargain through Alaska and American.",
    prices: {
      economy: [{ programId: "alaska-mileage-plan", miles: 35000 }],
      business: [{ programId: "alaska-mileage-plan", miles: 55000 }, { programId: "american-aadvantage", miles: 80000 }],
    },
  },
  {
    destination: "HNL", city: "Honolulu", region: "hawaii", bestMonths: [4, 5, 9, 10, 11],
    why: "Hawaii off-peak is the cheapest long-haul lie-flat in the US — Avios on Alaska and American from the West Coast is hard to beat.",
    prices: {
      economy: [{ programId: "british-airways-club", miles: 13000 }, { programId: "american-aadvantage", miles: 22500 }, { programId: "alaska-mileage-plan", miles: 25000 }],
      business: [{ programId: "british-airways-club", miles: 36000 }, { programId: "american-aadvantage", miles: 40000 }],
    },
  },
  {
    destination: "DXB", city: "Dubai", region: "middle-east", bestMonths: [11, 12, 1, 2, 3],
    why: "Winter sun and a showcase of Gulf premium cabins; Qatar via Doha is the value play, Emirates the splurge.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 70000 }, { programId: "aeroplan", miles: 85000 }, { programId: "emirates-skywards", miles: 136000 }],
      first: [{ programId: "etihad-guest", miles: 115000 }, { programId: "emirates-skywards", miles: 180000 }],
    },
  },
  {
    destination: "DOH", city: "Doha", region: "middle-east", bestMonths: [11, 12, 1, 2, 3],
    why: "Qatar Airways Qsuite is the best business class flying and books easily with AAdvantage or Avios.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 70000 }, { programId: "british-airways-club", miles: 70000 }, { programId: "qatar-privilege-club", miles: 85000 }],
    },
  },
  {
    destination: "MLE", city: "Maldives", region: "south-asia", bestMonths: [1, 2, 3, 4, 11, 12],
    why: "Qsuite to the Maldives for the price of a domestic cash ticket; pair with Hyatt or Marriott points on the resort side.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 70000 }, { programId: "aeroplan", miles: 87500 }],
    },
  },
  {
    destination: "DEL", city: "Delhi", region: "south-asia", bestMonths: [10, 11, 2, 3],
    why: "India in the cool season; Air India and Gulf carriers keep Star Alliance and oneworld business class open.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 70000 }, { programId: "aeroplan", miles: 87500 }, { programId: "united-mileageplus", miles: 88000 }],
    },
  },
  {
    destination: "CPT", city: "Cape Town", region: "sub-saharan-africa", bestMonths: [1, 2, 3, 11, 12],
    why: "Southern summer in the Cape; Qatar and Turkish route you through the Gulf or Istanbul in lie-flat seats.",
    prices: {
      business: [{ programId: "turkish-miles-smiles", miles: 60000 }, { programId: "american-aadvantage", miles: 75000 }, { programId: "aeroplan", miles: 85000 }],
    },
  },
  {
    destination: "GRU", city: "São Paulo", region: "south-america", bestMonths: [3, 4, 9, 10],
    why: "Overnight lie-flat flights from the East Coast with American and LATAM, priced like a transatlantic.",
    prices: {
      economy: [{ programId: "american-aadvantage", miles: 30000 }],
      business: [{ programId: "american-aadvantage", miles: 57500 }, { programId: "aeroplan", miles: 60000 }],
    },
  },
  {
    destination: "EZE", city: "Buenos Aires", region: "south-america", bestMonths: [3, 4, 10, 11],
    why: "Argentina is a strong-dollar destination and Aeroplan's South America zone keeps business class reasonable.",
    prices: {
      business: [{ programId: "american-aadvantage", miles: 57500 }, { programId: "aeroplan", miles: 70000 }],
    },
  },
  {
    destination: "CUN", city: "Cancún", region: "caribbean", bestMonths: [11, 12, 1, 2, 3, 4],
    why: "Short-haul Avios and partner pricing makes the Yucatán one of the cheapest beach awards from the US.",
    prices: {
      economy: [{ programId: "british-airways-club", miles: 13000 }, { programId: "american-aadvantage", miles: 15000 }, { programId: "delta-skymiles", miles: 15000 }],
      business: [{ programId: "american-aadvantage", miles: 30000 }],
    },
  },
  {
    destination: "SJU", city: "San Juan", region: "caribbean", bestMonths: [12, 1, 2, 3, 4],
    why: "No passport needed and cheap economy awards on JetBlue, American and Delta.",
    prices: {
      economy: [{ programId: "british-airways-club", miles: 13000 }, { programId: "american-aadvantage", miles: 15000 }, { programId: "jetblue-trueblue", miles: 14000 }],
    },
  },
  {
    destination: "PPT", city: "Tahiti", region: "oceania", bestMonths: [5, 6, 7, 8, 9, 10],
    why: "Air France and Air Tahiti Nui from LAX put Bora Bora within reach of Flying Blue points.",
    prices: {
      economy: [{ programId: "flying-blue", miles: 30000 }],
      business: [{ programId: "flying-blue", miles: 65000 }],
    },
  },
  {
    destination: "NYC", city: "New York", region: "north-america", bestMonths: [5, 6, 9, 10, 12],
    why: "Transcon lie-flat seats on JetBlue Mint, American and Delta are frequently bookable with Avios or partner miles.",
    prices: {
      economy: [{ programId: "british-airways-club", miles: 13000 }, { programId: "american-aadvantage", miles: 12500 }],
      business: [{ programId: "british-airways-club", miles: 36000 }, { programId: "american-aadvantage", miles: 50000 }],
    },
  },
];

/** Static bank → airline/hotel partner map used when the transfer dataset is empty. */
const STATIC_BANK_PARTNERS: Record<(typeof BANK_PROGRAM_IDS)[number], string[]> = {
  "amex-mr": ["aeroplan", "ana-mileage-club", "british-airways-club", "flying-blue", "virgin-atlantic-flying-club", "delta-skymiles", "cathay-asia-miles", "singapore-krisflyer", "avianca-lifemiles", "etihad-guest", "emirates-skywards", "qatar-privilege-club", "aer-lingus-aerclub", "iberia-plus", "jetblue-trueblue", "hilton-honors", "marriott-bonvoy", "choice-privileges"],
  "chase-ur": ["aeroplan", "united-mileageplus", "british-airways-club", "flying-blue", "virgin-atlantic-flying-club", "singapore-krisflyer", "southwest-rapid-rewards", "jetblue-trueblue", "emirates-skywards", "iberia-plus", "aer-lingus-aerclub", "world-of-hyatt", "marriott-bonvoy", "ihg-one-rewards"],
  "citi-ty": ["aeroplan", "turkish-miles-smiles", "avianca-lifemiles", "flying-blue", "virgin-atlantic-flying-club", "singapore-krisflyer", "cathay-asia-miles", "qatar-privilege-club", "etihad-guest", "emirates-skywards", "eva-infinity", "thai-royal-orchid", "jetblue-trueblue", "american-aadvantage", "wyndham-rewards", "choice-privileges", "accor-all"],
  "capital-one": ["aeroplan", "turkish-miles-smiles", "avianca-lifemiles", "flying-blue", "virgin-atlantic-flying-club", "singapore-krisflyer", "cathay-asia-miles", "qatar-privilege-club", "etihad-guest", "emirates-skywards", "eva-infinity", "british-airways-club", "finnair-plus", "tap-miles-go", "aeromexico-rewards", "wyndham-rewards", "choice-privileges", "accor-all"],
  bilt: ["aeroplan", "united-mileageplus", "american-aadvantage", "alaska-mileage-plan", "british-airways-club", "flying-blue", "virgin-atlantic-flying-club", "turkish-miles-smiles", "cathay-asia-miles", "emirates-skywards", "aer-lingus-aerclub", "iberia-plus", "tap-miles-go", "world-of-hyatt", "marriott-bonvoy", "ihg-one-rewards", "hilton-honors"],
  "wells-fargo": ["aeroplan", "british-airways-club", "flying-blue", "avianca-lifemiles", "virgin-atlantic-flying-club", "iberia-plus", "aer-lingus-aerclub", "choice-privileges"],
};

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

export function monthNumber(month: number | string | undefined): number | undefined {
  if (month === undefined || month === null || month === "") return undefined;
  if (typeof month === "number") return month >= 1 && month <= 12 ? Math.round(month) : undefined;
  const s = month.trim().toLowerCase();
  if (/^\d{1,2}$/.test(s)) return monthNumber(parseInt(s, 10));
  const idx = MONTH_NAMES.findIndex((m) => m.startsWith(s.slice(0, 3)));
  return idx >= 0 ? idx + 1 : undefined;
}

/** How many `programId` miles a bank balance can become (1:1 unless the dataset says otherwise). */
function bankYield(bankId: string, programId: string, amount: number): number | null {
  const links = transfersFrom(bankId);
  if (links.length) {
    const link = links.find((l) => l.to === programId);
    if (!link) return null;
    const bonus = link.bonus?.percent ?? 0;
    return Math.floor(amount * (link.ratio[1] / link.ratio[0]) * (1 + bonus / 100));
  }
  const partners = STATIC_BANK_PARTNERS[bankId as (typeof BANK_PROGRAM_IDS)[number]];
  return partners?.includes(programId) ? amount : null;
}

function ideaDate(month: number | undefined, today = new Date()): string {
  const y = today.getFullYear();
  const m = month ?? ((today.getMonth() + 2) % 12) + 1;
  const d = new Date(y, m - 1, 15);
  if (d.getTime() < today.getTime()) d.setFullYear(y + 1);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-15`;
}

const CABIN_RANK: Record<Cabin, number> = { economy: 0, premium: 1, business: 2, first: 3 };

/** Deterministic trip ideas from the static table, ranked by what the wallet can actually afford. */
export function tripIdeasHeuristic(input: TripIdeaInput): TripIdea[] {
  const origin = input.origin.toUpperCase();
  const originRegion = regionOf(origin) ?? "north-america";
  const month = monthNumber(input.month);
  const wallet = new Map<string, number>();
  for (const p of input.points) {
    const id = resolveProgramId(p.programId) ?? p.programId;
    if (!CANONICAL_PROGRAM_IDS.has(id) || !(p.amount > 0)) continue;
    wallet.set(id, (wallet.get(id) ?? 0) + Math.round(p.amount));
  }
  const banks = Array.from(wallet.entries()).filter(([id]) => (BANK_PROGRAM_IDS as readonly string[]).includes(id));

  type Scored = TripIdea & { score: number };
  const scored: Scored[] = [];
  for (const def of IDEAS) {
    if (def.region === originRegion && def.destination !== "NYC") continue;
    if (def.destination === "NYC" && (origin === "NYC" || origin === "JFK" || origin === "EWR" || origin === "LGA")) continue;
    let best: Scored | null = null;
    for (const [cabin, prices] of Object.entries(def.prices) as [Cabin, IdeaPrice[]][]) {
      for (const price of prices) {
        const direct = wallet.get(price.programId) ?? 0;
        let via: string | undefined;
        let affordable = direct >= price.miles;
        if (!affordable) {
          for (const [bankId, amount] of banks) {
            const yielded = bankYield(bankId, price.programId, amount);
            if (yielded !== null && yielded + direct >= price.miles) {
              affordable = true;
              via = bankId;
              break;
            }
          }
        }
        const inSeason = month ? def.bestMonths.includes(month) : false;
        const score = (affordable ? 100 : 0) + CABIN_RANK[cabin] * 12 + (inSeason ? 15 : 0) - price.miles / 10000 + (wallet.size === 0 ? CABIN_RANK[cabin] * 5 : 0);
        const programName = getProgram(price.programId)?.shortName ?? price.programId;
        const candidate: Scored = {
          title: `${def.city} in ${CABIN_LABEL[cabin].toLowerCase()} for ${fmtInt(price.miles)} ${programName}`,
          destination: def.destination,
          region: def.region,
          cabin,
          programId: price.programId,
          miles: price.miles,
          why: `${def.why}${via ? ` Transfer ${fmtInt(Math.max(0, price.miles - direct))} ${getProgram(via)?.shortName ?? via} points to cover it.` : affordable ? " Your balance already covers it." : wallet.size ? ` You're ${fmtInt(price.miles - direct)} short — a transfer bonus or a cheaper date could close the gap.` : ""}`,
          bestMonths: def.bestMonths,
          href: queryToSearchHref({ origin: [origin], destination: [def.destination], date: ideaDate(month), cabin }),
          affordable,
          via,
          score,
        };
        if (!best || candidate.score > best.score) best = candidate;
      }
    }
    if (best) scored.push(best);
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, 5).map(({ score: _s, ...idea }) => {
    void _s;
    return idea;
  });
}

const IdeasSchema = z.object({
  ideas: z.array(
    z.object({
      title: z.string(),
      destination: z.string().describe("IATA airport or metro code"),
      cabin: z.enum(["economy", "premium", "business", "first"]),
      programId: z.string().describe("Canonical program id used to book"),
      miles: z.number().describe("One-way miles needed"),
      why: z.string().describe("One or two sentences on why this is a good use of these points"),
      bestMonths: z.array(z.number()).describe("Months 1-12 when this trip is best"),
    }),
  ),
});

/** Five trip ideas for a wallet. LLM (fast model + structured output) when available, else the heuristic table. */
export async function tripIdeas(input: TripIdeaInput, opts: AiCallOptions = {}): Promise<TripIdea[]> {
  const heuristic = tripIdeasHeuristic(input);
  const client = pickClient(opts);
  if (!client) return heuristic;

  const origin = input.origin.toUpperCase();
  const month = monthNumber(input.month);
  try {
    const response = await client.messages.parse(
      {
        model: AI_FAST_MODEL,
        max_tokens: 2048,
        system: `${KESTREL_SYSTEM_PROMPT}\nPropose exactly 5 award trip ideas for this traveller. Prefer destinations their points can actually cover (directly or via a bank transfer partner), vary the regions, and favour premium cabins when affordable. Program ids must be canonical: ${Array.from(CANONICAL_PROGRAM_IDS).join(", ")}. Airport codes are IATA. A rule-based shortlist is provided; you may reuse or improve it, but never invent award prices that are wildly off saver-level charts.`,
        messages: [
          {
            role: "user",
            content: `Origin: ${origin}${month ? `\nMonth: ${MONTH_NAMES[month - 1]}` : ""}\nPoints: ${JSON.stringify(input.points)}\n\nShortlist: ${JSON.stringify(heuristic.map(({ title, destination, cabin, programId, miles, why, bestMonths, affordable }) => ({ title, destination, cabin, programId, miles, why, bestMonths, affordable })))}`,
          },
        ],
        output_config: { format: zodOutputFormat(IdeasSchema), effort: "low" },
      },
      { signal: opts.signal },
    );
    void recordAiUsage({ userId: opts.userId, feature: "ideas", model: AI_FAST_MODEL, inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens });
    if (response.stop_reason === "refusal" || !response.parsed_output) return heuristic;

    const wallet = new Map<string, number>();
    for (const p of input.points) {
      const id = resolveProgramId(p.programId) ?? p.programId;
      wallet.set(id, (wallet.get(id) ?? 0) + Math.round(p.amount));
    }
    const banks = Array.from(wallet.entries()).filter(([id]) => (BANK_PROGRAM_IDS as readonly string[]).includes(id));
    const ideas: TripIdea[] = [];
    for (const raw of response.parsed_output.ideas) {
      const destination = String(raw.destination).trim().toUpperCase();
      const programId = resolveProgramId(String(raw.programId));
      const miles = Math.round(Number(raw.miles));
      if (!/^[A-Z]{3}$/.test(destination) || !programId || !(miles > 0)) continue;
      const direct = wallet.get(programId) ?? 0;
      let affordable = direct >= miles;
      let via: string | undefined;
      if (!affordable) {
        for (const [bankId, amount] of banks) {
          const yielded = bankYield(bankId, programId, amount);
          if (yielded !== null && yielded + direct >= miles) {
            affordable = true;
            via = bankId;
            break;
          }
        }
      }
      const bestMonths = (raw.bestMonths ?? []).map((m) => clamp(Math.round(m), 1, 12)).filter((m, i, a) => a.indexOf(m) === i);
      ideas.push({
        title: String(raw.title).slice(0, 120),
        destination,
        region: regionOf(destination) ?? IDEAS.find((d) => d.destination === destination)?.region,
        cabin: raw.cabin,
        programId,
        miles,
        why: String(raw.why).slice(0, 400),
        bestMonths,
        href: queryToSearchHref({ origin: [origin], destination: [destination], date: ideaDate(month), cabin: raw.cabin }),
        affordable,
        via,
      });
      if (ideas.length === 5) break;
    }
    if (ideas.length < 3) return heuristic;
    for (const h of heuristic) {
      if (ideas.length >= 5) break;
      if (!ideas.some((i) => i.destination === h.destination)) ideas.push(h);
    }
    return ideas.slice(0, 5);
  } catch (err) {
    logAiError("tripIdeas", err);
    return heuristic;
  }
}

export { IDEAS as TRIP_IDEA_TABLE };
