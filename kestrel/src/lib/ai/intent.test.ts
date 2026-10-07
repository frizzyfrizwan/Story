import { describe, expect, it } from "vitest";
import type { Airport } from "@/lib/types";
import { intentChips, intentToQuery, parseIntentHeuristic, queryToSearchHref, summarizeIntent, type AirportResolver } from "./intent-heuristics";
import { detectPrograms, resolveProgramId } from "./program-synonyms";

const TODAY = "2026-10-07";

function ap(iata: string, city: string, extra: Partial<Airport> = {}): Airport {
  return {
    iata,
    name: `${city} ${iata}`,
    city,
    country: "X",
    countryCode: "XX",
    lat: 0,
    lon: 0,
    tz: "UTC",
    region: "north-america",
    hub: true,
    ...extra,
  };
}

const FIXTURE: Airport[] = [
  ap("JFK", "New York", { metro: "NYC" }),
  ap("EWR", "Newark", { metro: "NYC" }),
  ap("LGA", "New York", { metro: "NYC", hub: false }),
  ap("NRT", "Tokyo", { metro: "TYO", region: "north-asia" }),
  ap("HND", "Tokyo", { metro: "TYO", region: "north-asia" }),
  ap("KIX", "Osaka", { metro: "OSA", region: "north-asia" }),
  ap("LAX", "Los Angeles"),
  ap("SFO", "San Francisco"),
  ap("SEA", "Seattle"),
  ap("BOS", "Boston"),
  ap("MIA", "Miami"),
  ap("ORD", "Chicago", { metro: "CHI" }),
  ap("SYD", "Sydney", { region: "oceania" }),
  ap("LHR", "London", { metro: "LON", region: "europe" }),
  ap("CDG", "Paris", { metro: "PAR", region: "europe" }),
  ap("SIN", "Singapore", { region: "southeast-asia" }),
  ap("HNL", "Honolulu", { region: "hawaii" }),
  ap("DXB", "Dubai", { region: "middle-east" }),
  ap("NCE", "Nice", { region: "europe", hub: false }),
];

const resolver: AirportResolver = {
  getAirport: (iata) => FIXTURE.find((a) => a.iata === iata.toUpperCase()),
  searchAirports: (q, limit = 8) => {
    const s = q.trim().toLowerCase();
    if (!s) return FIXTURE.filter((a) => a.hub).slice(0, limit);
    return FIXTURE.filter((a) => a.iata.toLowerCase().startsWith(s) || a.city.toLowerCase().includes(s)).slice(0, limit);
  },
};

const parse = (text: string, extra: { homeAirport?: string } = {}) => parseIntentHeuristic(text, { today: TODAY, resolver, ...extra });

describe("parseIntentHeuristic", () => {
  it("JFK to NRT May 14 business for 2 with Amex", () => {
    const i = parse("JFK to NRT May 14 business for 2 with Amex");
    expect(i.origin).toEqual(["JFK"]);
    expect(i.destination).toEqual(["NRT"]);
    expect(i.date).toBe("2027-05-14");
    expect(i.window).toBeUndefined();
    expect(i.cabin).toBe("business");
    expect(i.passengers).toBe(2);
    expect(i.programs).toEqual(["amex-mr"]);
    expect(i.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("lie-flat to Europe over Christmas from Boston", () => {
    const i = parse("lie-flat to Europe over Christmas from Boston");
    expect(i.origin).toEqual(["BOS"]);
    expect(i.destination).toContain("LON");
    expect(i.date).toBeNull();
    expect(i.window).toEqual({ from: "2026-12-18", to: "2027-01-02" });
    expect(i.cabin).toBe("business");
    expect(i.constraints).toContain("lie-flat");
    expect(i.flexDays).toBe(3);
  });

  it("Tokyo in cherry blossom season", () => {
    const i = parse("Tokyo in cherry blossom season");
    expect(i.destination).toEqual(["TYO"]);
    expect(i.origin).toEqual([]);
    expect(i.window).toEqual({ from: "2027-03-20", to: "2027-04-15" });
    expect(i.date).toBeNull();
  });

  it("nonstop LAX-SYD first", () => {
    const i = parse("nonstop LAX-SYD first");
    expect(i.origin).toEqual(["LAX"]);
    expect(i.destination).toEqual(["SYD"]);
    expect(i.cabin).toBe("first");
    expect(i.constraints).toEqual(["nonstop"]);
    expect(i.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("Business class to Tokyo in May for 2", () => {
    const i = parse("Business class to Tokyo in May for 2");
    expect(i.destination).toEqual(["TYO"]);
    expect(i.window).toEqual({ from: "2027-05-01", to: "2027-05-31" });
    expect(i.cabin).toBe("business");
    expect(i.passengers).toBe(2);
  });

  it("from SFO to Singapore in first, avoid BA, no surcharges", () => {
    const i = parse("from SFO to Singapore in first, avoid BA, no surcharges");
    expect(i.origin).toEqual(["SFO"]);
    expect(i.destination).toEqual(["SIN"]);
    expect(i.cabin).toBe("first");
    expect(i.constraints).toContain("avoid BA");
    expect(i.constraints).toContain("no surcharges");
    expect(i.programs).toEqual([]);
  });

  it("family of 4 to Hawaii next summer economy", () => {
    const i = parse("family of 4 to Hawaii next summer economy");
    expect(i.passengers).toBe(4);
    expect(i.destination).toEqual(["HNL"]);
    expect(i.window).toEqual({ from: "2027-06-21", to: "2027-09-22" });
    expect(i.cabin).toBe("economy");
  });

  it("I have 120k Chase points and want to fly to Paris in early June", () => {
    const i = parse("I have 120k Chase points and want to fly to Paris in early June");
    expect(i.programs).toEqual(["chase-ur"]);
    expect(i.destination).toEqual(["PAR"]);
    expect(i.window).toEqual({ from: "2027-06-01", to: "2027-06-10" });
  });

  it("New York to London on 2027-03-05, premium economy, Avios", () => {
    const i = parse("New York to London on 2027-03-05, premium economy, Avios");
    expect(i.origin).toEqual(["NYC"]);
    expect(i.destination).toEqual(["LON"]);
    expect(i.date).toBe("2027-03-05");
    expect(i.cabin).toBe("premium");
    expect(i.programs).toEqual(["british-airways-club"]);
  });

  it("Alaska miles to Tokyo (program, not a place)", () => {
    const i = parse("Alaska miles to Tokyo");
    expect(i.programs).toEqual(["alaska-mileage-plan"]);
    expect(i.destination).toEqual(["TYO"]);
    expect(i.origin).toEqual([]);
  });

  it("Aeroplan business JFK-LHR 5/14 for two", () => {
    const i = parse("Aeroplan business JFK-LHR 5/14 for two");
    expect(i.programs).toEqual(["aeroplan"]);
    expect(i.origin).toEqual(["JFK"]);
    expect(i.destination).toEqual(["LHR"]);
    expect(i.date).toBe("2027-05-14");
    expect(i.passengers).toBe(2);
    expect(i.cabin).toBe("business");
  });

  it("fly my wife and I to Dubai over Thanksgiving in first class using Amex", () => {
    const i = parse("fly my wife and I to Dubai over Thanksgiving in first class using Amex");
    expect(i.passengers).toBe(2);
    expect(i.destination).toEqual(["DXB"]);
    expect(i.window).toEqual({ from: "2026-11-20", to: "2026-11-30" });
    expect(i.cabin).toBe("first");
    expect(i.programs).toEqual(["amex-mr"]);
  });

  it("cheapest business to Sydney next spring, flexible dates", () => {
    const i = parse("cheapest business to Sydney next spring, flexible dates");
    expect(i.destination).toEqual(["SYD"]);
    expect(i.cabin).toBe("business");
    expect(i.window).toEqual({ from: "2027-03-20", to: "2027-06-20" });
    expect(i.flexDays).toBe(3);
    expect(i.constraints).toContain("flexible dates");
    expect(i.constraints).toContain("best value");
  });

  it("Miami to Tokyo or Osaka late October", () => {
    const i = parse("Miami to Tokyo or Osaka late October");
    expect(i.origin).toEqual(["MIA"]);
    expect(i.destination).toEqual(["TYO", "OSA"]);
    expect(i.window).toEqual({ from: "2026-10-21", to: "2026-10-31" });
  });

  it("2 adults 1 child economy Chicago to Cancun Dec 20-27", () => {
    const i = parse("2 adults 1 child economy Chicago to Cancun Dec 20-27");
    expect(i.passengers).toBe(3);
    expect(i.cabin).toBe("economy");
    expect(i.origin).toEqual(["CHI"]);
    expect(i.destination).toEqual(["CUN"]);
    expect(i.window).toEqual({ from: "2026-12-20", to: "2026-12-27" });
  });

  it("uses the home airport when no origin is given", () => {
    const i = parse("to Europe in business", { homeAirport: "sea" });
    expect(i.origin).toEqual(["SEA"]);
    expect(i.destination).toContain("LON");
  });

  it("ORD to HND tomorrow J", () => {
    const i = parse("ORD to HND tomorrow J");
    expect(i.origin).toEqual(["ORD"]);
    expect(i.destination).toEqual(["HND"]);
    expect(i.date).toBe("2026-10-08");
    expect(i.cabin).toBe("business");
  });

  it("does not treat 'a nice trip' as Nice, France", () => {
    const i = parse("looking for a nice trip somewhere warm");
    expect(i.destination).toEqual([]);
    expect(i.confidence).toBeLessThan(0.5);
  });

  it("handles empty input gracefully", () => {
    const i = parse("");
    expect(i.destination).toEqual([]);
    expect(i.origin).toEqual([]);
    expect(i.passengers).toBe(1);
    expect(i.confidence).toBeLessThan(0.5);
  });
});

describe("intentToQuery", () => {
  it("defaults date to today+45 when neither date nor window is given", () => {
    const i = parse("business to Tokyo");
    const q = intentToQuery(i, TODAY);
    expect(q.date).toBe("2026-11-21");
    expect(q.flexDays).toBe(0);
    expect(q.passengers).toBe(1);
    expect(q.cabin).toBe("business");
    expect(q.destination).toEqual(["TYO"]);
  });

  it("uses the window start with 3 flex days", () => {
    const i = parse("to Paris in early June");
    const q = intentToQuery(i, TODAY);
    expect(q.date).toBe("2027-06-01");
    expect(q.flexDays).toBe(3);
  });

  it("maps nonstop to maxStops 0 and keeps programs", () => {
    const q = intentToQuery(parse("nonstop JFK to LHR with Avios"), TODAY);
    expect(q.maxStops).toBe(0);
    expect(q.programs).toEqual(["british-airways-club"]);
  });

  it("clamps passengers to at least 1", () => {
    const i = { ...parse("to Tokyo"), passengers: 0 };
    expect(intentToQuery(i, TODAY).passengers).toBe(1);
  });

  it("builds a search href", () => {
    const q = intentToQuery(parse("JFK to NRT May 14 business for 2"), TODAY);
    expect(queryToSearchHref(q)).toBe("/search?from=JFK&to=NRT&date=2027-05-14&cabin=business&pax=2");
  });
});

describe("chips & summary", () => {
  it("produces chips for the search box", () => {
    const chips = intentChips(parse("JFK to NRT May 14 business for 2 with Amex"));
    const kinds = chips.map((c) => c.kind);
    expect(kinds).toEqual(expect.arrayContaining(["origin", "destination", "date", "cabin", "passengers", "program"]));
    expect(summarizeIntent(parse("JFK to NRT May 14 business for 2 with Amex"))).toContain("JFK → NRT");
  });
});

describe("program synonyms", () => {
  it("maps common phrasings to canonical ids", () => {
    expect(detectPrograms("I have Amex points and some Chase")).toEqual(["amex-mr", "chase-ur"]);
    expect(detectPrograms("fly united to the United States")).toEqual([]);
    expect(detectPrograms("with United miles")).toEqual(["united-mileageplus"]);
    expect(detectPrograms("avoid BA, prefer Aeroplan")).toEqual(["aeroplan"]);
    expect(resolveProgramId("Avios")).toBe("british-airways-club");
    expect(resolveProgramId("world-of-hyatt")).toBe("world-of-hyatt");
    expect(resolveProgramId("hyatt")).toBe("world-of-hyatt");
  });
});
