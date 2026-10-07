import type { Cabin } from "@/lib/types";
import { asArray, asNumber, asString, fetchJson, memo, pick } from "./http";
import { STATIC_FX, toUsd } from "./fx";
import { round2 } from "./shared";
import { ProviderError, type CashFareProvider } from "./types";

/**
 * Duffel — cash fares via a synchronous offer request.
 *
 *   POST https://api.duffel.com/air/offer_requests?return_offers=true
 *   Headers: Authorization: Bearer <key>, Duffel-Version: v2
 *   Body: { data: { slices: [{ origin, destination, departure_date }], passengers: [{ type: "adult" }], cabin_class } }
 *
 * Returns the minimum `offers[].total_amount` converted to USD.
 */

export const DUFFEL_ID = "duffel";
export const DUFFEL_URL = "https://api.duffel.com/air/offer_requests?return_offers=true";
export const DUFFEL_VERSION = "v2";

const CABIN_CLASS: Record<Cabin, string> = { economy: "economy", premium: "premium_economy", business: "business", first: "first" };
const FARE_TTL_MS = 10 * 60_000;

export interface DuffelDeps {
  apiKey?: string;
  url?: string;
  rates?: (signal?: AbortSignal) => Promise<Record<string, number>>;
  timeoutMs?: number;
}

export function createDuffelProvider(deps: DuffelDeps = {}): CashFareProvider {
  const url = deps.url ?? DUFFEL_URL;
  const rates = deps.rates ?? (async () => ({ ...STATIC_FX }));
  const enabled = Boolean(deps.apiKey);
  return {
    id: DUFFEL_ID,
    label: "Duffel",
    source: "live",
    enabled,
    requires: enabled ? undefined : "DUFFEL_API_KEY",
    async lowestFare(origin, destination, date, cabin, signal) {
      if (!deps.apiKey) throw new ProviderError(DUFFEL_ID, "not configured (DUFFEL_API_KEY)");
      const o = origin.toUpperCase();
      const d = destination.toUpperCase();
      return memo(`duffel:fare:${o}:${d}:${date}:${cabin}`, FARE_TTL_MS, async () => {
        const body = JSON.stringify({
          data: {
            slices: [{ origin: o, destination: d, departure_date: date }],
            passengers: [{ type: "adult" }],
            cabin_class: CABIN_CLASS[cabin],
          },
        });
        const payload = await fetchJson(
          url,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${deps.apiKey}`,
              "Duffel-Version": DUFFEL_VERSION,
              "Content-Type": "application/json",
              Accept: "application/json",
              "Accept-Encoding": "gzip",
            },
            body,
            signal,
          },
          // Offer requests are slow (airline round-trips) and not idempotent enough to retry.
          { providerId: DUFFEL_ID, timeoutMs: deps.timeoutMs ?? 20_000, retries: 0 },
        );
        const rateTable = await rates(signal);
        let min: number | null = null;
        for (const offer of asArray(pick(payload, "data", "offers"))) {
          const amount = asNumber(pick(offer, "total_amount"));
          if (amount === undefined || amount <= 0) continue;
          const usd = toUsd(amount, asString(pick(offer, "total_currency")) ?? "USD", rateTable);
          if (min === null || usd < min) min = usd;
        }
        return min === null ? null : round2(min);
      });
    },
  };
}
