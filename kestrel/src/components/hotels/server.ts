import "server-only";

/**
 * Hotel search — server-side resolution.
 *
 * Turns the engine's `HotelAwardQuote`s (property ids only) into the fully-resolved
 * `HotelResult`s the UI renders: property + program joined, value badges, transfer partners
 * named, and — when the user is signed in — a wallet payment plan. Keeps the 170 KB hotel
 * catalogue and the pricing engine off the client.
 */

import { HOTEL_CITIES, getHotel, getHotelCity, hotelsInCity, hotelsNear, type HotelCity } from "@/data/hotels";
import { getHotelProgram } from "@/data/hotel-programs";
import { PROGRAM_BY_ID, getProgram } from "@/data/programs";
import { transfersTo } from "@/data/transfers";
import { compareQuotes, hotelValueBadges, quoteHotel, quoteHotelDetailed } from "@/lib/hotels/engine";
import { searchHotels } from "@/lib/providers";
import { listBalances } from "@/lib/repo/wallet";
import type { Balance, HotelAwardQuote, HotelProperty, TransferOption } from "@/lib/types";
import { haversineMiles } from "@/lib/utils";
import { planPayment } from "@/lib/wallet/affordability";
import type {
  CitySuggestion,
  HotelDetailPayload,
  HotelResult,
  HotelSearchParams,
  HotelSearchResult,
  ResolvedTransfer,
  StayParams,
  WalletContext,
  WalletPlan,
} from "./model";

// ─── Cities ───────────────────────────────────────────────────

/** Curated landing-page destinations, in display order. */
const POPULAR = ["Tokyo", "Paris", "Maldives", "New York", "Bali", "London", "Kyoto", "Dubai"];

/** The property whose artwork represents a city: the priciest one tends to have the best sky. */
function signatureArt(city: string): HotelProperty["art"] | null {
  const hotels = hotelsInCity(city);
  if (!hotels.length) return null;
  return hotels.reduce((best, h) => (h.avgCashUsd > best.avgCashUsd ? h : best), hotels[0]).art;
}

export function citySuggestion(city: HotelCity, distanceMiles?: number): CitySuggestion {
  return {
    ...city,
    hotelCount: hotelsInCity(city.name).length,
    art: signatureArt(city.name),
    ...(distanceMiles != null ? { distanceMiles } : {}),
  };
}

export function popularCities(limit = POPULAR.length): CitySuggestion[] {
  return POPULAR.map((name) => getHotelCity(name))
    .filter((c): c is HotelCity => Boolean(c))
    .slice(0, limit)
    .map((c) => citySuggestion(c));
}

/** Nearest other cities with award hotels, by great-circle distance. */
export function nearbyCities(city: HotelCity, limit = 6): CitySuggestion[] {
  return HOTEL_CITIES.filter((c) => c.name !== city.name)
    .map((c) => ({ c, d: haversineMiles(city.lat, city.lon, c.lat, c.lon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, limit)
    .map(({ c, d }) => citySuggestion(c, d));
}

// ─── Wallet ───────────────────────────────────────────────────

interface Wallet extends WalletContext {
  balances: Balance[];
}

async function loadWallet(userId: string | null): Promise<Wallet> {
  if (!userId) return { signedIn: false, hasBalances: false, balances: [] };
  try {
    const balances = await listBalances(userId);
    return { signedIn: true, hasBalances: balances.some((b) => b.amount > 0), balances };
  } catch (err) {
    console.warn("[hotels] wallet unavailable:", err instanceof Error ? err.message : err);
    return { signedIn: true, hasBalances: false, balances: [] };
  }
}

function walletPlan(programId: string, points: number, wallet: Wallet): WalletPlan | null {
  if (!wallet.signedIn || !wallet.hasBalances || points <= 0) return null;
  const plan = planPayment(programId, points, wallet.balances, transfersTo(programId), PROGRAM_BY_ID);
  return {
    affordable: plan.affordable,
    direct: plan.direct,
    shortfall: plan.shortfall,
    transfers: plan.transfers.map((t) => ({
      from: t.from,
      fromShort: getProgram(t.from)?.shortName ?? t.from,
      sourcePoints: t.sourcePoints,
      destPoints: t.destPoints,
      bonusPercent: t.bonusPercent,
      transferTime: t.transferTime,
    })),
  };
}

// ─── Quotes → results ─────────────────────────────────────────

function resolveTransfer(t: TransferOption): ResolvedTransfer {
  const bank = getProgram(t.bankProgramId);
  return {
    bankId: t.bankProgramId,
    bankName: bank?.name ?? t.bankProgramId,
    bankShort: bank?.shortName ?? t.bankProgramId,
    color: bank?.color ?? "#888888",
    bankPointsNeeded: t.bankPointsNeeded,
    ratio: t.ratio,
    bonusPercent: t.bonusPercent,
    transferTime: t.transferTime,
  };
}

function resolveQuote(quote: HotelAwardQuote, wallet: Wallet, rank: number): HotelResult | null {
  const property = getHotel(quote.propertyId);
  if (!property) return null;
  const program = getHotelProgram(property.programId);
  if (!program) return null;
  return {
    quote,
    property,
    program,
    badges: hotelValueBadges(quote, program),
    transfers: quote.transferOptions.map(resolveTransfer),
    plan: walletPlan(program.id, quote.totalPoints, wallet),
    rank,
  };
}

/** Run a city search through the provider registry and resolve every quote for the UI. */
export async function resolveSearch(query: HotelSearchParams, userId: string | null): Promise<HotelSearchResult> {
  const [search, wallet] = await Promise.all([
    searchHotels({
      city: query.city,
      checkIn: query.checkIn,
      checkOut: query.checkOut,
      guests: query.guests,
      programs: query.programs.length ? query.programs : undefined,
    }),
    loadWallet(userId),
  ]);

  const results = [...search.quotes]
    .sort(compareQuotes)
    .map((q, i) => resolveQuote(q, wallet, i))
    .filter((r): r is HotelResult => r !== null);

  // The query may be an alias or airport code; the results know the canonical city.
  const city = getHotelCity(query.city) ?? (results[0] ? (getHotelCity(results[0].property.city) ?? null) : null);

  return {
    query,
    nights: Math.max(1, results[0]?.quote.nights ?? 1),
    results,
    source: search.source,
    city,
    nearby: city ? nearbyCities(city) : popularCities(6),
    wallet: { signedIn: wallet.signedIn, hasBalances: wallet.hasBalances },
    generatedAt: new Date().toISOString(),
  };
}

/** Everything the detail page needs for one property and stay, nearby comparables included. */
export async function buildHotelDetail(
  property: HotelProperty,
  stay: StayParams,
  userId: string | null,
): Promise<HotelDetailPayload> {
  const wallet = await loadWallet(userId);
  const detail = quoteHotelDetailed({
    property,
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    guests: stay.guests,
    transfers: transfersTo(property.programId),
  });
  const result = resolveQuote(detail.quote, wallet, 0);
  if (!result) throw new Error(`Hotel "${property.id}" has no program`);

  const nearby = hotelsNear(property.lat, property.lon, 15)
    .filter((h) => h.id !== property.id)
    .slice(0, 3)
    .map((h, i) => {
      const quote = quoteHotel({
        property: h,
        checkIn: stay.checkIn,
        checkOut: stay.checkOut,
        guests: stay.guests,
        transfers: transfersTo(h.programId),
      });
      return resolveQuote(quote, wallet, i);
    })
    .filter((r): r is HotelResult => r !== null);

  return {
    stay,
    result,
    nights: detail.nights,
    freeNights: detail.freeNights,
    freePoints: detail.freePoints,
    city: getHotelCity(property.city) ?? null,
    nearby,
    wallet: { signedIn: wallet.signedIn, hasBalances: wallet.hasBalances },
    generatedAt: new Date().toISOString(),
  };
}
