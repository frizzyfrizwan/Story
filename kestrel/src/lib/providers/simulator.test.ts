import { describe, expect, it } from "vitest";
import type { AwardSearchQuery } from "@/lib/types";
import { addDays } from "@/lib/utils";
import { buildTimetable, carrierGenerosity, createSimulator, daysOutFactor, operatesOn, seasonalityFactor, seatProbability, seatsFor } from "./simulator";
import { FIXTURE_AIRLINES, FIXTURE_ROUTES, fixtureSimulatorDeps } from "./test-fixtures";

const NOW = Date.parse("2026-10-07T15:00:00Z");
const TODAY = "2026-10-07";
const WORLD = { lamin: -90, lomin: -180, lamax: 90, lomax: 180 };

const baseQuery: AwardSearchQuery = { origin: ["NYC"], destination: ["TYO"], date: "2026-11-20", flexDays: 2, cabin: "business", passengers: 1 };

describe("timetable", () => {
  it("assigns unique flight numbers per carrier and mirrors one-way routes", () => {
    const tt = buildTimetable(FIXTURE_ROUTES);
    const keys = tt.flights.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    // BA JFK→LHR is listed in both directions → no synthetic mirror; AA and LH one-way routes get mirrored returns.
    const lhrJfk = tt.byPair.get("LHR-JFK")!;
    expect(lhrJfk.filter((f) => f.carrier === "BA").every((f) => !f.mirrored)).toBe(true);
    expect(lhrJfk.filter((f) => f.carrier === "AA").every((f) => f.mirrored)).toBe(true);
    expect(tt.byPair.get("FRA-JFK")?.some((f) => f.mirrored && f.carrier === "LH")).toBe(true);
    // 21/week → 3 daily, 14/week → 2 daily, 3/week → 1 flight on 3 weekdays.
    expect(tt.byPair.get("JFK-LHR")?.filter((f) => f.carrier === "BA")).toHaveLength(3);
    expect(tt.byPair.get("JFK-LHR")?.filter((f) => f.carrier === "AA")).toHaveLength(2);
    const sfoFra = tt.byPair.get("SFO-FRA")!;
    expect(sfoFra).toHaveLength(1);
    const operatingDays = Array.from({ length: 7 }, (_, i) => addDays("2026-11-16", i)).filter((d) => operatesOn(sfoFra[0], d));
    expect(operatingDays).toHaveLength(3);
    // Explicit flight numbers are honoured.
    expect(tt.byKey.get("LH:401")?.route.destination).toBe("FRA");
    expect(tt.byKey.get("AA:100")?.route.destination).toBe("LHR");
  });
});

describe("seat model", () => {
  it("has the documented shape", () => {
    expect(daysOutFactor(-1)).toBe(0);
    expect(daysOutFactor(7)).toBeGreaterThan(daysOutFactor(100));
    expect(daysOutFactor(320)).toBeGreaterThan(daysOutFactor(100));
    expect(seasonalityFactor("2026-07-15")).toBeLessThan(seasonalityFactor("2026-10-14"));
    expect(seasonalityFactor("2026-12-24")).toBeLessThan(seasonalityFactor("2026-12-05"));
    expect(carrierGenerosity("SQ", "first")).toBeLessThan(carrierGenerosity("AC", "first"));
    expect(seatProbability({ cabin: "economy", daysOut: 40, date: "2026-11-20", carrier: "AC" })).toBeGreaterThan(seatProbability({ cabin: "first", daysOut: 40, date: "2026-11-20", carrier: "SQ" }));
    const p = seatProbability({ cabin: "first", daysOut: 400, date: "2026-12-25", carrier: "SQ" });
    expect(p).toBeGreaterThanOrEqual(0.02);
    expect(p).toBeLessThanOrEqual(0.97);
  });

  it("returns 0–9 seats deterministically and never above 9", () => {
    const tt = buildTimetable(FIXTURE_ROUTES);
    const f = tt.byPair.get("JFK-LHR")![0];
    const seen = new Set<number>();
    for (let i = 0; i < 120; i++) {
      const date = addDays(TODAY, i);
      const s = seatsFor(f, date, "business", i);
      expect(seatsFor(f, date, "business", i)).toBe(s);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(9);
      seen.add(s);
    }
    expect(seen.has(0)).toBe(true);
    expect(Array.from(seen).some((s) => s > 0)).toBe(true);
    expect(seatsFor(f, TODAY, "first", 1)).toBeLessThanOrEqual(9);
  });
});

describe("simulator search", () => {
  const sim = createSimulator(fixtureSimulatorDeps(NOW));

  it("is deterministic for the same query and instant", async () => {
    const a = await sim.search(baseQuery);
    const b = await createSimulator(fixtureSimulatorDeps(NOW)).search(baseQuery);
    expect(a.length).toBeGreaterThan(0);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("returns well-formed results: seats 1–9, sorted by value, dates within flex, cabins honoured", async () => {
    const results = await sim.search(baseQuery);
    expect(results.length).toBeLessThanOrEqual(40);
    for (const r of results) {
      expect(r.fares.length).toBeGreaterThan(0);
      for (const f of r.fares) {
        expect(f.seats).toBeGreaterThanOrEqual(1);
        expect(f.seats).toBeLessThanOrEqual(9);
        expect(f.cabin).toBe("business");
        expect(f.source).toBe("simulated");
        expect(f.miles).toBeGreaterThan(0);
      }
      expect(r.bestFare.valueScore).toBe(Math.max(...r.fares.map((f) => f.valueScore)));
      const date = r.itinerary.segments[0].departure.slice(0, 10);
      expect(["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]).toContain(date);
      expect(["JFK", "EWR"]).toContain(r.itinerary.segments[0].origin);
      expect(["NRT", "HND"]).toContain(r.itinerary.segments[r.itinerary.segments.length - 1].destination);
      expect(r.itinerary.stops).toBe(r.itinerary.segments.length - 1);
      expect(r.itinerary.distanceMiles).toBeGreaterThan(5000);
      expect(r.cashPriceUsd).toBeGreaterThan(0);
      for (const s of r.itinerary.segments) {
        expect(s.departure).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(s.arrival).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
        expect(s.flightNumber).toMatch(/^\d+$/);
      }
    }
    for (let i = 1; i < results.length; i++) expect(results[i - 1].bestFare.valueScore).toBeGreaterThanOrEqual(results[i].bestFare.valueScore);
  });

  it("builds one-stop connections over alliance hubs and honours maxStops", async () => {
    const withStops = await sim.search({ ...baseQuery, flexDays: 3, cabin: "economy" });
    const viaFra = withStops.find((r) => r.itinerary.segments.length === 2 && r.itinerary.segments[0].destination === "FRA");
    expect(viaFra).toBeDefined();
    expect(viaFra?.itinerary.segments.map((s) => s.carrier)).toEqual(["LH", "LH"]);
    // Connection respects the minimum connect time.
    const [l1, l2] = viaFra!.itinerary.segments;
    expect(l2.departure > l1.arrival).toBe(true);
    const nonstop = await sim.search({ ...baseQuery, maxStops: 0, cabin: "economy", flexDays: 3 });
    expect(nonstop.every((r) => r.itinerary.stops === 0)).toBe(true);
  });

  it("respects program filters and passenger counts", async () => {
    const only = await sim.search({ ...baseQuery, cabin: "economy", programs: ["aeroplan"] });
    expect(only.every((r) => r.fares.every((f) => f.programId === "aeroplan"))).toBe(true);
    const party = await sim.search({ ...baseQuery, cabin: "economy", passengers: 4 });
    expect(party.every((r) => r.fares.every((f) => (f.seats ?? 0) >= 4))).toBe(true);
    const everyone = await sim.search({ ...baseQuery, cabin: "economy" });
    expect(party.length).toBeLessThanOrEqual(everyone.length);
  });
});

describe("simulator availability", () => {
  const sim = createSimulator(fixtureSimulatorDeps(NOW));

  it("returns one cheapest fare per program per day, only for days with seats", async () => {
    const from = "2026-11-01";
    const to = "2026-11-30";
    const avail = await sim.availability("JFK", "LHR", "business", from, to);
    expect(avail.source).toBe("simulated");
    expect(avail.days.length).toBeGreaterThan(0);
    // ≤ 30 days × 2 programs (AA + BA book BA/AA).
    expect(avail.days.length).toBeLessThanOrEqual(30 * 2);
    const seen = new Set<string>();
    for (const d of avail.days) {
      expect(d.date >= from && d.date <= to).toBe(true);
      expect(d.seats).toBeGreaterThanOrEqual(1);
      expect(d.seats).toBeLessThanOrEqual(9);
      expect(d.cabin).toBe("business");
      expect(["AA", "BA"]).toContain(d.carrier);
      const key = `${d.date}:${d.programId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
    const again = await sim.availability("JFK", "LHR", "business", from, to);
    expect(again).toEqual(avail);
  });

  it("expands metros", async () => {
    const avail = await sim.availability("NYC", "LON", "economy", "2026-11-01", "2026-11-07");
    expect(avail.days.some((d) => d.carrier === "UA")).toBe(true); // EWR→LHR
  });
});

describe("simulator deals", () => {
  it("is deterministic per day, limited, and tagged", async () => {
    const sim = createSimulator(fixtureSimulatorDeps(NOW));
    const deals = await sim.deals({ limit: 8 });
    expect(deals.length).toBeGreaterThan(0);
    expect(deals.length).toBeLessThanOrEqual(8);
    expect(await createSimulator(fixtureSimulatorDeps(NOW)).deals({ limit: 8 })).toEqual(deals);
    for (const d of deals) {
      expect(["business", "first"]).toContain(d.cabin);
      expect(d.dates.length).toBeGreaterThan(0);
      expect(d.seats).toBeGreaterThan(0);
      expect(d.savingsPct).toBeGreaterThanOrEqual(0);
      expect(["sweet-spot", "transfer-bonus", "rare", "wide-open", "ai-pick"]).toContain(d.badge);
      expect(d.source).toBe("simulated");
    }
    const tomorrow = await createSimulator(fixtureSimulatorDeps(NOW + 86_400_000)).deals({ limit: 8 });
    expect(tomorrow.map((d) => d.id)).not.toEqual(deals.map((d) => d.id));
    const fromSfo = await sim.deals({ origin: "SFO", cabin: "business" });
    expect(fromSfo.every((d) => d.origin === "SFO" && d.cabin === "business")).toBe(true);
  });
});

describe("simulator live aircraft + flight status", () => {
  const sim = createSimulator(fixtureSimulatorDeps(NOW));

  it("synthesises airborne aircraft inside the bbox with plausible dynamics", async () => {
    const world = await sim.states(WORLD);
    expect(world.time).toBe(Math.floor(NOW / 1000));
    expect(world.aircraft.length).toBeGreaterThan(0);
    for (const a of world.aircraft) {
      expect(a.lat).toBeGreaterThanOrEqual(-90);
      expect(a.lat).toBeLessThanOrEqual(90);
      expect(a.altitudeM).toBeGreaterThan(0);
      expect(a.altitudeM!).toBeLessThanOrEqual(41_000 * 0.3048 + 1);
      expect(a.velocityMs).toBeGreaterThan(50);
      expect(a.heading).toBeGreaterThanOrEqual(0);
      expect(a.heading).toBeLessThan(360);
      expect(a.icao24).toMatch(/^[0-9a-f]{6}$/);
      expect(a.onGround).toBe(false);
      expect(a.carrier).toBeDefined();
      expect(FIXTURE_AIRLINES.some((al) => a.callsign?.startsWith(al.icao!))).toBe(true);
    }
    const atlantic = { lamin: 35, lomin: -70, lamax: 60, lomax: -5 };
    const narrow = await sim.states(atlantic);
    for (const a of narrow.aircraft) {
      expect(a.lat).toBeGreaterThanOrEqual(atlantic.lamin);
      expect(a.lat).toBeLessThanOrEqual(atlantic.lamax);
      expect(a.lon).toBeGreaterThanOrEqual(atlantic.lomin);
      expect(a.lon).toBeLessThanOrEqual(atlantic.lomax);
    }
    expect(narrow.aircraft.length).toBeLessThanOrEqual(world.aircraft.length);
  });

  it("flightStatus agrees with liveAircraft for the same flight", async () => {
    const { aircraft } = await sim.states(WORLD);
    expect(aircraft.length).toBeGreaterThan(0);
    for (const a of aircraft) {
      const airline = FIXTURE_AIRLINES.find((al) => a.callsign?.startsWith(al.icao!))!;
      const number = a.callsign!.slice(airline.icao!.length);
      let matched = false;
      for (const date of [addDays(TODAY, -1), TODAY, addDays(TODAY, 1)]) {
        const s = await sim.status(airline.iata, number, date);
        if (s?.status !== "active") continue;
        matched = true;
        expect(s.position?.lat).toBeCloseTo(a.lat, 9);
        expect(s.position?.lon).toBeCloseTo(a.lon, 9);
        expect(s.position?.altitudeM).toBe(a.altitudeM);
        expect(s.position?.heading).toBe(a.heading);
        expect(s.progress).toBeGreaterThan(0);
        expect(s.progress).toBeLessThan(1);
        expect(s.carrier).toBe(a.carrier);
        expect(s.flightNumber).toBe(number);
      }
      expect(matched).toBe(true);
    }
  });

  it("reports schedule, delay, landed and unknown flights", async () => {
    const tt = sim.timetable();
    const ba = tt.byPair.get("JFK-LHR")!.find((f) => f.carrier === "BA")!;
    const future = await sim.status("BA", `BA${ba.number}`, "2026-12-01");
    expect(future).not.toBeNull();
    expect(["scheduled", "cancelled"]).toContain(future!.status);
    expect(future).toMatchObject({ origin: "JFK", destination: "LHR", date: "2026-12-01", source: "simulated" });
    expect(future!.scheduledDeparture.startsWith("2026-12-01T")).toBe(true);
    expect(future!.terminal).toBeDefined();
    const past = await sim.status("BA", ba.number, "2026-09-01");
    expect(["landed", "cancelled"]).toContain(past!.status);
    expect(await sim.status("ZZ", "1", TODAY)).toBeNull();
    expect(await sim.status("BA", "9999", TODAY)).toBeNull();
    // Sub-daily route is null on a non-operating day.
    const sfoFra = tt.byPair.get("SFO-FRA")![0];
    const week = Array.from({ length: 7 }, (_, i) => addDays("2026-11-16", i));
    const statuses = await Promise.all(week.map((d) => sim.status("LH", sfoFra.number, d)));
    expect(statuses.filter((s) => s !== null)).toHaveLength(3);
  });
});

describe("simulator hotels", () => {
  it("quotes every curated property and sorts by value", async () => {
    const sim = createSimulator(fixtureSimulatorDeps(NOW));
    const quotes = await sim.hotels({ city: "Paris", checkIn: "2026-11-20", checkOut: "2026-11-23", guests: 2 });
    expect(quotes).toHaveLength(3);
    expect(quotes.every((q) => q.nights === 3 && q.source === "simulated")).toBe(true);
    for (let i = 1; i < quotes.length; i++) expect(quotes[i - 1].valueScore).toBeGreaterThanOrEqual(quotes[i].valueScore);
    const hyattOnly = await sim.hotels({ city: "paris", checkIn: "2026-11-20", checkOut: "2026-11-21", guests: 1, programs: ["world-of-hyatt"] });
    expect(hyattOnly).toHaveLength(2);
    expect(await sim.hotels({ city: "Nowhere", checkIn: "2026-11-20", checkOut: "2026-11-21", guests: 1 })).toEqual([]);
  });
});
