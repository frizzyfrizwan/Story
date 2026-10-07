import type { FxProvider } from "./types";
import { fetchJson, memo, isRecord, asNumber, pick } from "./http";
import { ProviderError } from "./types";

/**
 * Foreign-exchange rates relative to USD.
 *
 * Order of preference: exchangerate-api v6 (keyed) → open.er-api.com (free,
 * no key) → static table. Live rates are cached 6 h; after a failure we stop
 * hitting the network for 5 minutes and serve the static table.
 */

export const STATIC_FX: Readonly<Record<string, number>> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 150,
  CAD: 1.36,
  AUD: 1.52,
  SGD: 1.34,
  AED: 3.67,
  QAR: 3.64,
  INR: 83.5,
  KRW: 1340,
  HKD: 7.8,
  CHF: 0.88,
  SEK: 10.6,
  THB: 35,
  MXN: 18.2,
  BRL: 5.2,
  TRY: 34,
  ZAR: 18.3,
  NZD: 1.66,
};

export const FX_PROVIDER_ID = "exchangerate-api";
const CACHE_KEY = "fx:rates:usd";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 5 * 60 * 1000;

export interface FxDeps {
  /** exchangerate-api.com v6 key; optional — the free open.er-api.com mirror is used otherwise. */
  apiKey?: string;
  keyedBaseUrl?: string;
  openBaseUrl?: string;
  now?: () => number;
  timeoutMs?: number;
}

/** Convert an amount in `currency` into USD using per-USD rates (static fallback, then 1:1). */
export function toUsd(amount: number, currency: string | undefined, rates: Record<string, number>): number {
  const code = (currency ?? "USD").toUpperCase();
  if (code === "USD") return amount;
  const rate = rates[code] ?? STATIC_FX[code];
  if (!rate || rate <= 0) return amount; // unknown currency: assume parity rather than drop the fee
  return amount / rate;
}

function parseRates(payload: unknown, field: "conversion_rates" | "rates"): Record<string, number> {
  const raw = pick(payload, field);
  if (!isRecord(raw)) throw new ProviderError(FX_PROVIDER_ID, `response missing ${field}`);
  const out: Record<string, number> = { USD: 1 };
  for (const [code, v] of Object.entries(raw)) {
    const n = asNumber(v);
    if (n !== undefined && n > 0) out[code.toUpperCase()] = n;
  }
  if (Object.keys(out).length < 2) throw new ProviderError(FX_PROVIDER_ID, "empty rate table");
  return out;
}

export interface FxProviderWithConvert extends FxProvider {
  /** Convenience: amount in `currency` → USD using the current rate table. */
  convert(amount: number, currency: string | undefined, signal?: AbortSignal): Promise<number>;
}

export function createFxProvider(deps: FxDeps = {}): FxProviderWithConvert {
  const now = deps.now ?? (() => Date.now());
  const keyedBase = deps.keyedBaseUrl ?? "https://v6.exchangerate-api.com/v6";
  const openBase = deps.openBaseUrl ?? "https://open.er-api.com/v6";
  const timeoutMs = deps.timeoutMs ?? 6_000;
  let failedUntil = 0;

  async function fetchLive(signal?: AbortSignal): Promise<Record<string, number>> {
    if (deps.apiKey) {
      const payload = await fetchJson(`${keyedBase}/${encodeURIComponent(deps.apiKey)}/latest/USD`, { signal }, {
        providerId: FX_PROVIDER_ID,
        timeoutMs,
      });
      const result = pick(payload, "result");
      if (result === "error") throw new ProviderError(FX_PROVIDER_ID, String(pick(payload, "error-type") ?? "api error"));
      return parseRates(payload, "conversion_rates");
    }
    const payload = await fetchJson(`${openBase}/latest/USD`, { signal }, { providerId: FX_PROVIDER_ID, timeoutMs });
    const result = pick(payload, "result");
    if (result === "error") throw new ProviderError(FX_PROVIDER_ID, String(pick(payload, "error-type") ?? "api error"));
    return parseRates(payload, "rates");
  }

  async function rates(signal?: AbortSignal): Promise<Record<string, number>> {
    if (now() < failedUntil) return { ...STATIC_FX };
    try {
      return await memo(CACHE_KEY, CACHE_TTL_MS, () => fetchLive(signal));
    } catch {
      failedUntil = now() + FAILURE_BACKOFF_MS;
      return { ...STATIC_FX };
    }
  }

  return {
    id: FX_PROVIDER_ID,
    label: deps.apiKey ? "exchangerate-api (keyed)" : "open.er-api.com (free)",
    source: "live",
    enabled: true,
    requires: deps.apiKey ? undefined : "Optional EXCHANGERATE_API_KEY — falls back to open.er-api.com, then a static table",
    rates,
    async convert(amount, currency, signal) {
      return toUsd(amount, currency, await rates(signal));
    },
  };
}
