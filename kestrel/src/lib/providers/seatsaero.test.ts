import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoClear } from "./http";
import { PROGRAM_TO_SOURCE, SOURCE_TO_PROGRAM, createSeatsAeroProvider, parseRow, rowToFare, rowsToResults, type SeatsAeroMapContext } from "./seatsaero";
import { buildTransferOptions } from "@/lib/awards";
import {
  fixtureEstimateCashFare,
  fixtureGetAirline,
  fixtureGetAirport,
  fixtureGetProgram,
  fixtureScoreFare,
  fixtureTransfersTo,
  headerOf,
  jsonResponse,
  mockFetch,
} from "./test-fixtures";

/** A representative `/search` row (fields as documented by seats.aero). */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ID: "2ac1b4c9-aeroplan-1",
    RouteID: "route-1",
    Route: { ID: "route-1", OriginAirport: "JFK", DestinationAirport: "NRT", OriginRegion: "North America", DestinationRegion: "Asia", NumDaysOut: 44, Distance: 6735, Source: "aeroplan" },
    Date: "2026-11-20",
    ParsedDate: "2026-11-20T00:00:00Z",
    YAvailable: true,
    WAvailable: false,
    JAvailable: true,
    FAvailable: false,
    YMileageCost: "55000",
    WMileageCost: "0",
    JMileageCost: "75000",
    FMileageCost: "0",
    YMileageCostRaw: 55000,
    JMileageCostRaw: 75000,
    YRemainingSeats: 4,
    WRemainingSeats: 0,
    JRemainingSeats: 2,
    FRemainingSeats: 0,
    YAirlines: "AC, NH",
    JAirlines: "NH",
    YDirect: false,
    JDirect: true,
    TaxesCurrency: "CAD",
    YTotalTaxes: 12650,
    JTotalTaxes: 12650,
    Source: "aeroplan",
    UpdatedAt: "2026-10-07T10:00:00Z",
    ...overrides,
  };
}

const ctx: SeatsAeroMapContext = {
  rates: { USD: 1, CAD: 1.36, EUR: 0.92 },
  fetchedAt: "2026-10-07T15:00:00.000Z",
  getAirline: fixtureGetAirline,
  getAirport: fixtureGetAirport,
  getProgram: fixtureGetProgram,
  transfersTo: fixtureTransfersTo,
  buildTransferOptions,
  scoreFare: fixtureScoreFare,
  estimateCashFare: fixtureEstimateCashFare,
};

describe("seats.aero row mapping", () => {
  it("parses a row defensively", () => {
    const r = parseRow(row());
    expect(r).not.toBeNull();
    expect(r?.origin).toBe("JFK");
    expect(r?.cabins.business).toEqual({ available: true, miles: 75000, seats: 2, airlines: ["NH"], direct: true, taxesMinor: 12650 });
    expect(r?.cabins.premium.available).toBe(false);
    expect(r?.cabins.first.seats).toBeNull();
    expect(parseRow({ ID: "x" })).toBeNull();
    expect(parseRow(null)).toBeNull();
  });

  it("maps a row + cabin to an AwardFare with program id, FX-converted taxes and seats", () => {
    const fare = rowToFare(parseRow(row())!, "business", ctx);
    expect(fare).not.toBeNull();
    expect(fare?.programId).toBe("aeroplan");
    expect(fare?.miles).toBe(75000);
    expect(fare?.taxesUsd).toBeCloseTo(126.5 / 1.36, 2);
    expect(fare?.seats).toBe(2);
    expect(fare?.source).toBe("live");
    expect(fare?.fetchedAt).toBe("2026-10-07T10:00:00Z");
    expect(fare?.bookUrl).toBe("https://example.com/aeroplan");
    expect(fare?.transferOptions.map((t) => t.bankProgramId)).toEqual(["amex-mr"]);
    expect(typeof fare?.valueScore).toBe("number");
  });

  it("reports unknown seat counts as null and skips unavailable cabins / unmapped sources", () => {
    const base = parseRow(row({ JRemainingSeats: 0 }))!;
    expect(rowToFare(base, "business", ctx)?.seats).toBeNull();
    expect(rowToFare(base, "first", ctx)).toBeNull();
    expect(rowToFare(parseRow(row({ Source: "saudia" }))!, "business", ctx)).toBeNull();
    expect(rowToFare(parseRow(row({ Source: "mystery" }))!, "business", ctx)).toBeNull();
  });

  it("groups rows from several programs into one itinerary with multiple fares", () => {
    const rows = [parseRow(row())!, parseRow(row({ ID: "united-1", Source: "united", JMileageCost: "88000", JMileageCostRaw: 88000, TaxesCurrency: "USD", JTotalTaxes: 560 }))!];
    const results = rowsToResults(rows, "business", ctx);
    expect(results).toHaveLength(1);
    expect(results[0].fares.map((f) => f.programId).sort()).toEqual(["aeroplan", "united-mileageplus"]);
    expect(results[0].itinerary.stops).toBe(0);
    expect(results[0].itinerary.segments).toHaveLength(1);
    expect(results[0].itinerary.segments[0]).toMatchObject({ carrier: "NH", origin: "JFK", destination: "NRT", cabin: "business" });
    expect(results[0].itinerary.distanceMiles).toBe(6735);
    expect(results[0].bestFare.programId).toBe(results[0].fares.reduce((a, b) => (b.valueScore > a.valueScore ? b : a)).programId);
    expect(results[0].cashPriceUsd).toBeGreaterThan(0);
  });

  it("marks connecting rows with a stop and routes via the carrier's hub when known", () => {
    const results = rowsToResults([parseRow(row())!], "economy", ctx);
    expect(results).toHaveLength(1);
    const it = results[0].itinerary;
    expect(it.stops).toBe(1);
    // AC has no hubs in the fixtures → single segment flagged as one stop; NH would route via NRT/HND.
    expect(it.segments.length).toBeGreaterThanOrEqual(1);
    const viaNh = rowsToResults([parseRow(row({ YAirlines: "NH", Route: { ...(row().Route as object), DestinationAirport: "SFO" }, ID: "nh-1" }))!], "economy", ctx);
    expect(viaNh[0].itinerary.segments.map((s) => s.destination)).toEqual(["NRT", "SFO"]);
    expect(viaNh[0].itinerary.stops).toBe(1);
  });

  it("applies passenger / stops / program filters", () => {
    const rows = [parseRow(row())!];
    expect(rowsToResults(rows, "business", ctx, { passengers: 3 })).toHaveLength(0);
    expect(rowsToResults(rows, "business", ctx, { passengers: 2 })).toHaveLength(1);
    expect(rowsToResults(rows, "economy", ctx, { maxStops: 0 })).toHaveLength(0);
    expect(rowsToResults(rows, "business", ctx, { programs: ["united-mileageplus"] })).toHaveLength(0);
  });

  it("uses trip detail segments when present", () => {
    const withTrips = row({
      JDirect: false,
      JAirlines: "LH",
      AvailabilityTrips: [
        {
          ID: "trip-1",
          Cabin: "business",
          MileageCost: 70000,
          TotalTaxes: 9500,
          TaxesCurrency: "USD",
          RemainingSeats: 3,
          Stops: 1,
          TotalDuration: 1010,
          Carriers: "LH",
          Source: "aeroplan",
          AvailabilitySegments: [
            { FlightNumber: "LH401", OriginAirport: "JFK", DestinationAirport: "FRA", DepartsAt: "2026-11-20T16:10:00Z", ArrivesAt: "2026-11-21T05:50:00Z", AircraftName: "Airbus A340-600", Distance: 3851, Order: 0 },
            { FlightNumber: "LH716", OriginAirport: "FRA", DestinationAirport: "NRT", DepartsAt: "2026-11-21T13:35:00Z", ArrivesAt: "2026-11-22T09:00:00Z", AircraftName: "Boeing 747-8", Distance: 5820, Order: 1 },
          ],
        },
      ],
    });
    const results = rowsToResults([parseRow(withTrips)!], "business", ctx);
    expect(results).toHaveLength(1);
    const it = results[0].itinerary;
    expect(it.segments.map((s) => `${s.carrier}${s.flightNumber}`)).toEqual(["LH401", "LH716"]);
    expect(it.segments[0].departure).toBe("2026-11-20T16:10");
    expect(it.stops).toBe(1);
    expect(it.totalDurationMin).toBe(1010);
    expect(results[0].fares[0]).toMatchObject({ miles: 70000, taxesUsd: 95, seats: 3 });
  });

  it("keeps the source map and its inverse consistent", () => {
    expect(SOURCE_TO_PROGRAM.lifemiles).toBe("avianca-lifemiles");
    expect(SOURCE_TO_PROGRAM.smiles).toBeNull();
    expect(PROGRAM_TO_SOURCE["virgin-atlantic-flying-club"]).toBe("virginatlantic");
    expect(PROGRAM_TO_SOURCE).not.toHaveProperty("undefined");
  });
});

describe("seats.aero provider", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  const deps = {
    apiKey: "pk_test",
    rates: async () => ({ USD: 1, CAD: 1.36 }),
    now: () => new Date("2026-10-07T15:00:00Z"),
    expandMetro: (c: string) => (c === "NYC" ? ["JFK", "EWR"] : c === "TYO" ? ["NRT", "HND"] : [c]),
    context: { getAirline: fixtureGetAirline, getAirport: fixtureGetAirport, getProgram: fixtureGetProgram, transfersTo: fixtureTransfersTo, scoreFare: fixtureScoreFare, estimateCashFare: fixtureEstimateCashFare },
  };

  it("is disabled without a key", () => {
    const p = createSeatsAeroProvider({});
    expect(p.enabled).toBe(false);
    expect(p.requires).toBe("SEATS_AERO_API_KEY");
  });

  it("search() builds the documented query, sends Partner-Authorization and maps rows", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ data: [row()], count: 1, hasMore: false }));
    vi.stubGlobal("fetch", fn);
    const p = createSeatsAeroProvider(deps);
    const results = await p.search({ origin: ["NYC"], destination: ["TYO"], date: "2026-11-20", flexDays: 2, cabin: "business", passengers: 1 });
    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe("https://seats.aero/partnerapi/search");
    expect(url.searchParams.get("origin_airport")).toBe("JFK,EWR");
    expect(url.searchParams.get("destination_airport")).toBe("NRT,HND");
    expect(url.searchParams.get("cabin")).toBe("business");
    expect(url.searchParams.get("start_date")).toBe("2026-11-18");
    expect(url.searchParams.get("end_date")).toBe("2026-11-22");
    expect(url.searchParams.get("take")).toBe("500");
    expect(url.searchParams.get("order_by")).toBe("lowest_mileage");
    expect(headerOf(calls[0].init, "Partner-Authorization")).toBe("pk_test");
    expect(results).toHaveLength(1);
    expect(results[0].bestFare.programId).toBe("aeroplan");
    expect(results[0].bestFare.source).toBe("live");
  });

  it("search() follows the cursor and restricts sources for a programs filter", async () => {
    let page = 0;
    const { fn, calls } = mockFetch(() => {
      page++;
      return jsonResponse(page === 1 ? { data: [row()], hasMore: true, cursor: 1700000 } : { data: [row({ ID: "r2", Date: "2026-11-21" })], hasMore: false });
    });
    vi.stubGlobal("fetch", fn);
    const p = createSeatsAeroProvider(deps);
    const results = await p.search({ origin: ["JFK"], destination: ["NRT"], date: "2026-11-20", flexDays: 1, cabin: "business", passengers: 1, programs: ["aeroplan", "united-mileageplus"], maxStops: 0 });
    expect(calls).toHaveLength(2);
    expect(new URL(calls[1].url).searchParams.get("cursor")).toBe("1700000");
    expect(new URL(calls[0].url).searchParams.get("sources")).toBe("aeroplan,united");
    expect(new URL(calls[0].url).searchParams.get("only_direct_flights")).toBe("true");
    expect(results).toHaveLength(2);
  });

  it("availability() groups the cheapest fare per day and program", async () => {
    const rows = [
      row({ ID: "a", Date: "2026-11-20" }),
      row({ ID: "b", Date: "2026-11-20", JMileageCost: "60000", JMileageCostRaw: 60000, JRemainingSeats: 0 }),
      row({ ID: "c", Date: "2026-11-21", Source: "united", JMileageCost: "88000", JMileageCostRaw: 88000, TaxesCurrency: "USD", JTotalTaxes: 560 }),
    ];
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({ data: rows, hasMore: false })).fn);
    const p = createSeatsAeroProvider(deps);
    const avail = await p.availability("JFK", "NRT", "business", "2026-11-20", "2026-11-25");
    expect(avail.source).toBe("live");
    expect(avail.days).toHaveLength(2);
    expect(avail.days[0]).toMatchObject({ date: "2026-11-20", programId: "aeroplan", miles: 60000, seats: 1, carrier: "NH" });
    expect(avail.days[1]).toMatchObject({ date: "2026-11-21", programId: "united-mileageplus", miles: 88000, taxesUsd: 5.6 });
  });

  it("deals() scans /availability per source and ranks by cpp", async () => {
    const { fn, calls } = mockFetch((url) => {
      const source = new URL(url).searchParams.get("source");
      if (source === "aeroplan") return jsonResponse({ data: [row(), row({ ID: "f", FAvailable: true, FMileageCost: "100000", FMileageCostRaw: 100000, FRemainingSeats: 1, FAirlines: "NH", FDirect: true, FTotalTaxes: 12650 })] });
      if (source === "united") return jsonResponse({ data: [row({ ID: "u", Source: "united", JMileageCost: "200000", JMileageCostRaw: 200000, TaxesCurrency: "USD", JTotalTaxes: 560 })] });
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal("fetch", fn);
    const p = createSeatsAeroProvider({ ...deps, dealSources: ["aeroplan", "united", "alaska"] });
    const deals = await p.deals({ limit: 10 });
    expect(calls).toHaveLength(3);
    expect(new URL(calls[0].url).pathname).toBe("/partnerapi/availability");
    expect(deals.length).toBe(3);
    expect(deals[0].cpp).toBeGreaterThanOrEqual(deals[1].cpp);
    expect(deals[1].cpp).toBeGreaterThanOrEqual(deals[2].cpp);
    expect(deals.map((d) => d.source)).toEqual(["live", "live", "live"]);
    // Fixture scorer: high-cpp rows earn "Sweet spot"; the 200k-mile United row has no badge and few seats → "ai-pick".
    expect(deals.find((d) => d.cabin === "first")?.badge).toBe("sweet-spot");
    expect(deals.find((d) => d.programId === "united-mileageplus")?.badge).toBe("ai-pick");
    expect(deals.find((d) => d.programId === "united-mileageplus")?.savingsPct).toBe(0);
    expect(deals.every((d) => d.dates.includes("2026-11-20"))).toBe(true);
    const fromJfk = await p.deals({ origin: "SFO" });
    expect(fromJfk).toHaveLength(0);
  });

  it("surfaces HTTP errors as ProviderError", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({ message: "bad key" }, 401)).fn);
    const p = createSeatsAeroProvider(deps);
    await expect(p.search({ origin: ["JFK"], destination: ["NRT"], date: "2026-11-20", cabin: "business", passengers: 1 })).rejects.toMatchObject({ name: "ProviderError", status: 401 });
  });
});
