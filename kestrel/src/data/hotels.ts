import type { HotelProperty } from "@/lib/types";

/** STUB — replaced by the hotels agent. Keep these exports. */
export const HOTELS: HotelProperty[] = [];

export interface HotelCity {
  name: string;
  countryCode: string;
  /** Nearest major airport */
  airport: string;
  lat: number;
  lon: number;
}

export const HOTEL_CITIES: HotelCity[] = [];

export function hotelsInCity(city: string): HotelProperty[] {
  const c = city.trim().toLowerCase();
  return HOTELS.filter((h) => h.city.toLowerCase() === c);
}

export function getHotel(id: string): HotelProperty | undefined {
  return HOTELS.find((h) => h.id === id);
}

export function searchHotelCities(query: string, limit = 8): HotelCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return HOTEL_CITIES.slice(0, limit);
  return HOTEL_CITIES.filter((c) => c.name.toLowerCase().includes(q)).slice(0, limit);
}
