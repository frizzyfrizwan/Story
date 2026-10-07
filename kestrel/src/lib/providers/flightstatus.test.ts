import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAeroDataBoxProvider, createAviationStackProvider, mapAeroDataBoxFlight, mapAviationStackFlight, normalizeFlightNumber } from "./flightstatus";
import { memoClear } from "./http";
import { headerOf, jsonResponse, mockFetch } from "./test-fixtures";

const NOW = Date.parse("2026-10-07T15:00:00Z");

const AVIATIONSTACK_ROW = {
  flight_date: "2026-10-07",
  flight_status: "active",
  departure: { airport: "Newark Liberty", timezone: "America/New_York", iata: "EWR", icao: "KEWR", terminal: "C", gate: "C120", delay: 12, scheduled: "2026-10-07T08:35:00+00:00", estimated: "2026-10-07T08:35:00+00:00", actual: "2026-10-07T08:47:00+00:00" },
  arrival: { airport: "Heathrow", timezone: "Europe/London", iata: "LHR", icao: "EGLL", terminal: "2", gate: null, delay: null, scheduled: "2026-10-07T20:35:00+00:00", estimated: "2026-10-07T20:40:00+00:00", actual: null },
  airline: { name: "United Airlines", iata: "UA", icao: "UAL" },
  flight: { number: "16", iata: "UA16", icao: "UAL16" },
  aircraft: { registration: "N2644U", iata: "B77W", icao: "B77W", icao24: "A2B3C4" },
  live: { updated: "2026-10-07T14:59:00+00:00", latitude: 48.1, longitude: -40.2, altitude: 11277.6, direction: 62.3, speed_horizontal: 905.6, speed_vertical: 0, is_ground: false },
};

const AERODATABOX_ROW = {
  greatCircleDistance: { km: 5555, mile: 3452 },
  departure: { airport: { icao: "KEWR", iata: "EWR", name: "Newark" }, scheduledTime: { utc: "2026-10-07 12:35Z", local: "2026-10-07 08:35-04:00" }, revisedTime: { utc: "2026-10-07 12:47Z", local: "2026-10-07 08:47-04:00" }, terminal: "C", gate: "C120", quality: ["Basic", "Live"] },
  arrival: { airport: { icao: "EGLL", iata: "LHR", name: "London Heathrow" }, scheduledTime: { utc: "2026-10-07 19:35Z", local: "2026-10-07 20:35+01:00" }, revisedTime: { utc: "2026-10-07 19:40Z", local: "2026-10-07 20:40+01:00" }, terminal: "2", quality: ["Basic"] },
  lastUpdatedUtc: "2026-10-07 14:59Z",
  number: "UA 16",
  callSign: "UAL16",
  status: "EnRoute",
  codeshareStatus: "IsOperator",
  isCargo: false,
  aircraft: { reg: "N2644U", modeS: "A2B3C4", model: "Boeing 777-300ER" },
  airline: { name: "United", iata: "UA", icao: "UAL" },
  location: { pressureAltitude: { meter: 11277 }, altitude: { meter: 11300 }, groundSpeed: { kt: 489 }, trueTrack: { deg: 62.3 }, lat: 48.1, lon: -40.2, reportedAtUtc: "2026-10-07 14:59Z" },
};

describe("flight number normalisation", () => {
  it("strips the carrier prefix, spaces and leading zeros", () => {
    expect(normalizeFlightNumber("ua", "UA0016")).toEqual({ carrier: "UA", number: "16", iata: "UA16" });
    expect(normalizeFlightNumber("UA", " 16 ")).toEqual({ carrier: "UA", number: "16", iata: "UA16" });
    expect(normalizeFlightNumber("B6", "B6 1")).toEqual({ carrier: "B6", number: "1", iata: "B61" });
  });
});

describe("AviationStack", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  it("maps a flight row to FlightStatus with local wall-clock times and progress", () => {
    const s = mapAviationStackFlight(AVIATIONSTACK_ROW, "UA", "16", "2026-10-07", NOW);
    expect(s).toMatchObject({
      carrier: "UA",
      flightNumber: "16",
      date: "2026-10-07",
      origin: "EWR",
      destination: "LHR",
      scheduledDeparture: "2026-10-07T08:35",
      estimatedDeparture: "2026-10-07T08:47",
      scheduledArrival: "2026-10-07T20:35",
      estimatedArrival: "2026-10-07T20:40",
      status: "active",
      delayMin: 12,
      aircraft: "B77W",
      registration: "N2644U",
      terminal: "C",
      gate: "C120",
      position: { lat: 48.1, lon: -40.2, altitudeM: 11277.6, heading: 62.3 },
      source: "live",
    });
    // Departed 12:47Z, lands 19:40Z, now 15:00Z → ~32 % of the way.
    expect(s?.progress).toBeCloseTo((15 * 60 - (12 * 60 + 47)) / (19 * 60 + 40 - (12 * 60 + 47)), 2);
  });

  it("flags scheduled-with-delay as delayed and unknown statuses safely", () => {
    const delayed = mapAviationStackFlight({ ...AVIATIONSTACK_ROW, flight_status: "scheduled", live: null }, "UA", "16", "2026-10-07", NOW);
    expect(delayed?.status).toBe("delayed");
    expect(delayed?.position).toBeUndefined();
    expect(delayed?.progress).toBeUndefined();
    expect(mapAviationStackFlight({ ...AVIATIONSTACK_ROW, flight_status: "incident" }, "UA", "16", "2026-10-07", NOW)?.status).toBe("unknown");
    expect(mapAviationStackFlight({ departure: {} }, "UA", "16", "2026-10-07", NOW)).toBeNull();
  });

  it("calls the documented endpoint and picks the matching row", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ pagination: { count: 2 }, data: [{ ...AVIATIONSTACK_ROW, flight_date: "2026-10-06" }, AVIATIONSTACK_ROW] }));
    vi.stubGlobal("fetch", fn);
    const p = createAviationStackProvider({ apiKey: "k123", now: () => NOW });
    expect(p.enabled).toBe(true);
    const s = await p.status("UA", "UA16", "2026-10-07");
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe("http://api.aviationstack.com/v1/flights");
    expect(url.searchParams.get("access_key")).toBe("k123");
    expect(url.searchParams.get("flight_iata")).toBe("UA16");
    expect(url.searchParams.get("flight_date")).toBe("2026-10-07");
    expect(s?.date).toBe("2026-10-07");
    expect(s?.status).toBe("active");
  });

  it("returns null for empty data and throws on API error envelopes", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({ data: [] })).fn);
    const p = createAviationStackProvider({ apiKey: "k" });
    expect(await p.status("UA", "9999", "2026-10-07")).toBeNull();
    memoClear();
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({ error: { code: 104, message: "usage limit reached" } })).fn);
    await expect(p.status("UA", "16", "2026-10-07")).rejects.toMatchObject({ name: "ProviderError" });
    expect(createAviationStackProvider({}).enabled).toBe(false);
  });
});

describe("AeroDataBox", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  it("maps a flight to FlightStatus", () => {
    const s = mapAeroDataBoxFlight(AERODATABOX_ROW, "UA", "16", "2026-10-07", NOW);
    expect(s).toMatchObject({
      origin: "EWR",
      destination: "LHR",
      scheduledDeparture: "2026-10-07T08:35",
      estimatedDeparture: "2026-10-07T08:47",
      scheduledArrival: "2026-10-07T20:35",
      estimatedArrival: "2026-10-07T20:40",
      status: "active",
      delayMin: 12,
      aircraft: "Boeing 777-300ER",
      registration: "N2644U",
      terminal: "C",
      gate: "C120",
      position: { lat: 48.1, lon: -40.2, altitudeM: 11300, heading: 62.3 },
      source: "live",
    });
    expect(s?.progress).toBeCloseTo((15 * 60 - (12 * 60 + 47)) / (19 * 60 + 40 - (12 * 60 + 47)), 2);
    expect(mapAeroDataBoxFlight({ ...AERODATABOX_ROW, status: "Canceled" }, "UA", "16", "2026-10-07", NOW)?.status).toBe("cancelled");
    expect(mapAeroDataBoxFlight({ ...AERODATABOX_ROW, status: "Expected", location: undefined }, "UA", "16", "2026-10-07", NOW)).toMatchObject({ status: "scheduled", position: undefined });
  });

  it("sends RapidAPI headers, hits /flights/number/{iata}/{date}, and treats 404 as unknown", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse([AERODATABOX_ROW]));
    vi.stubGlobal("fetch", fn);
    const p = createAeroDataBoxProvider({ apiKey: "rapid", now: () => NOW });
    const s = await p.status("UA", "16", "2026-10-07");
    expect(calls[0].url.startsWith("https://aerodatabox.p.rapidapi.com/flights/number/UA16/2026-10-07")).toBe(true);
    expect(headerOf(calls[0].init, "x-rapidapi-key")).toBe("rapid");
    expect(headerOf(calls[0].init, "x-rapidapi-host")).toBe("aerodatabox.p.rapidapi.com");
    expect(s?.status).toBe("active");
    memoClear();
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({ message: "not found" }, 404)).fn);
    expect(await p.status("UA", "16", "2026-10-08")).toBeNull();
  });
});
