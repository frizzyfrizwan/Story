import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createDuffelProvider } from "./duffel";
import { memoClear } from "./http";
import { headerOf, jsonResponse, mockFetch } from "./test-fixtures";

describe("Duffel", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  it("is disabled without a key", () => {
    const p = createDuffelProvider({});
    expect(p.enabled).toBe(false);
    expect(p.requires).toBe("DUFFEL_API_KEY");
  });

  it("posts an offer request and returns the lowest total in USD", async () => {
    const { fn, calls } = mockFetch(() =>
      jsonResponse({
        data: {
          id: "orq_1",
          offers: [
            { id: "off_1", total_amount: "2450.10", total_currency: "USD" },
            { id: "off_2", total_amount: "1840.00", total_currency: "GBP" },
            { id: "off_3", total_amount: "2100.00", total_currency: "USD" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fn);
    const p = createDuffelProvider({ apiKey: "duffel_test_x", rates: async () => ({ USD: 1, GBP: 0.8 }) });
    const fare = await p.lowestFare("jfk", "lhr", "2026-11-20", "business");
    expect(fare).toBe(2100);
    expect(calls[0].url).toBe("https://api.duffel.com/air/offer_requests?return_offers=true");
    expect(calls[0].init?.method).toBe("POST");
    expect(headerOf(calls[0].init, "Authorization")).toBe("Bearer duffel_test_x");
    expect(headerOf(calls[0].init, "Duffel-Version")).toBe("v2");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({
      data: { slices: [{ origin: "JFK", destination: "LHR", departure_date: "2026-11-20" }], passengers: [{ type: "adult" }], cabin_class: "business" },
    });
    await p.lowestFare("JFK", "LHR", "2026-11-20", "business");
    expect(calls).toHaveLength(1); // memoised
  });

  it("returns null when there are no offers and maps premium economy", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ data: { offers: [] } }));
    vi.stubGlobal("fetch", fn);
    const p = createDuffelProvider({ apiKey: "k" });
    expect(await p.lowestFare("JFK", "LHR", "2026-11-20", "premium")).toBeNull();
    expect(JSON.parse(String(calls[0].init?.body)).data.cabin_class).toBe("premium_economy");
  });
});
