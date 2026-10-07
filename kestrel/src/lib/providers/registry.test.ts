import { describe, expect, it, vi } from "vitest";
import type { AwardResult, AwardSearchQuery, Deal, FlightStatus, HotelAwardQuote, LiveAircraft, RouteAvailability } from "@/lib/types";
import { createRegistry, snapshotsFromResults, type SnapshotRow } from "./registry";
import type { Simulator } from "./simulator";
import { ProviderError, type AwardSearchProvider, type CashFareProvider, type FlightStatusProvider, type FxProvider, type HotelProvider, type LiveFlightsProvider } from "./types";

const query: AwardSearchQuery = { origin: ["JFK"], destination: ["LHR"], date: "2026-11-20", cabin: "business", passengers: 1 };
const bbox = { lamin: 40, lomin: -75, lamax: 42, lomax: -70 };

function result(id: string, source: "live" | "simulated", programId = "aeroplan"): AwardResult {
  const fare = { programId, cabin: "business" as const, miles: 70000, taxesUsd: 60, seats: 2, transferOptions: [], valueScore: 80, badges: [], source, fetchedAt: "2026-10-07T15:00:00.000Z" };
  return {
    itinerary: { id, segments: [{ carrier: "BA", flightNumber: "117", origin: "JFK", destination: "LHR", departure: "2026-11-20T08:00", arrival: "2026-11-20T20:00", durationMin: 420, cabin: "business" }], totalDurationMin: 420, stops: 0, distanceMiles: 3451 },
    fares: [fare],
    bestFare: fare,
  };
}

const aircraft: LiveAircraft = { icao24: "abc123", callsign: "BAW117", originCountry: "United Kingdom", lat: 41, lon: -72, altitudeM: 11000, velocityMs: 240, heading: 60, verticalRateMs: 0, onGround: false, lastContact: 1 };
const status: FlightStatus = { carrier: "BA", flightNumber: "117", date: "2026-10-07", origin: "JFK", destination: "LHR", scheduledDeparture: "2026-10-07T08:00", scheduledArrival: "2026-10-07T20:00", status: "active", source: "simulated" };
const quote = (propertyId: string, source: "live" | "simulated", valueScore: number): HotelAwardQuote => ({
  propertyId,
  checkIn: "2026-11-20",
  checkOut: "2026-11-21",
  nights: 1,
  pointsPerNight: 30000,
  totalPoints: 30000,
  cashPerNightUsd: 500,
  totalCashUsd: 500,
  cpp: 1.6,
  valueScore,
  available: true,
  fifthNightFreeApplied: false,
  transferOptions: [],
  source,
  fetchedAt: "2026-10-07T15:00:00.000Z",
});

function fakeSimulator(overrides: Partial<Simulator> = {}): Simulator & { calls: string[] } {
  const calls: string[] = [];
  const meta = { id: "simulator", label: "Kestrel simulator", source: "simulated" as const, enabled: true };
  const sim: Simulator & { calls: string[] } = {
    calls,
    meta,
    search: async () => {
      calls.push("search");
      return [result("sim-1", "simulated")];
    },
    availability: async (origin, destination, cabin): Promise<RouteAvailability> => {
      calls.push("availability");
      return { origin, destination, cabin, days: [{ date: "2026-11-20", cabin, programId: "aeroplan", miles: 70000, taxesUsd: 60, seats: 2, carrier: "BA", source: "simulated" }], source: "simulated" };
    },
    deals: async (): Promise<Deal[]> => {
      calls.push("deals");
      return [{ id: "sim-deal", title: "x", origin: "JFK", destination: "LHR", carrier: "BA", cabin: "business", programId: "aeroplan", miles: 70000, taxesUsd: 60, cpp: 2, savingsPct: 10, dates: ["2026-11-20"], seats: 2, badge: "ai-pick", source: "simulated" }];
    },
    states: async () => {
      calls.push("states");
      return { aircraft: [aircraft], time: 1 };
    },
    status: async () => {
      calls.push("status");
      return status;
    },
    hotels: async () => {
      calls.push("hotels");
      return [quote("a", "simulated", 60), quote("b", "simulated", 40)];
    },
    timetable: () => ({ flights: [], byPair: new Map(), byOrigin: new Map(), byKey: new Map() }),
    awardProvider: { ...meta, search: async () => [], availability: async (o, d, c) => ({ origin: o, destination: d, cabin: c, days: [], source: "simulated" }), deals: async () => [] },
    liveProvider: { ...meta, states: async () => ({ aircraft: [], time: 0 }) },
    statusProvider: { ...meta, status: async () => null },
    hotelProvider: { ...meta, search: async () => [] },
    ...overrides,
  };
  return sim;
}

const fx: FxProvider = { id: "fx", label: "fx", source: "live", enabled: true, rates: async () => ({ USD: 1, EUR: 0.9 }) };

function awardProvider(impl: Partial<AwardSearchProvider>): AwardSearchProvider {
  return {
    id: "live-awards",
    label: "Live awards",
    source: "live",
    enabled: true,
    search: async () => [],
    availability: async (o, d, c) => ({ origin: o, destination: d, cabin: c, days: [], source: "live" }),
    deals: async () => [],
    ...impl,
  };
}

function registry(deps: Partial<Parameters<typeof createRegistry>[0]> & { simulator?: Simulator } = {}) {
  const sim = deps.simulator ?? fakeSimulator();
  return createRegistry({ awards: [], liveFlights: [], flightStatus: [], hotels: [], cashFares: [], fx, simulator: sim, timeoutMs: 200, cashTimeoutMs: 100, ...deps });
}

describe("registry: awards", () => {
  it("falls back to the simulator when the live provider throws, recording the error", async () => {
    const sim = fakeSimulator();
    const live = awardProvider({
      search: async () => {
        throw new ProviderError("live-awards", "HTTP 500", 500);
      },
    });
    const res = await registry({ awards: [live], simulator: sim }).searchAwards(query);
    expect(res.source).toBe("simulated");
    expect(res.results.map((r) => r.itinerary.id)).toEqual(["sim-1"]);
    expect(res.providers).toEqual([
      { id: "live-awards", ms: expect.any(Number), count: 0, error: "[live-awards] HTTP 500" },
      { id: "simulator", ms: expect.any(Number), count: 1 },
    ]);
    expect(sim.calls).toEqual(["search"]);
  });

  it("falls back when the live provider is empty or times out", async () => {
    const empty = await registry({ awards: [awardProvider({ search: async () => [] })] }).searchAwards(query);
    expect(empty.source).toBe("simulated");
    expect(empty.providers[0]).toMatchObject({ id: "live-awards", count: 0 });

    const slow = awardProvider({ search: (_q, signal) => new Promise((_, reject) => signal?.addEventListener("abort", () => reject(new Error("aborted")))) });
    const timedOut = await registry({ awards: [slow], timeoutMs: 30 }).searchAwards(query);
    expect(timedOut.source).toBe("simulated");
    expect(timedOut.providers[0].error).toContain("timed out");
  });

  it("uses live rows when present, skips disabled providers and persists snapshots", async () => {
    const sim = fakeSimulator();
    const persisted: SnapshotRow[][] = [];
    const disabled = awardProvider({ id: "disabled", enabled: false, search: async () => [result("nope", "live")] });
    const live = awardProvider({ search: async () => [result("live-1", "live"), result("live-1", "live", "united-mileageplus"), result("live-2", "live")] });
    const res = await registry({ awards: [disabled, live], simulator: sim, persistSnapshots: (rows) => persisted.push(rows) }).searchAwards(query);
    expect(res.source).toBe("live");
    expect(res.results.map((r) => r.itinerary.id)).toEqual(["live-1", "live-2"]); // de-duplicated by itinerary id
    expect(res.providers.map((p) => p.id)).toEqual(["live-awards"]);
    expect(sim.calls).toEqual([]);
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toEqual([
      expect.objectContaining({ origin: "JFK", destination: "LHR", date: "2026-11-20", cabin: "business", programId: "aeroplan", carrier: "BA", miles: 70000, seats: 2, source: "live" }),
    ]);
  });

  it("enriches results with a live cash fare and recomputes cpp", async () => {
    const cash: CashFareProvider = { id: "duffel", label: "Duffel", source: "live", enabled: true, lowestFare: async () => 3560 };
    const res = await registry({ cashFares: [cash] }).searchAwards(query);
    expect(res.results[0].cashPriceUsd).toBe(3560);
    expect(res.results[0].fares[0].cpp).toBeCloseTo(((3560 - 60) / 70000) * 100, 2);
    expect(res.providers.find((p) => p.id === "duffel")).toMatchObject({ count: 1 });
    const failing: CashFareProvider = { ...cash, lowestFare: async () => { throw new Error("nope"); } };
    const res2 = await registry({ cashFares: [failing] }).searchAwards(query);
    expect(res2.results[0].cashPriceUsd).toBeUndefined();
    expect(res2.providers.find((p) => p.id === "duffel")?.error).toContain("nope");
  });

  it("route availability and deals prefer live, then simulator", async () => {
    const sim = fakeSimulator();
    const live = awardProvider({
      availability: async (o, d, c) => ({ origin: o, destination: d, cabin: c, days: [{ date: "2026-11-21", cabin: c, programId: "united-mileageplus", miles: 80000, taxesUsd: 6, seats: 1, carrier: "UA", source: "live" }], source: "live" }),
      deals: async () => {
        throw new Error("quota");
      },
    });
    const persisted: SnapshotRow[][] = [];
    const reg = registry({ awards: [live], simulator: sim, persistSnapshots: (rows) => persisted.push(rows) });
    const avail = await reg.getRouteAvailability("JFK", "LHR", "business", "2026-11-20", "2026-11-25");
    expect(avail.source).toBe("live");
    expect(avail.days[0].programId).toBe("united-mileageplus");
    expect(persisted[0][0]).toMatchObject({ origin: "JFK", destination: "LHR", date: "2026-11-21", programId: "united-mileageplus" });
    const deals = await reg.getDeals();
    expect(deals[0].id).toBe("sim-deal");
    expect(sim.calls).toEqual(["deals"]);
  });
});

describe("registry: flights", () => {
  it("live aircraft fall back to the simulator on error or empty", async () => {
    const sim = fakeSimulator();
    const failing: LiveFlightsProvider = { id: "opensky", label: "OpenSky", source: "live", enabled: true, states: async () => { throw new ProviderError("opensky", "HTTP 429", 429); } };
    const res = await registry({ liveFlights: [failing], simulator: sim }).getLiveAircraft(bbox);
    expect(res.source).toBe("simulated");
    expect(res.aircraft).toEqual([aircraft]);
    const empty: LiveFlightsProvider = { ...failing, states: async () => ({ aircraft: [], time: 5 }) };
    expect((await registry({ liveFlights: [empty] }).getLiveAircraft(bbox)).source).toBe("simulated");
    const ok: LiveFlightsProvider = { ...failing, states: async () => ({ aircraft: [{ ...aircraft, icao24: "live" }], time: 9 }) };
    const live = await registry({ liveFlights: [ok] }).getLiveAircraft(bbox);
    expect(live).toEqual({ aircraft: [{ ...aircraft, icao24: "live" }], time: 9, source: "live" });
  });

  it("flight status tries providers in order and falls back to the simulator", async () => {
    const sim = fakeSimulator();
    const none: FlightStatusProvider = { id: "aviationstack", label: "", source: "live", enabled: true, status: async () => null };
    const boom: FlightStatusProvider = { id: "aerodatabox", label: "", source: "live", enabled: true, status: async () => { throw new Error("down"); } };
    const res = await registry({ flightStatus: [none, boom], simulator: sim }).getFlightStatus("BA", "117", "2026-10-07");
    expect(res).toEqual(status);
    const liveStatus: FlightStatus = { ...status, source: "live", status: "landed" };
    const hit: FlightStatusProvider = { ...none, status: async () => liveStatus };
    expect(await registry({ flightStatus: [none, hit] }).getFlightStatus("BA", "117", "2026-10-07")).toEqual(liveStatus);
  });
});

describe("registry: hotels, fx, catalog", () => {
  it("merges live hotel quotes over simulator quotes by property", async () => {
    const amadeus: HotelProvider = { id: "amadeus-hotels", label: "", source: "live", enabled: true, search: async () => [quote("b", "live", 90)] };
    const res = await registry({ hotels: [amadeus] }).searchHotels({ city: "Paris", checkIn: "2026-11-20", checkOut: "2026-11-21", guests: 2 });
    expect(res.source).toBe("live");
    expect(res.quotes.map((q) => [q.propertyId, q.source])).toEqual([
      ["b", "live"],
      ["a", "simulated"],
    ]);
    const failing: HotelProvider = { ...amadeus, search: async () => { throw new Error("x"); } };
    const fallback = await registry({ hotels: [failing] }).searchHotels({ city: "Paris", checkIn: "2026-11-20", checkOut: "2026-11-21", guests: 2 });
    expect(fallback.source).toBe("simulated");
    expect(fallback.quotes).toHaveLength(2);
  });

  it("exposes fx rates with a safe fallback", async () => {
    expect(await registry().getFxRates()).toEqual({ USD: 1, EUR: 0.9 });
    const broken: FxProvider = { ...fx, rates: async () => { throw new Error("x"); } };
    expect(await registry({ fx: broken }).getFxRates()).toEqual({ USD: 1 });
  });

  it("lists every provider with enablement hints plus the simulator", () => {
    const disabled = awardProvider({ id: "seatsaero", enabled: false, requires: "SEATS_AERO_API_KEY" });
    const log = vi.fn();
    const metas = registry({ awards: [disabled], log }).listProviders();
    expect(metas).toEqual([
      { id: "seatsaero", label: "Live awards", source: "live", enabled: false, requires: "SEATS_AERO_API_KEY" },
      { id: "fx", label: "fx", source: "live", enabled: true, requires: undefined },
      { id: "simulator", label: "Kestrel simulator", source: "simulated", enabled: true },
    ]);
  });

  it("snapshotsFromResults only keeps live fares and de-duplicates", () => {
    const rows = snapshotsFromResults([result("a", "live"), result("b", "live"), result("c", "simulated")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ origin: "JFK", destination: "LHR", programId: "aeroplan", miles: 70000 });
  });
});
