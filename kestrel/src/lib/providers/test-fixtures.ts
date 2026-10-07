import type { Airline, Airport, Cabin, HotelProperty, LoyaltyProgram, RouteDef, TransferLink } from "@/lib/types";
import type { PriceInput, PriceQuote, ScoreInput } from "@/lib/awards";
import type { HotelQuoteInput } from "@/lib/hotels/engine";
import type { HotelAwardQuote } from "@/lib/types";
import type { HotelCity } from "@/data/hotels";
import { clamp } from "@/lib/utils";

/**
 * TEST-ONLY fixtures for the provider suite. The real data modules
 * (`src/data/*`) and engines (`src/lib/awards`, `src/lib/hotels/engine`) are
 * filled in by other agents; these small, self-contained stand-ins let the
 * provider tests run deterministically regardless of their state.
 *
 * Not imported by production code.
 */

export const FIXTURE_AIRPORTS: Airport[] = [
  { iata: "JFK", icao: "KJFK", name: "John F. Kennedy", city: "New York", country: "United States", countryCode: "US", lat: 40.6413, lon: -73.7781, tz: "America/New_York", region: "north-america", hub: true, metro: "NYC" },
  { iata: "EWR", icao: "KEWR", name: "Newark Liberty", city: "New York", country: "United States", countryCode: "US", lat: 40.6895, lon: -74.1745, tz: "America/New_York", region: "north-america", hub: true, metro: "NYC" },
  { iata: "SFO", icao: "KSFO", name: "San Francisco", city: "San Francisco", country: "United States", countryCode: "US", lat: 37.6213, lon: -122.379, tz: "America/Los_Angeles", region: "north-america", hub: true },
  { iata: "LHR", icao: "EGLL", name: "Heathrow", city: "London", country: "United Kingdom", countryCode: "GB", lat: 51.47, lon: -0.4543, tz: "Europe/London", region: "europe", hub: true, metro: "LON" },
  { iata: "FRA", icao: "EDDF", name: "Frankfurt", city: "Frankfurt", country: "Germany", countryCode: "DE", lat: 50.0379, lon: 8.5622, tz: "Europe/Berlin", region: "europe", hub: true },
  { iata: "CDG", icao: "LFPG", name: "Charles de Gaulle", city: "Paris", country: "France", countryCode: "FR", lat: 49.0097, lon: 2.5479, tz: "Europe/Paris", region: "europe", hub: true, metro: "PAR" },
  { iata: "NRT", icao: "RJAA", name: "Narita", city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.772, lon: 140.3929, tz: "Asia/Tokyo", region: "north-asia", hub: true, metro: "TYO" },
  { iata: "HND", icao: "RJTT", name: "Haneda", city: "Tokyo", country: "Japan", countryCode: "JP", lat: 35.5494, lon: 139.7798, tz: "Asia/Tokyo", region: "north-asia", hub: true, metro: "TYO" },
];

export const FIXTURE_AIRLINES: Airline[] = [
  { iata: "UA", icao: "UAL", name: "United Airlines", alliance: "star", programId: "united-mileageplus", countryCode: "US", color: "#0033a0", hubs: ["EWR", "SFO", "ORD", "IAD", "DEN", "IAH", "LAX"] },
  { iata: "LH", icao: "DLH", name: "Lufthansa", alliance: "star", programId: "lufthansa-miles-more", countryCode: "DE", color: "#05164d", hubs: ["FRA", "MUC"] },
  { iata: "NH", icao: "ANA", name: "ANA", alliance: "star", programId: "ana-mileage-club", countryCode: "JP", color: "#13448f", hubs: ["NRT", "HND"] },
  { iata: "BA", icao: "BAW", name: "British Airways", alliance: "oneworld", programId: "british-airways-club", countryCode: "GB", color: "#075aaa", hubs: ["LHR", "LGW"] },
  { iata: "AA", icao: "AAL", name: "American Airlines", alliance: "oneworld", programId: "american-aadvantage", countryCode: "US", color: "#0078d2", hubs: ["JFK", "DFW", "ORD", "MIA", "LAX"] },
  { iata: "JL", icao: "JAL", name: "Japan Airlines", alliance: "oneworld", programId: "jal-mileage-bank", countryCode: "JP", color: "#c00", hubs: ["NRT", "HND"] },
];

export const FIXTURE_ROUTES: RouteDef[] = [
  { origin: "JFK", destination: "LHR", carrier: "BA", aircraft: ["777-300ER", "A380"], durationMin: 415, weeklyFrequency: 21, cabins: ["economy", "premium", "business", "first"], flightNumber: "BA" },
  { origin: "LHR", destination: "JFK", carrier: "BA", aircraft: ["777-300ER"], durationMin: 480, weeklyFrequency: 21, cabins: ["economy", "premium", "business", "first"], flightNumber: "BA" },
  { origin: "JFK", destination: "LHR", carrier: "AA", aircraft: ["777-300ER"], durationMin: 420, weeklyFrequency: 14, cabins: ["economy", "premium", "business", "first"], flightNumber: "AA100" },
  { origin: "EWR", destination: "LHR", carrier: "UA", aircraft: ["767-300ER"], durationMin: 420, weeklyFrequency: 14, cabins: ["economy", "premium", "business"] },
  { origin: "JFK", destination: "FRA", carrier: "LH", aircraft: ["A340-600"], durationMin: 460, weeklyFrequency: 7, cabins: ["economy", "premium", "business", "first"], flightNumber: "LH401" },
  { origin: "FRA", destination: "NRT", carrier: "LH", aircraft: ["747-8"], durationMin: 690, weeklyFrequency: 14, cabins: ["economy", "premium", "business", "first"], flightNumber: "LH716" },
  { origin: "EWR", destination: "NRT", carrier: "UA", aircraft: ["777-200ER"], durationMin: 840, weeklyFrequency: 7, cabins: ["economy", "premium", "business"] },
  { origin: "JFK", destination: "NRT", carrier: "JL", aircraft: ["777-300ER"], durationMin: 840, weeklyFrequency: 7, cabins: ["economy", "premium", "business", "first"], flightNumber: "JL5" },
  { origin: "JFK", destination: "HND", carrier: "NH", aircraft: ["777-300ER"], durationMin: 850, weeklyFrequency: 7, cabins: ["economy", "premium", "business", "first"] },
  { origin: "SFO", destination: "NRT", carrier: "UA", aircraft: ["787-9"], durationMin: 660, weeklyFrequency: 14, cabins: ["economy", "premium", "business"] },
  { origin: "SFO", destination: "FRA", carrier: "LH", aircraft: ["A350-900"], durationMin: 660, weeklyFrequency: 3, cabins: ["economy", "premium", "business"] },
];

function program(id: string, airline: string, name: string, bookableCarriers: string[], alliance: LoyaltyProgram["alliance"], surcharges: LoyaltyProgram["surcharges"]): LoyaltyProgram {
  return {
    id,
    name,
    shortName: name.split(" ")[0],
    kind: "airline",
    alliance,
    airline,
    currency: "miles",
    valuationCpp: 1.4,
    chartType: "zone",
    surcharges,
    typicalTaxesUsd: { economy: 60, premium: 80, business: 120, first: 150 },
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "none",
    bookingUrl: `https://example.com/${id}`,
    color: "#fff",
    summary: "",
    sweetSpots: [],
    bookableCarriers,
    oneWay: true,
    routingRules: "",
  };
}

export const FIXTURE_PROGRAMS: LoyaltyProgram[] = [
  program("united-mileageplus", "UA", "United MileagePlus", ["UA", "LH", "NH"], "star", "none"),
  program("aeroplan", "AC", "Air Canada Aeroplan", ["AC", "UA", "LH", "NH"], "star", "none"),
  program("lufthansa-miles-more", "LH", "Lufthansa Miles & More", ["LH", "UA", "NH"], "star", "high"),
  program("american-aadvantage", "AA", "American AAdvantage", ["AA", "BA", "JL"], "oneworld", "low"),
  program("british-airways-club", "BA", "British Airways Club", ["BA", "AA", "JL"], "oneworld", "high"),
];

export const FIXTURE_TRANSFERS: TransferLink[] = [
  { from: "amex-mr", to: "aeroplan", ratio: [1, 1], transferTime: "instant", minimum: 1000 },
  { from: "chase-ur", to: "united-mileageplus", ratio: [1, 1], transferTime: "instant", minimum: 1000 },
  { from: "amex-mr", to: "british-airways-club", ratio: [1, 1], transferTime: "hours", minimum: 1000, bonus: { percent: 30, startsAt: "2026-10-01", endsAt: "2026-11-30", verifiedAt: "2026-10-01" } },
];

export const FIXTURE_HOTEL_CITIES: HotelCity[] = [{ name: "Paris", countryCode: "FR", airport: "CDG", lat: 48.8566, lon: 2.3522 }];

export const FIXTURE_HOTELS: HotelProperty[] = [
  {
    id: "park-hyatt-paris-vendome",
    name: "Park Hyatt Paris-Vendôme",
    brand: "Park Hyatt",
    programId: "world-of-hyatt",
    city: "Paris",
    countryCode: "FR",
    lat: 48.8698,
    lon: 2.3305,
    category: 8,
    stars: 5,
    tier: "luxury",
    avgCashUsd: 1200,
    avgPointsPerNight: 45000,
    description: "",
    amenities: [],
    vibe: [],
    art: { from: "#000", to: "#111", motif: "skyline" },
  },
  {
    id: "hyatt-regency-paris-etoile",
    name: "Hyatt Regency Paris Étoile",
    brand: "Hyatt Regency",
    programId: "world-of-hyatt",
    city: "Paris",
    countryCode: "FR",
    lat: 48.8787,
    lon: 2.2839,
    category: 4,
    stars: 4,
    tier: "upscale",
    avgCashUsd: 280,
    avgPointsPerNight: 15000,
    description: "",
    amenities: [],
    vibe: [],
    art: { from: "#000", to: "#111", motif: "skyline" },
  },
  {
    id: "le-meridien-etoile",
    name: "Le Méridien Etoile",
    brand: "Le Méridien",
    programId: "marriott-bonvoy",
    city: "Paris",
    countryCode: "FR",
    lat: 48.8787,
    lon: 2.2839,
    stars: 4,
    tier: "upscale",
    avgCashUsd: 320,
    avgPointsPerNight: 40000,
    description: "",
    amenities: [],
    vibe: [],
    art: { from: "#000", to: "#111", motif: "skyline" },
  },
];

// ─── Lookup helpers bound to the fixtures ───────────────────

export const fixtureGetAirport = (iata: string): Airport | undefined => FIXTURE_AIRPORTS.find((a) => a.iata === iata.toUpperCase());
export const fixtureGetAirline = (iata: string): Airline | undefined => FIXTURE_AIRLINES.find((a) => a.iata === iata.toUpperCase());
export const fixtureExpandMetro = (code: string): string[] => {
  const c = code.toUpperCase();
  const members = FIXTURE_AIRPORTS.filter((a) => a.metro === c).map((a) => a.iata);
  return members.length ? members : [c];
};
export const fixtureRegionOf = (iata: string) => fixtureGetAirport(iata)?.region;
export const fixtureProgramsForCarrier = (carrier: string): LoyaltyProgram[] => FIXTURE_PROGRAMS.filter((p) => p.bookableCarriers.includes(carrier.toUpperCase()));
export const fixtureGetProgram = (id: string): LoyaltyProgram | undefined => FIXTURE_PROGRAMS.find((p) => p.id === id);
export const fixtureTransfersTo = (programId: string): TransferLink[] => FIXTURE_TRANSFERS.filter((l) => l.to === programId);
export const fixtureHotelsInCity = (city: string): HotelProperty[] => FIXTURE_HOTELS.filter((h) => h.city.toLowerCase() === city.trim().toLowerCase());
export const fixtureCarrierFromCallsign = (callsign: string | null | undefined): string | undefined => {
  if (!callsign) return undefined;
  const prefix = callsign.trim().slice(0, 3).toUpperCase();
  return FIXTURE_AIRLINES.find((a) => a.icao === prefix)?.iata;
};

// ─── Fake engines ───────────────────────────────────────────

const CABIN_BASE: Record<Cabin, number> = { economy: 30_000, premium: 45_000, business: 70_000, first: 110_000 };
const PROGRAM_MULT: Record<string, number> = { aeroplan: 1, "united-mileageplus": 1.25, "lufthansa-miles-more": 1.3, "american-aadvantage": 1.1, "british-airways-club": 0.9 };
const PROGRAM_TAXES: Record<string, number> = { aeroplan: 60, "united-mileageplus": 6, "lufthansa-miles-more": 350, "american-aadvantage": 5.6, "british-airways-club": 450 };

/** Chart-like pricing: cabin base × program multiplier, +5k per 1 000 mi beyond 4 000. */
export function fixturePriceAward(input: PriceInput): PriceQuote | null {
  const mult = PROGRAM_MULT[input.programId];
  if (mult === undefined) return null;
  const extra = Math.max(0, input.distanceMiles - 4_000) * 5;
  const dynamic = input.programId === "united-mileageplus" ? 1 + (input.demand ?? 0.5) * 0.4 : 1;
  const miles = Math.round(((CABIN_BASE[input.cabin] * mult + extra) * dynamic) / 500) * 500;
  return { miles, taxesUsd: PROGRAM_TAXES[input.programId] ?? 50, basis: "chart" };
}

export function fixtureEstimateCashFare(distanceMiles: number, cabin: Cabin): number {
  const base: Record<Cabin, number> = { economy: 0.12, premium: 0.22, business: 0.48, first: 0.9 };
  return Math.round(150 + distanceMiles * base[cabin]);
}

export function fixtureScoreFare(input: ScoreInput): { valueScore: number; badges: string[]; cpp: number } {
  const cpp = input.miles > 0 ? Math.max(0, ((input.cashUsd - input.taxesUsd) / input.miles) * 100) : 0;
  const badges: string[] = [];
  if (cpp >= 2.5) badges.push("Sweet spot");
  if ((input.seats ?? 0) >= 5) badges.push("Wide open");
  if (input.taxesUsd < 50) badges.push("Low taxes");
  const valueScore = clamp(Math.round(cpp * 25 - input.stops * 5), 0, 100);
  return { valueScore, badges, cpp: Math.round(cpp * 100) / 100 };
}

export function fixtureQuoteHotel(input: HotelQuoteInput): HotelAwardQuote {
  const nights = Math.max(1, Math.round((Date.parse(input.checkOut) - Date.parse(input.checkIn)) / 86_400_000));
  const cash = input.liveCashPerNightUsd ?? input.property.avgCashUsd;
  const points = input.property.avgPointsPerNight;
  const cpp = (cash / points) * 100;
  return {
    propertyId: input.property.id,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    nights,
    pointsPerNight: points,
    totalPoints: points * nights,
    cashPerNightUsd: cash,
    totalCashUsd: cash * nights,
    cpp: Math.round(cpp * 100) / 100,
    valueScore: clamp(Math.round(cpp * 30), 0, 100),
    available: true,
    fifthNightFreeApplied: false,
    transferOptions: input.transfers.map((t) => ({ bankProgramId: t.from, ratio: t.ratio, bankPointsNeeded: points * nights, transferTime: t.transferTime })),
    source: input.liveCashPerNightUsd !== undefined ? "live" : "simulated",
    fetchedAt: "2026-10-07T15:00:00.000Z",
  };
}

/** Everything `createSimulator` needs, bound to the fixtures. */
export function fixtureSimulatorDeps(nowMs = Date.parse("2026-10-07T15:00:00Z")) {
  return {
    routes: FIXTURE_ROUTES,
    getAirport: fixtureGetAirport,
    getAirline: fixtureGetAirline,
    expandMetro: fixtureExpandMetro,
    regionOf: fixtureRegionOf,
    programsForCarrier: fixtureProgramsForCarrier,
    getProgram: fixtureGetProgram,
    transfersTo: fixtureTransfersTo,
    priceAward: fixturePriceAward,
    estimateCashFare: fixtureEstimateCashFare,
    scoreFare: fixtureScoreFare,
    hotelsInCity: fixtureHotelsInCity,
    quoteHotel: fixtureQuoteHotel,
    now: () => nowMs,
  };
}

/** A `Response` carrying JSON, for mocked `fetch`. */
export function jsonResponse(body: unknown, status = 200, statusText = ""): Response {
  return new Response(JSON.stringify(body), { status, statusText, headers: { "Content-Type": "application/json" } });
}

export type FetchCall = { url: string; init: RequestInit | undefined };

/** Capture every fetch call and route by URL substring. */
export function mockFetch(router: (url: string, init: RequestInit | undefined) => Response | Promise<Response>) {
  const calls: FetchCall[] = [];
  const fn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    calls.push({ url, init });
    return router(url, init);
  };
  return { fn, calls };
}

export function headerOf(init: RequestInit | undefined, name: string): string | undefined {
  const h = init?.headers;
  if (!h) return undefined;
  if (h instanceof Headers) return h.get(name) ?? undefined;
  if (Array.isArray(h)) return h.find(([k]) => k.toLowerCase() === name.toLowerCase())?.[1];
  const entry = Object.entries(h).find(([k]) => k.toLowerCase() === name.toLowerCase());
  return entry?.[1];
}
