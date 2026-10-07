import type { Airport, Cabin, HotelAwardQuote, HotelProperty, HotelSearchQuery, TransferLink } from "@/lib/types";
import { getAirport } from "@/data/airports";
import { HOTEL_CITIES, hotelsInCity, type HotelCity } from "@/data/hotels";
import { transfersTo } from "@/data/transfers";
import { quoteHotel } from "@/lib/hotels/engine";
import { daysBetween } from "@/lib/utils";
import { asArray, asNumber, asString, buildUrl, fetchJson, isRecord, memo, pick, type QueryValue } from "./http";
import { STATIC_FX, toUsd } from "./fx";
import { round2 } from "./shared";
import { ProviderError, type CashFareProvider, type HotelProvider } from "./types";

/**
 * Amadeus Self-Service APIs (OAuth2 client credentials).
 *
 *   POST {base}/v1/security/oauth2/token
 *   GET  {base}/v1/reference-data/locations/hotels/by-city?cityCode=PAR&radius=20
 *   GET  {base}/v3/shopping/hotel-offers?hotelIds=&checkInDate=&checkOutDate=&adults=
 *   GET  {base}/v2/shopping/flight-offers?originLocationCode=&destinationLocationCode=&departureDate=&adults=1&travelClass=&currencyCode=USD&max=5
 *
 * `base` is test.api.amadeus.com or api.amadeus.com depending on AMADEUS_ENV.
 *
 * Hotels: live hotels are matched by name similarity to our curated `HOTELS`
 * in that city; the lowest live rate feeds `liveCashPerNightUsd` into
 * `quoteHotel`. Unmatched live hotels are ignored (we cannot price their awards).
 */

export const AMADEUS_HOTELS_ID = "amadeus-hotels";
export const AMADEUS_FARES_ID = "amadeus-fares";
export const AMADEUS_BASES = { test: "https://test.api.amadeus.com", production: "https://api.amadeus.com" } as const;

const TRAVEL_CLASS: Record<Cabin, string> = { economy: "ECONOMY", premium: "PREMIUM_ECONOMY", business: "BUSINESS", first: "FIRST" };
const HOTEL_TTL_MS = 10 * 60_000;
const FARE_TTL_MS = 10 * 60_000;
const HOTEL_IDS_PER_REQUEST = 20;
const MAX_HOTELS = 60;

// ─── Hotel name matching ──────────────────────────────────────

const STOPWORDS = new Set(["hotel", "hotels", "the", "a", "an", "and", "of", "by", "de", "du", "la", "le", "resort", "resorts", "spa", "inn", "suites", "collection"]);

export function normalizeHotelName(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((t) => t && !STOPWORDS.has(t));
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** 0–1 similarity: max of token Jaccard and character-bigram Dice on the normalised names. */
export function hotelNameSimilarity(a: string, b: string): number {
  const ta = normalizeHotelName(a);
  const tb = normalizeHotelName(b);
  if (!ta.length || !tb.length) return 0;
  const sa = new Set(ta);
  const sb = new Set(tb);
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const jaccard = inter / (sa.size + sb.size - inter);
  const ba = bigrams(ta.join(" "));
  const bb = bigrams(tb.join(" "));
  let common = 0;
  for (const g of ba) if (bb.has(g)) common++;
  const dice = ba.size + bb.size ? (2 * common) / (ba.size + bb.size) : 0;
  return Math.max(jaccard, dice);
}

export interface LiveHotel {
  hotelId: string;
  name: string;
}

export interface HotelMatch {
  property: HotelProperty;
  hotelId: string;
  score: number;
}

export const HOTEL_MATCH_THRESHOLD = 0.6;

/** Greedy one-to-one matching of our properties to live hotels by name similarity. */
export function matchHotels(ours: HotelProperty[], live: LiveHotel[], threshold = HOTEL_MATCH_THRESHOLD): HotelMatch[] {
  const pairs: HotelMatch[] = [];
  for (const property of ours) {
    for (const l of live) {
      const score = hotelNameSimilarity(property.name, l.name);
      if (score >= threshold) pairs.push({ property, hotelId: l.hotelId, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);
  const usedProps = new Set<string>();
  const usedIds = new Set<string>();
  const out: HotelMatch[] = [];
  for (const p of pairs) {
    if (usedProps.has(p.property.id) || usedIds.has(p.hotelId)) continue;
    usedProps.add(p.property.id);
    usedIds.add(p.hotelId);
    out.push(p);
  }
  return out;
}

// ─── Client ───────────────────────────────────────────────────

export interface AmadeusDeps {
  clientId?: string;
  clientSecret?: string;
  env?: "test" | "production";
  baseUrl?: string;
  rates?: (signal?: AbortSignal) => Promise<Record<string, number>>;
  now?: () => number;
  timeoutMs?: number;
  hotelCities?: HotelCity[];
  hotelsInCity?: (city: string) => HotelProperty[];
  getAirport?: (iata: string) => Airport | undefined;
  transfersTo?: (programId: string) => TransferLink[];
  quoteHotel?: typeof quoteHotel;
}

export interface AmadeusClient {
  enabled: boolean;
  getToken(signal?: AbortSignal): Promise<string>;
  get<T = unknown>(path: string, params: Record<string, QueryValue>, signal?: AbortSignal): Promise<T>;
}

export interface Amadeus {
  client: AmadeusClient;
  hotels: HotelProvider;
  fares: CashFareProvider;
}

export function createAmadeusClient(deps: AmadeusDeps = {}): AmadeusClient {
  const base = deps.baseUrl ?? AMADEUS_BASES[deps.env ?? "test"];
  const now = deps.now ?? (() => Date.now());
  const timeoutMs = deps.timeoutMs ?? 8_000;
  const enabled = Boolean(deps.clientId && deps.clientSecret);

  let token: { value: string; expiresAt: number } | null = null;
  let pending: Promise<string> | null = null;

  async function getToken(signal?: AbortSignal): Promise<string> {
    if (!enabled) throw new ProviderError("amadeus", "not configured (AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET)");
    if (token && token.expiresAt > now() + 60_000) return token.value;
    if (pending) return pending;
    pending = (async () => {
      try {
        const body = new URLSearchParams({
          grant_type: "client_credentials",
          client_id: deps.clientId ?? "",
          client_secret: deps.clientSecret ?? "",
        }).toString();
        const payload = await fetchJson(
          `${base}/v1/security/oauth2/token`,
          { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal },
          { providerId: "amadeus", timeoutMs },
        );
        const access = asString(pick(payload, "access_token"));
        if (!access) throw new ProviderError("amadeus", "token response missing access_token");
        const expiresIn = asNumber(pick(payload, "expires_in")) ?? 1_799;
        token = { value: access, expiresAt: now() + expiresIn * 1000 };
        return access;
      } finally {
        pending = null;
      }
    })();
    return pending;
  }

  async function get<T = unknown>(path: string, params: Record<string, QueryValue>, signal?: AbortSignal): Promise<T> {
    const url = buildUrl(base, path, params);
    const run = async (bearer: string) =>
      fetchJson<T>(url, { headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" }, signal }, { providerId: "amadeus", timeoutMs });
    try {
      return await run(await getToken(signal));
    } catch (e) {
      if (e instanceof ProviderError && e.status === 401) {
        token = null; // token revoked early — refresh once
        return run(await getToken(signal));
      }
      throw e;
    }
  }

  return { enabled, getToken, get };
}

interface LiveOffer {
  hotelId: string;
  total: number;
  currency: string;
}

function lowestOffer(item: unknown): LiveOffer | null {
  if (!isRecord(item)) return null;
  const hotelId = asString(pick(item, "hotel", "hotelId"));
  if (!hotelId) return null;
  let best: LiveOffer | null = null;
  for (const offer of asArray(item.offers)) {
    const total = asNumber(pick(offer, "price", "total")) ?? asNumber(pick(offer, "price", "base"));
    if (total === undefined || total <= 0) continue;
    const currency = (asString(pick(offer, "price", "currency")) ?? "USD").toUpperCase();
    if (!best || total < best.total) best = { hotelId, total, currency };
  }
  return best;
}

export function createAmadeus(deps: AmadeusDeps = {}): Amadeus {
  const client = createAmadeusClient(deps);
  const rates = deps.rates ?? (async () => ({ ...STATIC_FX }));
  const cities = deps.hotelCities ?? HOTEL_CITIES;
  const hotelsIn = deps.hotelsInCity ?? hotelsInCity;
  const airportOf = deps.getAirport ?? getAirport;
  const transfers = deps.transfersTo ?? transfersTo;
  const quote = deps.quoteHotel ?? quoteHotel;
  const requires = client.enabled ? undefined : "AMADEUS_CLIENT_ID + AMADEUS_CLIENT_SECRET";

  /** Our city name → IATA city code (metro of the nearest airport, else the airport code). */
  function cityCodeFor(city: string): string | undefined {
    const c = city.trim().toLowerCase();
    const entry = cities.find((x) => x.name.toLowerCase() === c);
    if (!entry) return undefined;
    return airportOf(entry.airport)?.metro ?? entry.airport.toUpperCase();
  }

  const hotels: HotelProvider = {
    id: AMADEUS_HOTELS_ID,
    label: "Amadeus hotel offers",
    source: "live",
    enabled: client.enabled,
    requires,
    async search(query: HotelSearchQuery, signal?: AbortSignal): Promise<HotelAwardQuote[]> {
      if (!client.enabled) throw new ProviderError(AMADEUS_HOTELS_ID, "not configured");
      const cityCode = cityCodeFor(query.city);
      const ours = hotelsIn(query.city);
      if (!cityCode || !ours.length) return [];
      const key = `amadeus:hotels:${cityCode}:${query.checkIn}:${query.checkOut}:${query.guests}`;
      return memo(key, HOTEL_TTL_MS, async () => {
        const list = await client.get("/v1/reference-data/locations/hotels/by-city", { cityCode, radius: 20, radiusUnit: "KM" }, signal);
        const live: LiveHotel[] = asArray(pick(list, "data"))
          .map((h) => ({ hotelId: asString(pick(h, "hotelId")) ?? "", name: asString(pick(h, "name")) ?? "" }))
          .filter((h) => h.hotelId && h.name);
        const matches = matchHotels(ours, live).slice(0, MAX_HOTELS);
        if (!matches.length) return [];

        const batches: string[][] = [];
        for (let i = 0; i < matches.length; i += HOTEL_IDS_PER_REQUEST) batches.push(matches.slice(i, i + HOTEL_IDS_PER_REQUEST).map((m) => m.hotelId));
        const settled = await Promise.allSettled(
          batches.map((ids) =>
            client.get("/v3/shopping/hotel-offers", {
              hotelIds: ids.join(","),
              checkInDate: query.checkIn,
              checkOutDate: query.checkOut,
              adults: Math.max(1, query.guests),
              roomQuantity: 1,
              currency: "USD",
              bestRateOnly: true,
            }, signal),
          ),
        );
        const offers = new Map<string, LiveOffer>();
        for (const s of settled) {
          if (s.status !== "fulfilled") continue;
          for (const item of asArray(pick(s.value, "data"))) {
            const o = lowestOffer(item);
            if (o) offers.set(o.hotelId, o);
          }
        }
        if (!offers.size) return [];

        const rateTable = await rates(signal);
        const nights = Math.max(1, daysBetween(query.checkIn, query.checkOut));
        const quotes: HotelAwardQuote[] = [];
        for (const m of matches) {
          const o = offers.get(m.hotelId);
          if (!o) continue;
          const liveCashPerNightUsd = round2(toUsd(o.total, o.currency, rateTable) / nights);
          const q = quote({
            property: m.property,
            checkIn: query.checkIn,
            checkOut: query.checkOut,
            guests: query.guests,
            transfers: transfers(m.property.programId),
            liveCashPerNightUsd,
          });
          quotes.push({ ...q, source: "live" });
        }
        return quotes.sort((a, b) => b.valueScore - a.valueScore);
      });
    },
  };

  const fares: CashFareProvider = {
    id: AMADEUS_FARES_ID,
    label: "Amadeus flight offers",
    source: "live",
    enabled: client.enabled,
    requires,
    async lowestFare(origin, destination, date, cabin, signal) {
      if (!client.enabled) throw new ProviderError(AMADEUS_FARES_ID, "not configured");
      const o = origin.toUpperCase();
      const d = destination.toUpperCase();
      return memo(`amadeus:fare:${o}:${d}:${date}:${cabin}`, FARE_TTL_MS, async () => {
        const payload = await client.get("/v2/shopping/flight-offers", {
          originLocationCode: o,
          destinationLocationCode: d,
          departureDate: date,
          adults: 1,
          travelClass: TRAVEL_CLASS[cabin],
          currencyCode: "USD",
          max: 5,
        }, signal);
        const rateTable = await rates(signal);
        let min: number | null = null;
        for (const offer of asArray(pick(payload, "data"))) {
          const total = asNumber(pick(offer, "price", "grandTotal")) ?? asNumber(pick(offer, "price", "total"));
          if (total === undefined || total <= 0) continue;
          const usd = toUsd(total, asString(pick(offer, "price", "currency")) ?? "USD", rateTable);
          if (min === null || usd < min) min = usd;
        }
        return min === null ? null : round2(min);
      });
    },
  };

  return { client, hotels, fares };
}
