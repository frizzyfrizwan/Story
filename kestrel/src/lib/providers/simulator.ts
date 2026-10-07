import type {
  Airline,
  Airport,
  AvailabilityDay,
  AwardFare,
  AwardRegion,
  AwardResult,
  AwardSearchQuery,
  Cabin,
  Deal,
  FlightSegment,
  FlightStatus,
  HotelAwardQuote,
  HotelProperty,
  HotelSearchQuery,
  Itinerary,
  LiveAircraft,
  LoyaltyProgram,
  RouteAvailability,
  RouteDef,
  TransferLink,
} from "@/lib/types";
import { CABIN_SHORT } from "@/lib/types";
import { expandMetro, getAirport, regionOf } from "@/data/airports";
import { getAirline } from "@/data/airlines";
import { ROUTES } from "@/data/routes";
import { getProgram, programsForCarrier } from "@/data/programs";
import { transfersTo } from "@/data/transfers";
import { hotelsInCity } from "@/data/hotels";
import { buildTransferOptions, estimateCashFare, priceAward, scoreFare } from "@/lib/awards";
import { quoteHotel } from "@/lib/hotels/engine";
import { addDays, clamp, daysBetween, hash32, haversineMiles, parseISODate, seededRandom } from "@/lib/utils";
import { bearing, countryName, dealBadge, localToUtcMs, pickBestFare, savingsPct, slerp, sortResults, typicalMiles, uniq, utcToLocalIso } from "./shared";
import type { AwardSearchProvider, BoundingBox, FlightStatusProvider, HotelProvider, LiveFlightsProvider, ProviderMeta } from "./types";

/**
 * The Kestrel simulator — a deterministic, always-available data engine.
 *
 * Everything derives from the curated `ROUTES` table and seeded PRNGs
 * (`hash32` + `seededRandom`), so the same query at the same instant always
 * returns the same answer, and the three flight views agree with each other:
 *
 *   timetable  → one schedule per route/day (flight numbers, departure slots)
 *   search     → itineraries + award fares priced by the awards engine
 *   states     → aircraft currently airborne, interpolated along great circles
 *   status     → the same flight's schedule / progress on a given date
 */

export const SIMULATOR_ID = "simulator";
export const SIMULATOR_META: ProviderMeta = { id: SIMULATOR_ID, label: "Kestrel simulator", source: "simulated", enabled: true };

export interface SimulatorDeps {
  routes?: RouteDef[];
  getAirport?: (iata: string) => Airport | undefined;
  getAirline?: (iata: string) => Airline | undefined;
  expandMetro?: (code: string) => string[];
  regionOf?: (iata: string) => AwardRegion | undefined;
  programsForCarrier?: (carrier: string) => LoyaltyProgram[];
  getProgram?: (id: string) => LoyaltyProgram | undefined;
  transfersTo?: (programId: string) => TransferLink[];
  priceAward?: typeof priceAward;
  estimateCashFare?: typeof estimateCashFare;
  scoreFare?: typeof scoreFare;
  buildTransferOptions?: typeof buildTransferOptions;
  hotelsInCity?: (city: string) => HotelProperty[];
  quoteHotel?: typeof quoteHotel;
  /** Injectable clock (ms) — tests pin it. */
  now?: () => number;
  popularRoutes?: readonly (readonly [string, string])[];
}

type Resolved = Required<SimulatorDeps>;

/** Curated city pairs scanned by `deals()` when no origin is given. */
export const POPULAR_ROUTES: readonly (readonly [string, string])[] = [
  ["JFK", "LHR"],
  ["JFK", "NRT"],
  ["JFK", "CDG"],
  ["JFK", "DXB"],
  ["JFK", "FCO"],
  ["JFK", "IST"],
  ["JFK", "ATH"],
  ["EWR", "LIS"],
  ["BOS", "DUB"],
  ["IAD", "DOH"],
  ["ORD", "FRA"],
  ["ORD", "MUC"],
  ["ATL", "AMS"],
  ["DFW", "LHR"],
  ["MIA", "GRU"],
  ["SFO", "HKG"],
  ["SFO", "SIN"],
  ["SFO", "TPE"],
  ["LAX", "SYD"],
  ["LAX", "NRT"],
  ["LAX", "AKL"],
  ["SEA", "ICN"],
  ["YYZ", "LHR"],
  ["YVR", "HND"],
];

// ─── Timetable ────────────────────────────────────────────────

export interface ScheduledFlight {
  route: RouteDef;
  carrier: string;
  /** Digits only, e.g. "401" */
  number: string;
  /** "LH:401" */
  key: string;
  depHour: number;
  depMinute: number;
  /** Index among the route's daily departures */
  k: number;
  /** Synthesised return leg for a route listed in one direction only */
  mirrored: boolean;
  seed: number;
}

export interface Timetable {
  flights: ScheduledFlight[];
  byPair: Map<string, ScheduledFlight[]>;
  byOrigin: Map<string, ScheduledFlight[]>;
  byKey: Map<string, ScheduledFlight>;
}

const MAX_DAILY = 4;

function dailyCount(route: RouteDef): number {
  if (route.weeklyFrequency <= 0) return 0;
  if (route.weeklyFrequency < 7) return 1;
  return clamp(Math.round(route.weeklyFrequency / 7), 1, MAX_DAILY);
}

function baseFlightNumber(route: RouteDef, mirrored: boolean): number {
  const digits = route.flightNumber?.replace(/\D/g, "");
  if (digits && Number(digits) > 0) return Number(digits) + (mirrored ? 1 : 0);
  return 100 + (hash32(`${route.carrier}:${route.origin}-${route.destination}`) % 850);
}

/** Realistic departure windows by block time; `k` picks the window so multi-daily routes spread out. */
function departureSlot(route: RouteDef, k: number, seed: number): { hour: number; minute: number } {
  const rng = seededRandom(seed);
  const d = route.durationMin;
  const windows: [number, number][] =
    d >= 480
      ? [
          [9, 14],
          [17, 23],
          [6, 9],
          [22, 24],
        ]
      : d >= 180
        ? [
            [7, 11],
            [13, 17],
            [17, 21],
            [10, 13],
          ]
        : [
            [6, 10],
            [12, 16],
            [16, 21],
            [9, 12],
          ];
  const [a, b] = windows[k % windows.length];
  const hour = a + Math.floor(rng() * (b - a));
  return { hour: Math.min(23, hour), minute: 5 * Math.floor(rng() * 12) };
}

export function buildTimetable(routes: RouteDef[]): Timetable {
  const normalized = routes.map((r) => ({ ...r, origin: r.origin.toUpperCase(), destination: r.destination.toUpperCase(), carrier: r.carrier.toUpperCase() }));
  const defs: { route: RouteDef; mirrored: boolean }[] = normalized.map((route) => ({ route, mirrored: false }));
  const seen = new Set(normalized.map((r) => `${r.carrier}:${r.origin}-${r.destination}`));
  for (const r of normalized) {
    const rev = `${r.carrier}:${r.destination}-${r.origin}`;
    if (seen.has(rev)) continue;
    seen.add(rev);
    defs.push({ route: { ...r, origin: r.destination, destination: r.origin }, mirrored: true });
  }

  const used = new Map<string, Set<number>>();
  const flights: ScheduledFlight[] = [];
  for (const { route, mirrored } of defs) {
    const count = dailyCount(route);
    if (!count) continue;
    const taken = used.get(route.carrier) ?? new Set<number>();
    used.set(route.carrier, taken);
    let n = baseFlightNumber(route, mirrored);
    for (let k = 0; k < count; k++) {
      while (taken.has(n)) n = n >= 9999 ? 100 : n + 1;
      taken.add(n);
      const number = String(n);
      const seed = hash32(`${route.carrier}${number}:${route.origin}-${route.destination}`);
      const slot = departureSlot(route, k, seed);
      flights.push({ route, carrier: route.carrier, number, key: `${route.carrier}:${number}`, depHour: slot.hour, depMinute: slot.minute, k, mirrored, seed });
      n++;
    }
  }
  flights.sort((a, b) => a.route.origin.localeCompare(b.route.origin) || a.depHour - b.depHour || a.depMinute - b.depMinute || a.key.localeCompare(b.key));

  const byPair = new Map<string, ScheduledFlight[]>();
  const byOrigin = new Map<string, ScheduledFlight[]>();
  const byKey = new Map<string, ScheduledFlight>();
  for (const f of flights) {
    const pair = `${f.route.origin}-${f.route.destination}`;
    byPair.set(pair, [...(byPair.get(pair) ?? []), f]);
    byOrigin.set(f.route.origin, [...(byOrigin.get(f.route.origin) ?? []), f]);
    byKey.set(f.key, f);
  }
  return { flights, byPair, byOrigin, byKey };
}

/** Does this flight operate on `dateISO`? Sub-daily routes get a seeded, evenly spaced set of weekdays. */
export function operatesOn(f: ScheduledFlight, dateISO: string): boolean {
  const freq = f.route.weeklyFrequency;
  if (freq >= 7) return true;
  if (freq <= 0) return false;
  const dow = parseISODate(dateISO).getDay();
  const start = f.seed % 7;
  const step = Math.max(1, Math.floor(7 / freq));
  for (let i = 0; i < freq; i++) if ((start + i * step) % 7 === dow) return true;
  return false;
}

// ─── Seat & demand model ──────────────────────────────────────

const BASE_SEAT_PROBABILITY: Record<Cabin, number> = { economy: 0.8, premium: 0.5, business: 0.45, first: 0.2 };

/** How freely a carrier releases partner award space, per cabin (1 = neutral). */
const GENEROSITY: Record<string, Partial<Record<Cabin, number>> & { all?: number }> = {
  AC: { all: 1.25 },
  UA: { all: 1.2 },
  TK: { all: 1.25 },
  AV: { all: 1.2 },
  TP: { all: 1.2 },
  AY: { all: 1.15 },
  QR: { all: 1.15 },
  EY: { all: 1.1 },
  SK: { all: 1.1 },
  EI: { all: 1.1 },
  IB: { all: 1.1 },
  B6: { all: 1.1 },
  AA: { all: 1.05 },
  BA: { all: 1.05 },
  AS: { all: 1.05 },
  DL: { all: 0.9 },
  EK: { all: 0.95, first: 0.7 },
  QF: { all: 0.8, first: 0.5 },
  NZ: { all: 0.6 },
  JL: { business: 0.8, first: 0.5 },
  NH: { business: 0.85, first: 0.5 },
  SQ: { business: 0.6, first: 0.35, premium: 0.7 },
  CX: { business: 0.85, first: 0.5 },
  LX: { business: 0.9, first: 0.3 },
  LH: { first: 0.6 },
  KE: { business: 0.9, first: 0.6 },
};

export function carrierGenerosity(carrier: string, cabin: Cabin): number {
  const g = GENEROSITY[carrier.toUpperCase()];
  if (!g) return 1;
  return g[cabin] ?? g.all ?? 1;
}

/** Booking-window curve: sweet spots at schedule opening (300–331 days) and inside two weeks. */
export function daysOutFactor(daysOut: number): number {
  if (daysOut < 0) return 0;
  if (daysOut <= 14) return 1.15;
  if (daysOut <= 59) return 0.95;
  if (daysOut <= 180) return 0.7;
  if (daysOut <= 299) return 0.85;
  if (daysOut <= 331) return 1.2;
  return 0.25; // beyond the schedule
}

/** Peak-season / holiday pressure (lower = scarcer). */
export function seasonalityFactor(dateISO: string): number {
  const d = parseISODate(dateISO);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const dow = d.getDay();
  let f = 1;
  if ((m === 12 && day >= 15) || (m === 1 && day <= 5)) f = 0.6;
  else if (m === 12) f = 0.85;
  else if (m >= 6 && m <= 8) f = 0.75;
  else if (m === 11 && day >= 20) f = 0.7;
  else if ((m === 3 && day >= 10) || (m === 4 && day <= 10)) f = 0.85;
  if (dow === 5 || dow === 6 || dow === 0) f *= 0.9;
  return f;
}

export interface SeatModelInput {
  cabin: Cabin;
  daysOut: number;
  date: string;
  carrier: string;
}

export function seatProbability(input: SeatModelInput): number {
  const p = BASE_SEAT_PROBABILITY[input.cabin] * daysOutFactor(input.daysOut) * seasonalityFactor(input.date) * carrierGenerosity(input.carrier, input.cabin);
  return clamp(p, 0.02, 0.97);
}

/** 0–1 demand signal handed to the pricing engine (dynamic programs price off it). */
export function demandSignal(input: SeatModelInput, seed: number): number {
  const rng = seededRandom(seed ^ 0x9e3779b9);
  const pressure = daysOutFactor(input.daysOut) * seasonalityFactor(input.date);
  return clamp(1 - pressure / 1.4 + (rng() - 0.5) * 0.15, 0.05, 0.95);
}

/**
 * Seats on one flight/date/cabin — 0 when nothing is released. Partner inventory
 * is shared, so every partner program sees the same count; the operating
 * carrier's own program sees a little more.
 */
export function seatsFor(f: ScheduledFlight, dateISO: string, cabin: Cabin, daysOut: number, program?: LoyaltyProgram): number {
  if (!f.route.cabins.includes(cabin)) return 0;
  const p = seatProbability({ cabin, daysOut, date: dateISO, carrier: f.carrier });
  const rng = seededRandom(hash32(`seats:${f.key}:${f.route.origin}-${f.route.destination}:${dateISO}:${CABIN_SHORT[cabin]}`));
  if (rng() > p) return 0;
  let seats = 1 + Math.floor(Math.pow(rng(), 1.5) * 8); // 1–8, skewed low
  if (program?.airline === f.carrier) seats += 1 + Math.floor(rng() * 2);
  return Math.min(9, seats);
}

// ─── Flight dynamics (shared by states + status) ─────────────

export interface FlightTimes {
  depLocal: string;
  arrLocal: string;
  depUtc: number;
  arrUtc: number;
}

export interface Disruption {
  cancelled: boolean;
  delayMin: number;
}

export interface FlightState {
  progress: number;
  lat: number;
  lon: number;
  altitudeM: number;
  velocityMs: number;
  heading: number;
  verticalRateMs: number;
}

const FT_TO_M = 0.3048;

function createSimulatorInternal(deps: Resolved) {
  const { now } = deps;
  let timetable: Timetable | null = null;
  const schedule = (): Timetable => (timetable ??= buildTimetable(deps.routes));

  const tzOf = (iata: string) => deps.getAirport(iata)?.tz ?? "UTC";
  const pad2 = (n: number) => String(n).padStart(2, "0");

  function flightTimes(f: ScheduledFlight, dateISO: string): FlightTimes {
    const depUtc = localToUtcMs(dateISO, f.depHour, f.depMinute, tzOf(f.route.origin));
    const arrUtc = depUtc + f.route.durationMin * 60_000;
    return { depLocal: `${dateISO}T${pad2(f.depHour)}:${pad2(f.depMinute)}`, depUtc, arrUtc, arrLocal: utcToLocalIso(arrUtc, tzOf(f.route.destination)) };
  }

  /** Day-of-operation irregularities, seeded so `states` and `status` agree. */
  function disruption(f: ScheduledFlight, dateISO: string): Disruption {
    const rng = seededRandom(hash32(`irrops:${f.key}:${f.route.origin}:${dateISO}`));
    const cancelled = rng() < 0.015;
    const delayMin = rng() < 0.15 ? 15 + Math.floor(rng() * 75) : 0;
    return { cancelled, delayMin };
  }

  function flightState(f: ScheduledFlight, dateISO: string, nowMs: number): (FlightState & { times: FlightTimes; disruption: Disruption }) | null {
    if (!operatesOn(f, dateISO)) return null;
    const irr = disruption(f, dateISO);
    if (irr.cancelled) return null;
    const o = deps.getAirport(f.route.origin);
    const d = deps.getAirport(f.route.destination);
    if (!o || !d) return null;
    const times = flightTimes(f, dateISO);
    const dep = times.depUtc + irr.delayMin * 60_000;
    const arr = times.arrUtc + irr.delayMin * 60_000;
    if (nowMs < dep || nowMs > arr) return null;

    const duration = f.route.durationMin;
    const progress = (nowMs - dep) / (arr - dep);
    const pos = slerp(o.lat, o.lon, d.lat, d.lon, progress);
    const heading = bearing(pos.lat, pos.lon, d.lat, d.lon);
    const elapsedMin = (nowMs - dep) / 60_000;
    const remainingMin = (arr - nowMs) / 60_000;
    const cruiseM = (33_000 + (f.seed % 9) * 1_000) * FT_TO_M;
    const cruiseV = 230 + ((f.seed >>> 4) % 31);
    const climbMin = Math.min(18, duration * 0.2);
    const descentMin = Math.min(22, duration * 0.25);

    let altitudeM: number;
    let velocityMs: number;
    let verticalRateMs: number;
    if (elapsedMin < climbMin) {
      const frac = elapsedMin / climbMin;
      altitudeM = cruiseM * frac;
      velocityMs = 90 + (cruiseV - 90) * frac;
      verticalRateMs = 10;
    } else if (remainingMin < descentMin) {
      const frac = remainingMin / descentMin;
      altitudeM = cruiseM * frac;
      velocityMs = 80 + (cruiseV - 80) * frac;
      verticalRateMs = -7;
    } else {
      altitudeM = cruiseM;
      velocityMs = cruiseV;
      verticalRateMs = 0;
    }
    return {
      progress,
      lat: pos.lat,
      lon: pos.lon,
      altitudeM: Math.round(altitudeM),
      velocityMs: Math.round(velocityMs * 10) / 10,
      heading: Math.round(heading * 10) / 10,
      verticalRateMs,
      times,
      disruption: irr,
    };
  }

  function callsignOf(f: ScheduledFlight): string {
    return `${deps.getAirline(f.carrier)?.icao ?? f.carrier}${f.number}`;
  }

  function todayISO(nowMs: number): string {
    return new Date(nowMs).toISOString().slice(0, 10);
  }

  // ─── Pricing helpers ──────────────────────────────────────

  interface PricedItinerary {
    itinerary: Itinerary;
    legs: ScheduledFlight[];
    date: string;
    mixedCabin: boolean;
  }

  const CABIN_ORDER: Cabin[] = ["first", "business", "premium", "economy"];

  /** The cabin actually flown on a leg: requested if sold, else the best lower cabin. */
  function legCabin(route: RouteDef, wanted: Cabin): Cabin | null {
    if (route.cabins.includes(wanted)) return wanted;
    const idx = CABIN_ORDER.indexOf(wanted);
    for (let i = idx + 1; i < CABIN_ORDER.length; i++) if (route.cabins.includes(CABIN_ORDER[i])) return CABIN_ORDER[i];
    return null;
  }

  function segmentFor(f: ScheduledFlight, dateISO: string, cabin: Cabin): { segment: FlightSegment; times: FlightTimes } {
    const times = flightTimes(f, dateISO);
    const aircraft = f.route.aircraft[f.k % Math.max(1, f.route.aircraft.length)];
    return {
      times,
      segment: {
        carrier: f.carrier,
        flightNumber: f.number,
        origin: f.route.origin,
        destination: f.route.destination,
        departure: times.depLocal,
        arrival: times.arrLocal,
        aircraft,
        durationMin: f.route.durationMin,
        cabin,
      },
    };
  }

  const MIN_CONNECT_MIN = 75;
  const MAX_LAYOVER_MIN = 600;

  /** Concrete itinerary for a leg chain on a date; null when a leg doesn't operate or can't connect. */
  function buildItinerary(legs: ScheduledFlight[], dateISO: string, wanted: Cabin): PricedItinerary | null {
    const first = legs[0];
    if (!operatesOn(first, dateISO)) return null;
    const longest = legs.reduce((a, b) => (b.route.durationMin > a.route.durationMin ? b : a));
    const segments: FlightSegment[] = [];
    const chosen: ScheduledFlight[] = [];
    let mixedCabin = false;
    let prevArrUtc = 0;
    let legDate = dateISO;
    let distance = 0;

    for (let i = 0; i < legs.length; i++) {
      let f = legs[i];
      const cabin = legCabin(f.route, wanted);
      if (!cabin || (f === longest && cabin !== wanted)) return null;
      if (cabin !== wanted) mixedCabin = true;

      if (i > 0) {
        // Pick the earliest same-route departure that connects; else the first one next day.
        const options = schedule().byPair.get(`${f.route.origin}-${f.route.destination}`)?.filter((x) => x.carrier === f.carrier) ?? [f];
        let pickF: ScheduledFlight | null = null;
        let pickDate = legDate;
        for (const candidateDate of [legDate, addDays(legDate, 1)]) {
          for (const x of options) {
            if (!operatesOn(x, candidateDate)) continue;
            const t = flightTimes(x, candidateDate);
            const layover = (t.depUtc - prevArrUtc) / 60_000;
            if (layover >= MIN_CONNECT_MIN && layover <= MAX_LAYOVER_MIN) {
              pickF = x;
              pickDate = candidateDate;
              break;
            }
          }
          if (pickF) break;
        }
        if (!pickF) return null;
        f = pickF;
        legDate = pickDate;
      }

      const { segment, times } = segmentFor(f, legDate, cabin);
      segments.push(segment);
      chosen.push(f);
      prevArrUtc = times.arrUtc;
      const o = deps.getAirport(f.route.origin);
      const d = deps.getAirport(f.route.destination);
      distance += o && d ? haversineMiles(o.lat, o.lon, d.lat, d.lon) : 0;
    }

    const firstTimes = flightTimes(chosen[0], dateISO);
    const totalDurationMin = Math.round((prevArrUtc - firstTimes.depUtc) / 60_000);
    const key = `${chosen.map((f) => `${f.key}`).join("/")}:${dateISO}`;
    return {
      legs: chosen,
      date: dateISO,
      mixedCabin,
      itinerary: { id: `sim-${hash32(key).toString(16)}`, segments, totalDurationMin, stops: segments.length - 1, distanceMiles: distance },
    };
  }

  function programsFor(legs: ScheduledFlight[], filter: Set<string> | null): LoyaltyProgram[] {
    const carriers = uniq(legs.map((l) => l.carrier));
    let programs = deps.programsForCarrier(carriers[0]);
    for (const c of carriers.slice(1)) {
      const ids = new Set(deps.programsForCarrier(c).map((p) => p.id));
      programs = programs.filter((p) => ids.has(p.id));
    }
    return filter ? programs.filter((p) => filter.has(p.id)) : programs;
  }

  function priceItinerary(pi: PricedItinerary, cabin: Cabin, passengers: number, filter: Set<string> | null, nowMs: number): AwardResult | null {
    const { itinerary, legs, date } = pi;
    const origin = itinerary.segments[0].origin;
    const destination = itinerary.segments[itinerary.segments.length - 1].destination;
    const originRegion = deps.regionOf(origin) ?? deps.getAirport(origin)?.region;
    const destinationRegion = deps.regionOf(destination) ?? deps.getAirport(destination)?.region;
    if (!originRegion || !destinationRegion) return null;
    const longest = legs.reduce((a, b) => (b.route.durationMin > a.route.durationMin ? b : a));
    const daysOut = daysBetween(todayISO(nowMs), date);
    const demand = demandSignal({ cabin, daysOut, date, carrier: longest.carrier }, hash32(itinerary.id));
    const cashPriceUsd = deps.estimateCashFare(itinerary.distanceMiles, cabin, date);
    const fetchedAt = new Date(nowMs).toISOString();
    const fares: AwardFare[] = [];

    for (const program of programsFor(legs, filter)) {
      const quote = deps.priceAward({
        programId: program.id,
        carrier: longest.carrier,
        origin,
        destination,
        originRegion,
        destinationRegion,
        distanceMiles: itinerary.distanceMiles,
        cabin,
        date,
        demand,
      });
      if (!quote || quote.miles <= 0) continue;
      let seats = 9;
      for (let i = 0; i < legs.length; i++) {
        const legDate = itinerary.segments[i].departure.slice(0, 10);
        seats = Math.min(seats, seatsFor(legs[i], legDate, itinerary.segments[i].cabin, daysBetween(todayISO(nowMs), legDate), program));
      }
      if (seats < Math.max(1, passengers)) continue;
      const score = deps.scoreFare({ programId: program.id, cabin, miles: quote.miles, taxesUsd: quote.taxesUsd, cashUsd: cashPriceUsd, distanceMiles: itinerary.distanceMiles, seats, stops: itinerary.stops });
      fares.push({
        programId: program.id,
        cabin,
        miles: quote.miles,
        taxesUsd: Math.round(quote.taxesUsd * 100) / 100,
        seats,
        mixedCabin: pi.mixedCabin || undefined,
        bookUrl: program.bookingUrl || deps.getProgram(program.id)?.bookingUrl,
        transferOptions: deps.buildTransferOptions(quote.miles, deps.transfersTo(program.id)),
        cpp: score.cpp,
        valueScore: score.valueScore,
        badges: score.badges,
        source: "simulated",
        fetchedAt,
      });
    }
    if (!fares.length) return null;
    return { itinerary, fares, bestFare: pickBestFare(fares), cashPriceUsd };
  }

  // ─── Candidates ───────────────────────────────────────────

  const MAX_CONNECTIONS_PER_PAIR = 10;
  const MAX_RESULTS = 40;

  function nonstopCandidates(o: string, d: string): ScheduledFlight[][] {
    return (schedule().byPair.get(`${o}-${d}`) ?? []).map((f) => [f]);
  }

  function distanceBetween(a: string, b: string): number | null {
    const A = deps.getAirport(a);
    const B = deps.getAirport(b);
    return A && B ? haversineMiles(A.lat, A.lon, B.lat, B.lon) : null;
  }

  /** One-stop chains A→H→B over a hub of the same carrier or alliance. */
  function connectionCandidates(o: string, d: string): ScheduledFlight[][] {
    const direct = distanceBetween(o, d);
    const out: { legs: ScheduledFlight[]; distance: number; sameCarrier: boolean }[] = [];
    const seenRoutes = new Set<string>();
    for (const f1 of schedule().byOrigin.get(o) ?? []) {
      const hub = f1.route.destination;
      if (hub === d || hub === o) continue;
      const a1 = deps.getAirline(f1.carrier);
      for (const f2 of schedule().byPair.get(`${hub}-${d}`) ?? []) {
        const routeKey = `${f1.carrier}:${o}-${hub}|${f2.carrier}:${hub}-${d}`;
        if (seenRoutes.has(routeKey)) continue;
        const sameCarrier = f2.carrier === f1.carrier;
        const a2 = deps.getAirline(f2.carrier);
        const sameAlliance = Boolean(a1 && a2 && a1.alliance !== "none" && a1.alliance === a2.alliance);
        if (!sameCarrier && !sameAlliance) continue;
        const hubOk = a1?.hubs.includes(hub) || a2?.hubs.includes(hub) || (!a1 && !a2 && sameCarrier);
        if (!hubOk) continue;
        const d1 = distanceBetween(o, hub);
        const d2 = distanceBetween(hub, d);
        const total = d1 !== null && d2 !== null ? d1 + d2 : null;
        if (direct !== null && total !== null && total > direct * 1.6 + 300) continue;
        seenRoutes.add(routeKey);
        out.push({ legs: [f1, f2], distance: total ?? Number.MAX_SAFE_INTEGER, sameCarrier });
      }
    }
    out.sort((a, b) => Number(b.sameCarrier) - Number(a.sameCarrier) || a.distance - b.distance);
    return out.slice(0, MAX_CONNECTIONS_PER_PAIR).map((c) => c.legs);
  }

  // ─── Public operations ────────────────────────────────────

  async function search(query: AwardSearchQuery): Promise<AwardResult[]> {
    const nowMs = now();
    const origins = uniq(query.origin.flatMap((c) => deps.expandMetro(c)).map((c) => c.toUpperCase()));
    const destinations = uniq(query.destination.flatMap((c) => deps.expandMetro(c)).map((c) => c.toUpperCase()));
    const flex = clamp(query.flexDays ?? 0, 0, 7);
    const maxStops = query.maxStops ?? 1;
    const filter = query.programs?.length ? new Set(query.programs) : null;
    const dates: string[] = [];
    for (let i = -flex; i <= flex; i++) dates.push(addDays(query.date, i));

    const candidates: ScheduledFlight[][] = [];
    for (const o of origins) {
      for (const d of destinations) {
        if (o === d) continue;
        candidates.push(...nonstopCandidates(o, d));
        if (maxStops >= 1) candidates.push(...connectionCandidates(o, d));
      }
    }

    const results: AwardResult[] = [];
    const seen = new Set<string>();
    for (const date of dates) {
      for (const legs of candidates) {
        const built = buildItinerary(legs, date, query.cabin);
        if (!built || seen.has(built.itinerary.id)) continue;
        seen.add(built.itinerary.id);
        const priced = priceItinerary(built, query.cabin, query.passengers, filter, nowMs);
        if (priced) results.push(priced);
      }
    }
    return sortResults(results).slice(0, MAX_RESULTS);
  }

  async function availability(origin: string, destination: string, cabin: Cabin, from: string, to: string): Promise<RouteAvailability> {
    const nowMs = now();
    const today = todayISO(nowMs);
    const origins = deps.expandMetro(origin).map((c) => c.toUpperCase());
    const destinations = deps.expandMetro(destination).map((c) => c.toUpperCase());
    const flights = origins.flatMap((o) => destinations.flatMap((d) => schedule().byPair.get(`${o}-${d}`) ?? []));
    const span = clamp(daysBetween(from, to), 0, 366);
    const days: AvailabilityDay[] = [];
    const priceCache = new Map<string, ReturnType<typeof priceAward>>();

    for (let i = 0; i <= span; i++) {
      const date = addDays(from, i);
      const daysOut = daysBetween(today, date);
      const best = new Map<string, AvailabilityDay>();
      for (const f of flights) {
        if (!operatesOn(f, date)) continue;
        const o = deps.getAirport(f.route.origin);
        const d = deps.getAirport(f.route.destination);
        if (!o || !d) continue;
        const distanceMiles = haversineMiles(o.lat, o.lon, d.lat, d.lon);
        for (const program of deps.programsForCarrier(f.carrier)) {
          const seats = seatsFor(f, date, cabin, daysOut, program);
          if (seats <= 0) continue;
          const pk = `${f.carrier}:${f.route.origin}-${f.route.destination}:${program.id}:${date}`;
          let quote = priceCache.get(pk);
          if (quote === undefined) {
            quote = deps.priceAward({
              programId: program.id,
              carrier: f.carrier,
              origin: f.route.origin,
              destination: f.route.destination,
              originRegion: deps.regionOf(f.route.origin) ?? o.region,
              destinationRegion: deps.regionOf(f.route.destination) ?? d.region,
              distanceMiles,
              cabin,
              date,
              demand: demandSignal({ cabin, daysOut, date, carrier: f.carrier }, f.seed),
            });
            priceCache.set(pk, quote);
          }
          if (!quote || quote.miles <= 0) continue;
          const day: AvailabilityDay = { date, cabin, programId: program.id, miles: quote.miles, taxesUsd: Math.round(quote.taxesUsd * 100) / 100, seats, carrier: f.carrier, source: "simulated" };
          const cur = best.get(program.id);
          if (!cur || day.miles < cur.miles || (day.miles === cur.miles && day.seats > cur.seats)) best.set(program.id, day);
        }
      }
      days.push(...Array.from(best.values()).sort((a, b) => a.miles - b.miles));
    }
    return { origin: origin.toUpperCase(), destination: destination.toUpperCase(), cabin, days, source: "simulated" };
  }

  async function deals(opts: { origin?: string; cabin?: Cabin; limit?: number }): Promise<Deal[]> {
    const nowMs = now();
    const today = todayISO(nowMs);
    const limit = clamp(opts.limit ?? 24, 1, 100);
    const cabins: Cabin[] = opts.cabin ? [opts.cabin] : ["business", "first"];

    let pairs: (readonly [string, string])[] = [...deps.popularRoutes];
    if (opts.origin) {
      const origins = deps.expandMetro(opts.origin).map((c) => c.toUpperCase());
      pairs = pairs.filter(([o]) => origins.includes(o));
      if (!pairs.length) {
        const dests = uniq(origins.flatMap((o) => (schedule().byOrigin.get(o) ?? []).map((f) => f.route.destination)));
        pairs = origins.flatMap((o) => dests.map((d) => [o, d] as const)).slice(0, 24);
      }
    }

    interface Candidate {
      deal: Deal;
      dates: Set<string>;
      valueScore: number;
    }
    const byKey = new Map<string, Candidate>();

    for (const [o, d] of pairs) {
      const flights = schedule().byPair.get(`${o}-${d}`) ?? [];
      if (!flights.length) continue;
      const pairRng = seededRandom(hash32(`deals:${today}:${o}-${d}`));
      const offsets = Array.from({ length: 9 }, (_, i) => 3 + i * 7 + Math.floor(pairRng() * 5));
      for (const offset of offsets) {
        const date = addDays(today, offset);
        for (const f of flights) {
          if (!operatesOn(f, date)) continue;
          const built = buildItinerary([f], date, "economy"); // cabin re-evaluated below
          if (!built) continue;
          for (const cabin of cabins) {
            if (!f.route.cabins.includes(cabin)) continue;
            const result = priceItinerary({ ...built, itinerary: { ...built.itinerary, segments: built.itinerary.segments.map((s) => ({ ...s, cabin })) } }, cabin, 1, null, nowMs);
            if (!result) continue;
            for (const fare of result.fares) {
              const key = `${o}-${d}:${fare.programId}:${cabin}`;
              const existing = byKey.get(key);
              if (existing) {
                existing.dates.add(date);
                existing.deal.seats = Math.max(existing.deal.seats, fare.seats ?? 0);
                if (fare.valueScore > existing.valueScore) {
                  existing.valueScore = fare.valueScore;
                  existing.deal.miles = fare.miles;
                  existing.deal.taxesUsd = fare.taxesUsd;
                  existing.deal.cpp = fare.cpp ?? 0;
                  existing.deal.savingsPct = savingsPct(fare.miles, typicalMiles(result.itinerary.distanceMiles, cabin));
                  existing.deal.badge = dealBadge(fare.badges, fare.seats, cabin, fare.transferOptions.some((t) => (t.bonusPercent ?? 0) > 0));
                }
                continue;
              }
              const program = deps.getProgram(fare.programId);
              const originCity = deps.getAirport(o)?.city ?? o;
              const destCity = deps.getAirport(d)?.city ?? d;
              byKey.set(key, {
                valueScore: fare.valueScore,
                dates: new Set([date]),
                deal: {
                  id: `sim-${hash32(`${today}:${key}`).toString(16)}`,
                  title: `${originCity} → ${destCity}`,
                  origin: o,
                  destination: d,
                  carrier: f.carrier,
                  cabin,
                  programId: fare.programId,
                  miles: fare.miles,
                  taxesUsd: fare.taxesUsd,
                  cpp: fare.cpp ?? 0,
                  savingsPct: savingsPct(fare.miles, typicalMiles(result.itinerary.distanceMiles, cabin)),
                  dates: [],
                  seats: fare.seats ?? 0,
                  badge: dealBadge(fare.badges, fare.seats, cabin, fare.transferOptions.some((t) => (t.bonusPercent ?? 0) > 0)),
                  source: "simulated",
                  note: `${program?.shortName ?? fare.programId} · ${f.carrier}${f.number} nonstop`,
                },
              });
            }
          }
        }
      }
    }

    return Array.from(byKey.values())
      .sort((a, b) => b.valueScore - a.valueScore || b.deal.cpp - a.deal.cpp || a.deal.miles - b.deal.miles)
      .slice(0, limit)
      .map((c) => ({ ...c.deal, dates: Array.from(c.dates).sort().slice(0, 6) }));
  }

  const MAX_AIRCRAFT = 400;

  async function states(bbox: BoundingBox): Promise<{ aircraft: LiveAircraft[]; time: number }> {
    const nowMs = now();
    const today = todayISO(nowMs);
    const dates = [addDays(today, -1), today, addDays(today, 1)];
    const aircraft: LiveAircraft[] = [];
    for (const f of schedule().flights) {
      for (const date of dates) {
        const s = flightState(f, date, nowMs);
        if (!s) continue;
        if (s.lat < bbox.lamin || s.lat > bbox.lamax || s.lon < bbox.lomin || s.lon > bbox.lomax) continue;
        const callsign = callsignOf(f);
        aircraft.push({
          icao24: (hash32(callsign) & 0xffffff).toString(16).padStart(6, "0"),
          callsign,
          originCountry: countryName(deps.getAirline(f.carrier)?.countryCode),
          lat: s.lat,
          lon: s.lon,
          altitudeM: s.altitudeM,
          velocityMs: s.velocityMs,
          heading: s.heading,
          verticalRateMs: s.verticalRateMs,
          onGround: false,
          lastContact: Math.floor(nowMs / 1000),
          carrier: f.carrier,
        });
        break; // a flight is airborne on at most one of the candidate dates
      }
    }
    aircraft.sort((a, b) => (a.callsign ?? "").localeCompare(b.callsign ?? ""));
    return { aircraft: aircraft.slice(0, MAX_AIRCRAFT), time: Math.floor(nowMs / 1000) };
  }

  async function status(carrier: string, flightNumber: string, date: string): Promise<FlightStatus | null> {
    const nowMs = now();
    const c = carrier.trim().toUpperCase();
    let n = flightNumber.trim().toUpperCase().replace(/\s+/g, "");
    if (n.startsWith(c)) n = n.slice(c.length);
    const digits = n.replace(/\D/g, "");
    if (!digits) return null;
    const f = schedule().byKey.get(`${c}:${Number(digits)}`);
    if (!f || !operatesOn(f, date)) return null;

    const times = flightTimes(f, date);
    const irr = disruption(f, date);
    const rng = seededRandom(f.seed ^ hash32(date));
    const terminal = ["1", "2", "3", "4", "5", "A", "B", "C"][Math.floor(rng() * 8)];
    const gate = `${String.fromCharCode(65 + Math.floor(rng() * 6))}${1 + Math.floor(rng() * 40)}`;
    const estDepUtc = times.depUtc + irr.delayMin * 60_000;
    const estArrUtc = times.arrUtc + irr.delayMin * 60_000;
    const base: FlightStatus = {
      carrier: c,
      flightNumber: f.number,
      date,
      origin: f.route.origin,
      destination: f.route.destination,
      scheduledDeparture: times.depLocal,
      scheduledArrival: times.arrLocal,
      estimatedDeparture: irr.delayMin ? utcToLocalIso(estDepUtc, tzOf(f.route.origin)) : undefined,
      estimatedArrival: irr.delayMin ? utcToLocalIso(estArrUtc, tzOf(f.route.destination)) : undefined,
      status: "scheduled",
      delayMin: irr.delayMin || undefined,
      aircraft: f.route.aircraft[f.k % Math.max(1, f.route.aircraft.length)],
      terminal,
      gate,
      source: "simulated",
    };
    if (irr.cancelled) return { ...base, status: "cancelled" };
    if (nowMs < estDepUtc) {
      const withinWindow = estDepUtc - nowMs < 12 * 3_600_000;
      return { ...base, status: irr.delayMin > 0 && withinWindow ? "delayed" : "scheduled" };
    }
    if (nowMs > estArrUtc) return { ...base, status: "landed" };
    const s = flightState(f, date, nowMs);
    if (!s) return { ...base, status: "active" };
    return { ...base, status: "active", progress: Math.round(s.progress * 1000) / 1000, position: { lat: s.lat, lon: s.lon, altitudeM: s.altitudeM, heading: s.heading } };
  }

  async function hotels(query: HotelSearchQuery): Promise<HotelAwardQuote[]> {
    const filter = query.programs?.length ? new Set(query.programs) : null;
    return deps
      .hotelsInCity(query.city)
      .filter((h) => !filter || filter.has(h.programId))
      .map((property) => deps.quoteHotel({ property, checkIn: query.checkIn, checkOut: query.checkOut, guests: query.guests, transfers: deps.transfersTo(property.programId) }))
      .sort((a, b) => b.valueScore - a.valueScore || a.totalPoints - b.totalPoints);
  }

  return { search, availability, deals, states, status, hotels, schedule, flightTimes, flightState };
}

export interface Simulator {
  meta: ProviderMeta;
  search(query: AwardSearchQuery, signal?: AbortSignal): Promise<AwardResult[]>;
  availability(origin: string, destination: string, cabin: Cabin, from: string, to: string, signal?: AbortSignal): Promise<RouteAvailability>;
  deals(opts: { origin?: string; cabin?: Cabin; limit?: number }, signal?: AbortSignal): Promise<Deal[]>;
  states(bbox: BoundingBox, signal?: AbortSignal): Promise<{ aircraft: LiveAircraft[]; time: number }>;
  status(carrier: string, flightNumber: string, date: string, signal?: AbortSignal): Promise<FlightStatus | null>;
  hotels(query: HotelSearchQuery, signal?: AbortSignal): Promise<HotelAwardQuote[]>;
  /** The timetable every flight view derives from (lazy). */
  timetable(): Timetable;
  /** Contract-shaped adapters for the registry. */
  awardProvider: AwardSearchProvider;
  liveProvider: LiveFlightsProvider;
  statusProvider: FlightStatusProvider;
  hotelProvider: HotelProvider;
}

export function createSimulator(overrides: SimulatorDeps = {}): Simulator {
  const deps: Resolved = {
    routes: overrides.routes ?? ROUTES,
    getAirport: overrides.getAirport ?? getAirport,
    getAirline: overrides.getAirline ?? getAirline,
    expandMetro: overrides.expandMetro ?? expandMetro,
    regionOf: overrides.regionOf ?? regionOf,
    programsForCarrier: overrides.programsForCarrier ?? programsForCarrier,
    getProgram: overrides.getProgram ?? getProgram,
    transfersTo: overrides.transfersTo ?? transfersTo,
    priceAward: overrides.priceAward ?? priceAward,
    estimateCashFare: overrides.estimateCashFare ?? estimateCashFare,
    scoreFare: overrides.scoreFare ?? scoreFare,
    buildTransferOptions: overrides.buildTransferOptions ?? buildTransferOptions,
    hotelsInCity: overrides.hotelsInCity ?? hotelsInCity,
    quoteHotel: overrides.quoteHotel ?? quoteHotel,
    now: overrides.now ?? (() => Date.now()),
    popularRoutes: overrides.popularRoutes ?? POPULAR_ROUTES,
  };
  const core = createSimulatorInternal(deps);
  const meta = { ...SIMULATOR_META };
  return {
    meta,
    search: (q) => core.search(q),
    availability: (o, d, c, f, t) => core.availability(o, d, c, f, t),
    deals: (opts) => core.deals(opts),
    states: (bbox) => core.states(bbox),
    status: (c, n, d) => core.status(c, n, d),
    hotels: (q) => core.hotels(q),
    timetable: () => core.schedule(),
    awardProvider: { ...meta, search: (q) => core.search(q), availability: (o, d, c, f, t) => core.availability(o, d, c, f, t), deals: (opts) => core.deals(opts) },
    liveProvider: { ...meta, states: (bbox) => core.states(bbox) },
    statusProvider: { ...meta, status: (c, n, d) => core.status(c, n, d) },
    hotelProvider: { ...meta, search: (q) => core.hotels(q) },
  };
}

/** Process-wide simulator bound to the real data modules. */
export const simulator: Simulator = createSimulator();
