import { describe, expect, it } from "vitest";
import {
  AIRPORTS,
  AIRPORT_BY_IATA,
  METROS,
  airportDistanceMiles,
  expandMetro,
  getAirport,
  regionOf,
  searchAirports,
} from "./airports";
import { AIRLINES, AIRLINE_BY_IATA, carrierFromCallsign, getAirline } from "./airlines";
import { POPULAR_ROUTES, ROUTES, ROUTE_COUNT, carriersOn, destinationsFrom, routesBetween, routesFrom } from "./routes";
import { CABINS, type AwardRegion } from "@/lib/types";

const REGIONS: AwardRegion[] = [
  "north-america",
  "hawaii",
  "central-america",
  "caribbean",
  "south-america",
  "europe",
  "middle-east",
  "north-africa",
  "sub-saharan-africa",
  "central-asia",
  "north-asia",
  "south-asia",
  "southeast-asia",
  "oceania",
];

describe("airports", () => {
  it("has a substantial, well-formed dataset", () => {
    expect(AIRPORTS.length).toBeGreaterThan(400);
    expect(AIRPORTS.length).toBeLessThan(700);
    const seen = new Set<string>();
    for (const a of AIRPORTS) {
      expect(a.iata).toMatch(/^[A-Z]{3}$/);
      expect(seen.has(a.iata), `duplicate ${a.iata}`).toBe(false);
      seen.add(a.iata);
      expect(a.icao, `${a.iata} icao`).toMatch(/^[A-Z0-9]{4}$/);
      expect(a.name.length).toBeGreaterThan(3);
      expect(a.city.length).toBeGreaterThan(1);
      expect(a.country.length).toBeGreaterThan(1);
      expect(a.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(a.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(a.lon)).toBeLessThanOrEqual(180);
      expect(a.tz, `${a.iata} tz`).toMatch(/^[A-Za-z_]+\/[A-Za-z_/+-]+$/);
      expect(REGIONS, `${a.iata} region ${a.region}`).toContain(a.region);
    }
  });

  it("includes the marquee airports and ~80+ hubs", () => {
    for (const code of "JFK EWR LGA LHR LGW CDG FRA MUC ZRH AMS DXB DOH AUH IST SIN HKG NRT HND ICN SYD MEL AKL GRU EZE SCL BOG LIM MEX YYZ YVR YUL JNB CPT NBO ADD CAI CMN DEL BOM BLR BKK KUL CGK MNL SGN TPE PEK PVG HNL OGG BER PKX TFU NQZ".split(" ")) {
      expect(AIRPORT_BY_IATA[code], code).toBeDefined();
    }
    const hubs = AIRPORTS.filter((a) => a.hub);
    expect(hubs.length).toBeGreaterThanOrEqual(80);
    expect(hubs.length).toBeLessThanOrEqual(110);
  });

  it("assigns regions per award-chart conventions", () => {
    expect(regionOf("HNL")).toBe("hawaii");
    expect(regionOf("OGG")).toBe("hawaii");
    expect(regionOf("JFK")).toBe("north-america");
    expect(regionOf("YVR")).toBe("north-america");
    expect(regionOf("MEX")).toBe("central-america");
    expect(regionOf("SJU")).toBe("caribbean");
    expect(regionOf("GRU")).toBe("south-america");
    expect(regionOf("IST")).toBe("europe");
    expect(regionOf("SVO")).toBe("europe");
    expect(regionOf("DXB")).toBe("middle-east");
    expect(regionOf("TLV")).toBe("middle-east");
    expect(regionOf("CAI")).toBe("north-africa");
    expect(regionOf("JNB")).toBe("sub-saharan-africa");
    expect(regionOf("ALA")).toBe("central-asia");
    expect(regionOf("NRT")).toBe("north-asia");
    expect(regionOf("HKG")).toBe("north-asia");
    expect(regionOf("DEL")).toBe("south-asia");
    expect(regionOf("MLE")).toBe("south-asia");
    expect(regionOf("SIN")).toBe("southeast-asia");
    expect(regionOf("SYD")).toBe("oceania");
    expect(regionOf("GUM")).toBe("oceania");
    expect(regionOf("PPT")).toBe("oceania");
    expect(regionOf("ZZZ")).toBeUndefined();
  });

  it("looks up by code case-insensitively", () => {
    expect(getAirport("lhr")?.city).toBe("London");
    expect(getAirport("XXX")).toBeUndefined();
  });

  it("expands metros per the architecture doc", () => {
    expect(expandMetro("NYC")).toContain("JFK");
    expect(expandMetro("NYC").sort()).toEqual(["EWR", "JFK", "LGA"]);
    expect(expandMetro("LON").sort()).toEqual(["LCY", "LGW", "LHR", "STN"]);
    expect(expandMetro("TYO").sort()).toEqual(["HND", "NRT"]);
    expect(expandMetro("WAS").sort()).toEqual(["BWI", "DCA", "IAD"]);
    expect(expandMetro("JFK")).toEqual(["JFK"]);
    expect(expandMetro("nyc")).toContain("EWR");
    const metroCodes = METROS.map((m) => m.code).sort();
    expect(metroCodes).toEqual(["BKK", "BUE", "CHI", "JKT", "LON", "MIL", "MOW", "NYC", "OSA", "PAR", "ROM", "SAO", "SEL", "STO", "TYO", "WAS"]);
    for (const m of METROS) {
      expect(m.name.length).toBeGreaterThan(2);
      for (const code of m.members) expect(AIRPORT_BY_IATA[code]?.metro).toBe(m.code);
    }
  });

  it("searches with the documented ranking", () => {
    expect(searchAirports("tokyo")[0].metro).toBe("TYO");
    expect(searchAirports("tokyo").slice(0, 2).map((a) => a.iata).sort()).toEqual(["HND", "NRT"]);
    expect(searchAirports("new york").map((a) => a.iata).slice(0, 3).sort()).toEqual(["EWR", "JFK", "LGA"]);
    expect(searchAirports("NYC").map((a) => a.iata).slice(0, 3).sort()).toEqual(["EWR", "JFK", "LGA"]);
    expect(searchAirports("JFK")[0].iata).toBe("JFK");
    expect(searchAirports("lh")[0].iata).toBe("LHR"); // IATA prefix, hub first
    expect(searchAirports("london")[0].iata).toBe("LHR");
    expect(searchAirports("San")[0].iata).toBe("SAN"); // exact IATA beats city prefix
    expect(searchAirports("heathrow")[0].iata).toBe("LHR");
    expect(searchAirports("japan").every((a) => a.countryCode === "JP")).toBe(true);
    expect(searchAirports("zürich")[0].iata).toBe("ZRH");
    expect(searchAirports("")).toHaveLength(8);
    expect(searchAirports("").every((a) => a.hub)).toBe(true);
    expect(searchAirports("qqqq")).toEqual([]);
    expect(searchAirports("a", 3)).toHaveLength(3);
  });

  it("computes great-circle distance", () => {
    const d = airportDistanceMiles("JFK", "LHR");
    expect(d).toBeGreaterThan(3400);
    expect(d).toBeLessThan(3500);
    expect(airportDistanceMiles("SIN", "EWR")).toBeGreaterThan(9500);
    expect(airportDistanceMiles("JFK", "ZZZ")).toBe(0);
  });
});

describe("airlines", () => {
  it("is well-formed with unique codes and canonical program ids", () => {
    expect(AIRLINES.length).toBeGreaterThanOrEqual(70);
    const iatas = new Set<string>();
    const icaos = new Set<string>();
    for (const a of AIRLINES) {
      expect(a.iata).toMatch(/^[A-Z0-9]{2}$/);
      expect(iatas.has(a.iata), `dup ${a.iata}`).toBe(false);
      iatas.add(a.iata);
      expect(a.icao).toMatch(/^[A-Z]{3}$/);
      expect(icaos.has(a.icao!), `dup icao ${a.icao}`).toBe(false);
      icaos.add(a.icao!);
      expect(["star", "oneworld", "skyteam", "none"]).toContain(a.alliance);
      expect(a.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(a.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(a.hubs.length).toBeGreaterThan(0);
      for (const h of a.hubs) expect(AIRPORT_BY_IATA[h], `${a.iata} hub ${h}`).toBeDefined();
      if (a.programId) expect(a.programId).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("covers the alliance anchors and maps callsigns", () => {
    expect(getAirline("sq")?.alliance).toBe("star");
    expect(getAirline("QR")?.programId).toBe("qatar-privilege-club");
    expect(getAirline("SK")?.alliance).toBe("skyteam");
    expect(carrierFromCallsign("SIA21")).toBe("SQ");
    expect(carrierFromCallsign("uae201")).toBe("EK");
    expect(carrierFromCallsign("DLH400")).toBe("LH");
    expect(carrierFromCallsign("ZZZ1")).toBeUndefined();
    expect(carrierFromCallsign(null)).toBeUndefined();
  });
});

describe("routes", () => {
  it("has ~400+ directional routes with resolvable endpoints and carriers", () => {
    expect(ROUTE_COUNT).toBe(ROUTES.length);
    expect(ROUTES.length).toBeGreaterThanOrEqual(400);
    const seen = new Set<string>();
    for (const r of ROUTES) {
      expect(AIRPORT_BY_IATA[r.origin], `origin ${r.origin}`).toBeDefined();
      expect(AIRPORT_BY_IATA[r.destination], `destination ${r.destination}`).toBeDefined();
      expect(r.origin).not.toBe(r.destination);
      expect(AIRLINE_BY_IATA[r.carrier], `carrier ${r.carrier} on ${r.origin}-${r.destination}`).toBeDefined();
      const key = `${r.carrier}:${r.origin}-${r.destination}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
      expect(r.aircraft.length).toBeGreaterThan(0);
      expect(r.weeklyFrequency).toBeGreaterThan(0);
      expect(r.cabins.length).toBeGreaterThan(0);
      for (const c of r.cabins) expect(CABINS).toContain(c);
      if (r.flightNumber) expect(r.flightNumber).toMatch(new RegExp(`^${r.carrier}\\d{1,4}$`));
    }
  });

  it("has plausible block times versus great-circle distance", () => {
    for (const r of ROUTES) {
      const miles = airportDistanceMiles(r.origin, r.destination);
      const minimum = (miles / 600) * 60 * 0.9; // cannot beat ~600 mph ground speed
      const maximum = (miles / 380) * 60 + 70; // headwinds + taxi, generous upper bound
      expect(r.durationMin, `${r.carrier} ${r.origin}-${r.destination} ${r.durationMin}m for ${miles}mi`).toBeGreaterThanOrEqual(minimum);
      expect(r.durationMin, `${r.carrier} ${r.origin}-${r.destination} ${r.durationMin}m for ${miles}mi`).toBeLessThanOrEqual(maximum);
    }
  });

  it("defines both directions for every city pair", () => {
    for (const r of ROUTES) {
      const back = ROUTES.find((x) => x.carrier === r.carrier && x.origin === r.destination && x.destination === r.origin);
      expect(back, `${r.carrier} ${r.destination}-${r.origin}`).toBeDefined();
    }
  });

  it("query helpers work in both directions", () => {
    expect(routesFrom("JFK").length).toBeGreaterThan(30);
    expect(routesFrom("jfk").every((r) => r.origin === "JFK")).toBe(true);
    expect(routesBetween("JFK", "LHR").length).toBeGreaterThanOrEqual(8);
    expect(routesBetween("lhr", "jfk").length).toBe(routesBetween("JFK", "LHR").length);
    expect(destinationsFrom("SIN")).toContain("JFK");
    expect(new Set(destinationsFrom("SIN")).size).toBe(destinationsFrom("SIN").length);
    expect(carriersOn("JFK", "LHR").sort()).toEqual(["AA", "BA", "DL", "VS"]);
    expect(carriersOn("SFO", "SIN").sort()).toEqual(["SQ", "UA"]);
    expect(carriersOn("JFK", "ZZZ")).toEqual([]);
  });

  it("carries the marquee flight numbers and aircraft", () => {
    expect(ROUTES.find((r) => r.origin === "JFK" && r.destination === "SIN" && r.carrier === "SQ")).toMatchObject({
      flightNumber: "SQ23",
      aircraft: ["A350-900ULR"],
      cabins: ["premium", "business"],
    });
    expect(ROUTES.find((r) => r.origin === "SFO" && r.destination === "SIN" && r.carrier === "UA")?.flightNumber).toBe("UA1");
    expect(ROUTES.find((r) => r.origin === "DXB" && r.destination === "JFK" && r.carrier === "EK")?.flightNumber).toBe("EK201");
    expect(ROUTES.find((r) => r.origin === "SYD" && r.destination === "LAX" && r.carrier === "QF")?.flightNumber).toBe("QF11");
    expect(ROUTES.find((r) => r.origin === "YYZ" && r.destination === "NRT" && r.carrier === "AC")).toMatchObject({ flightNumber: "AC1", aircraft: ["B787-9"] });
  });

  it("popular routes all resolve to real nonstop service", () => {
    expect(POPULAR_ROUTES.length).toBeGreaterThanOrEqual(20);
    for (const p of POPULAR_ROUTES) {
      expect(AIRPORT_BY_IATA[p.origin], p.origin).toBeDefined();
      expect(AIRPORT_BY_IATA[p.destination], p.destination).toBeDefined();
      expect(p.label).toContain("→");
      expect(routesBetween(p.origin, p.destination).length, `${p.origin}-${p.destination} has no route`).toBeGreaterThan(0);
    }
  });
});
