import type { HotelAwardQuote, HotelProperty, TransferLink } from "@/lib/types";

/** STUB — replaced by the hotels agent. Keep this signature. */
export interface HotelQuoteInput {
  property: HotelProperty;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** Bank → hotel program links to compute transfer options */
  transfers: TransferLink[];
  /** Live cash rate per night if a provider supplied one */
  liveCashPerNightUsd?: number;
}

export function quoteHotel(_input: HotelQuoteInput): HotelAwardQuote {
  const { property, checkIn, checkOut } = _input;
  return {
    propertyId: property.id,
    checkIn,
    checkOut,
    nights: 1,
    pointsPerNight: property.avgPointsPerNight,
    totalPoints: property.avgPointsPerNight,
    cashPerNightUsd: property.avgCashUsd,
    totalCashUsd: property.avgCashUsd,
    cpp: 0,
    valueScore: 50,
    available: true,
    fifthNightFreeApplied: false,
    transferOptions: [],
    source: "simulated",
    fetchedAt: new Date().toISOString(),
  };
}
