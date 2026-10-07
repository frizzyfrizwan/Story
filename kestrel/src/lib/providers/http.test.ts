import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MEMO_MAX_ENTRIES, asNumber, buildUrl, describeUrl, fetchJson, memo, memoClear, memoSize, pick, splitList } from "./http";
import { ProviderError } from "./types";
import { jsonResponse, mockFetch } from "./test-fixtures";

describe("fetchJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses JSON on success", async () => {
    const { fn } = mockFetch(() => jsonResponse({ ok: 1 }));
    vi.stubGlobal("fetch", fn);
    await expect(fetchJson("https://x.test/a", {}, { providerId: "t" })).resolves.toEqual({ ok: 1 });
  });

  it("retries once on 5xx then succeeds", async () => {
    let n = 0;
    const { fn, calls } = mockFetch(() => (n++ === 0 ? jsonResponse({ error: "boom" }, 503) : jsonResponse({ ok: true })));
    vi.stubGlobal("fetch", fn);
    await expect(fetchJson("https://x.test/a", {}, { providerId: "t", retryDelayMs: 0 })).resolves.toEqual({ ok: true });
    expect(calls).toHaveLength(2);
  });

  it("throws ProviderError with status and does not retry on 4xx", async () => {
    const { fn, calls } = mockFetch(() => jsonResponse({ message: "nope" }, 404, "Not Found"));
    vi.stubGlobal("fetch", fn);
    const err = await fetchJson("https://x.test/a?key=secret", {}, { providerId: "t", retryDelayMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    const pe = err as ProviderError;
    expect(pe.status).toBe(404);
    expect(pe.providerId).toBe("t");
    expect(pe.message).not.toContain("secret");
    expect(calls).toHaveLength(1);
  });

  it("retries network errors, then surfaces a ProviderError", async () => {
    const fn = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    vi.stubGlobal("fetch", fn);
    const err = await fetchJson("https://x.test/a", {}, { providerId: "t", retryDelayMs: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).message).toContain("network error");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("times out via AbortSignal", async () => {
    const fn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fn);
    const err = await fetchJson("https://x.test/slow", {}, { providerId: "t", timeoutMs: 20, retries: 0 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).message).toContain("timed out");
  });

  it("honours the caller's abort signal without retrying", async () => {
    const fn = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fn);
    const controller = new AbortController();
    const p = fetchJson("https://x.test/slow", { signal: controller.signal }, { providerId: "t", timeoutMs: 5_000 });
    controller.abort();
    const err = await p.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).message).toContain("aborted");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid JSON", async () => {
    vi.stubGlobal("fetch", async () => new Response("<html>", { status: 200 }));
    const err = await fetchJson("https://x.test/a", {}, { providerId: "t" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).message).toContain("invalid JSON");
  });
});

describe("memo", () => {
  beforeEach(() => {
    memoClear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-07T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    memoClear();
  });

  it("caches within the TTL and expires after it", async () => {
    const fn = vi.fn(async () => Math.random());
    const a = await memo("k", 1_000, fn);
    const b = await memo("k", 1_000, fn);
    expect(a).toBe(b);
    expect(fn).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-10-07T00:00:02Z"));
    await memo("k", 1_000, fn);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("de-duplicates in-flight calls", async () => {
    let resolve: (v: number) => void = () => undefined;
    const fn = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    const p1 = memo("dedupe", 1_000, fn);
    const p2 = memo("dedupe", 1_000, fn);
    resolve(42);
    expect(await Promise.all([p1, p2])).toEqual([42, 42]);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("does not cache rejections", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (n++ === 0) throw new Error("first");
      return "second";
    });
    await expect(memo("rej", 1_000, fn)).rejects.toThrow("first");
    await expect(memo("rej", 1_000, fn)).resolves.toBe("second");
  });

  it("evicts least-recently-used entries beyond the cap", async () => {
    for (let i = 0; i < MEMO_MAX_ENTRIES + 1; i++) await memo(`lru:${i}`, 60_000, async () => i);
    expect(memoSize()).toBe(MEMO_MAX_ENTRIES);
    // "lru:0" was the oldest and is gone; re-running the producer proves the miss.
    const fn = vi.fn(async () => -1);
    await memo("lru:0", 60_000, fn);
    expect(fn).toHaveBeenCalledTimes(1);
    const fn2 = vi.fn(async () => -2);
    await memo(`lru:${MEMO_MAX_ENTRIES}`, 60_000, fn2);
    expect(fn2).not.toHaveBeenCalled();
  });
});

describe("helpers", () => {
  it("buildUrl skips undefined params and encodes values", () => {
    const url = buildUrl("https://seats.aero/partnerapi", "/search", { origin_airport: "JFK,EWR", take: 500, skip: undefined, flag: true });
    expect(url).toBe("https://seats.aero/partnerapi/search?origin_airport=JFK%2CEWR&take=500&flag=true");
  });

  it("describeUrl strips query strings", () => {
    expect(describeUrl("https://api.test/v1/x?access_key=abc")).toBe("https://api.test/v1/x");
  });

  it("asNumber accepts numeric strings", () => {
    expect(asNumber("70000")).toBe(70000);
    expect(asNumber("1,234.5")).toBe(1234.5);
    expect(asNumber("")).toBeUndefined();
    expect(asNumber(NaN)).toBeUndefined();
  });

  it("pick walks nested paths safely", () => {
    expect(pick({ a: [{ b: 1 }] }, "a", 0, "b")).toBe(1);
    expect(pick({ a: [{ b: 1 }] }, "a", 1, "b")).toBeUndefined();
    expect(pick(null, "a")).toBeUndefined();
  });

  it("splitList trims and upper-cases", () => {
    expect(splitList("ac, ua ,LH,")).toEqual(["AC", "UA", "LH"]);
    expect(splitList(undefined)).toEqual([]);
  });
});
