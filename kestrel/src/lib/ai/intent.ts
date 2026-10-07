import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { ParsedTravelIntent } from "@/lib/types";
import { clamp } from "@/lib/utils";
import { AI_FAST_MODEL, Anthropic, getAnthropic } from "./client";
import { parseIntentHeuristic, type AirportResolver, type HeuristicOptions } from "./intent-heuristics";
import { getAirport as defaultGetAirport, searchAirports as defaultSearchAirports } from "@/data/airports";
import { CANONICAL_PROGRAM_IDS, resolveProgramId } from "./program-synonyms";
import { recordAiUsage } from "./usage";

export { intentToQuery, parseIntentHeuristic, intentChips, summarizeIntent, queryToSearchHref } from "./intent-heuristics";
export type { HeuristicOptions, AirportResolver } from "./intent-heuristics";

export interface ParseIntentOptions extends HeuristicOptions {
  /** Skip the LLM even when a key exists (tests, hot paths). Default true. */
  llm?: boolean;
  /** Override the Anthropic client (tests). `null` forces heuristic-only. */
  client?: Anthropic | null;
  userId?: string | null;
  signal?: AbortSignal;
}

/** Below this heuristic confidence we ask the fast model to refine the parse. */
export const LLM_REFINE_THRESHOLD = 0.8;

const CABINS = ["economy", "premium", "business", "first"] as const;

/** Mirrors ParsedTravelIntent. Nullable (not optional) so the schema is strict-compatible. */
const IntentSchema = z.object({
  origin: z.array(z.string()).describe("Departure IATA airport codes or metro codes (JFK, NYC, LON). Empty when unknown."),
  destination: z.array(z.string()).describe("Arrival IATA airport or metro codes. For a region like Europe list 2-3 representative hubs."),
  date: z.string().nullable().describe("YYYY-MM-DD when the user gave an exact departure date, else null."),
  window: z
    .object({ from: z.string(), to: z.string() })
    .nullable()
    .describe("Inclusive YYYY-MM-DD window when the user was vague (a month, season or holiday), else null."),
  flexDays: z.number().nullable().describe("Days of flexibility either side (0-7), null if not implied."),
  cabin: z.enum(CABINS).nullable().describe("Cabin if stated or strongly implied (lie-flat => business, suites => first)."),
  passengers: z.number().nullable().describe("Number of travellers if stated."),
  programs: z.array(z.string()).describe("Canonical Kestrel program ids the user holds or wants to use (e.g. amex-mr, chase-ur, aeroplan, british-airways-club)."),
  constraints: z.array(z.string()).describe("Short constraint phrases: nonstop, no surcharges, avoid BA, lie-flat, max 100,000 miles."),
  confidence: z.number().describe("0-1 confidence that this captures the request."),
});
export type LlmIntent = z.infer<typeof IntentSchema>;

const PROGRAM_ID_LIST = Array.from(CANONICAL_PROGRAM_IDS).join(", ");

function buildSystemPrompt(today: string, homeAirport: string | undefined, draft: ParsedTravelIntent): string {
  return [
    "You extract award-flight search intent from a short natural-language request for Kestrel, an award-travel app.",
    `Today is ${today}. Resolve relative dates ("next spring", "over Christmas", "May 14") to real dates on or after today.`,
    homeAirport ? `The user's home airport is ${homeAirport}; use it as the origin only when no origin is stated.` : "",
    "Airport codes must be 3-letter IATA codes. Prefer metro codes NYC, LON, PAR, TYO, CHI, WAS, MIL, ROM, SEL, OSA, BKK when a city has several airports.",
    `Program ids must come from this list: ${PROGRAM_ID_LIST}.`,
    "Only fill fields you are confident about; otherwise use null or an empty array. Never invent airports or dates.",
    "A rule-based draft parse is provided for reference; correct or complete it rather than contradicting clear text.",
    `Draft: ${JSON.stringify(draft)}`,
  ]
    .filter(Boolean)
    .join("\n");
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
function validIso(s: unknown): s is string {
  if (typeof s !== "string" || !ISO_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime());
}

/**
 * Keep anything shaped like an IATA/metro code. Codes our curated dataset
 * doesn't know are still kept — the model may know a small airport we omit.
 */
function normalizeCodes(codes: string[]): string[] {
  const out: string[] = [];
  for (const raw of codes) {
    const c = String(raw).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(c)) continue;
    if (!out.includes(c)) out.push(c);
  }
  return out.slice(0, 4);
}

/** Merge: the LLM wins on every field it filled; the heuristic fills the gaps. */
export function mergeIntents(base: ParsedTravelIntent, llm: LlmIntent): ParsedTravelIntent {
  const origin = normalizeCodes(llm.origin ?? []);
  const destination = normalizeCodes(llm.destination ?? []);

  let date = base.date;
  let window = base.window;
  if (validIso(llm.date)) {
    date = llm.date;
    window = undefined;
  } else if (llm.window && validIso(llm.window.from) && validIso(llm.window.to) && llm.window.from <= llm.window.to) {
    window = { from: llm.window.from, to: llm.window.to };
    date = null;
  }

  const programs = (llm.programs ?? [])
    .map((p) => resolveProgramId(String(p)))
    .filter((p): p is string => Boolean(p) && CANONICAL_PROGRAM_IDS.has(p as string));

  const constraints = (llm.constraints ?? [])
    .map((c) => String(c).trim().slice(0, 60))
    .filter(Boolean)
    .slice(0, 10);

  const llmConfidence = typeof llm.confidence === "number" ? clamp(llm.confidence, 0, 1) : 0;

  return {
    origin: origin.length ? origin : base.origin,
    destination: destination.length ? destination : base.destination,
    date,
    window,
    flexDays: typeof llm.flexDays === "number" ? clamp(Math.round(llm.flexDays), 0, 7) : base.flexDays,
    cabin: llm.cabin ?? base.cabin,
    passengers: typeof llm.passengers === "number" && llm.passengers >= 1 ? clamp(Math.round(llm.passengers), 1, 12) : base.passengers,
    programs: Array.from(new Set(programs.length ? programs : base.programs)),
    constraints: Array.from(new Set(constraints.length ? constraints : base.constraints)),
    confidence: Math.round(Math.max(base.confidence, llmConfidence) * 100) / 100,
  };
}

/**
 * Parse a free-text travel request. Heuristics run first (fast, no network).
 * When an Anthropic key exists and the heuristic confidence is below
 * `LLM_REFINE_THRESHOLD`, the fast model refines it via structured output.
 * Never throws: any LLM failure falls back to the heuristic result.
 */
export async function parseTravelIntent(text: string, opts: ParseIntentOptions = {}): Promise<ParsedTravelIntent> {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const resolver: AirportResolver = opts.resolver ?? { getAirport: defaultGetAirport, searchAirports: defaultSearchAirports };
  const heuristic = parseIntentHeuristic(text, { today, homeAirport: opts.homeAirport, resolver });

  if (opts.llm === false) return heuristic;
  const client = opts.client === undefined ? getAnthropic() : opts.client;
  if (!client) return heuristic;
  if (heuristic.confidence >= LLM_REFINE_THRESHOLD) return heuristic;
  const trimmed = text.trim();
  if (trimmed.length < 3) return heuristic;

  try {
    const response = await client.messages.parse(
      {
        model: AI_FAST_MODEL,
        max_tokens: 2048,
        system: buildSystemPrompt(today, opts.homeAirport, heuristic),
        messages: [{ role: "user", content: trimmed.slice(0, 1000) }],
        output_config: { format: zodOutputFormat(IntentSchema), effort: "low" },
      },
      { signal: opts.signal },
    );

    void recordAiUsage({
      userId: opts.userId,
      feature: "intent",
      model: AI_FAST_MODEL,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    });

    if (response.stop_reason === "refusal" || !response.parsed_output) return heuristic;
    return mergeIntents(heuristic, response.parsed_output);
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.warn("[ai] intent parse rate-limited; using heuristic");
    } else if (err instanceof Anthropic.APIError) {
      console.warn(`[ai] intent parse API error ${err.status ?? ""}: ${err.message}`);
    } else if (err instanceof Error && err.name === "AbortError") {
      // Caller went away; heuristic is still a fine answer.
    } else {
      console.warn("[ai] intent parse failed:", err);
    }
    return heuristic;
  }
}
