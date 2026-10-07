import type {
  Airline,
  Airport,
  AvailabilityDay,
  AwardFare,
  AwardResult,
  AwardSearchQuery,
  Cabin,
  Deal,
  FlightSegment,
  Itinerary,
  LoyaltyProgram,
  RouteAvailability,
  TransferLink,
} from "@/lib/types";
import { CABINS, CABIN_SHORT } from "@/lib/types";
import { getAirline } from "@/data/airlines";
import { expandMetro, getAirport } from "@/data/airports";
import { getProgram } from "@/data/programs";
import { transfersTo } from "@/data/transfers";
import { buildTransferOptions, estimateCashFare, scoreFare } from "@/lib/awards";
import { addDays, clamp, hash32, haversineMiles } from "@/lib/utils";
import { asArray, asBoolean, asNumber, asString, buildUrl, fetchJson, isRecord, memo, pick, splitList } from "./http";
import { STATIC_FX, toUsd } from "./fx";
import { dealBadge, estimateDurationMin, pickBestFare, round2, savingsPct, shiftLocalIso, sortResults, toLocalIso, typicalMiles, uniq } from "./shared";
import { ProviderError, type AwardSearchProvider } from "./types";

/**
 * seats.aero Partner API — cached award availability across ~20 programs.
 *
 * Docs: https://developers.seats.aero/reference/
 *   GET /search        cached search by airports + date range (rows = route × date × source)
 *   GET /availability  bulk availability for one source
 *   GET /trips/{id}    segment-level detail for one availability row
 *   GET /routes        routes known for a source
 *   GET /live          live (uncached, metered) search
 *
 * Auth header: `Partner-Authorization: <key>`.
 */

export const SEATS_AERO_ID = "seatsaero";
export const SEATS_AERO_BASE = "https://seats.aero/partnerapi";

/** seats.aero `Source` → Kestrel program id. `null` = program we don't model (skip). */
export const SOURCE_TO_PROGRAM: Readonly<Record<string, string | null>> = {
  aeroplan: "aeroplan",
  united: "united-mileageplus",
  american: "american-aadvantage",
  delta: "delta-skymiles",
  alaska: "alaska-mileage-plan",
  virginatlantic: "virgin-atlantic-flying-club",
  flyingblue: "flying-blue",
  etihad: "etihad-guest",
  qantas: "qantas-frequent-flyer",
  emirates: "emirates-skywards",
  lifemiles: "avianca-lifemiles",
  velocity: "virgin-australia-velocity",
  eurobonus: "sas-eurobonus",
  turkish: "turkish-miles-smiles",
  jetblue: "jetblue-trueblue",
  qatar: "qatar-privilege-club",
  finnair: "finnair-plus",
  connectmiles: "copa-connectmiles",
  saudia: null,
  smiles: null,
  azul: null,
};

/** Reverse map used to translate a `programs` filter into `sources=`. */
export const PROGRAM_TO_SOURCE: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(SOURCE_TO_PROGRAM)
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([source, program]) => [program, source]),
);

/** Sources scanned by `deals()` — the ones whose rows most often surface genuine bargains. */
export const DEFAULT_DEAL_SOURCES = ["aeroplan", "united", "american", "alaska", "virginatlantic", "flyingblue", "lifemiles", "qantas"];

/**
 * seats.aero reports `*TotalTaxes` in the minor unit of `TaxesCurrency`
 * (e.g. 5650 → USD 56.50). Flip this constant if the upstream contract changes.
 */
export const TAXES_IN_MINOR_UNITS = true;
const ZERO_DECIMAL_CURRENCIES = new Set(["JPY", "KRW", "VND", "CLP", "ISK", "XOF", "XAF", "UGX", "PYG", "RWF", "HUF"]);

export function taxesToMajor(minor: number, currency: string): number {
  if (!TAXES_IN_MINOR_UNITS) return minor;
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? minor : minor / 100;
}

// ─── Parsed shapes ────────────────────────────────────────────

export interface SeatsAeroCabinAvail {
  available: boolean;
  miles: number;
  /** null when seats.aero reports 0 = "unknown" */
  seats: number | null;
  airlines: string[];
  direct: boolean;
  /** In minor units of `taxesCurrency` */
  taxesMinor: number;
}

export interface SeatsAeroTripSegment {
  carrier: string;
  number: string;
  origin: string;
  destination: string;
  /** Local ISO without offset */
  departsAt?: string;
  arrivesAt?: string;
  /** Raw timestamps for duration math */
  departsAtRaw?: string;
  arrivesAtRaw?: string;
  aircraft?: string;
  distance: number;
  fareClass?: string;
}

export interface SeatsAeroTrip {
  id: string;
  cabin: Cabin | null;
  miles: number;
  taxesMinor: number;
  taxesCurrency: string;
  seats: number | null;
  stops: number;
  totalDurationMin: number;
  carriers: string[];
  source: string;
  segments: SeatsAeroTripSegment[];
}

export interface SeatsAeroRow {
  id: string;
  routeId: string;
  origin: string;
  destination: string;
  originRegion: string;
  destinationRegion: string;
  distance: number;
  source: string;
  date: string;
  updatedAt?: string;
  taxesCurrency: string;
  cabins: Record<Cabin, SeatsAeroCabinAvail>;
  trips: SeatsAeroTrip[];
}

export interface SeatsAeroRoute {
  id: string;
  origin: string;
  destination: string;
  originRegion: string;
  destinationRegion: string;
  distance: number;
  source: string;
}

const CABIN_BY_NAME: Record<string, Cabin> = { economy: "economy", premium: "premium", business: "business", first: "first", y: "economy", w: "premium", j: "business", f: "first" };

function cabinFromName(v: string | undefined): Cabin | null {
  if (!v) return null;
  return CABIN_BY_NAME[v.trim().toLowerCase()] ?? null;
}

const FLIGHT_RE = /^([A-Z0-9]{2})\s?(\d{1,4})[A-Z]?$/;

export function parseSegment(raw: unknown): SeatsAeroTripSegment | null {
  if (!isRecord(raw)) return null;
  const flight = (asString(raw.FlightNumber) ?? "").toUpperCase().trim();
  const m = FLIGHT_RE.exec(flight);
  const origin = asString(raw.OriginAirport)?.toUpperCase();
  const destination = asString(raw.DestinationAirport)?.toUpperCase();
  if (!origin || !destination) return null;
  const departsAtRaw = asString(raw.DepartsAt);
  const arrivesAtRaw = asString(raw.ArrivesAt);
  return {
    carrier: m ? m[1] : flight.slice(0, 2) || "??",
    number: m ? String(Number(m[2])) : flight.slice(2) || "0",
    origin,
    destination,
    departsAt: toLocalIso(departsAtRaw),
    arrivesAt: toLocalIso(arrivesAtRaw),
    departsAtRaw,
    arrivesAtRaw,
    aircraft: asString(raw.AircraftName) ?? asString(raw.AircraftCode),
    distance: asNumber(raw.Distance) ?? 0,
    fareClass: asString(raw.FareClass),
  };
}

export function parseTrip(raw: unknown, fallbackCurrency = "USD"): SeatsAeroTrip | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.ID);
  if (!id) return null;
  const segments = asArray(raw.AvailabilitySegments)
    .map(parseSegment)
    .filter((s): s is SeatsAeroTripSegment => s !== null)
    .sort((a, b) => (a.departsAtRaw ?? "").localeCompare(b.departsAtRaw ?? ""));
  const seatsRaw = asNumber(raw.RemainingSeats);
  const totalDuration = asNumber(raw.TotalDuration);
  return {
    id,
    cabin: cabinFromName(asString(raw.Cabin)),
    miles: asNumber(raw.MileageCost) ?? 0,
    taxesMinor: asNumber(raw.TotalTaxes) ?? 0,
    taxesCurrency: (asString(raw.TaxesCurrency) ?? fallbackCurrency).toUpperCase(),
    seats: seatsRaw && seatsRaw > 0 ? Math.round(seatsRaw) : null,
    stops: asNumber(raw.Stops) ?? Math.max(0, segments.length - 1),
    totalDurationMin: totalDuration && totalDuration > 0 ? Math.round(totalDuration) : 0,
    carriers: splitList(asString(raw.Carriers)),
    source: (asString(raw.Source) ?? "").toLowerCase(),
    segments,
  };
}

/** Parse one `/search` / `/availability` / `/live` row. Returns null when the row is unusable. */
export function parseRow(raw: unknown): SeatsAeroRow | null {
  if (!isRecord(raw)) return null;
  const route = isRecord(raw.Route) ? raw.Route : {};
  const origin = (asString(route.OriginAirport) ?? asString(raw.OriginAirport))?.toUpperCase();
  const destination = (asString(route.DestinationAirport) ?? asString(raw.DestinationAirport))?.toUpperCase();
  const date = asString(raw.Date)?.slice(0, 10) ?? asString(raw.ParsedDate)?.slice(0, 10);
  const id = asString(raw.ID);
  if (!origin || !destination || !date || !id) return null;
  const taxesCurrency = (asString(raw.TaxesCurrency) ?? "USD").toUpperCase();
  const cabins = {} as Record<Cabin, SeatsAeroCabinAvail>;
  for (const cabin of CABINS) {
    const L = CABIN_SHORT[cabin];
    const seatsRaw = asNumber(raw[`${L}RemainingSeats`]);
    cabins[cabin] = {
      available: asBoolean(raw[`${L}Available`]) ?? false,
      miles: Math.round(asNumber(raw[`${L}MileageCostRaw`]) ?? asNumber(raw[`${L}MileageCost`]) ?? 0),
      seats: seatsRaw && seatsRaw > 0 ? Math.round(seatsRaw) : null,
      airlines: splitList(asString(raw[`${L}Airlines`])),
      direct: asBoolean(raw[`${L}Direct`]) ?? false,
      taxesMinor: asNumber(raw[`${L}TotalTaxes`]) ?? asNumber(raw[`${L}TotalTaxesRaw`]) ?? 0,
    };
  }
  return {
    id,
    routeId: asString(raw.RouteID) ?? asString(route.ID) ?? "",
    origin,
    destination,
    originRegion: asString(route.OriginRegion) ?? "",
    destinationRegion: asString(route.DestinationRegion) ?? "",
    distance: asNumber(route.Distance) ?? 0,
    source: (asString(raw.Source) ?? asString(route.Source) ?? "").toLowerCase(),
    date,
    updatedAt: asString(raw.UpdatedAt),
    taxesCurrency,
    cabins,
    trips: asArray(raw.AvailabilityTrips)
      .map((t) => parseTrip(t, taxesCurrency))
      .filter((t): t is SeatsAeroTrip => t !== null),
  };
}

export function parseRoute(raw: unknown): SeatsAeroRoute | null {
  if (!isRecord(raw)) return null;
  const origin = asString(raw.OriginAirport)?.toUpperCase();
  const destination = asString(raw.DestinationAirport)?.toUpperCase();
  if (!origin || !destination) return null;
  return {
    id: asString(raw.ID) ?? `${origin}-${destination}`,
    origin,
    destination,
    originRegion: asString(raw.OriginRegion) ?? "",
    destinationRegion: asString(raw.DestinationRegion) ?? "",
    distance: asNumber(raw.Distance) ?? 0,
    source: (asString(raw.Source) ?? "").toLowerCase(),
  };
}

// ─── Mapping rows → domain ────────────────────────────────────

/** Everything the mapper needs; injectable so tests can run without the data modules. */
export interface SeatsAeroMapContext {
  rates: Record<string, number>;
  fetchedAt: string;
  getAirline: (iata: string) => Airline | undefined;
  getAirport: (iata: string) => Airport | undefined;
  getProgram: (id: string) => LoyaltyProgram | undefined;
  transfersTo: (programId: string) => TransferLink[];
  buildTransferOptions: typeof buildTransferOptions;
  scoreFare: typeof scoreFare;
  estimateCashFare: typeof estimateCashFare;
}

export function defaultMapContext(rates: Record<string, number>, fetchedAt: string): SeatsAeroMapContext {
  return { rates, fetchedAt, getAirline, getAirport, getProgram, transfersTo, buildTransferOptions, scoreFare, estimateCashFare };
}

export function programIdForSource(source: string): string | null {
  return SOURCE_TO_PROGRAM[source.toLowerCase()] ?? null;
}

function routeDistance(row: SeatsAeroRow, ctx: SeatsAeroMapContext, segments?: SeatsAeroTripSegment[]): number {
  if (row.distance > 0) return row.distance;
  const fromSegments = segments?.reduce((sum, s) => sum + s.distance, 0) ?? 0;
  if (fromSegments > 0) return fromSegments;
  const o = ctx.getAirport(row.origin);
  const d = ctx.getAirport(row.destination);
  return o && d ? haversineMiles(o.lat, o.lon, d.lat, d.lon) : 0;
}

/**
 * Build an `AwardFare` for a row+cabin (or a specific trip of that row).
 * Returns null when the program is unmapped, the cabin is unavailable or miles are missing.
 */
export function rowToFare(row: SeatsAeroRow, cabin: Cabin, ctx: SeatsAeroMapContext, trip?: SeatsAeroTrip, stopsOverride?: number): AwardFare | null {
  const programId = programIdForSource(row.source);
  if (!programId) return null;
  const c = row.cabins[cabin];
  if (!trip && !c.available) return null;
  const miles = trip && trip.miles > 0 ? trip.miles : c.miles;
  if (!miles || miles <= 0) return null;

  const taxesMinor = trip ? trip.taxesMinor : c.taxesMinor;
  const currency = trip?.taxesCurrency ?? row.taxesCurrency;
  const taxesUsd = round2(toUsd(taxesToMajor(taxesMinor, currency), currency, ctx.rates));
  const seats = trip?.seats ?? c.seats;
  const stops = stopsOverride ?? (trip ? trip.stops : c.direct ? 0 : 1);
  const distanceMiles = routeDistance(row, ctx, trip?.segments);
  const cashUsd = ctx.estimateCashFare(distanceMiles, cabin, row.date);
  const score = ctx.scoreFare({ programId, cabin, miles, taxesUsd, cashUsd, distanceMiles, seats, stops });
  const program = ctx.getProgram(programId);

  return {
    programId,
    cabin,
    miles,
    taxesUsd,
    seats,
    bookUrl: program?.bookingUrl,
    transferOptions: ctx.buildTransferOptions(miles, ctx.transfersTo(programId)),
    cpp: score.cpp,
    valueScore: score.valueScore,
    badges: score.badges,
    source: "live",
    fetchedAt: row.updatedAt ?? ctx.fetchedAt,
  };
}

function segmentDuration(seg: SeatsAeroTripSegment, ctx: SeatsAeroMapContext): number {
  if (seg.departsAtRaw && seg.arrivesAtRaw) {
    const a = Date.parse(seg.departsAtRaw);
    const b = Date.parse(seg.arrivesAtRaw);
    if (Number.isFinite(a) && Number.isFinite(b) && b > a) return Math.round((b - a) / 60_000);
  }
  const o = ctx.getAirport(seg.origin);
  const d = ctx.getAirport(seg.destination);
  const distance = seg.distance > 0 ? seg.distance : o && d ? haversineMiles(o.lat, o.lon, d.lat, d.lon) : 3_000;
  return estimateDurationMin(distance);
}

/** Itinerary from a seats.aero trip (segment-level detail). */
export function tripToItinerary(row: SeatsAeroRow, trip: SeatsAeroTrip, cabin: Cabin, ctx: SeatsAeroMapContext): Itinerary {
  const segments: FlightSegment[] = trip.segments.map((s) => {
    const durationMin = segmentDuration(s, ctx);
    const departure = s.departsAt ?? `${row.date}T12:00`;
    const arrival = s.arrivesAt ?? shiftLocalIso(departure, ctx.getAirport(s.origin)?.tz ?? "UTC", ctx.getAirport(s.destination)?.tz ?? "UTC", durationMin);
    return { carrier: s.carrier, flightNumber: s.number, origin: s.origin, destination: s.destination, departure, arrival, aircraft: s.aircraft, durationMin, cabin };
  });
  const distanceMiles = routeDistance(row, ctx, trip.segments);
  const totalDurationMin = trip.totalDurationMin > 0 ? trip.totalDurationMin : segments.reduce((sum, s) => sum + s.durationMin, 0);
  return { id: `sa-${trip.id}`, segments, totalDurationMin, stops: Math.max(0, segments.length - 1), distanceMiles };
}

/**
 * Synthesise an itinerary when trip detail is absent. seats.aero only tells us
 * the airlines and whether a nonstop exists, so:
 *  - direct → one segment at a neutral noon departure
 *  - connecting with a known hub for the first airline → two segments via that hub
 *  - connecting with no hub data → one segment but `stops: 1`
 * Times are placeholders (noon local); the UI should treat them as approximate.
 */
export function synthesizeItinerary(row: SeatsAeroRow, cabin: Cabin, ctx: SeatsAeroMapContext): Itinerary {
  const c = row.cabins[cabin];
  const carriers = c.airlines.length ? c.airlines : ["??"];
  const first = carriers[0];
  const originTz = ctx.getAirport(row.origin)?.tz ?? "UTC";
  const destTz = ctx.getAirport(row.destination)?.tz ?? "UTC";
  const distanceMiles = routeDistance(row, ctx);
  const departure = `${row.date}T12:00`;
  const key = `${row.origin}-${row.destination}:${row.date}:${c.direct ? "N" : "C"}:${carriers.join("/")}`;
  const id = `sa-syn-${hash32(key).toString(16)}`;

  if (!c.direct) {
    const hub = ctx.getAirline(first)?.hubs.find((h) => h !== row.origin && h !== row.destination);
    const hubAirport = hub ? ctx.getAirport(hub) : undefined;
    const o = ctx.getAirport(row.origin);
    const d = ctx.getAirport(row.destination);
    if (hub && hubAirport && o && d) {
      const d1 = haversineMiles(o.lat, o.lon, hubAirport.lat, hubAirport.lon);
      const d2 = haversineMiles(hubAirport.lat, hubAirport.lon, d.lat, d.lon);
      const dur1 = estimateDurationMin(d1);
      const dur2 = estimateDurationMin(d2);
      const layover = 120;
      const arr1 = shiftLocalIso(departure, originTz, hubAirport.tz, dur1);
      const dep2 = shiftLocalIso(arr1, hubAirport.tz, hubAirport.tz, layover);
      const arr2 = shiftLocalIso(dep2, hubAirport.tz, destTz, dur2);
      const segments: FlightSegment[] = [
        { carrier: first, flightNumber: "", origin: row.origin, destination: hub, departure, arrival: arr1, durationMin: dur1, cabin },
        { carrier: carriers[1] ?? first, flightNumber: "", origin: hub, destination: row.destination, departure: dep2, arrival: arr2, durationMin: dur2, cabin },
      ];
      return { id, segments, totalDurationMin: dur1 + layover + dur2, stops: 1, distanceMiles: d1 + d2 };
    }
  }

  const durationMin = estimateDurationMin(distanceMiles || 3_000) + (c.direct ? 0 : 150);
  const segment: FlightSegment = {
    carrier: first,
    flightNumber: "",
    origin: row.origin,
    destination: row.destination,
    departure,
    arrival: shiftLocalIso(departure, originTz, destTz, durationMin),
    durationMin,
    cabin,
  };
  return { id, segments: [segment], totalDurationMin: durationMin, stops: c.direct ? 0 : 1, distanceMiles };
}

export interface RowFilters {
  passengers?: number;
  maxStops?: number;
  programs?: string[];
}

/**
 * Group rows into `AwardResult`s. Rows from different sources that describe
 * the same flights (same route/date/airlines/direct-ness, or the same trip
 * flight numbers) collapse into one itinerary with several fares.
 */
export function rowsToResults(rows: SeatsAeroRow[], cabin: Cabin, ctx: SeatsAeroMapContext, filters: RowFilters = {}): AwardResult[] {
  const programs = filters.programs?.length ? new Set(filters.programs) : null;
  const passengers = Math.max(1, filters.passengers ?? 1);
  const groups = new Map<string, { itinerary: Itinerary; fares: AwardFare[] }>();

  const add = (key: string, itinerary: Itinerary, fare: AwardFare) => {
    if (programs && !programs.has(fare.programId)) return;
    if (fare.seats !== null && fare.seats < passengers) return;
    if (filters.maxStops !== undefined && itinerary.stops > filters.maxStops) return;
    const g = groups.get(key);
    if (!g) groups.set(key, { itinerary, fares: [fare] });
    else if (!g.fares.some((f) => f.programId === fare.programId)) g.fares.push(fare);
  };

  for (const row of rows) {
    const trips = row.trips.filter((t) => t.cabin === cabin && t.segments.length > 0).sort((a, b) => a.miles - b.miles).slice(0, 3);
    if (trips.length) {
      for (const trip of trips) {
        const fare = rowToFare(row, cabin, ctx, trip);
        if (!fare) continue;
        const itinerary = tripToItinerary(row, trip, cabin, ctx);
        const key = `${trip.segments.map((s) => `${s.carrier}${s.number}`).join("/")}:${row.date}`;
        add(key, { ...itinerary, id: `sa-${hash32(key).toString(16)}` }, fare);
      }
      continue;
    }
    const fare = rowToFare(row, cabin, ctx);
    if (!fare) continue;
    const itinerary = synthesizeItinerary(row, cabin, ctx);
    add(itinerary.id, itinerary, fare);
  }

  const results: AwardResult[] = [];
  for (const g of groups.values()) {
    const cashPriceUsd = ctx.estimateCashFare(g.itinerary.distanceMiles, cabin, g.itinerary.segments[0]?.departure.slice(0, 10));
    results.push({ itinerary: g.itinerary, fares: g.fares, bestFare: pickBestFare(g.fares), cashPriceUsd });
  }
  return sortResults(results);
}

// ─── Provider ─────────────────────────────────────────────────

export interface SeatsAeroDeps {
  apiKey?: string;
  baseUrl?: string;
  /** USD-relative FX rates; defaults to the static table */
  rates?: (signal?: AbortSignal) => Promise<Record<string, number>>;
  now?: () => Date;
  timeoutMs?: number;
  dealSources?: string[];
  expandMetro?: (code: string) => string[];
  context?: Partial<Omit<SeatsAeroMapContext, "rates" | "fetchedAt">>;
}

export interface SeatsAeroProvider extends AwardSearchProvider {
  /** Segment-level detail for an availability row. */
  trip(availabilityId: string, signal?: AbortSignal): Promise<SeatsAeroTrip[]>;
  /** Routes seats.aero tracks for a source. */
  routes(source: string, signal?: AbortSignal): Promise<SeatsAeroRoute[]>;
  /** Live (uncached, metered) search for one route/date/source. */
  live(origin: string, destination: string, date: string, source: string, cabin: Cabin, signal?: AbortSignal): Promise<AwardResult[]>;
}

const SEARCH_TTL_MS = 60_000;
const AVAIL_TTL_MS = 2 * 60_000;
const DEALS_TTL_MS = 10 * 60_000;
const MAX_PAGES = 3;
const PAGE_SIZE = 500;

export function createSeatsAeroProvider(deps: SeatsAeroDeps = {}): SeatsAeroProvider {
  const { apiKey } = deps;
  const base = deps.baseUrl ?? SEATS_AERO_BASE;
  const now = deps.now ?? (() => new Date());
  const timeoutMs = deps.timeoutMs ?? 15_000;
  const expand = deps.expandMetro ?? expandMetro;
  const rates = deps.rates ?? (async () => ({ ...STATIC_FX }));
  const dealSources = deps.dealSources ?? DEFAULT_DEAL_SOURCES;

  const enabled = Boolean(apiKey);

  function ctx(rateTable: Record<string, number>): SeatsAeroMapContext {
    return { ...defaultMapContext(rateTable, now().toISOString()), ...deps.context };
  }

  async function get<T = unknown>(path: string, params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<T> {
    if (!apiKey) throw new ProviderError(SEATS_AERO_ID, "not configured (SEATS_AERO_API_KEY)");
    return fetchJson<T>(
      buildUrl(base, path, params),
      { headers: { "Partner-Authorization": apiKey, Accept: "application/json" }, signal },
      { providerId: SEATS_AERO_ID, timeoutMs },
    );
  }

  function rowsOf(payload: unknown): SeatsAeroRow[] {
    return asArray(pick(payload, "data"))
      .map(parseRow)
      .filter((r): r is SeatsAeroRow => r !== null);
  }

  /** Follow `cursor` pagination up to MAX_PAGES. */
  async function paged(path: string, params: Record<string, string | number | boolean | undefined>, signal?: AbortSignal): Promise<SeatsAeroRow[]> {
    const rows: SeatsAeroRow[] = [];
    let cursor: number | undefined;
    for (let page = 0; page < MAX_PAGES; page++) {
      const payload = await get(path, { ...params, cursor }, signal);
      rows.push(...rowsOf(payload));
      const hasMore = asBoolean(pick(payload, "hasMore")) ?? false;
      const next = asNumber(pick(payload, "cursor"));
      if (!hasMore || next === undefined || next === cursor) break;
      cursor = next;
    }
    return rows;
  }

  function airports(codes: string[]): string[] {
    return uniq(codes.flatMap((c) => expand(c)).map((c) => c.toUpperCase()));
  }

  const provider: SeatsAeroProvider = {
    id: SEATS_AERO_ID,
    label: "seats.aero Partner API",
    source: "live",
    enabled,
    requires: enabled ? undefined : "SEATS_AERO_API_KEY",

    async search(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardResult[]> {
      const origins = airports(query.origin);
      const destinations = airports(query.destination);
      if (!origins.length || !destinations.length) return [];
      const flex = clamp(query.flexDays ?? 0, 0, 7);
      const sources = query.programs?.map((p) => PROGRAM_TO_SOURCE[p]).filter((s): s is string => Boolean(s));
      if (query.programs?.length && !sources?.length) return []; // none of the requested programs are covered
      const params = {
        origin_airport: origins.join(","),
        destination_airport: destinations.join(","),
        cabin: query.cabin,
        start_date: addDays(query.date, -flex),
        end_date: addDays(query.date, flex),
        take: PAGE_SIZE,
        order_by: "lowest_mileage",
        include_trips: true,
        include_filtered: false,
        only_direct_flights: query.maxStops === 0 ? true : undefined,
        sources: sources?.length ? sources.join(",") : undefined,
      };
      const key = `seatsaero:search:${JSON.stringify(params)}:${query.passengers}:${query.maxStops ?? ""}`;
      return memo(key, SEARCH_TTL_MS, async () => {
        const [rows, rateTable] = await Promise.all([paged("/search", params, signal), rates(signal)]);
        return rowsToResults(rows, query.cabin, ctx(rateTable), {
          passengers: query.passengers,
          maxStops: query.maxStops,
          programs: query.programs,
        }).slice(0, 60);
      });
    },

    async availability(origin, destination, cabin, from, to, signal) {
      const origins = airports([origin]);
      const destinations = airports([destination]);
      const params = {
        origin_airport: origins.join(","),
        destination_airport: destinations.join(","),
        cabin,
        start_date: from,
        end_date: to,
        take: PAGE_SIZE,
        order_by: "lowest_mileage",
      };
      const key = `seatsaero:avail:${JSON.stringify(params)}`;
      const days = await memo(key, AVAIL_TTL_MS, async () => {
        const [rows, rateTable] = await Promise.all([paged("/search", params, signal), rates(signal)]);
        const c = ctx(rateTable);
        const best = new Map<string, AvailabilityDay>();
        for (const row of rows) {
          const fare = rowToFare(row, cabin, c);
          if (!fare) continue;
          const day: AvailabilityDay = {
            date: row.date,
            cabin,
            programId: fare.programId,
            miles: fare.miles,
            taxesUsd: fare.taxesUsd,
            // seats.aero reports 0 when the count is unknown; availability implies at least one.
            seats: fare.seats ?? 1,
            carrier: row.cabins[cabin].airlines[0] ?? "",
            source: "live",
          };
          const k = `${day.date}:${day.programId}`;
          const cur = best.get(k);
          if (!cur || day.miles < cur.miles || (day.miles === cur.miles && day.seats > cur.seats)) best.set(k, day);
        }
        return Array.from(best.values()).sort((a, b) => a.date.localeCompare(b.date) || a.miles - b.miles);
      });
      const result: RouteAvailability = { origin: origin.toUpperCase(), destination: destination.toUpperCase(), cabin, days, source: "live" };
      return result;
    },

    async deals(opts, signal) {
      const limit = clamp(opts.limit ?? 24, 1, 100);
      const cabins: Cabin[] = opts.cabin ? [opts.cabin] : ["business", "first"];
      const origins = opts.origin ? airports([opts.origin]) : null;
      const today = now().toISOString().slice(0, 10);
      const key = `seatsaero:deals:${today}:${origins?.join(",") ?? "*"}:${cabins.join(",")}`;
      const candidates = await memo(key, DEALS_TTL_MS, async () => {
        const rateTable = await rates(signal);
        const c = ctx(rateTable);
        const params = { start_date: today, end_date: addDays(today, 60), take: PAGE_SIZE, cabin: opts.cabin };
        const settled = await Promise.allSettled(dealSources.map((source) => get("/availability", { ...params, source }, signal)));
        const rows = settled.flatMap((s) => (s.status === "fulfilled" ? rowsOf(s.value) : []));
        if (settled.every((s) => s.status === "rejected") && settled.length) {
          const first = settled[0];
          throw first.status === "rejected" ? first.reason : new ProviderError(SEATS_AERO_ID, "deals unavailable");
        }
        return buildDeals(rows, cabins, c, origins);
      });
      return candidates.slice(0, limit);
    },

    async trip(availabilityId, signal) {
      const payload = await get("/trips/" + encodeURIComponent(availabilityId), {}, signal);
      return asArray(pick(payload, "data"))
        .map((t) => parseTrip(t))
        .filter((t): t is SeatsAeroTrip => t !== null);
    },

    async routes(source, signal) {
      const payload = await get("/routes", { source }, signal);
      return asArray(pick(payload, "data"))
        .map(parseRoute)
        .filter((r): r is SeatsAeroRoute => r !== null);
    },

    async live(origin, destination, date, source, cabin, signal) {
      const [payload, rateTable] = await Promise.all([
        get("/live", { origin_airport: origin.toUpperCase(), destination_airport: destination.toUpperCase(), departure_date: date, source, cabin }, signal),
        rates(signal),
      ]);
      return rowsToResults(rowsOf(payload), cabin, ctx(rateTable));
    },
  };

  return provider;
}

interface DealCandidate {
  deal: Deal;
  dates: Set<string>;
}

/** Turn availability rows into ranked deals (cpp desc), one per route/program/cabin. */
export function buildDeals(rows: SeatsAeroRow[], cabins: Cabin[], ctx: SeatsAeroMapContext, origins: string[] | null): Deal[] {
  const byKey = new Map<string, DealCandidate>();
  for (const row of rows) {
    if (origins && !origins.includes(row.origin)) continue;
    for (const cabin of cabins) {
      const fare = rowToFare(row, cabin, ctx);
      if (!fare) continue;
      const c = row.cabins[cabin];
      const carrier = c.airlines[0] ?? "";
      const key = `${row.origin}-${row.destination}:${fare.programId}:${cabin}`;
      const distance = routeDistance(row, ctx);
      const seats = fare.seats ?? 1;
      const existing = byKey.get(key);
      if (existing) {
        existing.dates.add(row.date);
        existing.deal.seats = Math.max(existing.deal.seats, seats);
        if ((fare.cpp ?? 0) > existing.deal.cpp || ((fare.cpp ?? 0) === existing.deal.cpp && fare.miles < existing.deal.miles)) {
          existing.deal.miles = fare.miles;
          existing.deal.taxesUsd = fare.taxesUsd;
          existing.deal.cpp = fare.cpp ?? 0;
          existing.deal.savingsPct = savingsPct(fare.miles, typicalMiles(distance, cabin));
        }
        continue;
      }
      const program = ctx.getProgram(fare.programId);
      const hasBonus = fare.transferOptions.some((t) => (t.bonusPercent ?? 0) > 0);
      const originCity = ctx.getAirport(row.origin)?.city ?? row.origin;
      const destCity = ctx.getAirport(row.destination)?.city ?? row.destination;
      const deal: Deal = {
        id: `sa-${hash32(key).toString(16)}`,
        title: `${originCity} → ${destCity}`,
        origin: row.origin,
        destination: row.destination,
        carrier,
        cabin,
        programId: fare.programId,
        miles: fare.miles,
        taxesUsd: fare.taxesUsd,
        cpp: fare.cpp ?? 0,
        savingsPct: savingsPct(fare.miles, typicalMiles(distance, cabin)),
        dates: [],
        seats,
        badge: dealBadge(fare.badges, fare.seats, cabin, hasBonus),
        source: "live",
        note: `${program?.shortName ?? fare.programId}${carrier ? ` · ${c.airlines.join("/")}` : ""}${c.direct ? " · nonstop" : ""}`,
      };
      byKey.set(key, { deal, dates: new Set([row.date]) });
    }
  }
  return Array.from(byKey.values())
    .map(({ deal, dates }) => ({ ...deal, dates: Array.from(dates).sort().slice(0, 6) }))
    .sort((a, b) => b.cpp - a.cpp || b.savingsPct - a.savingsPct || a.miles - b.miles);
}
