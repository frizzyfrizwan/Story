import { describe, expect, it } from "vitest";
import { haversineMiles } from "@/lib/utils";
import { HOTEL_PROGRAMS, HOTEL_PROGRAM_IDS, getHotelProgram, hyattPoints } from "./hotel-programs";
import { HOTELS, HOTEL_CITIES, getHotel, getHotelCity, hotelsByProgram, hotelsInCity, hotelsNear, searchHotelCities } from "./hotels";

const REQUIRED_CITIES = [
  "Tokyo", "Kyoto", "Paris", "London", "New York", "Maui", "Kauai", "Honolulu", "Maldives", "Dubai",
  "Singapore", "Bangkok", "Hong Kong", "Seoul", "Sydney", "Bali", "Bora Bora", "Zanzibar", "Cancún",
  "Cabo San Lucas", "Liberia", "Lisbon", "Madrid", "Barcelona", "Rome", "Milan", "Amsterdam", "Vienna",
  "Zurich", "Istanbul", "Doha", "Cairo", "Cape Town", "Mumbai", "Delhi", "Ho Chi Minh City", "Hanoi",
  "Chicago", "Washington", "Los Angeles", "San Francisco", "Miami", "Las Vegas", "Austin", "Scottsdale",
  "Vail", "Big Sur", "Mexico City", "Buenos Aires", "Rio de Janeiro",
];

const HEX = /^#[0-9a-f]{6}$/i;
/** How far a property may sit from its city centre (the Maldives "city" is the whole archipelago). */
const MAX_MILES: Record<string, number> = { Maldives: 300 };

describe("hotel programs", () => {
  it("defines the seven canonical programs with sane fields", () => {
    expect(HOTEL_PROGRAM_IDS).toEqual([
      "world-of-hyatt", "marriott-bonvoy", "hilton-honors", "ihg-one-rewards", "accor-all", "choice-privileges", "wyndham-rewards",
    ]);
    for (const p of HOTEL_PROGRAMS) {
      expect(p.valuationCpp).toBeGreaterThan(0);
      expect(p.color).toMatch(HEX);
      expect(p.bookingUrl).toMatch(/^https:\/\//);
      expect(p.summary.split(/\.\s/).length).toBeGreaterThanOrEqual(2);
    }
    expect(getHotelProgram("world-of-hyatt")?.chartType).toBe("category");
    expect(getHotelProgram("world-of-hyatt")?.fifthNightFree).toBe(false);
    expect(getHotelProgram("marriott-bonvoy")?.fifthNightFree).toBe(true);
    expect(getHotelProgram("hilton-honors")?.fifthNightFree).toBe(true);
    expect(getHotelProgram("ihg-one-rewards")?.fifthNightFree).toBe(false);
    expect(getHotelProgram("accor-all")?.chartType).toBe("fixed");
    expect(getHotelProgram("nope")).toBeUndefined();
  });
});

describe("hotel cities", () => {
  it("covers every required city with airport + coordinates", () => {
    const names = new Set(HOTEL_CITIES.map((c) => c.name));
    for (const c of REQUIRED_CITIES) expect(names, `missing city ${c}`).toContain(c);
    expect(HOTEL_CITIES.length).toBeGreaterThanOrEqual(45);
    expect(new Set(HOTEL_CITIES.map((c) => c.name.toLowerCase())).size).toBe(HOTEL_CITIES.length);
    for (const c of HOTEL_CITIES) {
      expect(c.airport).toMatch(/^[A-Z]{3}$/);
      expect(c.countryCode).toMatch(/^[A-Z]{2}$/);
      expect(Math.abs(c.lat)).toBeLessThanOrEqual(90);
      expect(Math.abs(c.lon)).toBeLessThanOrEqual(180);
      for (const m of [...(c.peakMonths ?? []), ...(c.lowMonths ?? [])]) {
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(12);
      }
      const overlap = (c.peakMonths ?? []).filter((m) => (c.lowMonths ?? []).includes(m));
      expect(overlap, `${c.name} has months both peak and low`).toEqual([]);
    }
  });

  it("searches by name, alias, airport and country code", () => {
    expect(searchHotelCities("tok")[0]?.name).toBe("Tokyo");
    expect(searchHotelCities("NYC")[0]?.name).toBe("New York");
    expect(searchHotelCities("ogg")[0]?.name).toBe("Maui");
    expect(searchHotelCities("malé").map((c) => c.name)).toContain("Maldives");
    expect(searchHotelCities("costa rica").map((c) => c.name)).toContain("Liberia");
    expect(searchHotelCities("hawaii").length).toBeGreaterThanOrEqual(3);
    expect(searchHotelCities("", 3)).toHaveLength(3);
    expect(searchHotelCities("zzzz")).toEqual([]);
    expect(getHotelCity("paris")?.airport).toBe("CDG");
  });
});

describe("hotel properties", () => {
  it("has a broad, well-formed catalogue", () => {
    expect(HOTELS.length).toBeGreaterThanOrEqual(160);
    expect(new Set(HOTELS.map((h) => h.id)).size).toBe(HOTELS.length);
    const cityByName = new Map(HOTEL_CITIES.map((c) => [c.name, c]));
    const programIds = new Set(HOTEL_PROGRAM_IDS);

    for (const h of HOTELS) {
      expect(programIds, `${h.name}: unknown program ${h.programId}`).toContain(h.programId);
      const city = cityByName.get(h.city);
      expect(city, `${h.name}: unknown city ${h.city}`).toBeDefined();
      if (!city) continue;
      expect(h.countryCode).toBe(city.countryCode);
      const miles = haversineMiles(city.lat, city.lon, h.lat, h.lon);
      expect(miles, `${h.name} is ${miles} mi from ${city.name}`).toBeLessThanOrEqual(MAX_MILES[city.name] ?? 60);

      expect([3, 4, 5]).toContain(h.stars);
      expect(["luxury", "upscale", "midscale"]).toContain(h.tier);
      expect(h.avgCashUsd).toBeGreaterThanOrEqual(80);
      expect(h.avgCashUsd).toBeLessThanOrEqual(2500);
      expect(h.avgPointsPerNight).toBeGreaterThanOrEqual(3500);
      expect(h.avgPointsPerNight).toBeLessThanOrEqual(150000);
      expect(h.amenities.length, `${h.name} amenities`).toBeGreaterThanOrEqual(5);
      expect(h.amenities.length, `${h.name} amenities`).toBeLessThanOrEqual(8);
      expect(h.vibe.length, `${h.name} vibe`).toBeGreaterThanOrEqual(3);
      expect(h.vibe.length, `${h.name} vibe`).toBeLessThanOrEqual(4);
      expect(h.description.split(/\.\s|\.$/).filter(Boolean).length, `${h.name} description`).toBeGreaterThanOrEqual(2);
      expect(h.art.from).toMatch(HEX);
      expect(h.art.to).toMatch(HEX);
      expect(["skyline", "coast", "mountain", "desert", "island", "forest"]).toContain(h.art.motif);

      if (h.programId === "world-of-hyatt") {
        expect(h.category, `${h.name} needs a Hyatt category`).toBeDefined();
        expect(h.category).toBeGreaterThanOrEqual(1);
        expect(h.category).toBeLessThanOrEqual(8);
        expect(h.avgPointsPerNight).toBe(hyattPoints(h.category ?? 1));
      } else {
        expect(h.category, `${h.name} should not carry a category`).toBeUndefined();
      }
      if (h.programId === "hilton-honors") expect(h.avgPointsPerNight).toBeGreaterThanOrEqual(30000);
      if (h.programId === "marriott-bonvoy") expect(h.avgPointsPerNight).toBeGreaterThanOrEqual(20000);
      if (h.programId === "ihg-one-rewards") expect(h.avgPointsPerNight).toBeGreaterThanOrEqual(20000);
      if (h.programId === "wyndham-rewards") expect([7500, 15000, 30000]).toContain(h.avgPointsPerNight);
      if (h.programId === "accor-all") expect(h.avgPointsPerNight % 2000).toBe(0);
    }
  });

  it("gives every program and every city at least one property", () => {
    for (const id of HOTEL_PROGRAM_IDS) expect(hotelsByProgram(id).length, id).toBeGreaterThan(0);
    for (const c of HOTEL_CITIES) expect(hotelsInCity(c.name).length, c.name).toBeGreaterThan(0);
    expect(hotelsByProgram("world-of-hyatt").length).toBeGreaterThanOrEqual(60);
  });

  it("looks up hotels by city (case-insensitive), airport, alias and country", () => {
    const tokyo = hotelsInCity("tokyo");
    expect(tokyo.map((h) => h.name)).toContain("Park Hyatt Tokyo");
    expect(hotelsInCity("TOKYO")).toEqual(tokyo);
    expect(hotelsInCity("  Tokyo ")).toEqual(tokyo);
    expect(hotelsInCity("HND")).toEqual(tokyo);
    expect(hotelsInCity("ogg").every((h) => h.city === "Maui")).toBe(true);
    expect(hotelsInCity("MV").every((h) => h.city === "Maldives")).toBe(true);
    expect(hotelsInCity("saigon").every((h) => h.city === "Ho Chi Minh City")).toBe(true);
    expect(hotelsInCity("CUN").map((h) => h.city).sort()).toEqual(expect.arrayContaining(["Cancún", "Playa del Carmen"]));
    expect(hotelsInCity("")).toEqual([]);
    expect(hotelsInCity("atlantis")).toEqual([]);
    expect(getHotel("park-hyatt-tokyo")?.category).toBe(7);
    expect(getHotel("nope")).toBeUndefined();
  });

  it("finds hotels near a point, nearest first", () => {
    const tokyo = getHotelCity("Tokyo");
    if (!tokyo) throw new Error("Tokyo missing");
    const near = hotelsNear(tokyo.lat, tokyo.lon, 15);
    expect(near.length).toBeGreaterThanOrEqual(5);
    expect(near.every((h) => h.distanceMiles <= 15)).toBe(true);
    for (let i = 1; i < near.length; i++) expect(near[i].distanceMiles).toBeGreaterThanOrEqual(near[i - 1].distanceMiles);
    expect(near.map((h) => h.id)).toContain("park-hyatt-tokyo");
    expect(hotelsNear(0, 0, 10)).toEqual([]);
  });
});
