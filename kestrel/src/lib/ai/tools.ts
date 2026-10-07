import "server-only";
import { z } from "zod";
import type { Anthropic } from "./client";
import type {
  AwardResult,
  AwardSearchQuery,
  AwardSearchResponse,
  Balance,
  Cabin,
  Deal,
  HotelAwardQuote,
  HotelSearchQuery,
  LoyaltyProgram,
  RouteAvailability,
  TransferLink,
} from "@/lib/types";
import { CABIN_SHORT } from "@/lib/types";
import { searchAwards, getRouteAvailability, getDeals, searchHotels } from "@/lib/providers";
import { getProgram, PROGRAMS } from "@/data/programs";
import { transfersTo } from "@/data/transfers";
import { buildTransferOptions } from "@/lib/awards";
import { fmtCpp, fmtDuration, fmtInt, fmtUsd } from "@/lib/utils";
import { queryToSearchHref } from "./intent-heuristics";
import { resolveProgramId } from "./program-synonyms";

// ─── Dependency injection (tests inject fixtures) ───────────────

export interface ConciergeDeps {
  searchAwards: (query: AwardSearchQuery, signal?: AbortSignal) => Promise<AwardSearchResponse>;
  getRouteAvailability: (origin: string, destination: string, cabin: Cabin, from: string, to: string, signal?: AbortSignal) => Promise<RouteAvailability>;
  getDeals: (opts: { origin?: string; cabin?: Cabin; limit?: number }, signal?: AbortSignal) => Promise<Deal[]>;
  searchHotels: (query: HotelSearchQuery, signal?: AbortSignal) => Promise<{ quotes: HotelAwardQuote[]; source: "live" | "simulated" }>;
  getProgram: (id: string) => LoyaltyProgram | undefined;
  listPrograms: () => LoyaltyProgram[];
  transfersTo: (programId: string) => TransferLink[];
}

export const defaultConciergeDeps: ConciergeDeps = {
  searchAwards,
  getRouteAvailability,
  getDeals,
  searchHotels,
  getProgram,
  listPrograms: () => PROGRAMS,
  transfersTo,
};

export interface ToolContext {
  today: string;
  wallet?: Balance[];
  homeAirport?: string;
  signal?: AbortSignal;
  deps?: Partial<ConciergeDeps>;
}

export interface ToolOutcome {
  /** One-line description for the UI "tool" event. */
  summary: string;
  /** Markdown/text returned to the model as the tool_result. */
  content: string;
}

// ─── Tool definitions (strict JSON schemas) ────────────────────

const CABINS = ["economy", "premium", "business", "first"] as const;
const cabinSchema = { type: "string", enum: [...CABINS], description: "Cabin: economy, premium (premium economy), business or first." };
const dateSchema = (desc: string) => ({ type: "string", description: `${desc} as YYYY-MM-DD.` });

export const CONCIERGE_TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "search_awards",
    description:
      "Search live award-seat availability for a route and date. Returns the best itineraries with miles, taxes, seats and cents-per-point, plus a /search link. Use this whenever the user asks what is available, what something costs in points, or wants options. Never guess availability without calling it.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "array", items: { type: "string" }, description: "Departure IATA airport or metro codes, e.g. [\"JFK\"] or [\"NYC\"]." },
        destination: { type: "array", items: { type: "string" }, description: "Arrival IATA airport or metro codes." },
        date: dateSchema("Departure date"),
        cabin: cabinSchema,
        passengers: { type: "integer", description: "Seats needed, 1-9." },
        flexDays: { type: "integer", description: "Days of flexibility either side of the date, 0-7." },
      },
      required: ["origin", "destination", "date", "cabin", "passengers", "flexDays"],
      additionalProperties: false,
    },
  },
  {
    name: "route_availability",
    description: "Day-by-day award availability for one route and cabin across a date range (max 60 days). Use for 'when in May is there space' style questions.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        origin: { type: "string", description: "Departure IATA code." },
        destination: { type: "string", description: "Arrival IATA code." },
        cabin: cabinSchema,
        from: dateSchema("First date"),
        to: dateSchema("Last date (inclusive)"),
      },
      required: ["origin", "destination", "cabin", "from", "to"],
      additionalProperties: false,
    },
  },
  {
    name: "get_program",
    description: "Look up a loyalty program: rules, surcharges, fees, sweet spots and which bank currencies transfer into it. Accepts a canonical id (aeroplan, amex-mr, british-airways-club) or a common name (Avios, Chase).",
    strict: true,
    input_schema: {
      type: "object",
      properties: { id: { type: "string", description: "Program id or common name." } },
      required: ["id"],
      additionalProperties: false,
    },
  },
  {
    name: "transfer_options",
    description: "Which bank points can be transferred into a program to cover a miles price, with ratios, bonuses, transfer times, and whether the user's wallet covers it.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        programId: { type: "string", description: "Destination program id, e.g. aeroplan." },
        miles: { type: "integer", description: "Miles/points needed in that program." },
      },
      required: ["programId", "miles"],
      additionalProperties: false,
    },
  },
  {
    name: "search_hotels",
    description: "Search hotel award stays in a city for a date range: points per night, cash comparison, cents-per-point and value score.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        city: { type: "string", description: "City name, e.g. Tokyo." },
        checkIn: dateSchema("Check-in date"),
        checkOut: dateSchema("Check-out date"),
        guests: { type: "integer", description: "Guests, 1-6." },
      },
      required: ["city", "checkIn", "checkOut", "guests"],
      additionalProperties: false,
    },
  },
  {
    name: "get_deals",
    description: "Trending award deals and sweet spots, optionally filtered by origin airport and cabin. Good for inspiration ('where can I go in business for under 60k').",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        origin: { type: ["string", "null"], description: "Origin IATA code, or null for anywhere." },
        cabin: { type: ["string", "null"], enum: [...CABINS, null], description: "Cabin filter, or null for any." },
      },
      required: ["origin", "cabin"],
      additionalProperties: false,
    },
  },
  {
    name: "wallet_balances",
    description: "The user's current points and miles balances by program, with estimated value. Call before recommending which currency to use.",
    strict: true,
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
  },
];

export const CONCIERGE_TOOL_NAMES = CONCIERGE_TOOLS.map((t) => t.name);

// ─── Input validation ───────────────────────────────────────────

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");
const code = z
  .string()
  .trim()
  .min(3)
  .max(4)
  .transform((s) => s.toUpperCase());

const SearchAwardsInput = z.object({
  origin: z.array(code).min(1).max(4),
  destination: z.array(code).min(1).max(4),
  date: iso,
  cabin: z.enum(CABINS),
  passengers: z.number().int().min(1).max(9),
  flexDays: z.number().int().min(0).max(7),
});
const RouteAvailabilityInput = z.object({ origin: code, destination: code, cabin: z.enum(CABINS), from: iso, to: iso });
const GetProgramInput = z.object({ id: z.string().trim().min(1).max(60) });
const TransferOptionsInput = z.object({ programId: z.string().trim().min(1).max(60), miles: z.number().int().min(1).max(2_000_000) });
const SearchHotelsInput = z.object({ city: z.string().trim().min(2).max(60), checkIn: iso, checkOut: iso, guests: z.number().int().min(1).max(6) });
const GetDealsInput = z.object({ origin: code.nullable(), cabin: z.enum(CABINS).nullable() });

// ─── Formatting helpers ─────────────────────────────────────────

function routeLabel(r: AwardResult): string {
  const segs = r.itinerary.segments;
  if (!segs.length) return "?";
  const points = [segs[0].origin, ...segs.map((s) => s.destination)];
  return points.join("→");
}

function carriersOf(r: AwardResult): string {
  return Array.from(new Set(r.itinerary.segments.map((s) => s.carrier))).join("/") || "?";
}

function demoNote(source: string): string {
  return source === "simulated" ? "\n\n_Note: these are simulated demo results — the live award provider is not configured. Say so to the user._" : "";
}

function programLabel(id: string, deps: ConciergeDeps): string {
  return deps.getProgram(id)?.shortName ?? id;
}

// ─── Handlers ───────────────────────────────────────────────────

async function searchAwardsTool(input: z.infer<typeof SearchAwardsInput>, ctx: ToolContext, deps: ConciergeDeps): Promise<ToolOutcome> {
  const query: AwardSearchQuery = {
    origin: input.origin,
    destination: input.destination,
    date: input.date,
    cabin: input.cabin,
    passengers: input.passengers,
    flexDays: input.flexDays,
  };
  const res = await deps.searchAwards(query, ctx.signal);
  const href = queryToSearchHref(query);
  const label = `${query.origin.join("/")} → ${query.destination.join("/")} · ${CABIN_SHORT[query.cabin]} · ${query.date}${query.flexDays ? ` ±${query.flexDays}d` : ""}`;

  if (!res.results.length) {
    return {
      summary: `No award space: ${label}`,
      content: `No award availability found for ${label} (${query.passengers} pax).${demoNote(res.source)}\n\nSuggest: widen the date window, try nearby airports, or a different cabin. Search page: ${href}`,
    };
  }

  const ranked = [...res.results].sort((a, b) => b.bestFare.valueScore - a.bestFare.valueScore).slice(0, 8);
  const rows = ranked.map((r) => {
    const f = r.bestFare;
    const seats = f.seats === null ? "?" : String(f.seats);
    const cpp = f.cpp !== undefined ? fmtCpp(f.cpp) : "—";
    const stops = r.itinerary.stops === 0 ? "nonstop" : `${r.itinerary.stops} stop${r.itinerary.stops > 1 ? "s" : ""}`;
    return `| ${routeLabel(r)} (${stops}, ${fmtDuration(r.itinerary.totalDurationMin)}) | ${carriersOf(r)} | ${programLabel(f.programId, deps)} | ${fmtInt(f.miles)} | ${fmtUsd(f.taxesUsd)} | ${seats} | ${cpp} | ${f.valueScore}${f.badges.length ? ` · ${f.badges.join(", ")}` : ""} |`;
  });
  const table = ["| Route | Carrier | Program | Miles | Taxes | Seats | ¢/pt | Score |", "|---|---|---|---|---|---|---|---|", ...rows].join("\n");
  const cash = ranked.find((r) => r.cashPriceUsd)?.cashPriceUsd;
  return {
    summary: `${res.results.length} option${res.results.length === 1 ? "" : "s"} for ${label}`,
    content: `Award search ${label}, ${query.passengers} pax — top ${ranked.length} of ${res.results.length} (source: ${res.source}).${cash ? ` Cash comparison ≈ ${fmtUsd(cash)}.` : ""}\n\n${table}\n\nFull results: ${href}${demoNote(res.source)}`,
  };
}

async function routeAvailabilityTool(input: z.infer<typeof RouteAvailabilityInput>, ctx: ToolContext, deps: ConciergeDeps): Promise<ToolOutcome> {
  if (input.to < input.from) throw new Error("`to` must be on or after `from`");
  const res = await deps.getRouteAvailability(input.origin, input.destination, input.cabin, input.from, input.to, ctx.signal);
  const label = `${input.origin}→${input.destination} ${CABIN_SHORT[input.cabin]} ${input.from}..${input.to}`;
  const withSeats = res.days.filter((d) => d.seats > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (!withSeats.length) {
    return { summary: `No open dates: ${label}`, content: `No award space on ${label}.${demoNote(res.source)}` };
  }
  const lines = withSeats.slice(0, 60).map((d) => `- ${d.date}: ${fmtInt(d.miles)} ${programLabel(d.programId, deps)} + ${fmtUsd(d.taxesUsd)} · ${d.seats} seat${d.seats === 1 ? "" : "s"} on ${d.carrier}`);
  const cheapest = [...withSeats].sort((a, b) => a.miles - b.miles)[0];
  return {
    summary: `${withSeats.length} open date${withSeats.length === 1 ? "" : "s"} on ${label}`,
    content: `Availability ${label} — ${withSeats.length} dates with space (source: ${res.source}). Cheapest: ${cheapest.date} at ${fmtInt(cheapest.miles)} ${programLabel(cheapest.programId, deps)}.\n\n${lines.join("\n")}${demoNote(res.source)}`,
  };
}

function programSummary(p: LoyaltyProgram, deps: ConciergeDeps): string {
  const links = deps.transfersTo(p.id);
  const partners = links.length
    ? links.map((l) => `${programLabel(l.from, deps)} ${l.ratio[0]}:${l.ratio[1]}${l.bonus ? ` (+${l.bonus.percent}% bonus until ${l.bonus.endsAt})` : ""}, ${l.transferTime}`).join("; ")
    : "none listed";
  const sweet = p.sweetSpots.length
    ? p.sweetSpots.map((s) => `- ${s.title}${s.miles ? ` — ${fmtInt(s.miles)}` : ""}${s.cabin ? ` ${CABIN_SHORT[s.cabin]}` : ""}: ${s.description}${s.example ? ` (e.g. ${s.example})` : ""}`).join("\n")
    : "- (none on file)";
  return [
    `**${p.name}** (${p.id}) — ${p.kind}${p.alliance ? `, ${p.alliance} alliance` : ""}${p.airline ? `, airline ${p.airline}` : ""}`,
    p.summary,
    `Currency: ${p.currency} · valuation ${fmtCpp(p.valuationCpp)}/pt · chart: ${p.chartType} · surcharges: ${p.surcharges}`,
    `Typical long-haul taxes: Y ${fmtUsd(p.typicalTaxesUsd.economy)} / J ${fmtUsd(p.typicalTaxesUsd.business)} / F ${fmtUsd(p.typicalTaxesUsd.first)} · change ${fmtUsd(p.changeFeeUsd)} · cancel ${fmtUsd(p.cancelFeeUsd)}`,
    `One-way awards: ${p.oneWay ? "yes" : "no"} · routing: ${p.routingRules} · expiration: ${p.expirationPolicy}`,
    `Bookable carriers: ${p.bookableCarriers.join(", ") || "n/a"}`,
    `Transfers in: ${partners}`,
    `Sweet spots:\n${sweet}`,
    `Book at ${p.bookingUrl} · in-app: /programs/${p.id}`,
  ].join("\n");
}

function getProgramTool(input: z.infer<typeof GetProgramInput>, deps: ConciergeDeps): ToolOutcome {
  const id = deps.getProgram(input.id)?.id ?? resolveProgramId(input.id) ?? input.id.toLowerCase();
  const p = deps.getProgram(id);
  if (!p) {
    const known = deps.listPrograms().map((x) => x.id);
    return {
      summary: `Unknown program "${input.id}"`,
      content: `No program matches "${input.id}". ${known.length ? `Known ids: ${known.slice(0, 40).join(", ")}` : "The program catalogue is empty in this environment."}`,
    };
  }
  return { summary: `Looked up ${p.name}`, content: programSummary(p, deps) };
}

function transferOptionsTool(input: z.infer<typeof TransferOptionsInput>, ctx: ToolContext, deps: ConciergeDeps): ToolOutcome {
  const id = deps.getProgram(input.programId)?.id ?? resolveProgramId(input.programId) ?? input.programId.toLowerCase();
  const links = deps.transfersTo(id);
  const label = programLabel(id, deps);
  if (!links.length) {
    return { summary: `No transfer partners into ${label}`, content: `No bank currencies transfer into ${label} (${id}) in our data. The user would need to earn ${label} directly or pick a program with partners.` };
  }
  const wallet = new Map((ctx.wallet ?? []).map((b) => [b.programId, b.amount]));
  const direct = wallet.get(id) ?? 0;
  const options = buildTransferOptions(input.miles, links).sort((a, b) => a.bankPointsNeeded - b.bankPointsNeeded);
  const lines = options.map((o) => {
    const held = wallet.get(o.bankProgramId);
    const afford = held === undefined ? "" : held >= o.bankPointsNeeded ? ` ✓ user holds ${fmtInt(held)}` : ` ✗ user holds ${fmtInt(held)} (short ${fmtInt(o.bankPointsNeeded - held)})`;
    return `- ${programLabel(o.bankProgramId, deps)}: ${fmtInt(o.bankPointsNeeded)} points (${o.ratio[0]}:${o.ratio[1]}${o.bonusPercent ? `, +${o.bonusPercent}% bonus` : ""}, posts ${o.transferTime})${afford}`;
  });
  const directLine = direct > 0 ? `User already holds ${fmtInt(direct)} ${label} directly${direct >= input.miles ? " — enough to book without transferring." : `; needs ${fmtInt(input.miles - direct)} more.`}\n` : "";
  return {
    summary: `${options.length} transfer route${options.length === 1 ? "" : "s"} into ${label} for ${fmtInt(input.miles)}`,
    content: `Transfer options to cover ${fmtInt(input.miles)} ${label}:\n${directLine}${lines.join("\n")}`,
  };
}

async function searchHotelsTool(input: z.infer<typeof SearchHotelsInput>, ctx: ToolContext, deps: ConciergeDeps): Promise<ToolOutcome> {
  if (input.checkOut <= input.checkIn) throw new Error("checkOut must be after checkIn");
  const res = await deps.searchHotels({ city: input.city, checkIn: input.checkIn, checkOut: input.checkOut, guests: input.guests }, ctx.signal);
  const href = `/hotels?city=${encodeURIComponent(input.city)}&checkIn=${input.checkIn}&checkOut=${input.checkOut}&guests=${input.guests}`;
  const label = `${input.city} ${input.checkIn}→${input.checkOut}`;
  if (!res.quotes.length) {
    return { summary: `No hotel awards: ${label}`, content: `No award stays found for ${label}.${demoNote(res.source)}\n\nHotel search: ${href}` };
  }
  const ranked = [...res.quotes].sort((a, b) => b.valueScore - a.valueScore).slice(0, 8);
  const rows = ranked.map(
    (q) =>
      `| ${q.propertyId} | ${q.nights} | ${fmtInt(q.pointsPerNight)} | ${fmtInt(q.totalPoints)} | ${fmtUsd(q.cashPerNightUsd)} | ${fmtCpp(q.cpp)} | ${q.valueScore} | ${q.available ? "yes" : "no"}${q.fifthNightFreeApplied ? " · 5th night free" : ""}${q.tier ? ` · ${q.tier}` : ""} |`,
  );
  const table = ["| Property | Nights | Pts/night | Total pts | Cash/night | ¢/pt | Score | Available |", "|---|---|---|---|---|---|---|---|", ...rows].join("\n");
  return {
    summary: `${res.quotes.length} hotel award${res.quotes.length === 1 ? "" : "s"} in ${input.city}`,
    content: `Hotel awards ${label}, ${input.guests} guest${input.guests === 1 ? "" : "s"} — top ${ranked.length} of ${res.quotes.length} (source: ${res.source}).\n\n${table}\n\nAll results: ${href}${demoNote(res.source)}`,
  };
}

async function getDealsTool(input: z.infer<typeof GetDealsInput>, ctx: ToolContext, deps: ConciergeDeps): Promise<ToolOutcome> {
  const deals = await deps.getDeals({ origin: input.origin ?? undefined, cabin: input.cabin ?? undefined, limit: 10 }, ctx.signal);
  const scope = `${input.origin ? `from ${input.origin}` : "anywhere"}${input.cabin ? ` in ${CABIN_SHORT[input.cabin]}` : ""}`;
  if (!deals.length) return { summary: `No deals ${scope}`, content: `No current deals ${scope}. Suggest setting an alert at /alerts.` };
  const lines = deals.map(
    (d) =>
      `- **${d.title}** — ${d.origin}→${d.destination} ${CABIN_SHORT[d.cabin]} on ${d.carrier} via ${programLabel(d.programId, deps)}: ${fmtInt(d.miles)} + ${fmtUsd(d.taxesUsd)} (${fmtCpp(d.cpp)}/pt, ${d.savingsPct}% below typical) · ${d.seats} seats · dates ${d.dates.slice(0, 3).join(", ")}${d.dates.length > 3 ? "…" : ""} · ${d.badge}${d.note ? ` · ${d.note}` : ""} · ${queryToSearchHref({ origin: [d.origin], destination: [d.destination], date: d.dates[0] ?? ctx.today, cabin: d.cabin })}`,
  );
  const simulated = deals.some((d) => d.source === "simulated");
  return { summary: `${deals.length} deal${deals.length === 1 ? "" : "s"} ${scope}`, content: `Deals ${scope}:\n${lines.join("\n")}${simulated ? demoNote("simulated") : ""}` };
}

function walletBalancesTool(ctx: ToolContext, deps: ConciergeDeps): ToolOutcome {
  const wallet = ctx.wallet ?? [];
  if (!wallet.length) {
    return { summary: "Wallet is empty", content: "The user has no balances on file. Suggest adding them at /wallet so recommendations can be tailored." };
  }
  let totalValue = 0;
  const lines = wallet.map((b) => {
    const p = deps.getProgram(b.programId);
    const value = p ? (b.amount * p.valuationCpp) / 100 : 0;
    totalValue += value;
    return `- ${p?.name ?? b.programId} (${b.programId}): ${fmtInt(b.amount)}${p ? ` ≈ ${fmtUsd(value)}` : ""}${b.status ? ` · ${b.status}` : ""}${b.expiresAt ? ` · expires ${b.expiresAt}` : ""}`;
  });
  return {
    summary: `${wallet.length} balance${wallet.length === 1 ? "" : "s"}${totalValue ? ` ≈ ${fmtUsd(totalValue)}` : ""}`,
    content: `Wallet (${wallet.length} programs${totalValue ? `, est. ${fmtUsd(totalValue)}` : ""}):\n${lines.join("\n")}`,
  };
}

// ─── Dispatcher ─────────────────────────────────────────────────

function parseInput<T>(schema: z.ZodType<T>, input: unknown, tool: string): T {
  const r = schema.safeParse(input ?? {});
  if (!r.success) {
    const issues = r.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    throw new Error(`Invalid input for ${tool}: ${issues}`);
  }
  return r.data;
}

/**
 * Execute one concierge tool. Throws on unknown tool or invalid input — the
 * caller turns that into an `is_error` tool_result so the model can recover.
 */
export async function runConciergeTool(name: string, input: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  const deps: ConciergeDeps = { ...defaultConciergeDeps, ...(ctx.deps ?? {}) };
  switch (name) {
    case "search_awards":
      return searchAwardsTool(parseInput(SearchAwardsInput, input, name), ctx, deps);
    case "route_availability":
      return routeAvailabilityTool(parseInput(RouteAvailabilityInput, input, name), ctx, deps);
    case "get_program":
      return getProgramTool(parseInput(GetProgramInput, input, name), deps);
    case "transfer_options":
      return transferOptionsTool(parseInput(TransferOptionsInput, input, name), ctx, deps);
    case "search_hotels":
      return searchHotelsTool(parseInput(SearchHotelsInput, input, name), ctx, deps);
    case "get_deals":
      return getDealsTool(parseInput(GetDealsInput, input, name), ctx, deps);
    case "wallet_balances":
      return walletBalancesTool(ctx, deps);
    default:
      throw new Error(`Unknown tool "${name}". Available: ${CONCIERGE_TOOL_NAMES.join(", ")}`);
  }
}
