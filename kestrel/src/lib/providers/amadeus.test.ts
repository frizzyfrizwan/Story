import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HotelQuoteInput } from "@/lib/hotels/engine";
import { createAmadeus, hotelNameSimilarity, matchHotels } from "./amadeus";
import { memoClear } from "./http";
import { FIXTURE_HOTELS, FIXTURE_HOTEL_CITIES, fixtureGetAirport, fixtureHotelsInCity, fixtureQuoteHotel, fixtureTransfersTo, headerOf, jsonResponse, mockFetch } from "./test-fixtures";

const TOKEN = { type: "amadeusOAuth2Token", access_token: "tok-abc", token_type: "Bearer", expires_in: 1799 };

describe("hotel name matching", () => {
  it("scores near-identical names high and different properties low", () => {
    expect(hotelNameSimilarity("Park Hyatt Paris-Vendôme", "PARK HYATT PARIS VENDOME")).toBeGreaterThan(0.9);
    expect(hotelNameSimilarity("Park Hyatt Paris-Vendôme", "Hyatt Regency Paris Étoile")).toBeLessThan(0.6);
    expect(hotelNameSimilarity("Le Méridien Etoile", "LE MERIDIEN ETOILE HOTEL")).toBeGreaterThan(0.9);
  });

  it("matches one-to-one by best score and ignores unrelated hotels", () => {
    const live = [
      { hotelId: "HLPAR001", name: "IBIS PARIS BASTILLE" },
      { hotelId: "HYPAR002", name: "PARK HYATT PARIS VENDOME" },
      { hotelId: "HYPAR003", name: "HYATT REGENCY PARIS ETOILE" },
      { hotelId: "MDPAR004", name: "LE MERIDIEN ETOILE" },
    ];
    const matches = matchHotels(FIXTURE_HOTELS, live);
    expect(matches.map((m) => [m.property.id, m.hotelId]).sort()).toEqual([
      ["hyatt-regency-paris-etoile", "HYPAR003"],
      ["le-meridien-etoile", "MDPAR004"],
      ["park-hyatt-paris-vendome", "HYPAR002"],
    ]);
    expect(matches.every((m) => m.score >= 0.9)).toBe(true);
    // A property can only claim one live hotel even when two live rows look alike.
    const twins = matchHotels(FIXTURE_HOTELS, [{ hotelId: "A", name: "PARK HYATT PARIS VENDOME" }, { hotelId: "B", name: "PARK HYATT PARIS-VENDOME" }]);
    expect(twins).toHaveLength(1);
  });
});

describe("Amadeus", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  const base = {
    clientId: "cid",
    clientSecret: "sec",
    env: "test" as const,
    rates: async () => ({ USD: 1, EUR: 0.92 }),
    hotelCities: FIXTURE_HOTEL_CITIES,
    hotelsInCity: fixtureHotelsInCity,
    getAirport: fixtureGetAirport,
    transfersTo: fixtureTransfersTo,
  };

  it("is disabled without credentials", () => {
    const a = createAmadeus({});
    expect(a.hotels.enabled).toBe(false);
    expect(a.fares.enabled).toBe(false);
    expect(a.fares.requires).toContain("AMADEUS_CLIENT_ID");
  });

  it("fetches an OAuth2 token once and reuses it until expiry", async () => {
    let now = Date.parse("2026-10-07T15:00:00Z");
    const { fn, calls } = mockFetch((url) => {
      if (url.endsWith("/v1/security/oauth2/token")) return jsonResponse(TOKEN);
      return jsonResponse({ data: [{ price: { grandTotal: "1899.40", currency: "USD" } }, { price: { grandTotal: "1750.00", currency: "USD" } }] });
    });
    vi.stubGlobal("fetch", fn);
    const a = createAmadeus({ ...base, now: () => now });

    const fare = await a.fares.lowestFare("JFK", "LHR", "2026-11-20", "business");
    expect(fare).toBe(1750);
    expect(calls[0].url).toBe("https://test.api.amadeus.com/v1/security/oauth2/token");
    expect(calls[0].init?.method).toBe("POST");
    expect(String(calls[0].init?.body)).toBe("grant_type=client_credentials&client_id=cid&client_secret=sec");
    const offersUrl = new URL(calls[1].url);
    expect(offersUrl.pathname).toBe("/v2/shopping/flight-offers");
    expect(offersUrl.searchParams.get("travelClass")).toBe("BUSINESS");
    expect(offersUrl.searchParams.get("currencyCode")).toBe("USD");
    expect(offersUrl.searchParams.get("max")).toBe("5");
    expect(headerOf(calls[1].init, "Authorization")).toBe("Bearer tok-abc");

    await a.fares.lowestFare("JFK", "CDG", "2026-11-21", "economy");
    expect(calls.filter((c) => c.url.includes("oauth2/token"))).toHaveLength(1);

    now += 1_800_000; // past expiry → refresh
    await a.fares.lowestFare("JFK", "FRA", "2026-11-22", "first");
    expect(calls.filter((c) => c.url.includes("oauth2/token"))).toHaveLength(2);
  });

  it("refreshes the token once on 401", async () => {
    let gets = 0;
    const { fn, calls } = mockFetch((url) => {
      if (url.includes("oauth2/token")) return jsonResponse(TOKEN);
      return gets++ === 0 ? jsonResponse({ errors: [{ status: 401 }] }, 401) : jsonResponse({ data: [{ price: { grandTotal: "500" } }] });
    });
    vi.stubGlobal("fetch", fn);
    const a = createAmadeus(base);
    expect(await a.fares.lowestFare("JFK", "LHR", "2026-11-20", "economy")).toBe(500);
    expect(calls.filter((c) => c.url.includes("oauth2/token"))).toHaveLength(2);
  });

  it("matches live hotels to ours and feeds the lowest offer into quoteHotel", async () => {
    const inputs: HotelQuoteInput[] = [];
    const { fn, calls } = mockFetch((url) => {
      if (url.includes("oauth2/token")) return jsonResponse(TOKEN);
      if (url.includes("/hotels/by-city"))
        return jsonResponse({
          data: [
            { hotelId: "HYPAR002", name: "PARK HYATT PARIS VENDOME", iataCode: "PAR" },
            { hotelId: "HLPAR001", name: "IBIS PARIS BASTILLE", iataCode: "PAR" },
            { hotelId: "MDPAR004", name: "LE MERIDIEN ETOILE", iataCode: "PAR" },
          ],
        });
      if (url.includes("/v3/shopping/hotel-offers"))
        return jsonResponse({
          data: [
            { hotel: { hotelId: "HYPAR002", name: "PARK HYATT PARIS VENDOME" }, available: true, offers: [{ price: { currency: "EUR", total: "1840.00" } }, { price: { currency: "EUR", total: "1600.00" } }] },
            { hotel: { hotelId: "HLPAR001" }, available: true, offers: [{ price: { currency: "EUR", total: "200.00" } }] },
          ],
        });
      return jsonResponse({}, 404);
    });
    vi.stubGlobal("fetch", fn);
    const a = createAmadeus({
      ...base,
      quoteHotel: (input) => {
        inputs.push(input);
        return fixtureQuoteHotel(input);
      },
    });
    const quotes = await a.hotels.search({ city: "Paris", checkIn: "2026-11-20", checkOut: "2026-11-22", guests: 2 });

    const byCity = new URL(calls.find((c) => c.url.includes("by-city"))!.url);
    expect(byCity.searchParams.get("cityCode")).toBe("PAR");
    expect(byCity.searchParams.get("radius")).toBe("20");
    const offers = new URL(calls.find((c) => c.url.includes("hotel-offers"))!.url);
    expect(offers.searchParams.get("hotelIds")?.split(",").sort()).toEqual(["HYPAR002", "MDPAR004"]);
    expect(offers.searchParams.get("checkInDate")).toBe("2026-11-20");
    expect(offers.searchParams.get("adults")).toBe("2");

    expect(quotes).toHaveLength(1); // Méridien had no offer, Ibis isn't ours
    expect(quotes[0].propertyId).toBe("park-hyatt-paris-vendome");
    expect(quotes[0].source).toBe("live");
    expect(inputs).toHaveLength(1);
    // €1 600 for two nights → $869.57/night
    expect(inputs[0].liveCashPerNightUsd).toBeCloseTo(1600 / 0.92 / 2, 2);
    expect(inputs[0].transfers).toEqual(fixtureTransfersTo("world-of-hyatt"));
  });

  it("returns nothing for cities we do not curate", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse(TOKEN)).fn);
    const a = createAmadeus(base);
    expect(await a.hotels.search({ city: "Atlantis", checkIn: "2026-11-20", checkOut: "2026-11-21", guests: 1 })).toEqual([]);
  });
});
