import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATIC_FX, createFxProvider, toUsd } from "./fx";
import { memoClear } from "./http";
import { jsonResponse, mockFetch } from "./test-fixtures";

describe("fx provider", () => {
  beforeEach(() => memoClear());
  afterEach(() => {
    vi.unstubAllGlobals();
    memoClear();
  });

  it("uses the keyed exchangerate-api endpoint when a key is present", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ result: "success", conversion_rates: { USD: 1, EUR: 0.9, JPY: "149.5" } }));
    vi.stubGlobal("fetch", fn);
    const fx = createFxProvider({ apiKey: "abc" });
    const rates = await fx.rates();
    expect(calls[0].url).toBe("https://v6.exchangerate-api.com/v6/abc/latest/USD");
    expect(rates).toEqual({ USD: 1, EUR: 0.9, JPY: 149.5 });
    expect(fx.enabled).toBe(true);
  });

  it("falls back to open.er-api.com without a key and caches the result", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ result: "success", rates: { USD: 1, GBP: 0.8 } }));
    vi.stubGlobal("fetch", fn);
    const fx = createFxProvider();
    await fx.rates();
    await fx.rates();
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://open.er-api.com/v6/latest/USD");
    expect(fx.requires).toContain("EXCHANGERATE_API_KEY");
  });

  it("serves the static table when the network fails, then backs off", async () => {
    let now = Date.parse("2026-10-07T00:00:00Z");
    const fn = vi.fn(async () => jsonResponse({ result: "error", "error-type": "quota" }, 500));
    vi.stubGlobal("fetch", fn);
    const fx = createFxProvider({ now: () => now });
    const rates = await fx.rates();
    expect(rates).toEqual(STATIC_FX);
    expect(fn).toHaveBeenCalledTimes(2); // one retry
    await fx.rates();
    expect(fn).toHaveBeenCalledTimes(2); // in back-off window: no new request
    now += 6 * 60_000;
    await fx.rates();
    expect(fn).toHaveBeenCalledTimes(4); // retried after the window
  });

  it("converts to USD with live, static, then parity fallback", async () => {
    expect(toUsd(100, "USD", {})).toBe(100);
    expect(toUsd(92, "EUR", { EUR: 0.92 })).toBeCloseTo(100);
    expect(toUsd(150, "JPY", {})).toBeCloseTo(1); // static table
    expect(toUsd(10, "XYZ", {})).toBe(10); // unknown currency → 1:1
    expect(toUsd(5, undefined, {})).toBe(5);
  });

  it("convert() uses the fetched table", async () => {
    vi.stubGlobal("fetch", mockFetch(() => jsonResponse({ rates: { USD: 1, CAD: 2 } })).fn);
    const fx = createFxProvider();
    expect(await fx.convert(10, "CAD")).toBe(5);
  });
});
