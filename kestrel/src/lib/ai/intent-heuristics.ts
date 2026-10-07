/**
 * Heuristic travel-intent parser — fast, deterministic, no network.
 * Client-safe (no server-only import). The LLM-backed wrapper lives in
 * `./intent.ts`; this module is what it falls back to and merges with.
 */
import type { Airport, AwardSearchQuery, Cabin, ParsedTravelIntent } from "@/lib/types";
import { addDays, clamp, parseISODate, toISODate, todayISO } from "@/lib/utils";
import { getAirport as defaultGetAirport, searchAirports as defaultSearchAirports } from "@/data/airports";
import { findProgramMentions } from "./program-synonyms";

// ─── Public types ───────────────────────────────────────────────

export interface AirportResolver {
  getAirport(iata: string): Airport | undefined;
  searchAirports(query: string, limit?: number): Airport[];
}

export interface HeuristicOptions {
  /** YYYY-MM-DD; defaults to today (local). */
  today?: string;
  /** Used as origin when the text has none. */
  homeAirport?: string;
  /** Inject airport data (tests); defaults to src/data/airports. */
  resolver?: AirportResolver;
}

export const DEFAULT_CABIN: Cabin = "business";

/** Metro codes the search engine understands (expanded by `expandMetro`). */
export const METRO_CODES: ReadonlySet<string> = new Set([
  "NYC", "LON", "PAR", "TYO", "CHI", "WAS", "MIL", "ROM", "SEL", "OSA", "BUE", "SAO", "BKK", "JKT", "MOW", "STO",
]);

// ─── Static place hints (regions, countries, big metros) ────────

const PLACE_HINTS: Record<string, string[]> = {
  // regions
  europe: ["LON", "PAR", "FRA"],
  "western europe": ["LON", "PAR"],
  "eastern europe": ["PRG", "BUD"],
  scandinavia: ["CPH", "STO"],
  asia: ["TYO", "SIN", "HKG"],
  "east asia": ["TYO", "SEL"],
  "north asia": ["TYO", "SEL"],
  "southeast asia": ["SIN", "BKK"],
  "south east asia": ["SIN", "BKK"],
  "south asia": ["DEL", "BOM"],
  "middle east": ["DXB", "DOH"],
  africa: ["JNB", "CPT"],
  "south africa": ["JNB", "CPT"],
  "north africa": ["CAI", "CMN"],
  oceania: ["SYD", "AKL"],
  australia: ["SYD", "MEL"],
  "new zealand": ["AKL"],
  "south america": ["GRU", "EZE"],
  "central america": ["SJO", "PTY"],
  caribbean: ["SJU", "AUA"],
  hawaii: ["HNL"],
  "north america": ["NYC", "LAX"],
  "united states": ["NYC", "LAX"],
  usa: ["NYC", "LAX"],
  "the states": ["NYC", "LAX"],
  canada: ["YYZ", "YVR"],
  mexico: ["MEX", "CUN"],
  // countries
  japan: ["TYO"],
  korea: ["SEL"],
  "south korea": ["SEL"],
  china: ["PEK", "PVG"],
  taiwan: ["TPE"],
  "hong kong": ["HKG"],
  singapore: ["SIN"],
  thailand: ["BKK"],
  vietnam: ["SGN", "HAN"],
  philippines: ["MNL"],
  indonesia: ["CGK", "DPS"],
  bali: ["DPS"],
  malaysia: ["KUL"],
  india: ["DEL", "BOM"],
  maldives: ["MLE"],
  "sri lanka": ["CMB"],
  uk: ["LON"],
  "united kingdom": ["LON"],
  england: ["LON"],
  britain: ["LON"],
  scotland: ["EDI"],
  ireland: ["DUB"],
  france: ["PAR"],
  germany: ["FRA", "MUC"],
  italy: ["ROM", "MIL"],
  spain: ["MAD", "BCN"],
  portugal: ["LIS"],
  netherlands: ["AMS"],
  holland: ["AMS"],
  belgium: ["BRU"],
  switzerland: ["ZRH", "GVA"],
  austria: ["VIE"],
  greece: ["ATH"],
  turkey: ["IST"],
  croatia: ["ZAG", "DBV"],
  "czech republic": ["PRG"],
  czechia: ["PRG"],
  poland: ["WAW"],
  hungary: ["BUD"],
  denmark: ["CPH"],
  sweden: ["STO"],
  norway: ["OSL"],
  finland: ["HEL"],
  iceland: ["KEF"],
  uae: ["DXB"],
  qatar: ["DOH"],
  israel: ["TLV"],
  egypt: ["CAI"],
  morocco: ["CMN", "RAK"],
  kenya: ["NBO"],
  tanzania: ["JRO"],
  seychelles: ["SEZ"],
  mauritius: ["MRU"],
  brazil: ["GRU", "GIG"],
  argentina: ["EZE"],
  chile: ["SCL"],
  peru: ["LIM"],
  colombia: ["BOG"],
  "costa rica": ["SJO"],
  panama: ["PTY"],
  fiji: ["NAN"],
  tahiti: ["PPT"],
  "french polynesia": ["PPT"],
  "bora bora": ["PPT"],
  // metros & major cities (fallback when the airport dataset is thin)
  tokyo: ["TYO"],
  london: ["LON"],
  paris: ["PAR"],
  "new york": ["NYC"],
  "new york city": ["NYC"],
  nyc: ["NYC"],
  chicago: ["CHI"],
  washington: ["WAS"],
  "washington dc": ["WAS"],
  dc: ["WAS"],
  milan: ["MIL"],
  rome: ["ROM"],
  seoul: ["SEL"],
  osaka: ["OSA"],
  kyoto: ["OSA"],
  "buenos aires": ["BUE"],
  "sao paulo": ["SAO"],
  "são paulo": ["SAO"],
  bangkok: ["BKK"],
  jakarta: ["JKT"],
  moscow: ["MOW"],
  stockholm: ["STO"],
  "los angeles": ["LAX"],
  "san francisco": ["SFO"],
  sydney: ["SYD"],
  melbourne: ["MEL"],
  brisbane: ["BNE"],
  perth: ["PER"],
  auckland: ["AKL"],
  queenstown: ["ZQN"],
  boston: ["BOS"],
  miami: ["MIA"],
  seattle: ["SEA"],
  denver: ["DEN"],
  dallas: ["DFW"],
  houston: ["IAH"],
  atlanta: ["ATL"],
  philadelphia: ["PHL"],
  "san diego": ["SAN"],
  "las vegas": ["LAS"],
  vegas: ["LAS"],
  phoenix: ["PHX"],
  detroit: ["DTW"],
  minneapolis: ["MSP"],
  toronto: ["YYZ"],
  vancouver: ["YVR"],
  montreal: ["YUL"],
  honolulu: ["HNL"],
  maui: ["OGG"],
  cancun: ["CUN"],
  "mexico city": ["MEX"],
  lisbon: ["LIS"],
  madrid: ["MAD"],
  barcelona: ["BCN"],
  amsterdam: ["AMS"],
  frankfurt: ["FRA"],
  munich: ["MUC"],
  zurich: ["ZRH"],
  geneva: ["GVA"],
  vienna: ["VIE"],
  athens: ["ATH"],
  istanbul: ["IST"],
  dublin: ["DUB"],
  edinburgh: ["EDI"],
  copenhagen: ["CPH"],
  oslo: ["OSL"],
  helsinki: ["HEL"],
  reykjavik: ["KEF"],
  prague: ["PRG"],
  budapest: ["BUD"],
  warsaw: ["WAW"],
  venice: ["VCE"],
  florence: ["FLR"],
  dubai: ["DXB"],
  "abu dhabi": ["AUH"],
  doha: ["DOH"],
  "tel aviv": ["TLV"],
  cairo: ["CAI"],
  marrakech: ["RAK"],
  nairobi: ["NBO"],
  "cape town": ["CPT"],
  johannesburg: ["JNB"],
  taipei: ["TPE"],
  manila: ["MNL"],
  hanoi: ["HAN"],
  saigon: ["SGN"],
  "ho chi minh city": ["SGN"],
  "kuala lumpur": ["KUL"],
  delhi: ["DEL"],
  "new delhi": ["DEL"],
  mumbai: ["BOM"],
  beijing: ["PEK"],
  shanghai: ["PVG"],
  rio: ["GIG"],
  "rio de janeiro": ["GIG"],
  lima: ["LIM"],
  santiago: ["SCL"],
  bogota: ["BOG"],
};

/** Words that pass the bare-city scan but are far more often plain English. */
const BARE_SCAN_BLOCKLIST = new Set(["nice", "reading", "bath", "mobile", "orange", "split", "male", "most", "home", "hope"]);

/** Uppercase 3-letter tokens that are English words, never airport codes here. */
const IATA_BLOCKLIST = new Set([
  "THE", "AND", "FOR", "NOT", "BUT", "ALL", "ANY", "CAN", "GET", "MAY", "NEW", "NOW", "OLD", "ONE", "OUR", "OUT", "TWO",
  "SIX", "TEN", "WAY", "YES", "YOU", "VIA", "TOP", "BIZ", "LIE", "FLY", "SEE", "PAX", "USD", "CPP", "RTW", "ETA", "ASK",
  "HOW", "WHO", "WHY", "USE", "LET", "ITS", "PER", "MID", "END", "LOW", "BIG", "RED", "EYE", "DAY", "FEW", "TRY", "FAR",
  "JAN", "FEB", "MAR", "APR", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
]);

const PLACE_STOP_WORDS = new Set([
  "in", "on", "for", "with", "using", "via", "nonstop", "non-stop", "direct", "next", "this", "over", "during", "around",
  "business", "first", "economy", "premium", "coach", "class", "and", "from", "to", "by", "at", "my", "our", "miles",
  "points", "flying", "fly", "lie-flat", "then", "return", "returning", "round", "roundtrip", "one-way", "early", "mid",
  "late", "under", "below", "max", "or", "of", "the", "a", "an", "is", "are", "be", "please", "want", "need", "looking",
  "trip", "flight", "flights", "ticket", "tickets", "seat", "seats", "award", "awards", "redemption", "sometime",
  "somewhere", "anywhere", "cheap", "cheapest", "best", "value", "go", "book", "find", "get", "see", "visit", "travel",
  "head", "take", "use", "do", "spend", "search", "look", "like", "would", "can", "could", "i", "we", "me", "us", "it",
  "that", "some", "any", "week", "weekend", "month", "tomorrow", "today", "season", "cherry", "blossom", "sakura", "golden",
  "christmas", "xmas", "thanksgiving", "easter", "summer", "winter", "spring", "fall", "autumn", "holidays", "holiday",
  "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december",
  "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "people", "pax", "passengers",
  "adults", "kids", "children", "family", "couple", "solo", "ideally", "preferably", "only", "just", "also", "maybe",
  "about", "roughly", "approximately", "there", "here", "back", "home", "two", "three", "four", "five", "six", "one",
]);

// ─── Small helpers ──────────────────────────────────────────────

const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
const MONTH_PREFIXES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function monthIndex(token: string): number {
  const t = token.toLowerCase().slice(0, 3);
  return MONTH_PREFIXES.indexOf(t);
}

const NUM_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, a: 1, single: 1,
};
function toNumber(token: string): number | null {
  const t = token.toLowerCase();
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  return NUM_WORDS[t] ?? null;
}

function blank(s: string, start: number, len: number): string {
  return s.slice(0, start) + " ".repeat(len) + s.slice(start + len);
}

function uniq<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function lastDayOfMonth(y: number, m: number): Date {
  return new Date(y, m + 1, 0);
}

/** Resolve a month/day (optional year) to the next occurrence on/after today. */
function resolveMonthDay(month: number, day: number, year: number | undefined, today: string): string | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const t = parseISODate(today);
  let y = year ?? t.getFullYear();
  if (year !== undefined && year < 100) y = 2000 + year;
  let d = new Date(y, month, day);
  if (d.getMonth() !== month) return null; // e.g. Feb 30
  if (year === undefined && toISODate(d) < today) d = new Date(y + 1, month, day);
  return toISODate(d);
}

type Part = "early" | "mid" | "late" | undefined;

function monthWindow(month: number, today: string, part: Part, yearHint?: number): { from: string; to: string } {
  const t = parseISODate(today);
  const build = (y: number) => {
    let from = new Date(y, month, 1);
    let to = lastDayOfMonth(y, month);
    if (part === "early") to = new Date(y, month, 10);
    else if (part === "mid") {
      from = new Date(y, month, 11);
      to = new Date(y, month, 20);
    } else if (part === "late") from = new Date(y, month, 21);
    return { from, to };
  };
  let y = yearHint ?? t.getFullYear();
  let w = build(y);
  if (yearHint === undefined && toISODate(w.to) < today) {
    y += 1;
    w = build(y);
  }
  let from = toISODate(w.from);
  if (from <= today) from = addDays(today, 1);
  return { from, to: toISODate(w.to) };
}

/** Window spanning [m1/d1 .. m2/d2], rolling into next year if it has already passed. */
function spanWindow(m1: number, d1: number, m2: number, d2: number, today: string, forceNext = false): { from: string; to: string } {
  const t = parseISODate(today);
  const build = (y: number) => {
    const from = new Date(y, m1, d1);
    const to = new Date(m2 < m1 || (m2 === m1 && d2 < d1) ? y + 1 : y, m2, d2);
    return { from: toISODate(from), to: toISODate(to) };
  };
  let w = build(t.getFullYear());
  if (w.to < today || (forceNext && w.from <= today)) w = build(t.getFullYear() + 1);
  if (w.from <= today) w = { from: addDays(today, 1), to: w.to };
  return w;
}

// ─── Section parsers (each scrubs what it consumed) ─────────────

interface DateFindings {
  date: string | null;
  window?: { from: string; to: string };
  flexDays?: number;
  extraConstraints: string[];
  explicit: boolean;
}

function parseDates(work: string, today: string): { work: string; found: DateFindings } {
  const found: DateFindings = { date: null, extraConstraints: [], explicit: false };
  const explicitDates: string[] = [];
  let window: { from: string; to: string } | undefined;

  const consume = (re: RegExp, handler: (m: RegExpExecArray) => boolean) => {
    const snapshot = work;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(snapshot))) {
      if (handler(m)) work = blank(work, m.index, m[0].length);
      if (m[0].length === 0) re.lastIndex++;
    }
  };

  // 1. ISO dates
  consume(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/g, (m) => {
    const iso = resolveMonthDay(parseInt(m[2], 10) - 1, parseInt(m[3], 10), parseInt(m[1], 10), today);
    if (!iso) return false;
    explicitDates.push(iso);
    return true;
  });

  // 2. Numeric m/d(/y)
  consume(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g, (m) => {
    const iso = resolveMonthDay(parseInt(m[1], 10) - 1, parseInt(m[2], 10), m[3] ? parseInt(m[3], 10) : undefined, today);
    if (!iso) return false;
    explicitDates.push(iso);
    return true;
  });

  // 3a. "May 14", "May 14th, 2027", "May 14-20", "May 14 to June 2"
  consume(
    new RegExp(
      `\\b${MONTH_RE}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|—|to|through|thru|until)\\s*(?:${MONTH_RE}\\.?\\s+)?(\\d{1,2})(?:st|nd|rd|th)?)?(?:,?\\s*(20\\d{2}))?\\b(?!\\s*(?:people|pax|passengers|adults|nights|days|weeks))`,
      "gi",
    ),
    (m) => {
      const month = monthIndex(m[1]);
      const year = m[5] ? parseInt(m[5], 10) : undefined;
      const from = resolveMonthDay(month, parseInt(m[2], 10), year, today);
      if (!from) return false;
      if (m[4]) {
        const month2 = m[3] ? monthIndex(m[3]) : month;
        const fromYear = parseInt(from.slice(0, 4), 10);
        const to = resolveMonthDay(month2, parseInt(m[4], 10), year ?? fromYear, today);
        if (to && to >= from) {
          window = { from, to };
          return true;
        }
      }
      explicitDates.push(from);
      return true;
    },
  );

  // 3b. "14 May", "14th of May 2027", "14-20 May"
  consume(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?(?:\\s*(?:-|–|to)\\s*(\\d{1,2})(?:st|nd|rd|th)?)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:,?\\s*(20\\d{2}))?`, "gi"),
    (m) => {
      const month = monthIndex(m[3]);
      const year = m[4] ? parseInt(m[4], 10) : undefined;
      const from = resolveMonthDay(month, parseInt(m[1], 10), year, today);
      if (!from) return false;
      if (m[2]) {
        const to = resolveMonthDay(month, parseInt(m[2], 10), year ?? parseInt(from.slice(0, 4), 10), today);
        if (to && to >= from) {
          window = { from, to };
          return true;
        }
      }
      explicitDates.push(from);
      return true;
    },
  );

  // 4. Holidays & named seasons
  const HOLIDAYS: [RegExp, [number, number, number, number]][] = [
    [/\b(?:over|at|for|around|during|on|this|next|the)?\s*(?:christmas|xmas)(?:\s*(?:break|holidays?|week|time))?\b/gi, [11, 18, 0, 2]],
    [/\b(?:over|at|for|around|during|on|this|next|the)?\s*new\s*years?(?:'s)?(?:\s*(?:eve|day|week))?\b/gi, [11, 28, 0, 3]],
    [/\b(?:over|at|for|around|during|on|this|next|the)?\s*(?:the\s+)?holidays\b/gi, [11, 18, 0, 3]],
    [/\b(?:over|at|for|around|during|on|this|next|the)?\s*thanksgiving(?:\s*(?:week|weekend|break))?\b/gi, [10, 20, 10, 30]],
    [/\b(?:over|at|for|around|during|on|this|next|the)?\s*easter(?:\s*(?:week|weekend|break))?\b/gi, [2, 28, 3, 12]],
    [/\b(?:over|at|for|around|during|on|this|next|the)?\s*spring\s*break\b/gi, [2, 7, 3, 5]],
    [/\b(?:in|during|for|around|over|the)?\s*(?:cherry\s*blossom(?:\s*season)?|sakura(?:\s*season)?|hanami)\b/gi, [2, 20, 3, 15]],
    [/\b(?:in|during|for|around|over|the)?\s*golden\s*week\b/gi, [3, 29, 4, 6]],
    [/\b(?:over|on|for|around|during|the)?\s*labou?r\s*day(?:\s*weekend)?\b/gi, [7, 29, 8, 5]],
    [/\b(?:over|on|for|around|during|the)?\s*memorial\s*day(?:\s*weekend)?\b/gi, [4, 22, 4, 30]],
    [/\b(?:over|on|for|around|during|the)?\s*(?:july\s*4(?:th)?|fourth\s*of\s*july|independence\s*day)\b/gi, [6, 1, 6, 7]],
    [/\b(?:over|on|for|around|during|the)?\s*halloween\b/gi, [9, 25, 10, 1]],
    [/\b(?:over|on|for|around|during|the)?\s*valentine'?s?(?:\s*day)?\b/gi, [1, 10, 1, 16]],
    [/\b(?:in|during|for|around|over|the)?\s*(?:fall\s*foliage|autumn\s*leaves|leaf\s*peeping)\b/gi, [9, 1, 10, 10]],
    [/\b(?:in|during|for|around|over|the)?\s*ski\s*season\b/gi, [11, 15, 2, 15]],
  ];
  for (const [re, [m1, d1, m2, d2]] of HOLIDAYS) {
    consume(re, () => {
      if (!window) window = spanWindow(m1, d1, m2, d2, today);
      return true;
    });
  }

  // 5. Seasons
  consume(/\b(next|this|in|during|over|for|the)?\s*(spring|summer|fall|autumn|winter)(?:\s*(?:holidays?|break|time|vacation))?\b(?:\s*(?:of\s*)?(20\d{2}))?/gi, (m) => {
    const season = m[2].toLowerCase();
    const spans: Record<string, [number, number, number, number]> = {
      spring: [2, 20, 5, 20],
      summer: [5, 21, 8, 22],
      fall: [8, 23, 11, 20],
      autumn: [8, 23, 11, 20],
      winter: [11, 21, 2, 19],
    };
    const [m1, d1, m2, d2] = spans[season];
    const forceNext = (m[1] ?? "").toLowerCase() === "next";
    if (!window) {
      if (m[3]) {
        const y = parseInt(m[3], 10);
        window = { from: toISODate(new Date(y, m1, d1)), to: toISODate(new Date(m2 < m1 ? y + 1 : y, m2, d2)) };
      } else window = spanWindow(m1, d1, m2, d2, today, forceNext);
    }
    return true;
  });

  // 6. "early/mid/late June"
  consume(new RegExp(`\\b(early|mid|late|end of|beginning of|start of|first half of|second half of)[\\s-]+(?:next\\s+|this\\s+)?${MONTH_RE}\\b(?:\\s*(20\\d{2}))?`, "gi"), (m) => {
    const p = m[1].toLowerCase();
    const part: Part = p.startsWith("early") || p.startsWith("beginning") || p.startsWith("start") || p.startsWith("first") ? "early" : p.startsWith("mid") ? "mid" : "late";
    if (!window) window = monthWindow(monthIndex(m[2]), today, part, m[3] ? parseInt(m[3], 10) : undefined);
    return true;
  });

  // 7. "in May", "next May", bare "May" / "October 2027"
  consume(new RegExp(`(?:\\b(in|during|for|around|sometime in|next|this|by)\\s+)?\\b${MONTH_RE}\\b\\.?(?:\\s*(20\\d{2}))?(?!\\s*\\d)`, "gi"), (m) => {
    const token = m[2];
    const hasContext = Boolean(m[1]);
    // Bare "may" is almost always the modal verb unless capitalised or contextualised.
    if (token.toLowerCase() === "may" && !hasContext && token !== "May") return false;
    if (!window && explicitDates.length === 0) window = monthWindow(monthIndex(token), today, undefined, m[3] ? parseInt(m[3], 10) : undefined);
    return true;
  });

  // 8. Relative phrases
  consume(/\btomorrow\b/gi, () => {
    explicitDates.push(addDays(today, 1));
    return true;
  });
  consume(/\b(this|next)\s+weekend\b/gi, (m) => {
    const t = parseISODate(today);
    const dow = t.getDay(); // 0 Sun .. 6 Sat
    let daysToSat = (6 - dow + 7) % 7;
    if (daysToSat === 0) daysToSat = 7;
    if (m[1].toLowerCase() === "next") daysToSat += 7;
    const sat = addDays(today, daysToSat);
    if (!window) window = { from: sat, to: addDays(sat, 1) };
    return true;
  });
  consume(/\bnext\s+week\b/gi, () => {
    const t = parseISODate(today);
    const dow = t.getDay();
    const daysToMon = ((8 - dow) % 7) || 7;
    const mon = addDays(today, daysToMon);
    if (!window) window = { from: mon, to: addDays(mon, 6) };
    return true;
  });
  consume(/\b(next|this)\s+month\b/gi, (m) => {
    const t = parseISODate(today);
    if (!window) {
      if (m[1].toLowerCase() === "next") {
        const nm = (t.getMonth() + 1) % 12;
        const y = nm === 0 ? t.getFullYear() + 1 : t.getFullYear();
        window = monthWindow(nm, today, undefined, y);
      } else window = { from: addDays(today, 1), to: toISODate(lastDayOfMonth(t.getFullYear(), t.getMonth())) };
    }
    return true;
  });
  consume(/\bin\s+(\d{1,2}|a|two|three|four|five|six)\s+(days?|weeks?|months?)\b/gi, (m) => {
    const n = toNumber(m[1]) ?? 1;
    const unit = m[2].toLowerCase();
    if (unit.startsWith("day")) explicitDates.push(addDays(today, n));
    else if (unit.startsWith("week")) explicitDates.push(addDays(today, n * 7));
    else if (!window) {
      const t = parseISODate(today);
      const total = t.getMonth() + n;
      window = monthWindow(total % 12, today, undefined, t.getFullYear() + Math.floor(total / 12));
    }
    return true;
  });

  // 9. Flexibility
  consume(/(?:±|\+\/?-|plus or minus|plus\/minus|give or take)\s*(\d)\s*days?\b|\b(\d)\s*days?\s*(?:either side|on either side|of flex(?:ibility)?|flex(?:ibility)?)\b/gi, (m) => {
    found.flexDays = clamp(parseInt(m[1] ?? m[2], 10), 0, 7);
    return true;
  });
  consume(/\b(?:flexible(?:\s+(?:on\s+)?dates?)?|flex(?:ible)?\s+dates?|dates?\s+(?:are\s+)?flexible|any\s*time|whenever)\b/gi, () => {
    found.flexDays = found.flexDays ?? 3;
    found.extraConstraints.push("flexible dates");
    return true;
  });

  explicitDates.sort();
  if (explicitDates.length > 0) {
    found.date = explicitDates[0];
    found.explicit = true;
    if (explicitDates.length > 1) found.extraConstraints.push(`round-trip returning ${explicitDates[1]}`);
  } else if (window) {
    found.window = window;
    found.explicit = true;
  }
  return { work, found };
}

function parseCabin(work: string): { work: string; cabin: Cabin | null } {
  const patterns: [RegExp, Cabin][] = [
    [/\b(?:premium[- ]economy|prem(?:ium)?[- ]econ(?:omy)?|premium(?:[- ]class)?|pe\s+class|economy\s+plus)\b/gi, "premium"],
    [/\bfirst[- ]class\b|\b(?:in|fly|flying|book)\s+first\b|\bfirst\b(?=\s*(?:$|[,.;!?]|cabin|seat|or|and|from|to\b))|\b(?:singapore|sq|etihad|emirates|ana|jal|lufthansa|lh|cathay)\s+(?:first|suites?)\b|\bthe\s+residence\b|\bfirst\s+suites?\b/gi, "first"],
    [/\bbusiness(?:[- ]class)?\b|\bbiz(?:[- ]class)?\b|\blie[- ]?flat\b|\bflat[- ]?beds?\b|\bflatbed\b|\bqsuites?\b|\bpolaris\b|\bclub\s+world\b|\bupper\s+class\b/gi, "business"],
    [/\beconomy(?:[- ]class)?\b|\bcoach\b|\bmain\s+cabin\b|\beco\b/gi, "economy"],
  ];
  const hits: { index: number; cabin: Cabin; len: number }[] = [];
  for (const [re, cabin] of patterns) {
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(work))) hits.push({ index: m.index, cabin, len: m[0].length });
  }
  // Single-letter codes, uppercase only, standalone: J F W Y
  const letterRe = /(?<![A-Za-z0-9/])([JFWY])(?![A-Za-z0-9/])/g;
  let lm: RegExpExecArray | null;
  while ((lm = letterRe.exec(work))) {
    const map: Record<string, Cabin> = { J: "business", F: "first", W: "premium", Y: "economy" };
    hits.push({ index: lm.index, cabin: map[lm[1]], len: 1 });
  }
  if (hits.length === 0) return { work, cabin: null };
  hits.sort((a, b) => a.index - b.index);
  const chosen = hits[0].cabin;
  // Scrub every cabin mention so they don't leak into place detection.
  for (const h of hits) {
    // "lie-flat" is also a constraint; leave it for the constraint pass.
    const txt = work.slice(h.index, h.index + h.len).toLowerCase();
    if (/lie|flat/.test(txt)) continue;
    work = blank(work, h.index, h.len);
  }
  return { work, cabin: chosen };
}

function parsePassengers(work: string): { work: string; passengers: number | null } {
  let pax: number | null = null;
  const consume = (re: RegExp, handler: (m: RegExpExecArray) => boolean) => {
    const snapshot = work;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(snapshot))) {
      if (handler(m)) work = blank(work, m.index, m[0].length);
    }
  };
  const NUM = "(\\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|a)";

  // "2 adults and 2 kids"
  let adults = 0;
  let kids = 0;
  consume(new RegExp(`\\b${NUM}\\s+(adults?|grown-?ups)\\b`, "gi"), (m) => {
    adults += toNumber(m[1]) ?? 0;
    return true;
  });
  consume(new RegExp(`\\b${NUM}\\s+(kids?|children|child|infants?|teens?|teenagers?)\\b`, "gi"), (m) => {
    kids += toNumber(m[1]) ?? 0;
    return true;
  });
  if (adults + kids > 0) pax = adults + kids;

  consume(new RegExp(`\\b(?:family|party|group)\\s+of\\s+${NUM}\\b`, "gi"), (m) => {
    pax = pax ?? toNumber(m[1]);
    return true;
  });
  consume(new RegExp(`\\b${NUM}\\s+(?:people|pax|passengers|travell?ers|persons|ppl|tickets|seats|of\\s+us)\\b`, "gi"), (m) => {
    pax = pax ?? toNumber(m[1]);
    return true;
  });
  consume(/\b(?:the\s+)?(?:two|both)\s+of\s+us\b|\bmy\s+(?:wife|husband|partner|spouse|girlfriend|boyfriend|fianc[ée]e?)\s+and\s+(?:me|i)\b|\bme\s+and\s+my\s+(?:wife|husband|partner|spouse|girlfriend|boyfriend)\b|\b(?:as\s+a\s+)?couple\b|\bhoneymoon\b|\banniversary\b/gi, () => {
    pax = pax ?? 2;
    return true;
  });
  consume(/\bsolo\b|\bjust\s+me\b|\b(?:by\s+)?myself\b|\bone\s+person\b/gi, () => {
    pax = pax ?? 1;
    return true;
  });
  // "for two", "for 2" — but not "for 2 weeks" / "for May 2"
  consume(
    new RegExp(`\\b(?:for|with)\\s+${NUM}(?!\\s*(?:days?|nights?|weeks?|months?|k\\b|miles|points|pts|hours?|hrs|%|st\\b|nd\\b|rd\\b|th\\b|${MONTH_RE}|/|-|:))\\b`, "gi"),
    (m) => {
      const n = toNumber(m[1]);
      if (n === null || n < 1 || n > 12) return false;
      if (m[1].toLowerCase() === "a") return false;
      pax = pax ?? n;
      return true;
    },
  );
  consume(/\bx\s?(\d)\b|\b(\d)\s?x\b/gi, (m) => {
    pax = pax ?? parseInt(m[1] ?? m[2], 10);
    return true;
  });
  return { work, passengers: pax };
}

function parseConstraints(work: string): { work: string; constraints: string[]; impliedCabin: Cabin | null } {
  const constraints: string[] = [];
  let impliedCabin: Cabin | null = null;
  const consume = (re: RegExp, handler: (m: RegExpExecArray) => boolean) => {
    const snapshot = work;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(snapshot))) {
      if (handler(m)) work = blank(work, m.index, m[0].length);
    }
  };
  const add = (c: string) => {
    if (!constraints.includes(c)) constraints.push(c);
  };

  consume(/\b(?:no|without|avoid(?:ing)?|low|minimal|zero|skip)\s+(?:the\s+)?(?:fuel\s+|carrier[- ]imposed\s+|high\s+)?(?:surcharges?|yq|fees|taxes(?:\s+and\s+fees)?)\b|\blow[- ]taxes\b|\bcheap\s+taxes\b/gi, () => {
    add("no surcharges");
    return true;
  });
  consume(/\bnon-?\s?stop\b|\bdirect(?:\s+(?:flights?|only))?\b|\bno\s+(?:connections?|layovers?|stops?)\b|\bwithout\s+(?:a\s+|any\s+)?(?:connection|layover|stop)s?\b/gi, () => {
    add("nonstop");
    return true;
  });
  consume(/\b(?:max(?:imum)?|at\s+most|no\s+more\s+than|up\s+to)\s+(?:one|1)\s+(?:stop|connection)\b|\bone[- ]stop\b/gi, () => {
    add("max 1 stop");
    return true;
  });
  consume(/\blie[- ]?flat\b|\bflat[- ]?beds?\b|\bflatbed\b|\bfully\s+flat\b/gi, () => {
    add("lie-flat");
    impliedCabin = impliedCabin ?? "business";
    return true;
  });
  consume(/\bqsuites?\b/gi, () => {
    add("qsuite");
    impliedCabin = impliedCabin ?? "business";
    return true;
  });
  consume(/\b(?:singapore|sq|etihad|emirates|ana|jal|lufthansa|lh|cathay)?\s*(?:first\s+)?suites?\b|\bthe\s+residence\b|\bapartments?\b/gi, () => {
    add("suites");
    impliedCabin = impliedCabin ?? "first";
    return true;
  });
  consume(/\bno\s+red[- ]?eyes?\b|\bavoid(?:ing)?\s+red[- ]?eyes?\b|\bnot?\s+overnight\b|\bdaytime\s+(?:flights?|only)\b|\bday\s+flight\b/gi, () => {
    add("no red-eye");
    return true;
  });
  consume(/\b(?:under|below|less\s+than|max(?:imum)?|no\s+more\s+than|up\s+to|at\s+most)\s+(\d{2,3})\s*k\b(?:\s*(?:miles|points|pts))?|\b(?:under|below|less\s+than|max(?:imum)?|no\s+more\s+than|up\s+to|at\s+most)\s+(\d{2,3}[,.]\d{3})\s*(?:miles|points|pts)?\b/gi, (m) => {
    const n = m[1] ? parseInt(m[1], 10) * 1000 : parseInt(m[2].replace(/[,.]/g, ""), 10);
    add(`max ${n.toLocaleString("en-US")} miles`);
    return true;
  });
  consume(/\b(?:a380|a350|777x?|787|dreamliner|747)\b/gi, (m) => {
    add(`aircraft ${m[0].toUpperCase()}`);
    return true;
  });
  consume(/\bone[- ]?way\b|\bow\b/gi, () => {
    add("one-way");
    return true;
  });
  consume(/\bround[- ]?trip\b|\breturn\s+(?:flight|ticket|trip)\b|\bboth\s+ways\b|\brt\b/gi, () => {
    add("round-trip");
    return true;
  });
  consume(/\b(?:with\s+a\s+)?stop-?over\b/gi, () => {
    add("stopover");
    return true;
  });
  consume(/\b(?:cheapest|fewest\s+(?:miles|points)|lowest\s+(?:miles|points)|best\s+value|best\s+deal|bargain)\b/gi, () => {
    add("best value");
    return true;
  });
  // "avoid BA", "avoid Lufthansa", "not on United", "no British Airways"
  consume(/\b(?:avoid(?:ing)?|not\s+on|no|never\s+on|skip|except)\s+(?:flying\s+|on\s+|the\s+)?([A-Za-z][A-Za-z&]*(?:\s+(?:air|airways|airlines|pacific|atlantic|express))?)\b/gi, (m) => {
    const who = m[1].trim();
    const lower = who.toLowerCase();
    if (/^(?:surcharge|surcharges|fees|taxes|yq|red|long|overnight|connection|connections|layover|layovers|stop|stops|the|a|an|it|that|this|flying)$/.test(lower)) return false;
    if (lower.length < 2) return false;
    add(`avoid ${who.length <= 3 ? who.toUpperCase() : who}`);
    return true;
  });
  return { work, constraints, impliedCabin };
}

// ─── Place resolution ───────────────────────────────────────────

interface PlaceHit {
  codes: string[];
  kind: "iata" | "metro" | "city" | "hint";
}

function resolveSingle(phraseRaw: string, resolver: AirportResolver): PlaceHit | null {
  const phrase = phraseRaw
    .trim()
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/[.,;:!?'"]+$/g, "")
    .trim();
  if (!phrase) return null;
  const lower = phrase.toLowerCase();

  // 3-letter code
  if (/^[a-z]{3}$/i.test(phrase)) {
    const upper = phrase.toUpperCase();
    if (IATA_BLOCKLIST.has(upper) && phrase !== upper) return null;
    if (METRO_CODES.has(upper)) return { codes: [upper], kind: "metro" };
    if (resolver.getAirport(upper)) return { codes: [upper], kind: "iata" };
    if (phrase !== upper) return null; // lowercase 3-letter non-airport word
    if (IATA_BLOCKLIST.has(upper)) return null;
    // Unknown uppercase code: trust the user typed an IATA code.
    return { codes: [upper], kind: "iata" };
  }

  // Dataset city / name search
  const results = resolver.searchAirports(lower, 10);
  if (results.length) {
    const exact = results.filter((a) => a.city.toLowerCase() === lower || a.name.toLowerCase() === lower);
    const starts = results.filter((a) => a.city.toLowerCase().startsWith(lower));
    const includes = lower.length >= 4 ? results.filter((a) => a.name.toLowerCase().includes(lower) || a.city.toLowerCase().includes(lower)) : [];
    const pool = exact.length ? exact : starts.length ? starts : includes;
    if (pool.length) {
      const best = [...pool].sort((a, b) => Number(Boolean(b.hub)) - Number(Boolean(a.hub)))[0];
      return { codes: [best.metro ?? best.iata], kind: best.metro ? "metro" : "city" };
    }
  }

  const hint = PLACE_HINTS[lower];
  if (hint) return { codes: hint, kind: "hint" };
  return null;
}

/** Resolve a free-text place phrase; splits "Tokyo or Osaka", "Paris, Rome". */
function resolvePlace(phrase: string, resolver: AirportResolver): PlaceHit | null {
  const parts = phrase.split(/\s*(?:,|\/|\bor\b|\band\b)\s*/i).filter(Boolean);
  if (parts.length > 1) {
    const codes: string[] = [];
    let kind: PlaceHit["kind"] = "city";
    for (const p of parts) {
      const hit = resolvePlace(p, resolver);
      if (hit) {
        codes.push(...hit.codes);
        kind = hit.kind;
      }
    }
    return codes.length ? { codes: uniq(codes), kind } : null;
  }
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  // Longest leading phrase that resolves (up to 3 words), then trailing.
  for (let n = Math.min(3, words.length); n >= 1; n--) {
    const hit = resolveSingle(words.slice(0, n).join(" "), resolver);
    if (hit) return hit;
  }
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const hit = resolveSingle(words.slice(words.length - n).join(" "), resolver);
    if (hit) return hit;
  }
  return null;
}

/** Take up to `max` words after a keyword, stopping at stop words / punctuation. */
function grabPhrase(text: string, start: number, max = 3): { phrase: string; end: number } {
  const rest = text.slice(start);
  const tokens: { word: string; end: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rest)) && tokens.length < max) {
    const raw = m[0];
    const word = raw.replace(/[.,;:!?'"()]+$/g, "");
    const lower = word.toLowerCase();
    const isConnector = lower === "or" || lower === "and" || raw.endsWith(",");
    if (!word) break;
    if (PLACE_STOP_WORDS.has(lower) && !(isConnector && tokens.length > 0)) break;
    if (/^\d/.test(word)) break;
    tokens.push({ word: raw.endsWith(",") ? `${word},` : word, end: m.index + raw.length });
    if (/[.;:!?]$/.test(raw)) break;
    // allow one connector in the middle ("Tokyo or Osaka") by extending max
    if (isConnector && tokens.length === max) max++;
  }
  // Trim trailing connectors
  while (tokens.length && /^(?:or|and)$/i.test(tokens[tokens.length - 1].word)) tokens.pop();
  if (!tokens.length) return { phrase: "", end: start };
  return { phrase: tokens.map((t) => t.word).join(" "), end: start + tokens[tokens.length - 1].end };
}

function parsePlaces(work: string, resolver: AirportResolver): { work: string; origin: string[]; destination: string[] } {
  let origin: string[] = [];
  let destination: string[] = [];
  const consumed: [number, number][] = [];
  const take = (s: number, e: number) => {
    consumed.push([s, e]);
    work = blank(work, s, e - s);
  };

  // a. IATA pairs: "LAX-SYD", "JFK → NRT", "jfk to nrt", "LAX>SYD"
  const pairRe = /(?<![A-Za-z])([A-Za-z]{3})\s*(?:-|–|—|>|->|→|\/)\s*([A-Za-z]{3})(?![A-Za-z])|(?<![A-Za-z])([A-Za-z]{3})\s+to\s+([A-Za-z]{3})(?![A-Za-z])/g;
  let pm: RegExpExecArray | null;
  while ((pm = pairRe.exec(work))) {
    const a = pm[1] ?? pm[3];
    const b = pm[2] ?? pm[4];
    const ha = resolveSingle(a, resolver);
    const hb = resolveSingle(b, resolver);
    if (ha && hb && (ha.kind === "iata" || ha.kind === "metro") && (hb.kind === "iata" || hb.kind === "metro")) {
      if (!origin.length) origin = ha.codes;
      if (!destination.length) destination = hb.codes;
      take(pm.index, pm.index + pm[0].length);
    }
  }

  // b. "between X and Y"
  const betweenRe = /\bbetween\s+(.+?)\s+and\s+(.+?)(?=$|[,.;]|\s+(?:in|on|for|with|next|this|over|during|around|using|via)\b)/gi;
  let bm: RegExpExecArray | null;
  while ((bm = betweenRe.exec(work))) {
    const ho = resolvePlace(bm[1], resolver);
    const hd = resolvePlace(bm[2], resolver);
    if (ho && hd) {
      if (!origin.length) origin = ho.codes;
      if (!destination.length) destination = hd.codes;
      take(bm.index, bm.index + bm[0].length);
    }
  }

  // c. "from X" / "out of X" / "departing X"
  const fromRe = /\b(?:from|out\s+of|departing(?:\s+from)?|leaving(?:\s+from)?|ex)\s+/gi;
  let fm: RegExpExecArray | null;
  while ((fm = fromRe.exec(work))) {
    const { phrase, end } = grabPhrase(work, fm.index + fm[0].length);
    if (!phrase) continue;
    const hit = resolvePlace(phrase, resolver);
    if (hit && !origin.length) {
      origin = hit.codes;
      take(fm.index, end);
    }
  }

  // d. "to X" / "into X" / "→ X"
  const toRe = /(?:\bto|\binto|\btowards?|→|->)\s+/gi;
  let tm: RegExpExecArray | null;
  while ((tm = toRe.exec(work))) {
    const { phrase, end } = grabPhrase(work, tm.index + tm[0].length);
    if (!phrase) continue;
    const hit = resolvePlace(phrase, resolver);
    if (hit && !destination.length) {
      destination = hit.codes;
      // Origin immediately before "to": "Boston to Tokyo"
      if (!origin.length) {
        const before = work.slice(0, tm.index).trimEnd();
        const prevWords = before.split(/\s+/).filter(Boolean).slice(-3);
        for (let n = prevWords.length; n >= 1; n--) {
          const cand = prevWords.slice(prevWords.length - n).join(" ");
          if (cand.split(/\s+/).some((w) => PLACE_STOP_WORDS.has(w.toLowerCase().replace(/[^a-z-]/g, "")))) continue;
          const oh = resolvePlace(cand, resolver);
          if (oh) {
            origin = oh.codes;
            const s = before.lastIndexOf(cand);
            if (s >= 0) take(s, s + cand.length);
            break;
          }
        }
      }
      take(tm.index, end);
    }
  }

  // e. Bare uppercase IATA codes anywhere
  const codeRe = /(?<![A-Za-z])([A-Z]{3})(?![A-Za-z])/g;
  let cm: RegExpExecArray | null;
  const bare: { code: string; index: number }[] = [];
  while ((cm = codeRe.exec(work))) {
    if (IATA_BLOCKLIST.has(cm[1])) continue;
    const hit = resolveSingle(cm[1], resolver);
    if (hit && (hit.kind === "iata" || hit.kind === "metro")) bare.push({ code: hit.codes[0], index: cm.index });
  }
  if (bare.length >= 2 && !origin.length && !destination.length) {
    origin = [bare[0].code];
    destination = [bare[1].code];
    take(bare[0].index, bare[0].index + 3);
    take(bare[1].index, bare[1].index + 3);
  } else if (bare.length >= 1) {
    const b = bare[0];
    if (!destination.length) destination = [b.code];
    else if (!origin.length) origin = [b.code];
    take(b.index, b.index + 3);
  }

  // f. Bare city names ("Tokyo in cherry blossom season") — exact matches only
  if (!destination.length) {
    const words = work.split(/\s+/).filter(Boolean);
    outer: for (let i = 0; i < words.length; i++) {
      for (let n = 3; n >= 1; n--) {
        if (i + n > words.length) continue;
        const cand = words
          .slice(i, i + n)
          .join(" ")
          .replace(/[.,;:!?'"()]+/g, "");
        const lower = cand.toLowerCase();
        if (lower.length < 4 || BARE_SCAN_BLOCKLIST.has(lower)) continue;
        if (cand.split(/\s+/).some((w) => PLACE_STOP_WORDS.has(w.toLowerCase()))) continue;
        const hit = PLACE_HINTS[lower] ? { codes: PLACE_HINTS[lower] } : null;
        const exact = hit ?? (() => {
          const res = resolver.searchAirports(lower, 10).filter((a) => a.city.toLowerCase() === lower || a.name.toLowerCase() === lower);
          if (!res.length) return null;
          const best = [...res].sort((a, b) => Number(Boolean(b.hub)) - Number(Boolean(a.hub)))[0];
          return { codes: [best.metro ?? best.iata] };
        })();
        if (exact) {
          destination = exact.codes;
          const s = work.toLowerCase().indexOf(lower);
          if (s >= 0) take(s, s + lower.length);
          break outer;
        }
      }
    }
  }

  void consumed;
  return { work, origin: uniq(origin), destination: uniq(destination) };
}

// ─── Main entry ─────────────────────────────────────────────────

export function parseIntentHeuristic(text: string, opts: HeuristicOptions = {}): ParsedTravelIntent {
  const today = opts.today ?? todayISO();
  const resolver: AirportResolver = opts.resolver ?? { getAirport: defaultGetAirport, searchAirports: defaultSearchAirports };
  let work = ` ${(text ?? "").replace(/\s+/g, " ").trim()} `;

  const dates = parseDates(work, today);
  work = dates.work;

  const programMentions = findProgramMentions(work);
  const programs = uniq(programMentions.filter((m) => !m.excluded).map((m) => m.id));
  for (const m of programMentions) if (!m.excluded) work = blank(work, m.start, m.end - m.start);

  const cons = parseConstraints(work);
  work = cons.work;

  const cab = parseCabin(work);
  work = cab.work;

  const pax = parsePassengers(work);
  work = pax.work;

  const places = parsePlaces(work, resolver);
  work = places.work;

  let origin = places.origin;
  const destination = places.destination;
  let usedHome = false;
  if (!origin.length && opts.homeAirport) {
    origin = [opts.homeAirport.toUpperCase()];
    usedHome = true;
  }

  const cabin: Cabin = cab.cabin ?? cons.impliedCabin ?? DEFAULT_CABIN;
  const constraints = uniq([...cons.constraints, ...dates.found.extraConstraints]);
  const flexDays = dates.found.flexDays ?? (dates.found.window ? 3 : 0);

  // Confidence
  let confidence = 0.2;
  if (destination.length) confidence += 0.35;
  if (places.origin.length) confidence += 0.15;
  else if (usedHome) confidence += 0.05;
  if (dates.found.explicit) confidence += 0.1;
  if (cab.cabin || cons.impliedCabin) confidence += 0.1;
  if (pax.passengers !== null) confidence += 0.05;
  if (programs.length) confidence += 0.05;
  if (constraints.length) confidence += 0.03;
  if (!destination.length) confidence = Math.min(confidence, 0.45);
  const leftover = work
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z-]/g, "").toLowerCase())
    .filter((w) => w.length >= 4 && !PLACE_STOP_WORDS.has(w));
  if (leftover.length > 6) confidence -= 0.2;
  else if (leftover.length > 3) confidence -= 0.1;
  confidence = Math.round(clamp(confidence, 0, 1) * 100) / 100;

  return {
    origin,
    destination,
    date: dates.found.window ? null : dates.found.date,
    window: dates.found.window,
    flexDays,
    cabin,
    passengers: pax.passengers ?? 1,
    programs,
    constraints,
    confidence,
  };
}

/** Turn an intent into a search query with sensible defaults. */
export function intentToQuery(intent: ParsedTravelIntent, today: string = todayISO()): AwardSearchQuery {
  let date = intent.date ?? intent.window?.from ?? addDays(today, 45);
  if (date <= today) date = addDays(today, 1);
  const nonstop = intent.constraints.some((c) => /^nonstop$/i.test(c));
  const oneStop = intent.constraints.some((c) => /^max 1 stop$/i.test(c));
  const query: AwardSearchQuery = {
    origin: intent.origin.map((c) => c.toUpperCase()),
    destination: intent.destination.map((c) => c.toUpperCase()),
    date,
    flexDays: clamp(intent.window ? Math.max(3, intent.flexDays || 0) : intent.flexDays || 0, 0, 7),
    cabin: intent.cabin,
    passengers: Math.max(1, Math.round(intent.passengers || 1)),
  };
  if (intent.programs.length) query.programs = [...intent.programs];
  if (nonstop) query.maxStops = 0;
  else if (oneStop) query.maxStops = 1;
  return query;
}

/** Build a /search URL from a query (used by chips, the concierge and tool results). */
export function queryToSearchHref(q: Pick<AwardSearchQuery, "origin" | "destination" | "date" | "cabin"> & Partial<AwardSearchQuery>): string {
  const p = new URLSearchParams();
  if (q.origin?.length) p.set("from", q.origin.join(","));
  if (q.destination?.length) p.set("to", q.destination.join(","));
  if (q.date) p.set("date", q.date);
  if (q.cabin) p.set("cabin", q.cabin);
  if (q.passengers && q.passengers > 1) p.set("pax", String(q.passengers));
  if (q.flexDays) p.set("flex", String(q.flexDays));
  if (q.programs?.length) p.set("programs", q.programs.join(","));
  if (q.maxStops !== undefined) p.set("stops", String(q.maxStops));
  return `/search?${p.toString()}`;
}

export interface IntentChip {
  kind: "origin" | "destination" | "date" | "window" | "cabin" | "passengers" | "program" | "constraint";
  label: string;
  value: string;
}

const CABIN_LABELS: Record<Cabin, string> = { economy: "Economy", premium: "Premium Economy", business: "Business", first: "First" };

/** Compact chips for the search box ("As you type"). */
export function intentChips(intent: ParsedTravelIntent): IntentChip[] {
  const chips: IntentChip[] = [];
  if (intent.origin.length) chips.push({ kind: "origin", label: `From ${intent.origin.join("/")}`, value: intent.origin.join(",") });
  if (intent.destination.length) chips.push({ kind: "destination", label: `To ${intent.destination.join("/")}`, value: intent.destination.join(",") });
  if (intent.date) chips.push({ kind: "date", label: fmtShort(intent.date), value: intent.date });
  else if (intent.window) chips.push({ kind: "window", label: `${fmtShort(intent.window.from)} – ${fmtShort(intent.window.to)}`, value: `${intent.window.from}/${intent.window.to}` });
  chips.push({ kind: "cabin", label: CABIN_LABELS[intent.cabin], value: intent.cabin });
  if (intent.passengers > 1) chips.push({ kind: "passengers", label: `${intent.passengers} pax`, value: String(intent.passengers) });
  for (const p of intent.programs) chips.push({ kind: "program", label: p, value: p });
  for (const c of intent.constraints) chips.push({ kind: "constraint", label: c, value: c });
  return chips;
}

function fmtShort(iso: string): string {
  const d = parseISODate(iso);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** One-line human summary, e.g. "JFK → NRT · Business · 2 pax · May 14, 2027 · amex-mr". */
export function summarizeIntent(intent: ParsedTravelIntent): string {
  const parts: string[] = [];
  const route = `${intent.origin.length ? intent.origin.join("/") : "?"} → ${intent.destination.length ? intent.destination.join("/") : "?"}`;
  parts.push(route);
  parts.push(CABIN_LABELS[intent.cabin]);
  if (intent.passengers > 1) parts.push(`${intent.passengers} pax`);
  if (intent.date) parts.push(fmtShort(intent.date));
  else if (intent.window) parts.push(`${fmtShort(intent.window.from)} – ${fmtShort(intent.window.to)}`);
  if (intent.programs.length) parts.push(intent.programs.join(", "));
  if (intent.constraints.length) parts.push(intent.constraints.join(", "));
  return parts.join(" · ");
}
