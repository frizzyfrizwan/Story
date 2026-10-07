import type { HotelProperty } from "@/lib/types";
import { haversineMiles, slugify } from "@/lib/utils";
import {
  ACCOR_EUR_PER_BLOCK,
  ACCOR_POINTS_PER_BLOCK,
  USD_TO_EUR,
  hyattPoints,
} from "@/data/hotel-programs";

/**
 * Curated hotel reference data: ~190 real, points-bookable properties across ~55 cities.
 *
 * Cash rates are editorial 2025 average daily rates (standard room, USD). Points are the
 * program's standard-season rate for Hyatt, a typical dynamic rate for Marriott/Hilton/IHG,
 * the fixed tier for Wyndham/Choice and the cash-equivalent block for Accor. The award
 * engine (`src/lib/hotels/engine.ts`) layers seasonality, demand noise and availability
 * on top of these anchors.
 */

export interface HotelCity {
  name: string;
  countryCode: string;
  /** Nearest major airport */
  airport: string;
  lat: number;
  lon: number;
  /** Leisure destination — weekends price as peak and resort fees apply */
  resort?: boolean;
  /** Months (1–12) that price as peak season for this destination */
  peakMonths?: number[];
  /** Months (1–12) where weekday nights price as off-peak */
  lowMonths?: number[];
  /** Alternate names people search by, e.g. "Malé", "NYC" */
  aliases?: string[];
}

export const HOTEL_CITIES: HotelCity[] = [
  // ── Asia-Pacific ────────────────────────────────────────────────
  { name: "Tokyo", countryCode: "JP", airport: "HND", lat: 35.6762, lon: 139.6503, peakMonths: [3, 4, 11], lowMonths: [1, 2, 6] },
  { name: "Kyoto", countryCode: "JP", airport: "KIX", lat: 35.0116, lon: 135.7681, peakMonths: [3, 4, 11], lowMonths: [1, 2, 6, 7], aliases: ["Osaka"] },
  { name: "Seoul", countryCode: "KR", airport: "ICN", lat: 37.5665, lon: 126.978, peakMonths: [4, 5, 10], lowMonths: [1, 2, 7] },
  { name: "Hong Kong", countryCode: "HK", airport: "HKG", lat: 22.3193, lon: 114.1694, peakMonths: [10, 11, 12], lowMonths: [6, 7, 8] },
  { name: "Singapore", countryCode: "SG", airport: "SIN", lat: 1.3521, lon: 103.8198, peakMonths: [9, 12], lowMonths: [5, 6] },
  { name: "Bangkok", countryCode: "TH", airport: "BKK", lat: 13.7563, lon: 100.5018, peakMonths: [12, 1, 2], lowMonths: [6, 7, 8, 9] },
  { name: "Ho Chi Minh City", countryCode: "VN", airport: "SGN", lat: 10.7769, lon: 106.7009, peakMonths: [12, 1, 2, 3], lowMonths: [6, 7, 8, 9], aliases: ["Saigon"] },
  { name: "Hanoi", countryCode: "VN", airport: "HAN", lat: 21.0278, lon: 105.8342, peakMonths: [10, 11, 12, 3], lowMonths: [6, 7, 8] },
  { name: "Da Nang", countryCode: "VN", airport: "DAD", lat: 16.0544, lon: 108.2022, resort: true, peakMonths: [5, 6, 7, 8], lowMonths: [10, 11, 12], aliases: ["Danang", "Hoi An"] },
  { name: "Bali", countryCode: "ID", airport: "DPS", lat: -8.6705, lon: 115.2126, resort: true, peakMonths: [7, 8, 12], lowMonths: [1, 2, 3], aliases: ["Denpasar", "Uluwatu", "Nusa Dua"] },
  { name: "Maldives", countryCode: "MV", airport: "MLE", lat: 4.1755, lon: 73.5093, resort: true, peakMonths: [12, 1, 2, 3, 4], lowMonths: [5, 6, 9, 10], aliases: ["Malé", "Male"] },
  { name: "Mumbai", countryCode: "IN", airport: "BOM", lat: 19.076, lon: 72.8777, peakMonths: [11, 12, 1, 2], lowMonths: [5, 6, 7, 8] },
  { name: "Delhi", countryCode: "IN", airport: "DEL", lat: 28.6139, lon: 77.209, peakMonths: [10, 11, 12, 2], lowMonths: [5, 6, 7, 8], aliases: ["New Delhi"] },
  { name: "Hyderabad", countryCode: "IN", airport: "HYD", lat: 17.385, lon: 78.4867, peakMonths: [11, 12, 1], lowMonths: [5, 6, 7] },
  { name: "Sydney", countryCode: "AU", airport: "SYD", lat: -33.8688, lon: 151.2093, peakMonths: [12, 1, 2], lowMonths: [5, 6, 8] },
  { name: "Bora Bora", countryCode: "PF", airport: "BOB", lat: -16.5004, lon: -151.7415, resort: true, peakMonths: [6, 7, 8, 12], lowMonths: [1, 2, 3], aliases: ["Tahiti", "French Polynesia"] },
  // ── Hawaii ─────────────────────────────────────────────────────
  { name: "Maui", countryCode: "US", airport: "OGG", lat: 20.7984, lon: -156.3319, resort: true, peakMonths: [6, 7, 8, 12, 1, 2], lowMonths: [4, 5, 9, 10], aliases: ["Wailea", "Kaanapali", "Kapalua", "Hawaii"] },
  { name: "Kauai", countryCode: "US", airport: "LIH", lat: 21.9811, lon: -159.3711, resort: true, peakMonths: [6, 7, 8, 12, 1], lowMonths: [4, 5, 9, 10], aliases: ["Poipu", "Hawaii"] },
  { name: "Honolulu", countryCode: "US", airport: "HNL", lat: 21.3069, lon: -157.8583, resort: true, peakMonths: [6, 7, 8, 12, 1], lowMonths: [4, 5, 9, 10], aliases: ["Oahu", "Waikiki", "Hawaii"] },
  // ── Middle East & Africa ───────────────────────────────────────
  { name: "Dubai", countryCode: "AE", airport: "DXB", lat: 25.2048, lon: 55.2708, resort: true, peakMonths: [11, 12, 1, 2, 3], lowMonths: [6, 7, 8] },
  { name: "Doha", countryCode: "QA", airport: "DOH", lat: 25.2854, lon: 51.531, peakMonths: [11, 12, 1, 2, 3], lowMonths: [6, 7, 8] },
  { name: "Cairo", countryCode: "EG", airport: "CAI", lat: 30.0444, lon: 31.2357, peakMonths: [11, 12, 1, 2, 3], lowMonths: [6, 7, 8], aliases: ["Giza"] },
  { name: "Cape Town", countryCode: "ZA", airport: "CPT", lat: -33.9249, lon: 18.4241, peakMonths: [12, 1, 2, 3], lowMonths: [5, 6, 7, 8] },
  { name: "Zanzibar", countryCode: "TZ", airport: "ZNZ", lat: -6.1659, lon: 39.2026, resort: true, peakMonths: [7, 8, 12, 1], lowMonths: [4, 5], aliases: ["Stone Town", "Tanzania"] },
  { name: "Istanbul", countryCode: "TR", airport: "IST", lat: 41.0082, lon: 28.9784, peakMonths: [5, 6, 9, 10], lowMonths: [1, 2] },
  // ── Europe ─────────────────────────────────────────────────────
  { name: "London", countryCode: "GB", airport: "LHR", lat: 51.5072, lon: -0.1276, peakMonths: [6, 7, 9, 12], lowMonths: [1, 2, 11] },
  { name: "Paris", countryCode: "FR", airport: "CDG", lat: 48.8566, lon: 2.3522, peakMonths: [6, 7, 9, 10], lowMonths: [1, 2, 11] },
  { name: "Amsterdam", countryCode: "NL", airport: "AMS", lat: 52.3676, lon: 4.9041, peakMonths: [4, 5, 7, 8], lowMonths: [1, 2, 11] },
  { name: "Lisbon", countryCode: "PT", airport: "LIS", lat: 38.7223, lon: -9.1393, peakMonths: [6, 7, 8, 9], lowMonths: [1, 2, 11] },
  { name: "Madrid", countryCode: "ES", airport: "MAD", lat: 40.4168, lon: -3.7038, peakMonths: [5, 6, 9, 10], lowMonths: [1, 2, 8] },
  { name: "Barcelona", countryCode: "ES", airport: "BCN", lat: 41.3874, lon: 2.1686, peakMonths: [6, 7, 8, 9], lowMonths: [1, 2, 11] },
  { name: "Rome", countryCode: "IT", airport: "FCO", lat: 41.9028, lon: 12.4964, peakMonths: [5, 6, 9, 10], lowMonths: [1, 2, 11] },
  { name: "Milan", countryCode: "IT", airport: "MXP", lat: 45.4642, lon: 9.19, peakMonths: [4, 6, 9], lowMonths: [1, 8] },
  { name: "Vienna", countryCode: "AT", airport: "VIE", lat: 48.2082, lon: 16.3738, peakMonths: [5, 6, 9, 12], lowMonths: [1, 2, 11] },
  { name: "Zurich", countryCode: "CH", airport: "ZRH", lat: 47.3769, lon: 8.5417, peakMonths: [6, 7, 8, 9], lowMonths: [1, 2, 11] },
  // ── Americas ───────────────────────────────────────────────────
  { name: "New York", countryCode: "US", airport: "JFK", lat: 40.7128, lon: -74.006, peakMonths: [9, 10, 11, 12], lowMonths: [1, 2, 7, 8], aliases: ["NYC", "Manhattan"] },
  { name: "Chicago", countryCode: "US", airport: "ORD", lat: 41.8781, lon: -87.6298, peakMonths: [6, 7, 8, 9], lowMonths: [1, 2] },
  { name: "Washington", countryCode: "US", airport: "IAD", lat: 38.9072, lon: -77.0369, peakMonths: [3, 4, 5, 9, 10], lowMonths: [1, 2, 7, 8], aliases: ["Washington DC", "DC"] },
  { name: "Los Angeles", countryCode: "US", airport: "LAX", lat: 34.0522, lon: -118.2437, peakMonths: [6, 7, 8, 9], lowMonths: [1, 2], aliases: ["LA", "Beverly Hills", "West Hollywood"] },
  { name: "Orange County", countryCode: "US", airport: "SNA", lat: 33.6603, lon: -117.9992, resort: true, peakMonths: [6, 7, 8], lowMonths: [1, 2, 11], aliases: ["Huntington Beach", "Laguna", "Dana Point"] },
  { name: "San Diego", countryCode: "US", airport: "SAN", lat: 32.7157, lon: -117.1611, resort: true, peakMonths: [6, 7, 8], lowMonths: [1, 2, 11], aliases: ["Encinitas", "Coronado"] },
  { name: "San Francisco", countryCode: "US", airport: "SFO", lat: 37.7749, lon: -122.4194, peakMonths: [6, 7, 8, 9, 10], lowMonths: [1, 2, 12] },
  { name: "Big Sur", countryCode: "US", airport: "MRY", lat: 36.2704, lon: -121.8081, resort: true, peakMonths: [6, 7, 8, 9], lowMonths: [1, 2, 12], aliases: ["Monterey", "Carmel"] },
  { name: "Miami", countryCode: "US", airport: "MIA", lat: 25.7617, lon: -80.1918, resort: true, peakMonths: [12, 1, 2, 3], lowMonths: [8, 9, 10], aliases: ["Miami Beach", "South Beach", "Bal Harbour"] },
  { name: "Las Vegas", countryCode: "US", airport: "LAS", lat: 36.1699, lon: -115.1398, resort: true, peakMonths: [3, 10], lowMonths: [7, 8, 12] },
  { name: "Austin", countryCode: "US", airport: "AUS", lat: 30.2672, lon: -97.7431, peakMonths: [3, 10], lowMonths: [1, 7, 8] },
  { name: "Scottsdale", countryCode: "US", airport: "PHX", lat: 33.4942, lon: -111.9261, resort: true, peakMonths: [2, 3, 4], lowMonths: [6, 7, 8], aliases: ["Phoenix"] },
  { name: "Tucson", countryCode: "US", airport: "TUS", lat: 32.2226, lon: -110.9747, resort: true, peakMonths: [2, 3, 4], lowMonths: [6, 7, 8] },
  { name: "Vail", countryCode: "US", airport: "EGE", lat: 39.6403, lon: -106.3742, resort: true, peakMonths: [12, 1, 2, 3], lowMonths: [4, 5, 10, 11], aliases: ["Beaver Creek", "Avon", "Colorado"] },
  { name: "Lake Tahoe", countryCode: "US", airport: "RNO", lat: 39.2385, lon: -120.0245, resort: true, peakMonths: [12, 1, 2, 7, 8], lowMonths: [4, 5, 10, 11], aliases: ["Tahoe", "Truckee"] },
  { name: "Lenox", countryCode: "US", airport: "BDL", lat: 42.3565, lon: -73.2851, resort: true, peakMonths: [7, 8, 10], lowMonths: [3, 4, 11], aliases: ["Berkshires", "Massachusetts"] },
  { name: "Cancún", countryCode: "MX", airport: "CUN", lat: 21.1619, lon: -86.8515, resort: true, peakMonths: [12, 1, 2, 3], lowMonths: [9, 10], aliases: ["Cancun", "Riviera Maya"] },
  { name: "Playa del Carmen", countryCode: "MX", airport: "CUN", lat: 20.6296, lon: -87.0739, resort: true, peakMonths: [12, 1, 2, 3], lowMonths: [9, 10], aliases: ["Mayakoba", "Riviera Maya", "Tulum"] },
  { name: "Cabo San Lucas", countryCode: "MX", airport: "SJD", lat: 22.8905, lon: -109.9167, resort: true, peakMonths: [12, 1, 2, 3], lowMonths: [8, 9], aliases: ["Los Cabos", "Cabo", "San José del Cabo"] },
  { name: "Mexico City", countryCode: "MX", airport: "MEX", lat: 19.4326, lon: -99.1332, peakMonths: [10, 11, 12], lowMonths: [7, 8], aliases: ["CDMX"] },
  { name: "Liberia", countryCode: "CR", airport: "LIR", lat: 10.6346, lon: -85.4377, resort: true, peakMonths: [12, 1, 2, 3], lowMonths: [9, 10], aliases: ["Costa Rica", "Guanacaste", "Papagayo"] },
  { name: "Buenos Aires", countryCode: "AR", airport: "EZE", lat: -34.6037, lon: -58.3816, peakMonths: [11, 12, 1, 2], lowMonths: [6, 7] },
  { name: "Rio de Janeiro", countryCode: "BR", airport: "GIG", lat: -22.9068, lon: -43.1729, resort: true, peakMonths: [12, 1, 2], lowMonths: [6, 7], aliases: ["Rio", "Copacabana"] },
];

const CITY_BY_NAME: Record<string, HotelCity> = Object.fromEntries(HOTEL_CITIES.map((c) => [c.name.toLowerCase(), c]));

export function getHotelCity(name: string): HotelCity | undefined {
  return CITY_BY_NAME[name.trim().toLowerCase()];
}

// ─── Seed format ────────────────────────────────────────────────

type HotelProgramId =
  | "world-of-hyatt"
  | "marriott-bonvoy"
  | "hilton-honors"
  | "ihg-one-rewards"
  | "accor-all"
  | "choice-privileges"
  | "wyndham-rewards";

type Motif = HotelProperty["art"]["motif"];

interface HotelSeed {
  name: string;
  brand: string;
  program: HotelProgramId;
  city: string;
  lat: number;
  lon: number;
  /** Hyatt 1–8 award category */
  category?: number;
  stars: 3 | 4 | 5;
  tier: HotelProperty["tier"];
  /** Typical 2025 ADR in USD */
  cash: number;
  /** Typical points per night; derived from the chart for Hyatt and Accor when omitted */
  points?: number;
  description: string;
  amenities: string[];
  vibe: string[];
  art: [from: string, to: string, motif: Motif];
}

function accorPoints(cashUsd: number): number {
  return Math.ceil((cashUsd * USD_TO_EUR) / ACCOR_EUR_PER_BLOCK) * ACCOR_POINTS_PER_BLOCK;
}

function toProperty(seed: HotelSeed): HotelProperty {
  const city = CITY_BY_NAME[seed.city.toLowerCase()];
  if (!city) throw new Error(`Hotel seed "${seed.name}" references unknown city "${seed.city}"`);
  let points = seed.points;
  if (points == null) {
    if (seed.program === "world-of-hyatt" && seed.category) points = hyattPoints(seed.category);
    else if (seed.program === "accor-all") points = accorPoints(seed.cash);
    else throw new Error(`Hotel seed "${seed.name}" needs an explicit points value`);
  }
  return {
    id: slugify(seed.name),
    name: seed.name,
    brand: seed.brand,
    programId: seed.program,
    city: city.name,
    countryCode: city.countryCode,
    lat: seed.lat,
    lon: seed.lon,
    category: seed.category,
    stars: seed.stars,
    tier: seed.tier,
    avgCashUsd: seed.cash,
    avgPointsPerNight: points,
    description: seed.description,
    amenities: seed.amenities,
    vibe: seed.vibe,
    art: { from: seed.art[0], to: seed.art[1], motif: seed.art[2] },
  };
}

const SEEDS: HotelSeed[] = [
  // ── Tokyo ──────────────────────────────────────────────────────
  {
    name: "Park Hyatt Tokyo", brand: "Park Hyatt", program: "world-of-hyatt", city: "Tokyo", lat: 35.6857, lon: 139.6906,
    category: 7, stars: 5, tier: "luxury", cash: 1100,
    description: "The Lost in Translation hotel occupies the top 14 floors of Kenzo Tange's Shinjuku Park Tower, with Mount Fuji views from the pool and the New York Bar. A floor-to-ceiling 2024–25 renovation refreshed the 1994 interiors without touching the hushed, library-like atmosphere.",
    amenities: ["Rooftop pool", "Spa", "Fitness center", "New York Bar", "Club lounge", "Library", "Concierge"],
    vibe: ["iconic", "serene", "skyline views", "design"], art: ["#141a33", "#d96b8a", "skyline"],
  },
  {
    name: "Andaz Tokyo Toranomon Hills", brand: "Andaz", program: "world-of-hyatt", city: "Tokyo", lat: 35.6671, lon: 139.7494,
    category: 6, stars: 5, tier: "luxury", cash: 620,
    description: "Floors 47–52 of Toranomon Hills, with a glass-walled rooftop bar and a chapel that doubles as an event space with Tokyo Tower straight ahead. Rooms mix washi paper, oak and tatami-style sitting nooks, and the AO Spa has a 37th-floor pool.",
    amenities: ["Rooftop bar", "Indoor pool", "AO Spa", "Fitness center", "Three restaurants", "Free minibar snacks"],
    vibe: ["modern", "rooftop", "design", "central"], art: ["#1c2541", "#8fd3f4", "skyline"],
  },
  {
    name: "Hyatt Regency Tokyo", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Tokyo", lat: 35.6898, lon: 139.6917,
    category: 4, stars: 4, tier: "upscale", cash: 290,
    description: "A 746-room Shinjuku workhorse beside Tokyo Metropolitan Government Building with a dramatic chandelier-hung atrium lobby. Rooms are large by Tokyo standards and the Regency Club lounge makes it one of the best mid-tier Hyatt redemptions in Japan.",
    amenities: ["Regency Club", "Indoor pool", "Fitness center", "Six restaurants", "Spa", "Concierge"],
    vibe: ["business", "spacious", "central", "value"], art: ["#223047", "#9bb7d4", "skyline"],
  },
  {
    name: "Conrad Tokyo", brand: "Conrad", program: "hilton-honors", city: "Tokyo", lat: 35.6632, lon: 139.7597,
    stars: 5, tier: "luxury", cash: 640, points: 95000,
    description: "Floors 28–37 of the Tokyo Shiodome Building, where bay-view rooms look across Hamarikyu Gardens to Tokyo Bay and Rainbow Bridge. Twenty-eight Café's afternoon tea and the Mizuki Spa pool are the draws, and Diamond members get reliable suite upgrades.",
    amenities: ["Indoor pool", "Mizuki Spa", "Executive lounge", "Fitness center", "Gordon Ramsay restaurant", "Concierge"],
    vibe: ["bay views", "elegant", "upgrades", "modern"], art: ["#0f2a44", "#5fa8d3", "skyline"],
  },
  {
    name: "The Ritz-Carlton, Tokyo", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Tokyo", lat: 35.6655, lon: 139.7302,
    stars: 5, tier: "luxury", cash: 1150, points: 140000,
    description: "The top nine floors of Midtown Tower, the tallest building in Roppongi, with Fuji-facing suites and a 46th-floor lobby bar that sets the tone. Expect jewel-box interiors, a Michelin-starred French dining room and a club lounge that justifies the premium.",
    amenities: ["Club lounge", "Indoor pool", "Spa", "Fitness center", "Michelin dining", "Butler service"],
    vibe: ["opulent", "skyline views", "classic luxury", "roppongi"], art: ["#1a1f3a", "#c9a24f", "skyline"],
  },
  {
    name: "Hilton Tokyo", brand: "Hilton", program: "hilton-honors", city: "Tokyo", lat: 35.6927, lon: 139.6919,
    stars: 4, tier: "upscale", cash: 320, points: 65000,
    description: "A 1984 Shinjuku tower with shoji-screened rooms, a quiet executive lounge and a free shuttle to Shinjuku station. It is the dependable Hilton points play in Tokyo, especially when Gold or Diamond breakfast is factored in.",
    amenities: ["Executive lounge", "Indoor pool", "Fitness center", "Tennis court", "Five restaurants", "Shuttle"],
    vibe: ["business", "reliable", "shinjuku", "value"], art: ["#2b3a55", "#7fa6c9", "skyline"],
  },
  {
    name: "The Tokyo EDITION, Toranomon", brand: "EDITION", program: "marriott-bonvoy", city: "Tokyo", lat: 35.6668, lon: 139.7469,
    stars: 5, tier: "luxury", cash: 600, points: 95000,
    description: "Ian Schrager's first Tokyo project, with a 31st-floor lobby lounge wrapped in greenery and a Gold Bar that fills with Toranomon's creative crowd. Rooms are minimalist in blond wood and marble, and Tokyo Tower lights up most of them at night.",
    amenities: ["Gold Bar", "Spa", "Fitness center", "Indoor pool", "Rooftop terrace", "Concierge"],
    vibe: ["nightlife", "design", "fashionable", "tokyo tower views"], art: ["#101418", "#f0a35e", "skyline"],
  },
  // ── Kyoto ──────────────────────────────────────────────────────
  {
    name: "Park Hyatt Kyoto", brand: "Park Hyatt", program: "world-of-hyatt", city: "Kyoto", lat: 34.9986, lon: 135.7824,
    category: 8, stars: 5, tier: "luxury", cash: 1300,
    description: "Seventy rooms terraced into the Higashiyama hillside beside Kodaiji Temple, with the Yasaka Pagoda framed from the Living Room lounge. Shared gardens with the 140-year-old Kyoyamato restaurant make this the most atmospheric Hyatt in the world.",
    amenities: ["Spa", "Fitness center", "Kyoyamato kaiseki", "Living Room lounge", "Private gardens", "Concierge"],
    vibe: ["temple district", "intimate", "heritage", "romantic"], art: ["#2f3e34", "#d4894f", "forest"],
  },
  {
    name: "Hyatt Regency Kyoto", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Kyoto", lat: 34.9888, lon: 135.7717,
    category: 5, stars: 4, tier: "upscale", cash: 380,
    description: "A low-rise hotel opposite Sanjusangendo in the Shichijo temple district with kimono-fabric headboards and a sunken Japanese garden. The Riak spa and Touzan restaurant are good, and it is a short walk from Kyoto station.",
    amenities: ["Riak Spa", "Fitness center", "Japanese garden", "Three restaurants", "Concierge", "Bicycle rental"],
    vibe: ["calm", "traditional", "walkable", "value"], art: ["#3b4a3f", "#b8c7a3", "forest"],
  },
  {
    name: "The Ritz-Carlton, Kyoto", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Kyoto", lat: 35.0136, lon: 135.7725,
    stars: 5, tier: "luxury", cash: 1250, points: 130000,
    description: "A riverside hotel on the Kamogawa with Meiji-era villa gardens, a cascading waterfall and rooms averaging 540 square feet. Breakfast by the river and the Kyoto-style kaiseki at Mizuki are among the best meals in a Marriott anywhere.",
    amenities: ["Spa", "Indoor pool", "Fitness center", "Kaiseki dining", "Riverside garden", "Cultural classes"],
    vibe: ["riverside", "refined", "gardens", "serene"], art: ["#223a2e", "#e4b17a", "forest"],
  },
  {
    name: "ROKU KYOTO, LXR Hotels & Resorts", brand: "LXR", program: "hilton-honors", city: "Kyoto", lat: 35.0675, lon: 135.7327,
    stars: 5, tier: "luxury", cash: 720, points: 110000,
    description: "Hilton's first LXR in Asia sits at the foot of Takagamine in the northern hills, with a thermal pool fed by natural hot springs and rooms that open onto a stream. Dinner at Tenjin and the forested setting make it feel like a ryokan with a points rate.",
    amenities: ["Thermal pool", "Spa", "Onsen baths", "Fitness center", "Tenjin restaurant", "Shuttle to Kinkaku-ji"],
    vibe: ["hot springs", "forested", "secluded", "ryokan-style"], art: ["#1f3b2d", "#9ad1b0", "forest"],
  },
  // ── Seoul ──────────────────────────────────────────────────────
  {
    name: "Park Hyatt Seoul", brand: "Park Hyatt", program: "world-of-hyatt", city: "Seoul", lat: 37.5084, lon: 127.0628,
    category: 5, stars: 5, tier: "luxury", cash: 380,
    description: "A 185-room glass tower in Gangnam where every room has a stone-floored bathroom with floor-to-ceiling windows and a deep soaking tub. The 24th-floor pool and Cornerstone restaurant draw Seoul's business set, and it is steps from COEX and Samseong station.",
    amenities: ["Rooftop pool", "Spa", "Fitness center", "Cornerstone restaurant", "Timber House bar", "Concierge"],
    vibe: ["gangnam", "minimalist", "design", "business"], art: ["#1b2338", "#c2d6ea", "skyline"],
  },
  {
    name: "Grand Hyatt Seoul", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Seoul", lat: 37.5392, lon: 126.9964,
    category: 4, stars: 5, tier: "upscale", cash: 290,
    description: "A hillside landmark on Namsan with sweeping Han River views, an outdoor pool that becomes an ice rink in winter and a legendary breakfast spread. Rooms were refreshed in 2023 and the Grand Club lounge is one of Hyatt's best in Asia.",
    amenities: ["Grand Club", "Indoor and outdoor pools", "Ice rink", "Spa", "Tennis", "Fitness center"],
    vibe: ["river views", "resort-in-city", "classic", "family"], art: ["#2d3f5c", "#f2c58e", "skyline"],
  },
  {
    name: "Conrad Seoul", brand: "Conrad", program: "hilton-honors", city: "Seoul", lat: 37.5252, lon: 126.9276,
    stars: 5, tier: "luxury", cash: 330, points: 70000,
    description: "A sleek tower in Yeouido's IFC complex with Han River views, a 25-meter indoor pool and direct access to the IFC Mall. Executive lounge upgrades are generous for Diamonds and Zest's weekend brunch is a Seoul institution.",
    amenities: ["Executive lounge", "Indoor pool", "Spa", "Fitness center", "Zest restaurant", "Mall access"],
    vibe: ["river views", "modern", "business", "upgrades"], art: ["#17243d", "#6fb1e8", "skyline"],
  },
  {
    name: "JW Marriott Dongdaemun Square Seoul", brand: "JW Marriott", program: "marriott-bonvoy", city: "Seoul", lat: 37.5712, lon: 127.0095,
    stars: 5, tier: "luxury", cash: 380, points: 65000,
    description: "A 170-room boutique-scale JW across from Heunginjimun Gate, with Zaha Hadid's Dongdaemun Design Plaza a few minutes' walk away. Griffin Bar's rooftop terrace overlooks the gate and the executive lounge is open to Platinum members.",
    amenities: ["Executive lounge", "Indoor pool", "Spa", "Fitness center", "Rooftop bar", "Concierge"],
    vibe: ["historic", "boutique", "design district", "rooftop"], art: ["#2a2d4a", "#e08a5c", "skyline"],
  },
  // ── Hong Kong ──────────────────────────────────────────────────
  {
    name: "Grand Hyatt Hong Kong", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Hong Kong", lat: 22.2826, lon: 114.1731,
    category: 6, stars: 5, tier: "luxury", cash: 430,
    description: "A 1989 Art Deco grande dame in Wan Chai with a 50-meter harbourfront pool, a Grand Club overlooking Victoria Harbour and the celebrated Grand Café. Harbour-view rooms are the ones to request, and it is attached to the Convention Centre.",
    amenities: ["Grand Club", "Outdoor pool", "Plateau Spa", "Fitness center", "Tennis", "Eight restaurants"],
    vibe: ["harbour views", "grand", "art deco", "pool"], art: ["#1a2440", "#f29e4c", "skyline"],
  },
  {
    name: "Hyatt Regency Hong Kong, Tsim Sha Tsui", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Hong Kong", lat: 22.2985, lon: 114.1757,
    category: 4, stars: 5, tier: "upscale", cash: 260,
    description: "Floors 3–24 of the K11 tower on Nathan Road, with harbour-facing rooms on the upper floors and a Regency Club with sunset views over Hong Kong Island. Hugo's steakhouse and The Chinese Restaurant remain Kowloon institutions.",
    amenities: ["Regency Club", "Outdoor pool", "Fitness center", "Spa", "Hugo's", "MTR access"],
    vibe: ["kowloon", "harbour views", "value", "central"], art: ["#243b5e", "#9fd3f0", "skyline"],
  },
  {
    name: "Conrad Hong Kong", brand: "Conrad", program: "hilton-honors", city: "Hong Kong", lat: 22.2775, lon: 114.1654,
    stars: 5, tier: "luxury", cash: 380, points: 80000,
    description: "A 61-storey tower above Pacific Place in Admiralty, where harbour-view rooms on the top floors look across to Kowloon and the hillside pool faces the Peak. The lounge is generous and the location is the best transit base on Hong Kong Island.",
    amenities: ["Executive lounge", "Outdoor pool", "Fitness center", "Spa", "Golden Leaf restaurant", "Mall access"],
    vibe: ["harbour views", "admiralty", "classic", "upgrades"], art: ["#152238", "#61a0d8", "skyline"],
  },
  {
    name: "The St. Regis Hong Kong", brand: "St. Regis", program: "marriott-bonvoy", city: "Hong Kong", lat: 22.2762, lon: 114.1762,
    stars: 5, tier: "luxury", cash: 600, points: 95000,
    description: "André Fu's 2019 design in Wan Chai pairs a glass-walled drawing room with a garden terrace and two Michelin-starred restaurants, L'Envol and Rùn. Butler service is included on every room and the outdoor pool is one of the quietest in the city.",
    amenities: ["Butler service", "Outdoor pool", "Iridium Spa", "Fitness center", "Two Michelin restaurants", "St. Regis Bar"],
    vibe: ["michelin", "butler", "design", "refined"], art: ["#1d1f33", "#c8a76b", "skyline"],
  },
  {
    name: "Regent Hong Kong", brand: "Regent", program: "ihg-one-rewards", city: "Hong Kong", lat: 22.2937, lon: 114.1730,
    stars: 5, tier: "luxury", cash: 650, points: 110000,
    description: "The reborn 1980 harbourfront landmark on Salisbury Road, reopened in 2023 with a Chi Wing Lo redesign, a multi-level infinity pool and the original lobby's sweep of harbour glass. Lai Ching Heen holds two Michelin stars and the Kowloon-side views are unmatched.",
    amenities: ["Infinity pool", "Spa", "Fitness center", "Michelin dining", "Club lounge", "Harbourfront terrace"],
    vibe: ["harbourfront", "landmark", "michelin", "glamour"], art: ["#101c2e", "#f4b860", "skyline"],
  },
  // ── Singapore ──────────────────────────────────────────────────
  {
    name: "Andaz Singapore", brand: "Andaz", program: "world-of-hyatt", city: "Singapore", lat: 1.3010, lon: 103.8590,
    category: 5, stars: 5, tier: "luxury", cash: 350,
    description: "Floors 25–39 of Ole Scheeren's DUO towers on the edge of Kampong Glam, with a 39th-floor rooftop bar and a lobby designed as a cluster of Singaporean shophouses. The Sunroom offers complimentary evening cocktails and the Andaz Lounge replaces a club floor.",
    amenities: ["Rooftop pool", "Mr Stork bar", "Fitness center", "Spa", "Sunroom", "MRT access"],
    vibe: ["rooftop", "design", "kampong glam", "modern"], art: ["#1a2a3a", "#f3a683", "skyline"],
  },
  {
    name: "Conrad Centennial Singapore", brand: "Conrad", program: "hilton-honors", city: "Singapore", lat: 1.2933, lon: 103.8589,
    stars: 5, tier: "luxury", cash: 330, points: 70000,
    description: "A 31-storey Marina Bay-adjacent tower next to Millenia Walk with large rooms, a palm-lined outdoor pool and an executive lounge that pours generously. Diamond members routinely land Marina Bay-facing rooms and the Suntec location is practical.",
    amenities: ["Executive lounge", "Outdoor pool", "Fitness center", "Spa", "Oscar's restaurant", "Concierge"],
    vibe: ["marina views", "upgrades", "business", "reliable"], art: ["#0f2740", "#64c2c8", "skyline"],
  },
  {
    name: "The St. Regis Singapore", brand: "St. Regis", program: "marriott-bonvoy", city: "Singapore", lat: 1.3045, lon: 103.8257,
    stars: 5, tier: "luxury", cash: 520, points: 90000,
    description: "A Tanglin-district palace a short walk from the Botanic Gardens, with butlers, a Remède Spa and a collection of Chagall, Picasso and Botero pieces in the public spaces. Brasserie Les Saveurs' champagne brunch and Yan Ting's Cantonese dim sum are the signatures.",
    amenities: ["Butler service", "Outdoor pool", "Remède Spa", "Fitness center", "Astor Bar", "Art collection"],
    vibe: ["butler", "art", "classic luxury", "botanic gardens"], art: ["#2a2340", "#d4a85a", "skyline"],
  },
  {
    name: "The Ritz-Carlton, Millenia Singapore", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Singapore", lat: 1.2914, lon: 103.8596,
    stars: 5, tier: "luxury", cash: 600, points: 110000,
    description: "Famous for octagonal bathroom windows that frame Marina Bay from the tub, this Kevin Roche tower holds 4,200 artworks including a Dale Chihuly and Frank Stella. The Club Lounge is among Ritz-Carlton's best and the pool faces the Marina Bay Sands skyline.",
    amenities: ["Club lounge", "Outdoor pool", "Spa", "Fitness center", "Art collection", "Colony restaurant"],
    vibe: ["marina views", "art", "bathtub views", "grand"], art: ["#15233d", "#b3d8f2", "skyline"],
  },
  {
    name: "Sofitel Singapore City Centre", brand: "Sofitel", program: "accor-all", city: "Singapore", lat: 1.2768, lon: 103.8449,
    stars: 5, tier: "luxury", cash: 320,
    description: "A 223-room French-accented tower above Tanjong Pagar MRT with a 35-meter outdoor pool, a Club Millésime lounge and the Racines restaurant. It is the practical Accor points play in Singapore, with Chinatown and the CBD on foot.",
    amenities: ["Club Millésime", "Outdoor pool", "Fitness center", "Spa", "Racines restaurant", "MRT access"],
    vibe: ["french", "cbd", "pool", "walkable"], art: ["#1f2a44", "#e8b4b8", "skyline"],
  },
  // ── Bangkok ────────────────────────────────────────────────────
  {
    name: "Park Hyatt Bangkok", brand: "Park Hyatt", program: "world-of-hyatt", city: "Bangkok", lat: 13.7437, lon: 100.5469,
    category: 5, stars: 5, tier: "luxury", cash: 330,
    description: "A 222-room Yabu Pushelberg-designed tower atop Central Embassy, with a tri-level Penthouse Bar + Grill, a cantilevered outdoor pool and teak-lined rooms. The Chidlom location puts BTS and Bangkok's best malls at the door.",
    amenities: ["Outdoor pool", "Spa", "Fitness center", "Penthouse Bar", "Mall access", "Concierge"],
    vibe: ["design", "mall access", "rooftop bar", "chic"], art: ["#2b1d3a", "#f7b267", "skyline"],
  },
  {
    name: "Grand Hyatt Erawan Bangkok", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Bangkok", lat: 13.7442, lon: 100.5406,
    category: 4, stars: 5, tier: "upscale", cash: 230,
    description: "A neoclassical landmark beside the Erawan Shrine at Ratchaprasong, with a 5th-floor garden pool, the i.sawan spa and one of Bangkok's best Sunday brunches at The Dining Room. Grand Club rooms are a strong use of 15,000 points.",
    amenities: ["Grand Club", "Outdoor pool", "i.sawan Spa", "Fitness center", "Tennis", "Seven restaurants"],
    vibe: ["central", "brunch", "spa", "value"], art: ["#3a2b4d", "#f0c38e", "skyline"],
  },
  {
    name: "Conrad Bangkok", brand: "Conrad", program: "hilton-honors", city: "Bangkok", lat: 13.7408, lon: 100.5477,
    stars: 5, tier: "luxury", cash: 180, points: 50000,
    description: "A Wireless Road tower with a resort-scale pool, a renovated executive lounge and Liu's Cantonese dining, a short walk from Ploenchit BTS. Rooms are large and teak-trimmed, and points rates here are among the softest for a Conrad anywhere.",
    amenities: ["Executive lounge", "Outdoor pool", "Spa", "Fitness center", "Tennis", "Liu restaurant"],
    vibe: ["value", "pool", "embassy district", "classic"], art: ["#1c2b44", "#e9b872", "skyline"],
  },
  {
    name: "Hilton Sukhumvit Bangkok", brand: "Hilton", program: "hilton-honors", city: "Bangkok", lat: 13.7306, lon: 100.5696,
    stars: 4, tier: "upscale", cash: 150, points: 40000,
    description: "A 280-room tower on Sukhumvit Soi 24 with a leafy rooftop pool and Scalini's Italian, a few minutes' walk from Phrom Phong BTS and EmQuartier. It is a reliable 40,000-point base with an executive lounge that Golds can access.",
    amenities: ["Executive lounge", "Rooftop pool", "Fitness center", "Scalini restaurant", "BTS access", "Concierge"],
    vibe: ["sukhumvit", "value", "rooftop pool", "walkable"], art: ["#243a5a", "#8fc1e3", "skyline"],
  },
  {
    name: "Waldorf Astoria Bangkok", brand: "Waldorf Astoria", program: "hilton-honors", city: "Bangkok", lat: 13.7446, lon: 100.5394,
    stars: 5, tier: "luxury", cash: 360, points: 75000,
    description: "A curvaceous André Fu-designed tower at Ratchaprasong with a 16th-floor infinity pool, a Peacock Alley lounge and the three-storey Champagne Bar and Loft at the summit. Rooms are among the largest in the city and come with Waldorf butlers.",
    amenities: ["Infinity pool", "Spa", "Fitness center", "Butler service", "Peacock Alley", "Rooftop bar"],
    vibe: ["design", "butler", "rooftop bar", "glamorous"], art: ["#2d1b3d", "#f4d58d", "skyline"],
  },
  {
    name: "Kimpton Maa-Lai Bangkok", brand: "Kimpton", program: "ihg-one-rewards", city: "Bangkok", lat: 13.7405, lon: 100.5451,
    stars: 5, tier: "upscale", cash: 220, points: 45000,
    description: "A 362-key lifestyle tower on Langsuan Road with a 14th-floor rooftop pool, the Bar.Yard rooftop bar and Kimpton's pet-friendly, free-wine-hour habits. Rooms have bathtubs with city views and the Lumphini Park location is leafy for Bangkok.",
    amenities: ["Rooftop pool", "Bar.Yard", "Fitness center", "Spa", "Evening wine hour", "Pet friendly"],
    vibe: ["lifestyle", "rooftop", "pet friendly", "park views"], art: ["#1f3a3d", "#f6a56b", "skyline"],
  },
  // ── Vietnam ────────────────────────────────────────────────────
  {
    name: "Park Hyatt Saigon", brand: "Park Hyatt", program: "world-of-hyatt", city: "Ho Chi Minh City", lat: 10.7779, lon: 106.7035,
    category: 4, stars: 5, tier: "luxury", cash: 330,
    description: "A French-colonial style mansion on Lam Son Square beside the Opera House, with a courtyard pool shaded by frangipani and the Xuan Spa. Opera restaurant and 2 Lam Son bar are Saigon institutions, and 15,000 points buys a genuinely luxurious stay.",
    amenities: ["Outdoor pool", "Xuan Spa", "Fitness center", "Opera restaurant", "2 Lam Son bar", "Concierge"],
    vibe: ["colonial", "sweet spot", "central", "refined"], art: ["#3b2f2f", "#f2c572", "skyline"],
  },
  {
    name: "InterContinental Saigon", brand: "InterContinental", program: "ihg-one-rewards", city: "Ho Chi Minh City", lat: 10.7822, lon: 106.7004,
    stars: 5, tier: "luxury", cash: 200, points: 38000,
    description: "A District 1 tower opposite the Saigon Notre-Dame Basilica with 305 rooms, a 3rd-floor outdoor pool and a popular Club InterContinental lounge. Market 39's buffet is a city favourite and the location is steps from the post office and Dong Khoi.",
    amenities: ["Club lounge", "Outdoor pool", "Fitness center", "Spa", "Market 39", "Concierge"],
    vibe: ["central", "value", "club lounge", "business"], art: ["#243b53", "#e3a857", "skyline"],
  },
  {
    name: "Hilton Saigon", brand: "Hilton", program: "hilton-honors", city: "Ho Chi Minh City", lat: 10.7916, lon: 106.7066,
    stars: 5, tier: "upscale", cash: 190, points: 38000,
    description: "Opened in 2023 on the Saigon River edge of District 1, this 34-storey tower has a rooftop infinity pool, an executive lounge with river views and Vietnam's first Hilton-branded flagship. Rooms are modern with riverside glass and the skyline shows from most floors.",
    amenities: ["Rooftop infinity pool", "Executive lounge", "Spa", "Fitness center", "Three restaurants", "Concierge"],
    vibe: ["new", "river views", "rooftop pool", "modern"], art: ["#1b2f4b", "#78c6e0", "skyline"],
  },
  {
    name: "Sofitel Legend Metropole Hanoi", brand: "Sofitel Legend", program: "accor-all", city: "Hanoi", lat: 21.0255, lon: 105.8560,
    stars: 5, tier: "luxury", cash: 320,
    description: "Hanoi's 1901 grande dame, where Graham Greene and Charlie Chaplin stayed, with a wartime bunker under the Bamboo Bar and a courtyard pool ringed by the Opera Wing. The Historical Wing suites with wooden shutters and ceiling fans are worth the premium.",
    amenities: ["Outdoor pool", "Spa", "Fitness center", "Le Beaulieu", "Bamboo Bar", "Bunker tour"],
    vibe: ["heritage", "colonial", "iconic", "romantic"], art: ["#2f3a2a", "#e4c27a", "skyline"],
  },
  {
    name: "JW Marriott Hotel Hanoi", brand: "JW Marriott", program: "marriott-bonvoy", city: "Hanoi", lat: 21.0069, lon: 105.7846,
    stars: 5, tier: "luxury", cash: 200, points: 35000,
    description: "A Carlos Zapata-designed cantilevered building shaped like a dragon on a lake in the new convention district, with a 450-room scale and seven restaurants. Lake-view rooms and the executive lounge make it a comfortable points base for Hanoi's west side.",
    amenities: ["Executive lounge", "Indoor pool", "Spa", "Fitness center", "Seven restaurants", "Lake views"],
    vibe: ["architecture", "lake views", "business", "value"], art: ["#1f2e45", "#9cc5d9", "skyline"],
  },
  {
    name: "Hyatt Regency West Hanoi", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Hanoi", lat: 21.0152, lon: 105.7792,
    category: 1, stars: 4, tier: "upscale", cash: 110,
    description: "A 2023 opening in the Tu Liem business district with a 40-meter outdoor pool, a large Regency Club and spacious rooms that are among the cheapest Hyatt awards anywhere. The old quarter is a 25-minute taxi, but at 5,000 points it is hard to argue.",
    amenities: ["Regency Club", "Outdoor pool", "Fitness center", "Spa", "Three restaurants", "Kids club"],
    vibe: ["cheap award", "pool", "new", "business"], art: ["#2a3b55", "#a9d6ea", "skyline"],
  },
  {
    name: "Hyatt Regency Danang Resort and Spa", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Da Nang", lat: 16.0067, lon: 108.2611,
    category: 3, stars: 5, tier: "upscale", cash: 200,
    description: "A 20-hectare beachfront resort on Non Nuoc Beach between Da Nang and Hoi An, with five pools, residences and a Vie Spa under the Marble Mountains. Ocean-view rooms at 12,000 points are one of the best beach-resort awards in the Hyatt chart.",
    amenities: ["Five pools", "Beachfront", "Vie Spa", "Fitness center", "Kids club", "Four restaurants"],
    vibe: ["beach", "family", "sweet spot", "resort"], art: ["#1b5e6b", "#f5d28a", "coast"],
  },
  {
    name: "InterContinental Danang Sun Peninsula Resort", brand: "InterContinental", program: "ihg-one-rewards", city: "Da Nang", lat: 16.1203, lon: 108.3027,
    stars: 5, tier: "luxury", cash: 650, points: 80000,
    description: "Bill Bensley's hillside fantasy on the Son Tra peninsula, with monkey-shaped funiculars, four tiered levels descending to a private bay and La Maison 1888 by Pierre Gagnaire. It is regularly named the best resort in Asia and points pricing is a bargain against cash.",
    amenities: ["Private beach", "Infinity pool", "HARNN Spa", "Fitness center", "Funicular", "Michelin-chef dining"],
    vibe: ["bensley", "bay views", "iconic", "secluded"], art: ["#14433f", "#f3b562", "coast"],
  },
  // ── Bali ───────────────────────────────────────────────────────
  {
    name: "Hyatt Regency Bali", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Bali", lat: -8.7985, lon: 115.2331,
    category: 3, stars: 5, tier: "upscale", cash: 210,
    description: "The reborn Bali Hyatt in Sanur sits on nine hectares of 1970s tropical gardens with three pools, a beach club on the calm east coast and a Shankha Spa. At 12,000 points a night it is the value anchor of Hyatt's Bali portfolio.",
    amenities: ["Three pools", "Beachfront", "Shankha Spa", "Fitness center", "Kids club", "Gardens"],
    vibe: ["gardens", "sanur", "family", "sweet spot"], art: ["#1f6b5a", "#f7c873", "coast"],
  },
  {
    name: "Andaz Bali", brand: "Andaz", program: "world-of-hyatt", city: "Bali", lat: -8.7005, lon: 115.2622,
    category: 4, stars: 5, tier: "luxury", cash: 290,
    description: "A village-style resort in Sanur with 149 rooms and villas arranged around a market square, three pools and a beachfront Fisherman's Club. The design nods to Balinese banjar life and private-pool villas price surprisingly low on points.",
    amenities: ["Three pools", "Beach club", "Spa", "Fitness center", "Pool villas", "Bike rental"],
    vibe: ["village design", "beach", "pool villas", "value"], art: ["#226b63", "#f5b971", "coast"],
  },
  {
    name: "Alila Villas Uluwatu", brand: "Alila", program: "world-of-hyatt", city: "Bali", lat: -8.8450, lon: 115.1392,
    category: 7, stars: 5, tier: "luxury", cash: 850,
    description: "A cliff-edge resort 100 meters above the Indian Ocean with an iconic cantilevered sunset cabana, all-pool villas and WOHA's sustainable limestone architecture. The Spa Alila and the cliff-edge pool make 30,000 points feel like a steal against $850 cash rates.",
    amenities: ["Pool villas", "Cliff-edge pool", "Spa Alila", "Fitness center", "Sunset cabana", "Yoga pavilion"],
    vibe: ["clifftop", "architecture", "pool villas", "sunsets"], art: ["#0f3d4a", "#f28b6b", "coast"],
  },
  {
    name: "Conrad Bali", brand: "Conrad", program: "hilton-honors", city: "Bali", lat: -8.7797, lon: 115.2187,
    stars: 5, tier: "luxury", cash: 280, points: 55000,
    description: "A Tanjung Benoa beachfront resort with a 350-meter beach, a lagoon-style pool and the Jiwa Spa, plus adults-only Conrad Suites with their own pool and lounge. It is a solid family option where Diamond breakfast and lounge access add up.",
    amenities: ["Lagoon pool", "Beachfront", "Jiwa Spa", "Kids club", "Executive lounge", "Water sports"],
    vibe: ["beach", "family", "lagoon pool", "upgrades"], art: ["#1b5c74", "#ffd27f", "coast"],
  },
  {
    name: "The St. Regis Bali Resort", brand: "St. Regis", program: "marriott-bonvoy", city: "Bali", lat: -8.8049, lon: 115.2311,
    stars: 5, tier: "luxury", cash: 820, points: 95000,
    description: "A Nusa Dua beachfront estate with a 3,668-square-meter saltwater lagoon pool, butlers on every room and Kayuputi's wine-paired Asian dining. Lagoon-access suites let you step from the terrace into the water, and Marriott's fifth night free makes long stays compelling.",
    amenities: ["Saltwater lagoon", "Beachfront", "Remède Spa", "Butler service", "Kids club", "Kayuputi restaurant"],
    vibe: ["lagoon", "butler", "beach", "opulent"], art: ["#115e63", "#f8c75d", "coast"],
  },
  {
    name: "Hilton Bali Resort", brand: "Hilton", program: "hilton-honors", city: "Bali", lat: -8.8307, lon: 115.2243,
    stars: 5, tier: "upscale", cash: 220, points: 45000,
    description: "A clifftop resort above Nusa Dua with an inclinator down to a private beach, a huge free-form pool with slides and a sizable executive lounge. It is a family favourite where Diamond perks stretch far and points rates stay modest year-round.",
    amenities: ["Private beach", "Waterslide pool", "Executive lounge", "Spa", "Kids club", "Tennis"],
    vibe: ["family", "clifftop", "value", "beach"], art: ["#1d6e74", "#fbd38d", "coast"],
  },
  // ── Maldives ───────────────────────────────────────────────────
  {
    name: "Park Hyatt Maldives Hadahaa", brand: "Park Hyatt", program: "world-of-hyatt", city: "Maldives", lat: 0.4486, lon: 73.4211,
    category: 8, stars: 5, tier: "luxury", cash: 1400,
    description: "Fifty villas on a tiny island in the far-south Gaafu Alifu atoll with a pristine house reef steps from every Park Villa, reached by a domestic flight plus speedboat. At 40,000 points for an overwater villa, it is the cheapest luxury Maldives award in any program.",
    amenities: ["Overwater villas", "House reef", "Vidhun Spa", "Dive center", "Infinity pool", "Three restaurants"],
    vibe: ["house reef", "sweet spot", "remote", "diving"], art: ["#0a6f8c", "#aee6f0", "island"],
  },
  {
    name: "Alila Kothaifaru Maldives", brand: "Alila", program: "world-of-hyatt", city: "Maldives", lat: 5.7360, lon: 72.8880,
    category: 8, stars: 5, tier: "luxury", cash: 1300,
    description: "An 80-villa island in Raa atoll opened in 2022, 45 minutes by seaplane from Malé, with overwater and beach pool villas, a sunset bar on a jetty and Spa Alila over the lagoon. It books at the same 40,000-point rate as Hadahaa but is easier to reach.",
    amenities: ["Overwater villas", "Private pools", "Spa Alila", "Dive center", "Seaplane transfer", "Four restaurants"],
    vibe: ["seaplane", "pool villas", "sweet spot", "lagoon"], art: ["#0c7a9a", "#b9ecf2", "island"],
  },
  {
    name: "Waldorf Astoria Maldives Ithaafushi", brand: "Waldorf Astoria", program: "hilton-honors", city: "Maldives", lat: 4.0510, lon: 73.4470,
    stars: 5, tier: "luxury", cash: 2200, points: 150000,
    description: "Three islands near Malé reached by 40-minute yacht, with 119 villas, 11 restaurants including treetop dining at Terra and a private-island residence for groups. It is the headline Hilton redemption, where the 150,000-point cap against $2,000-plus cash makes Aspire card points sing.",
    amenities: ["Overwater villas", "Private pools", "Waldorf Astoria Spa", "11 restaurants", "Yacht transfer", "Kids club"],
    vibe: ["ultra luxury", "yacht transfer", "dining", "capped points"], art: ["#055d78", "#9fe3ec", "island"],
  },
  {
    name: "Conrad Maldives Rangali Island", brand: "Conrad", program: "hilton-honors", city: "Maldives", lat: 3.6150, lon: 72.7172,
    stars: 5, tier: "luxury", cash: 1300, points: 120000,
    description: "The original points Maldives resort, spanning two islands with the undersea Ithaa restaurant, the Muraka underwater residence and a serious whale-shark season. Beach villas on Rangali-Finolhu are the classic award, and seaplane transfers are the main cash cost.",
    amenities: ["Undersea restaurant", "Overwater villas", "Two spas", "Dive center", "Seaplane transfer", "12 restaurants"],
    vibe: ["iconic", "undersea dining", "whale sharks", "two islands"], art: ["#0b6a86", "#86d9e8", "island"],
  },
  {
    name: "The St. Regis Maldives Vommuli Resort", brand: "St. Regis", program: "marriott-bonvoy", city: "Maldives", lat: 2.7667, lon: 72.9000,
    stars: 5, tier: "luxury", cash: 2300, points: 150000,
    description: "A Dhaalu atoll island with whale-shaped overwater villas, a Blue Hole-shaped Iridium Spa and the Whale Bar at sunset, 45 minutes by seaplane from Malé. Every villa has a private pool and butler, and Marriott's fifth night free trims a five-night stay to 600,000 points.",
    amenities: ["Overwater villas", "Private pools", "Butler service", "Iridium Spa", "Seaplane transfer", "Six restaurants"],
    vibe: ["architecture", "butler", "ultra luxury", "fifth night free"], art: ["#06607d", "#bfe9f3", "island"],
  },
  {
    name: "W Maldives", brand: "W Hotels", program: "marriott-bonvoy", city: "Maldives", lat: 4.2764, lon: 72.9239,
    stars: 5, tier: "luxury", cash: 1500, points: 120000,
    description: "A compact, lively island in North Ari atoll with one of the best house reefs in the country, a 15-minute-plus seaplane hop and the party-ready SIP bar. Ocean Oasis overwater villas are the award to chase and snorkelling is right off the deck.",
    amenities: ["House reef", "Overwater villas", "AWAY Spa", "Dive center", "Seaplane transfer", "Gaathafushi private island"],
    vibe: ["house reef", "lively", "snorkelling", "social"], art: ["#0a5f7a", "#f6a5c0", "island"],
  },
  {
    name: "JW Marriott Maldives Resort & Spa", brand: "JW Marriott", program: "marriott-bonvoy", city: "Maldives", lat: 5.9330, lon: 73.2470,
    stars: 5, tier: "luxury", cash: 1200, points: 100000,
    description: "Sixty private-pool villas in Shaviyani atoll, reached by a scenic 55-minute seaplane flight, with a family-focused Little Griffins club and treetop-style dining at Fiamma. Overwater sunrise villas are the standard award and the long lagoon suits beginners.",
    amenities: ["Pool villas", "Kids club", "Spa by JW", "Dive center", "Seaplane transfer", "Five restaurants"],
    vibe: ["family", "pool villas", "lagoon", "remote"], art: ["#0e6b8a", "#a8e4ea", "island"],
  },
  {
    name: "InterContinental Maldives Maamunagau Resort", brand: "InterContinental", program: "ihg-one-rewards", city: "Maldives", lat: 5.4620, lon: 72.9380,
    stars: 5, tier: "luxury", cash: 1300, points: 100000,
    description: "An all-club-lounge resort in Raa atoll where every villa includes Club InterContinental breakfast, afternoon tea and evening cocktails, with manta rays in the resident lagoon from May to November. It is IHG's strongest points play and Diamond Ambassadors get meaningful upgrades.",
    amenities: ["Club InterContinental", "Overwater villas", "Manta lagoon", "AVI Spa", "Seaplane transfer", "Kids club"],
    vibe: ["all-club", "manta rays", "pool villas", "inclusive feel"], art: ["#0c6d8e", "#b4e7f0", "island"],
  },
  {
    name: "Hilton Maldives Amingiri Resort & Spa", brand: "Hilton", program: "hilton-honors", city: "Maldives", lat: 4.3410, lon: 73.5190,
    stars: 5, tier: "luxury", cash: 950, points: 110000,
    description: "A 2022 island just 20 minutes by speedboat from Malé with 109 pool villas, a Krakengiri kids club and a sunset bar, so there is no seaplane cost or wait. Points rates sit below the Waldorf and Conrad, making it the accessible Hilton Maldives.",
    amenities: ["Pool villas", "Speedboat transfer", "Amingiri Spa", "Kids club", "Dive center", "Five restaurants"],
    vibe: ["speedboat access", "pool villas", "family", "value"], art: ["#0a6786", "#9ae0ee", "island"],
  },
  {
    name: "Sheraton Maldives Full Moon Resort & Spa", brand: "Sheraton", program: "marriott-bonvoy", city: "Maldives", lat: 4.2578, lon: 73.5543,
    stars: 5, tier: "upscale", cash: 600, points: 60000,
    description: "A 15-minute speedboat from the airport, this long-running North Malé atoll resort has 176 rooms including overwater bungalows, a Shine Spa on its own island and seven restaurants. Points rates are among the lowest for a Maldives overwater stay in any program.",
    amenities: ["Overwater bungalows", "Speedboat transfer", "Shine Spa", "Dive center", "Kids club", "Seven restaurants"],
    vibe: ["value", "speedboat access", "overwater", "family"], art: ["#107a94", "#c3eaf1", "island"],
  },
  // ── India ──────────────────────────────────────────────────────
  {
    name: "Grand Hyatt Mumbai Hotel & Residences", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Mumbai", lat: 19.0745, lon: 72.8599,
    category: 2, stars: 5, tier: "upscale", cash: 190,
    description: "A 547-room complex in Santacruz East with a 10-acre site, an outdoor pool, a Club Oasis spa and Celini's celebrated Italian, 15 minutes from the airport. Grand Club rooms at 8,000 points are a textbook Hyatt sweet spot in India.",
    amenities: ["Grand Club", "Outdoor pool", "Spa", "Fitness center", "Five restaurants", "Shopping plaza"],
    vibe: ["sweet spot", "airport access", "business", "spacious"], art: ["#3d2f4f", "#f4a259", "skyline"],
  },
  {
    name: "The St. Regis Mumbai", brand: "St. Regis", program: "marriott-bonvoy", city: "Mumbai", lat: 19.0119, lon: 72.8300,
    stars: 5, tier: "luxury", cash: 320, points: 45000,
    description: "Mumbai's tallest hotel at 37 floors, rising above Palladium Mall in Lower Parel with 395 rooms, the Iridium Spa and the glamorous Asilo rooftop bar. Butler service and the Sahib Room & Kipling Bar give it the full St. Regis theatre at a modest points rate.",
    amenities: ["Butler service", "Outdoor pool", "Iridium Spa", "Fitness center", "Asilo rooftop", "Mall access"],
    vibe: ["rooftop", "butler", "glamour", "value"], art: ["#261d3b", "#f5b041", "skyline"],
  },
  {
    name: "JW Marriott Mumbai Juhu", brand: "JW Marriott", program: "marriott-bonvoy", city: "Mumbai", lat: 19.1012, lon: 72.8260,
    stars: 5, tier: "luxury", cash: 300, points: 42000,
    description: "A Juhu Beach landmark where Bollywood meets brunch, with three pools, an Arabian Sea sunset view, the Quan Spa and a famous Sunday spread at Lotus Café. Sea-facing rooms and the executive lounge are generous to Platinum members.",
    amenities: ["Three pools", "Beachfront", "Quan Spa", "Executive lounge", "Fitness center", "Six restaurants"],
    vibe: ["beach", "brunch", "bollywood", "sunsets"], art: ["#2d3a5a", "#f9a66c", "coast"],
  },
  {
    name: "Andaz Delhi", brand: "Andaz", program: "world-of-hyatt", city: "Delhi", lat: 28.5493, lon: 77.1223,
    category: 2, stars: 5, tier: "upscale", cash: 170,
    description: "A 401-room Aerocity hotel built around 401 stories of Delhi, with the AnnaMaya food hall, a landscaped pool and the free Andaz minibar. At 8,000 points it is an easy, stylish airport-adjacent stay before an early flight.",
    amenities: ["Outdoor pool", "Spa", "Fitness center", "AnnaMaya food hall", "Free minibar", "Airport shuttle"],
    vibe: ["airport", "design", "sweet spot", "food"], art: ["#3a2a3f", "#f2a65a", "skyline"],
  },
  {
    name: "JW Marriott New Delhi Aerocity", brand: "JW Marriott", program: "marriott-bonvoy", city: "Delhi", lat: 28.5486, lon: 77.1210,
    stars: 5, tier: "luxury", cash: 220, points: 35000,
    description: "A 523-room Aerocity flagship with the Quan Spa, an outdoor pool and the K3 international kitchens plus Akira Back's Japanese. Executive lounge access and rooms that run large make it a comfortable Delhi base ten minutes from the terminals.",
    amenities: ["Executive lounge", "Outdoor pool", "Quan Spa", "Fitness center", "Akira Back", "Airport shuttle"],
    vibe: ["airport", "business", "spa", "value"], art: ["#2a2744", "#f0b35c", "skyline"],
  },
  {
    name: "Park Hyatt Hyderabad", brand: "Park Hyatt", program: "world-of-hyatt", city: "Hyderabad", lat: 17.4197, lon: 78.4482,
    category: 2, stars: 5, tier: "luxury", cash: 180,
    description: "A 209-room Banjara Hills hotel with an atrium lobby, a rooftop pool and the Tre-Forni Italian, serving Hyderabad's tech and pharma executives. It is one of only a handful of Park Hyatts priced at 8,000 points a night.",
    amenities: ["Rooftop pool", "Spa", "Fitness center", "Tre-Forni", "Club lounge", "Concierge"],
    vibe: ["sweet spot", "park hyatt cheap", "business", "refined"], art: ["#2f2a4a", "#f7c072", "skyline"],
  },
  // ── Sydney ─────────────────────────────────────────────────────
  {
    name: "Park Hyatt Sydney", brand: "Park Hyatt", program: "world-of-hyatt", city: "Sydney", lat: -33.8557, lon: 151.2102,
    category: 8, stars: 5, tier: "luxury", cash: 1100,
    description: "A low-rise harbourfront at Campbells Cove with the Opera House filling the windows of the best rooms, butlers and a rooftop pool beneath the Harbour Bridge. It is the most requested 40,000-point award in Australia and sells out months ahead.",
    amenities: ["Rooftop pool", "Butler service", "Spa", "Fitness center", "The Dining Room", "Harbour views"],
    vibe: ["opera house views", "iconic", "butler", "harbour"], art: ["#1f3a5c", "#f6c177", "coast"],
  },
  {
    name: "Hyatt Regency Sydney", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Sydney", lat: -33.8683, lon: 151.2027,
    category: 4, stars: 4, tier: "upscale", cash: 280,
    description: "Australia's largest hotel at 892 rooms, on Sussex Street beside Darling Harbour, with the Zephyr rooftop bar and a Regency Club with harbour views. Rooms are compact but the 15,000-point rate is the practical Hyatt choice in the CBD.",
    amenities: ["Regency Club", "Zephyr rooftop bar", "Fitness center", "Sailmaker restaurant", "Concierge", "Harbour views"],
    vibe: ["darling harbour", "rooftop bar", "value", "central"], art: ["#223c5a", "#9ccfe6", "skyline"],
  },
  {
    name: "InterContinental Sydney", brand: "InterContinental", program: "ihg-one-rewards", city: "Sydney", lat: -33.8630, lon: 151.2106,
    stars: 5, tier: "luxury", cash: 400, points: 65000,
    description: "The 1851 Treasury Building at Circular Quay, reopened in 2022 after a full renovation with a 32nd-floor rooftop pool and the Aster bar looking straight at the Opera House. Club InterContinental on the top floor is among the best in the brand.",
    amenities: ["Rooftop pool", "Club lounge", "Spa", "Fitness center", "Aster bar", "Heritage building"],
    vibe: ["heritage", "rooftop pool", "opera house views", "club lounge"], art: ["#1b3550", "#f4b78a", "coast"],
  },
  {
    name: "W Sydney", brand: "W Hotels", program: "marriott-bonvoy", city: "Sydney", lat: -33.8706, lon: 151.1985,
    stars: 5, tier: "luxury", cash: 420, points: 70000,
    description: "The ribbon-shaped Ribbon building at Darling Harbour, opened in 2023 with 585 rooms, a 29th-floor infinity pool and the WET Deck bar overlooking the harbour. It is Marriott's splashiest Sydney opening and prices reasonably on points.",
    amenities: ["Infinity pool", "AWAY Spa", "Fitness center", "WET Deck", "Rooftop bar", "Harbour views"],
    vibe: ["new", "nightlife", "infinity pool", "architecture"], art: ["#1a1f3b", "#ff7b9c", "coast"],
  },
  // ── Bora Bora ──────────────────────────────────────────────────
  {
    name: "The St. Regis Bora Bora Resort", brand: "St. Regis", program: "marriott-bonvoy", city: "Bora Bora", lat: -16.4760, lon: -151.7137,
    stars: 5, tier: "luxury", cash: 2000, points: 150000,
    description: "Forty-four acres of motu with Mount Otemanu views, the largest overwater villas in French Polynesia, a swimmable lagoonarium and Jean-Georges's Lagoon restaurant. Butlers and bicycles come standard and five-night stays with the free night are the classic play.",
    amenities: ["Overwater villas", "Lagoonarium", "Butler service", "Iridium Spa", "Jean-Georges dining", "Boat transfer"],
    vibe: ["otemanu views", "overwater", "butler", "honeymoon"], art: ["#0a6d8f", "#8fe3e0", "island"],
  },
  {
    name: "Conrad Bora Bora Nui", brand: "Conrad", program: "hilton-honors", city: "Bora Bora", lat: -16.5280, lon: -151.7840,
    stars: 5, tier: "luxury", cash: 1500, points: 130000,
    description: "A private-bay resort on Motu To'opua with Bora Bora's only two-storey overwater presidential villas, a hillside Hina Spa and the Motu Tapu private island for picnics. Hilton Diamond breakfast and 5th night free make it the value Bora Bora overwater award.",
    amenities: ["Overwater villas", "Private island", "Hina Spa", "Infinity pool", "Dive center", "Boat transfer"],
    vibe: ["private bay", "fifth night free", "spa", "overwater"], art: ["#0c6b8a", "#a4e4e8", "island"],
  },
  {
    name: "InterContinental Bora Bora Resort & Thalasso Spa", brand: "InterContinental", program: "ihg-one-rewards", city: "Bora Bora", lat: -16.4920, lon: -151.7060,
    stars: 5, tier: "luxury", cash: 1500, points: 120000,
    description: "Eighty overwater villas on Motu Piti Aau with glass-floor panels, a deep-sea-water-cooled Thalasso spa and the brand's signature Otemanu views across the lagoon. The adults-focused calm and strong IHG Diamond treatment make it the IHG flagship in the Pacific.",
    amenities: ["Overwater villas", "Deep Ocean Spa", "Infinity pool", "Dive center", "Boat transfer", "Three restaurants"],
    vibe: ["overwater", "spa", "adults-oriented", "lagoon views"], art: ["#0b668a", "#b6e8ea", "island"],
  },
  {
    name: "Le Méridien Bora Bora", brand: "Le Méridien", program: "marriott-bonvoy", city: "Bora Bora", lat: -16.4700, lon: -151.7010,
    stars: 5, tier: "luxury", cash: 1100, points: 90000,
    description: "A motu resort with one of the clearest inner lagoons in Bora Bora, a sea-turtle sanctuary and overwater bungalows with the largest glass floors on the island. Points rates run well below the St. Regis and the kids' turtle programme is a highlight.",
    amenities: ["Overwater bungalows", "Turtle sanctuary", "Inner lagoon", "Spa", "Dive center", "Boat transfer"],
    vibe: ["turtles", "lagoon", "family", "value"], art: ["#107a98", "#c7edf0", "island"],
  },
  // ── Dubai ──────────────────────────────────────────────────────
  {
    name: "Al Maha, a Luxury Collection Desert Resort & Spa", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "Dubai", lat: 24.8296, lon: 55.4917,
    stars: 5, tier: "luxury", cash: 1400, points: 120000,
    description: "Forty-two Bedouin-style suites with private plunge pools inside the Dubai Desert Conservation Reserve, where oryx and gazelle wander past the terrace. Rates include all meals and two daily activities such as falconry and dune drives, which makes points pricing exceptional.",
    amenities: ["Private pools", "All meals included", "Falconry", "Camel treks", "Timeless Spa", "Desert safaris"],
    vibe: ["desert", "all-inclusive", "wildlife", "romantic"], art: ["#8c4b2a", "#f5c56b", "desert"],
  },
  {
    name: "Waldorf Astoria Dubai International Financial Centre", brand: "Waldorf Astoria", program: "hilton-honors", city: "Dubai", lat: 25.2120, lon: 55.2760,
    stars: 5, tier: "luxury", cash: 380, points: 80000,
    description: "A 2021 tower in DIFC's Burj Daman with Burj Khalifa views from the rooftop pool and Peacock Alley, Bull & Bear's steak and a True Waldorf Service butler desk. It is the better-value of Dubai's two Waldorfs for a city stay.",
    amenities: ["Rooftop pool", "Spa", "Fitness center", "Peacock Alley", "Butler service", "Bull & Bear"],
    vibe: ["burj views", "financial district", "rooftop", "modern"], art: ["#1b2a4a", "#e8a95b", "skyline"],
  },
  {
    name: "Conrad Dubai", brand: "Conrad", program: "hilton-honors", city: "Dubai", lat: 25.2203, lon: 55.2780,
    stars: 5, tier: "luxury", cash: 230, points: 55000,
    description: "A 555-room Sheikh Zayed Road tower with a curved glass façade, an outdoor pool overlooking the skyline and the Conrad Spa. The executive lounge is sizeable and Diamond members get regular suite upgrades at a modest points cost.",
    amenities: ["Executive lounge", "Outdoor pool", "Conrad Spa", "Fitness center", "Three restaurants", "Metro access"],
    vibe: ["value", "skyline", "upgrades", "business"], art: ["#162b45", "#f0b86c", "skyline"],
  },
  {
    name: "Park Hyatt Dubai", brand: "Park Hyatt", program: "world-of-hyatt", city: "Dubai", lat: 25.2443, lon: 55.3300,
    category: 6, stars: 5, tier: "luxury", cash: 420,
    description: "A Moorish-style low-rise on Dubai Creek beside the golf and yacht club, with a lagoon pool, a lazy river, the Amara spa and creek-view terraces far from the Marina crowds. It is the quiet old-Dubai Hyatt and includes a private beach on the creek.",
    amenities: ["Lagoon pool", "Lazy river", "Amara Spa", "Creek beach", "Golf club access", "Fitness center"],
    vibe: ["creekside", "low-rise", "gardens", "calm"], art: ["#24405c", "#f6c69a", "coast"],
  },
  {
    name: "Grand Hyatt Dubai", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Dubai", lat: 25.2282, lon: 55.3243,
    category: 4, stars: 5, tier: "upscale", cash: 230,
    description: "A 37-acre city resort near Dubai Creek with an indoor rainforest atrium, four pools, a Grand Club and 14 restaurants. Rooms are large and the 15,000-point rate buys resort-level amenities ten minutes from DXB.",
    amenities: ["Grand Club", "Four pools", "Spa", "Tennis", "Kids club", "14 restaurants"],
    vibe: ["family", "resort-in-city", "value", "airport access"], art: ["#2a3f5e", "#ffd18e", "skyline"],
  },
  {
    name: "Sofitel Dubai The Palm", brand: "Sofitel", program: "accor-all", city: "Dubai", lat: 25.1180, lon: 55.1540,
    stars: 5, tier: "luxury", cash: 300,
    description: "A Polynesian-themed resort on the Palm Jumeirah's east crescent with 500 meters of private beach, a lagoon pool and Club Millésime access. It is the natural Accor points redemption in Dubai and works well for families.",
    amenities: ["Private beach", "Lagoon pool", "Club Millésime", "Spa", "Kids club", "Eight restaurants"],
    vibe: ["beach", "family", "palm jumeirah", "polynesian"], art: ["#1a6a86", "#f8c98a", "coast"],
  },
  // ── Doha ───────────────────────────────────────────────────────
  {
    name: "Park Hyatt Doha", brand: "Park Hyatt", program: "world-of-hyatt", city: "Doha", lat: 25.2920, lon: 51.5450,
    category: 4, stars: 5, tier: "luxury", cash: 260,
    description: "A 2019 opening at the heart of Msheireb Downtown with a rooftop pool, the Sora teppanyaki and a spa tucked into the city's walkable new quarter. At 15,000 points it is a very affordable Park Hyatt beside Souq Waqif.",
    amenities: ["Rooftop pool", "Spa", "Fitness center", "Sora restaurant", "Concierge", "Metro access"],
    vibe: ["msheireb", "walkable", "sweet spot", "modern"], art: ["#3a2d4f", "#f3b56e", "desert"],
  },
  {
    name: "The St. Regis Doha", brand: "St. Regis", program: "marriott-bonvoy", city: "Doha", lat: 25.3610, lon: 51.5270,
    stars: 5, tier: "luxury", cash: 300, points: 50000,
    description: "A West Bay beachfront palace with a 350-meter beach, a Remède Spa, the Olympic-size pool and Gordon Ramsay's Opal restaurant. Butlers and Platinum lounge access make it an opulent stopover for Qatar Airways connections.",
    amenities: ["Private beach", "Butler service", "Remède Spa", "Olympic pool", "Executive lounge", "Gordon Ramsay dining"],
    vibe: ["beach", "butler", "stopover", "grand"], art: ["#2b2f55", "#f7cf8b", "coast"],
  },
  {
    name: "Waldorf Astoria Lusail Doha", brand: "Waldorf Astoria", program: "hilton-honors", city: "Doha", lat: 25.4040, lon: 51.5100,
    stars: 5, tier: "luxury", cash: 330, points: 65000,
    description: "A 2023 Lusail marina landmark with 426 keys, a Peacock Alley, a private beach and a Waldorf Astoria Spa with hammams. Rooms are vast and views across the Arabian Gulf and Lusail Stadium are the backdrop to one of Hilton's best Gulf redemptions.",
    amenities: ["Private beach", "Spa with hammam", "Outdoor pool", "Fitness center", "Peacock Alley", "Kids club"],
    vibe: ["marina", "new", "beach", "grand"], art: ["#1d2a4d", "#f0c07a", "coast"],
  },
  // ── Cairo ──────────────────────────────────────────────────────
  {
    name: "Marriott Mena House, Cairo", brand: "Marriott Hotels", program: "marriott-bonvoy", city: "Cairo", lat: 29.9850, lon: 31.1370,
    stars: 5, tier: "luxury", cash: 330, points: 50000,
    description: "The 1869 hunting lodge turned hotel at the foot of the Giza plateau, where pyramid-view rooms and the palm-ringed pool look straight at the Great Pyramid of Khufu. The historic Palace wing rooms are the ones to book, ideally on a fifth-night-free stay.",
    amenities: ["Pyramid views", "Outdoor pool", "Spa", "Fitness center", "Historic palace wing", "Gardens"],
    vibe: ["pyramid views", "heritage", "iconic", "gardens"], art: ["#8a5a2b", "#f6d27f", "desert"],
  },
  {
    name: "The St. Regis Cairo", brand: "St. Regis", program: "marriott-bonvoy", city: "Cairo", lat: 30.0670, lon: 31.2300,
    stars: 5, tier: "luxury", cash: 350, points: 55000,
    description: "A 2021 Nile-front tower on the Corniche with 286 rooms, butlers, a Nile-facing infinity pool and nine restaurants including J&G Steakhouse. The grand marble lobby and river views make it the most lavish points hotel in Egypt.",
    amenities: ["Nile views", "Butler service", "Infinity pool", "Iridium Spa", "Nine restaurants", "Fitness center"],
    vibe: ["nile views", "butler", "opulent", "new"], art: ["#2a2f4f", "#e9b96e", "skyline"],
  },
  {
    name: "Conrad Cairo", brand: "Conrad", program: "hilton-honors", city: "Cairo", lat: 30.0640, lon: 31.2290,
    stars: 5, tier: "upscale", cash: 170, points: 38000,
    description: "A Corniche el-Nil tower with Nile-view rooms, a riverside pool and an executive lounge that opens to Gold members, next to the Cairo World Trade Center. Points rates are low and it is a dependable base for Egyptian Museum and Zamalek visits.",
    amenities: ["Executive lounge", "Outdoor pool", "Spa", "Fitness center", "Nile views", "Casino"],
    vibe: ["nile views", "value", "business", "lounge"], art: ["#243653", "#f2c484", "skyline"],
  },
  // ── Cape Town & Zanzibar ───────────────────────────────────────
  {
    name: "Hyatt Regency Cape Town", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Cape Town", lat: -33.9205, lon: 18.4160,
    category: 2, stars: 5, tier: "upscale", cash: 190,
    description: "A 2019 conversion in the Bo-Kaap quarter with 137 rooms, a Regency Club and a rooftop terrace looking toward Signal Hill and the V&A Waterfront. At 8,000 points it is a rare sub-10k Hyatt in a bucket-list city.",
    amenities: ["Regency Club", "Rooftop terrace", "Fitness center", "Restaurant", "Concierge", "Shuttle"],
    vibe: ["bo-kaap", "sweet spot", "heritage", "central"], art: ["#2c3e63", "#f6b26b", "mountain"],
  },
  {
    name: "The Westin Cape Town", brand: "Westin", program: "marriott-bonvoy", city: "Cape Town", lat: -33.9150, lon: 18.4240,
    stars: 5, tier: "upscale", cash: 220, points: 40000,
    description: "A 19-storey tower above the Cape Town International Convention Centre with Table Mountain and harbour views, a 19th-floor Arabella Spa and indoor pool. It is a five-minute walk to the V&A Waterfront and prices gently on Bonvoy points.",
    amenities: ["Executive lounge", "Indoor pool", "Arabella Spa", "Fitness center", "Thirty7 restaurant", "Waterfront access"],
    vibe: ["table mountain views", "waterfront", "spa", "value"], art: ["#1f3b5a", "#9bc7e8", "mountain"],
  },
  {
    name: "Cape Grace, A Fairmont Managed Hotel", brand: "Fairmont", program: "accor-all", city: "Cape Town", lat: -33.9080, lon: 18.4200,
    stars: 5, tier: "luxury", cash: 650,
    description: "The grand dame of the V&A Waterfront on its own quay, reopened in 2024 under Fairmont management with a full redesign, Bascule whisky bar and yacht-marina views. Table Mountain fills the terrace sightlines and the service is the city's benchmark.",
    amenities: ["Outdoor pool", "Spa", "Fitness center", "Bascule bar", "Marina views", "Chauffeur service"],
    vibe: ["waterfront", "heritage", "table mountain views", "whisky"], art: ["#1a3250", "#f3c585", "coast"],
  },
  {
    name: "Park Hyatt Zanzibar", brand: "Park Hyatt", program: "world-of-hyatt", city: "Zanzibar", lat: -6.1630, lon: 39.1860,
    category: 5, stars: 5, tier: "luxury", cash: 480,
    description: "A 67-room seafront hotel built into the 17th-century Mambo Msiige mansion in Stone Town, with an infinity pool on the Indian Ocean and dhow sunsets from the terrace. It is a 20,000-point Park Hyatt in a UNESCO site, which is nearly unmatched value.",
    amenities: ["Infinity pool", "Spa", "Fitness center", "Seafront terrace", "The Dining Room", "Heritage building"],
    vibe: ["stone town", "sweet spot", "sunsets", "heritage"], art: ["#0f5b6e", "#f3a86d", "coast"],
  },
  // ── Istanbul ───────────────────────────────────────────────────
  {
    name: "Park Hyatt Istanbul – Maçka Palas", brand: "Park Hyatt", program: "world-of-hyatt", city: "Istanbul", lat: 41.0440, lon: 28.9930,
    category: 4, stars: 5, tier: "luxury", cash: 330,
    description: "A 1922 Art Deco apartment block in Nişantaşı converted into 90 rooms, many with private hammams and the Spa Suites' heated marble massage beds. The intimate scale and 15,000-point rate make it one of the chart's standout Park Hyatt values.",
    amenities: ["In-room hammams", "Spa", "Fitness center", "Outdoor pool", "The Prime steakhouse", "Concierge"],
    vibe: ["art deco", "hammam", "boutique", "sweet spot"], art: ["#3a2f46", "#e7a86a", "skyline"],
  },
  {
    name: "Conrad Istanbul Bosphorus", brand: "Conrad", program: "hilton-honors", city: "Istanbul", lat: 41.0430, lon: 29.0040,
    stars: 5, tier: "luxury", cash: 260, points: 55000,
    description: "A Beşiktaş hillside tower above Yıldız Park with Bosphorus-view rooms, a large outdoor pool and a summer rooftop bar. The executive lounge is one of Hilton's most generous and points rates stay low for the view on offer.",
    amenities: ["Executive lounge", "Outdoor pool", "Spa", "Fitness center", "Bosphorus views", "Summit Bar"],
    vibe: ["bosphorus views", "lounge", "value", "classic"], art: ["#1e2f4e", "#8fc1e5", "skyline"],
  },
  {
    name: "The Ritz-Carlton, Istanbul", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Istanbul", lat: 41.0400, lon: 28.9890,
    stars: 5, tier: "luxury", cash: 380, points: 60000,
    description: "A Dolmabahçe tower with Bosphorus views from the club lounge, a Turkish hammam in the spa and the Bleu Lounge terrace in summer. Rooms were fully refreshed in 2022 and the Taksim location is a short walk to Istiklal.",
    amenities: ["Club lounge", "Hammam spa", "Indoor pool", "Fitness center", "Bleu Lounge", "Bosphorus views"],
    vibe: ["bosphorus views", "hammam", "club lounge", "central"], art: ["#262848", "#f2bb6c", "skyline"],
  },
  {
    name: "Raffles Istanbul", brand: "Raffles", program: "accor-all", city: "Istanbul", lat: 41.0680, lon: 29.0120,
    stars: 5, tier: "luxury", cash: 480,
    description: "A 181-room hotel atop Zorlu Center with Raffles butlers, a 3,000-square-meter spa with hammam, an outdoor infinity pool and sweeping Bosphorus views from the Long Bar. Accor points redeem at a flat rate, so high cash rates here convert cleanly.",
    amenities: ["Butler service", "Infinity pool", "Hammam spa", "Fitness center", "Long Bar", "Mall access"],
    vibe: ["butler", "spa", "bosphorus views", "glamour"], art: ["#1f2340", "#e6b566", "skyline"],
  },
  // ── London ─────────────────────────────────────────────────────
  {
    name: "Park Hyatt London River Thames", brand: "Park Hyatt", program: "world-of-hyatt", city: "London", lat: 51.4835, lon: -0.1780,
    category: 7, stars: 5, tier: "luxury", cash: 700,
    description: "Opened in late 2024 on the Battersea waterfront at Nine Elms, with 203 rooms, a 25-meter indoor pool, river-view terraces and the brand's hushed, art-filled style. It is Hyatt's first Park Hyatt in the UK and books at 30,000 points.",
    amenities: ["Indoor pool", "Spa", "Fitness center", "River terraces", "Three restaurants", "Concierge"],
    vibe: ["new", "riverside", "serene", "design"], art: ["#20283f", "#b9c7d6", "skyline"],
  },
  {
    name: "Andaz London Liverpool Street", brand: "Andaz", program: "world-of-hyatt", city: "London", lat: 51.5176, lon: -0.0810,
    category: 5, stars: 5, tier: "luxury", cash: 380,
    description: "The 1884 Great Eastern Hotel beside Liverpool Street station, with a hidden Masonic temple, Rake's Café Bar and 267 rooms in Victorian bones. Shoreditch is a five-minute walk and 20,000 points is strong value for central London.",
    amenities: ["Fitness center", "Masonic temple", "Rake's bar", "Three restaurants", "Free minibar snacks", "Concierge"],
    vibe: ["victorian", "shoreditch", "value", "quirky"], art: ["#2d2a3e", "#d48d6a", "skyline"],
  },
  {
    name: "Great Scotland Yard Hotel", brand: "The Unbound Collection", program: "world-of-hyatt", city: "London", lat: 51.5063, lon: -0.1256,
    category: 6, stars: 5, tier: "luxury", cash: 480,
    description: "The former Metropolitan Police headquarters off Whitehall, reopened in 2019 with 153 rooms, a whisky bar hidden behind a bookcase and Edwardian façades. Trafalgar Square is two minutes away and the 25,000-point rate is fair for Westminster.",
    amenities: ["Fitness center", "Sibín whisky bar", "The Parlour", "Afternoon tea", "Concierge", "Heritage building"],
    vibe: ["heritage", "whitehall", "whisky", "storied"], art: ["#262b3a", "#c9a36a", "skyline"],
  },
  {
    name: "Conrad London St. James", brand: "Conrad", program: "hilton-honors", city: "London", lat: 51.4993, lon: -0.1337,
    stars: 5, tier: "luxury", cash: 480, points: 85000,
    description: "A 256-room hotel opposite St James's Park tube and a short walk from Buckingham Palace, with the Blue Boar pub, an executive lounge and large, quiet rooms. Diamond members get solid upgrades and the location suits first-time visitors.",
    amenities: ["Executive lounge", "Fitness center", "Blue Boar pub", "Afternoon tea", "Concierge", "Tube access"],
    vibe: ["westminster", "lounge", "classic", "walkable"], art: ["#1f2a44", "#9fb8d3", "skyline"],
  },
  {
    name: "St. Pancras Renaissance Hotel London", brand: "Renaissance", program: "marriott-bonvoy", city: "London", lat: 51.5306, lon: -0.1263,
    stars: 5, tier: "luxury", cash: 480, points: 80000,
    description: "George Gilbert Scott's 1873 Gothic Revival masterpiece attached to St Pancras International, with the grand staircase from the Spice Girls video and Chambers Club rooms in the original hotel wing. Eurostar arrives steps away and the spa pool sits in a Victorian hall.",
    amenities: ["Chambers Club", "Indoor pool", "Spa", "Fitness center", "Booking Office bar", "Eurostar access"],
    vibe: ["gothic", "eurostar", "heritage", "grand"], art: ["#3a2228", "#e3a46e", "skyline"],
  },
  {
    name: "The Waldorf Hilton, London", brand: "Hilton", program: "hilton-honors", city: "London", lat: 51.5125, lon: -0.1192,
    stars: 5, tier: "upscale", cash: 350, points: 70000,
    description: "The 1908 Edwardian landmark on Aldwych between Covent Garden and the Strand, with the Palm Court ballroom, a lap pool and an executive lounge. Theatre-goers love the location and Hilton points rates are reasonable for a heritage building.",
    amenities: ["Executive lounge", "Indoor pool", "Fitness center", "Palm Court", "Homage restaurant", "Concierge"],
    vibe: ["edwardian", "covent garden", "theatre", "value"], art: ["#2a2c44", "#d9b27a", "skyline"],
  },
  {
    name: "InterContinental London Park Lane", brand: "InterContinental", program: "ihg-one-rewards", city: "London", lat: 51.5035, lon: -0.1503,
    stars: 5, tier: "luxury", cash: 520, points: 90000,
    description: "The 1975 Mayfair flagship at Hyde Park Corner on the site of the Queen's childhood home, with Theo Randall's Italian and a Club InterContinental lounge overlooking the park. Rooms were refreshed through 2023 and park-view rooms are the award to request.",
    amenities: ["Club lounge", "Fitness center", "Spa", "Theo Randall restaurant", "Afternoon tea", "Park views"],
    vibe: ["mayfair", "hyde park", "club lounge", "classic"], art: ["#1c2b3f", "#a9c3a0", "skyline"],
  },
  {
    name: "The London EDITION", brand: "EDITION", program: "marriott-bonvoy", city: "London", lat: 51.5176, lon: -0.1354,
    stars: 5, tier: "luxury", cash: 560, points: 95000,
    description: "Ian Schrager's Fitzrovia hotel in a 1835 building with a stucco-ceilinged Lobby Bar, the Punch Room and Berners Tavern's Jason Atherton menu. Rooms are oak-panelled and compact, but the scene and the Oxford Street location are the point.",
    amenities: ["Lobby Bar", "Punch Room", "Berners Tavern", "Fitness center", "Spa treatment rooms", "Concierge"],
    vibe: ["nightlife", "fitzrovia", "design", "scene"], art: ["#15171f", "#e2a861", "skyline"],
  },
  {
    name: "Kimpton Fitzroy London", brand: "Kimpton", program: "ihg-one-rewards", city: "London", lat: 51.5218, lon: -0.1240,
    stars: 5, tier: "luxury", cash: 400, points: 70000,
    description: "The 1898 terracotta palace on Russell Square, restored in 2018 with 334 rooms, the Fitz's bar beneath a mosaic ceiling and Kimpton's free evening wine hour. Bloomsbury's museums and King's Cross are both walkable.",
    amenities: ["Fitness center", "Fitz's bar", "Burr & Co café", "Evening wine hour", "Pet friendly", "Concierge"],
    vibe: ["bloomsbury", "victorian", "lifestyle", "wine hour"], art: ["#3b2a2a", "#e3a07a", "skyline"],
  },
  // ── Paris ──────────────────────────────────────────────────────
  {
    name: "Park Hyatt Paris-Vendôme", brand: "Park Hyatt", program: "world-of-hyatt", city: "Paris", lat: 48.8700, lon: 2.3310,
    category: 8, stars: 5, tier: "luxury", cash: 1500,
    description: "Five Haussmann buildings on rue de la Paix joined into one Ed Tuttle-designed palace with Michelin-starred Pur' and a Le Spa hammam a minute from Place Vendôme. At 40,000 points against four-figure cash rates, it is the Hyatt chart's most lucrative city award.",
    amenities: ["Le Spa", "Fitness center", "Pur' restaurant", "Les Orchidées", "Butler service", "Concierge"],
    vibe: ["palace", "vendôme", "sweet spot", "michelin"], art: ["#2b2338", "#d9b56e", "skyline"],
  },
  {
    name: "Hyatt Regency Paris Étoile", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Paris", lat: 48.8780, lon: 2.2830,
    category: 4, stars: 4, tier: "upscale", cash: 260,
    description: "The 34-storey tower at Porte Maillot, where every room has an Eiffel Tower or La Défense view and the Windo Skybar sits on the 34th floor. Rooms are compact but the 15,000-point rate and the Regency Club make it a sensible Paris base.",
    amenities: ["Regency Club", "Windo Skybar", "Fitness center", "Spa", "Metro access", "Concierge"],
    vibe: ["eiffel views", "skybar", "value", "tower"], art: ["#1e2846", "#a7bfe0", "skyline"],
  },
  {
    name: "Prince de Galles, a Luxury Collection Hotel", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "Paris", lat: 48.8700, lon: 2.3020,
    stars: 5, tier: "luxury", cash: 900, points: 110000,
    description: "A 1928 Art Deco jewel on avenue George V with a mosaic-tiled Patio courtyard, Pierre-Yves Rochon interiors and the Les Heures bar. It is Marriott's most refined Paris redemption and the fifth night free brings a five-night stay well under cash.",
    amenities: ["Fitness center", "Spa treatment rooms", "Patio courtyard", "Les Heures bar", "Butler service", "Concierge"],
    vibe: ["art deco", "golden triangle", "intimate", "glamour"], art: ["#2a2240", "#e0b370", "skyline"],
  },
  {
    name: "Hilton Paris Opéra", brand: "Hilton", program: "hilton-honors", city: "Paris", lat: 48.8757, lon: 2.3260,
    stars: 4, tier: "upscale", cash: 320, points: 70000,
    description: "The 1889 Grand Hôtel Terminus beside Gare Saint-Lazare, restored with a frescoed Le Grand Salon and 268 modern rooms. It is Hilton's main Paris property and the executive lounge is open to Gold members.",
    amenities: ["Executive lounge", "Fitness center", "Le Grand Salon", "Concierge", "Metro access", "Bar"],
    vibe: ["belle époque", "opéra", "value", "central"], art: ["#2c2f4a", "#d8c08a", "skyline"],
  },
  {
    name: "Pullman Paris Tour Eiffel", brand: "Pullman", program: "accor-all", city: "Paris", lat: 48.8555, lon: 2.2925,
    stars: 4, tier: "upscale", cash: 350,
    description: "A 430-room tower on the edge of Champ de Mars where Eiffel-view rooms look straight at the tower's iron lattice. The Frame Brasserie terrace and rooftop event space share the view, and Accor points apply at a fixed €40 per 2,000.",
    amenities: ["Fitness center", "Frame Brasserie", "Rooftop terrace", "Concierge", "Eiffel views", "Bike rental"],
    vibe: ["eiffel views", "accor", "modern", "champ de mars"], art: ["#1f2b4d", "#f0a97a", "skyline"],
  },
  {
    name: "InterContinental Paris Le Grand", brand: "InterContinental", program: "ihg-one-rewards", city: "Paris", lat: 48.8713, lon: 2.3316,
    stars: 5, tier: "luxury", cash: 600, points: 95000,
    description: "The 1862 Grand Hôtel on Place de l'Opéra, with 470 rooms, the restored Café de la Paix and a winter-garden courtyard beneath a glass roof. Opera-view rooms and Club InterContinental make it the IHG grande dame of Paris.",
    amenities: ["Club lounge", "Fitness center", "Café de la Paix", "Winter garden", "Concierge", "Spa treatment rooms"],
    vibe: ["second empire", "opéra", "grand", "heritage"], art: ["#2a2545", "#d9b17a", "skyline"],
  },
  // ── Amsterdam ──────────────────────────────────────────────────
  {
    name: "Hyatt Regency Amsterdam", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Amsterdam", lat: 52.3568, lon: 4.9003,
    category: 4, stars: 4, tier: "upscale", cash: 280,
    description: "A botanical-themed 2017 hotel on Sarphatistraat beside the Hortus Botanicus with a green-wall courtyard, Mama Makan Indonesian restaurant and the Regency Club. Bikes rent at the door and the 15,000-point rate beats most Amsterdam cash rates.",
    amenities: ["Regency Club", "Fitness center", "Mama Makan", "Bike rental", "Courtyard garden", "Concierge"],
    vibe: ["botanical", "value", "bikes", "plantage"], art: ["#243b2f", "#f0a86b", "skyline"],
  },
  {
    name: "Andaz Amsterdam Prinsengracht", brand: "Andaz", program: "world-of-hyatt", city: "Amsterdam", lat: 52.3666, lon: 4.8830,
    category: 6, stars: 5, tier: "luxury", cash: 480,
    description: "Marcel Wanders' surreal take on a former public library on the Prinsengracht, with a bell-shaped lobby, Delft-blue murals and canal-view rooms. The Bluespoon bar's garden and the free minibar make 25,000 points feel like a good trade in the canal belt.",
    amenities: ["Fitness center", "Spa", "Bluespoon restaurant", "Garden", "Free minibar snacks", "Bike rental"],
    vibe: ["canal views", "marcel wanders", "design", "central"], art: ["#1f3350", "#f4a7b9", "skyline"],
  },
  {
    name: "Waldorf Astoria Amsterdam", brand: "Waldorf Astoria", program: "hilton-honors", city: "Amsterdam", lat: 52.3652, lon: 4.8940,
    stars: 5, tier: "luxury", cash: 850, points: 110000,
    description: "Six 17th-century canal palaces on the Herengracht joined around a private garden, with a two-Michelin-star Spectrum, a Guerlain spa and a vaulted-bank-turned-cocktail bar. Diamond members get breakfast in the Peacock Alley overlooking the canal.",
    amenities: ["Guerlain Spa", "Indoor pool", "Fitness center", "Spectrum restaurant", "Vault Bar", "Private garden"],
    vibe: ["canal palaces", "michelin", "ultra luxury", "heritage"], art: ["#1e2b44", "#dcbd7e", "skyline"],
  },
  {
    name: "Hilton Amsterdam", brand: "Hilton", program: "hilton-honors", city: "Amsterdam", lat: 52.3500, lon: 4.8720,
    stars: 5, tier: "upscale", cash: 330, points: 60000,
    description: "The 1962 Apollolaan hotel famous for John and Yoko's 1969 bed-in, now with a renovated marina-side terrace, executive lounge and the Roberto's Italian. It sits in the leafy Zuid district with a tram to the centre.",
    amenities: ["Executive lounge", "Fitness center", "Roberto's restaurant", "Marina terrace", "Bike rental", "Concierge"],
    vibe: ["bed-in history", "zuid", "lounge", "classic"], art: ["#2a3a5c", "#aac4e4", "skyline"],
  },
  {
    name: "InterContinental Amstel Amsterdam", brand: "InterContinental", program: "ihg-one-rewards", city: "Amsterdam", lat: 52.3615, lon: 4.9070,
    stars: 5, tier: "luxury", cash: 750, points: 100000,
    description: "The 1867 Amstel river palace where royalty and rock stars stay, with 79 rooms, a riverside terrace, a Roman-style indoor pool and the Amstel Bar. Points pricing is steep but it remains the city's most storied address.",
    amenities: ["Indoor pool", "Spa", "Fitness center", "Riverside terrace", "Amstel Bar", "Butler service"],
    vibe: ["palace", "amstel river", "royal", "heritage"], art: ["#2c2940", "#d6ad6d", "skyline"],
  },
  // ── Iberia ─────────────────────────────────────────────────────
  {
    name: "Hyatt Regency Lisbon", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Lisbon", lat: 38.6980, lon: -9.1920,
    category: 4, stars: 5, tier: "upscale", cash: 290,
    description: "A 2022 riverside hotel in Belém near the Jerónimos Monastery with a rooftop pool, the Serenity Spa and Tagus-view rooms. It is Hyatt's only full-service Lisbon property and the 15,000-point rate is comfortably under cash in summer.",
    amenities: ["Rooftop pool", "Serenity Spa", "Fitness center", "Regency Club", "River views", "Bike rental"],
    vibe: ["belém", "rooftop pool", "river views", "new"], art: ["#1f4a6e", "#f4c27a", "coast"],
  },
  {
    name: "Sofitel Lisbon Liberdade", brand: "Sofitel", program: "accor-all", city: "Lisbon", lat: 38.7210, lon: -9.1450,
    stars: 5, tier: "luxury", cash: 300,
    description: "A 163-room French-style hotel on Avenida da Liberdade with the Ad Lib brasserie and a Club Millésime, a short walk from Chiado and Bairro Alto. Portuguese tile and azulejo touches soften the corporate bones, and Accor points redeem at face value.",
    amenities: ["Club Millésime", "Fitness center", "Ad Lib brasserie", "Concierge", "Metro access", "Bar"],
    vibe: ["liberdade", "accor", "french", "central"], art: ["#2b3a5a", "#f1b56e", "skyline"],
  },
  {
    name: "The Madrid EDITION", brand: "EDITION", program: "marriott-bonvoy", city: "Madrid", lat: 40.4184, lon: -3.7050,
    stars: 5, tier: "luxury", cash: 600, points: 90000,
    description: "A 2022 John Pawson-designed hotel on Plaza de las Descalzas with a helix staircase, a rooftop pool with city views and Enrique Olvera's Jerónimo restaurant. It is Madrid's most fashionable Marriott and books under cash on points most of the year.",
    amenities: ["Rooftop pool", "Spa", "Fitness center", "Jerónimo restaurant", "Punch Room", "Concierge"],
    vibe: ["rooftop pool", "design", "nightlife", "central"], art: ["#1c1e2e", "#f0a060", "skyline"],
  },
  {
    name: "Thompson Madrid", brand: "Thompson Hotels", program: "world-of-hyatt", city: "Madrid", lat: 40.4190, lon: -3.7010,
    category: 5, stars: 5, tier: "luxury", cash: 380,
    description: "A 175-room 2022 opening on Plaza del Carmen between Puerta del Sol and Gran Vía, with the Hijos de Tomás rooftop and the Omar Malpartida-led Luna Rossa. Rooms feel residential and the 20,000-point rate is excellent for central Madrid.",
    amenities: ["Rooftop bar", "Fitness center", "Spa", "Luna Rossa restaurant", "Concierge", "Metro access"],
    vibe: ["rooftop", "gran vía", "value", "lifestyle"], art: ["#2d2a4a", "#f5b26b", "skyline"],
  },
  {
    name: "Hotel Arts Barcelona", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Barcelona", lat: 41.3870, lon: 2.1960,
    stars: 5, tier: "luxury", cash: 650, points: 100000,
    description: "The 44-storey beachfront tower at Port Olímpic beside Frank Gehry's fish sculpture, with a two-Michelin-star Enoteca, a 43rd-floor spa and a palm-fringed pool. Sea-view rooms and the club lounge keep it among Europe's most sought-after Bonvoy stays.",
    amenities: ["Club lounge", "Outdoor pool", "43 The Spa", "Fitness center", "Enoteca", "Beach access"],
    vibe: ["beachfront", "michelin", "tower views", "glamour"], art: ["#1b3a5c", "#f2c078", "coast"],
  },
  {
    name: "W Barcelona", brand: "W Hotels", program: "marriott-bonvoy", city: "Barcelona", lat: 41.3680, lon: 2.1900,
    stars: 5, tier: "luxury", cash: 480, points: 80000,
    description: "Ricardo Bofill's sail-shaped tower on Barceloneta beach with a 26th-floor Eclipse bar, two pools and the WET deck scene in summer. Every room faces the sea or the city and points rates fall sharply in winter.",
    amenities: ["Two pools", "Eclipse bar", "AWAY Spa", "Fitness center", "Beach access", "WET deck"],
    vibe: ["beach", "nightlife", "architecture", "sea views"], art: ["#163a5e", "#7fd1e8", "coast"],
  },
  {
    name: "Kimpton Vividora Barcelona", brand: "Kimpton", program: "ihg-one-rewards", city: "Barcelona", lat: 41.3830, lon: 2.1760,
    stars: 4, tier: "upscale", cash: 300, points: 55000,
    description: "A 156-room Gothic Quarter hotel with the Terraza de Vivi rooftop pool and bar, Fauna restaurant and Kimpton's nightly wine hour. It is a lively, well-placed IHG option a few steps from La Rambla.",
    amenities: ["Rooftop pool", "Fitness center", "Fauna restaurant", "Evening wine hour", "Pet friendly", "Concierge"],
    vibe: ["gothic quarter", "rooftop pool", "lifestyle", "value"], art: ["#3a2d3f", "#f0a874", "skyline"],
  },
  // ── Italy ──────────────────────────────────────────────────────
  {
    name: "The St. Regis Rome", brand: "St. Regis", program: "marriott-bonvoy", city: "Rome", lat: 41.9040, lon: 12.4950,
    stars: 5, tier: "luxury", cash: 850, points: 110000,
    description: "César Ritz's 1894 Grand Hotel near Piazza della Repubblica, renovated in 2018 with Pierre-Yves Rochon interiors, the Lumen bar and butler service on every floor. It remains Rome's most luxurious points hotel and the fifth night free softens the price.",
    amenities: ["Butler service", "Fitness center", "Spa", "Lumen bar", "Afternoon tea", "Concierge"],
    vibe: ["belle époque", "butler", "palace", "central"], art: ["#3a2a2e", "#e0b26e", "skyline"],
  },
  {
    name: "Rome Cavalieri, A Waldorf Astoria Hotel", brand: "Waldorf Astoria", program: "hilton-honors", city: "Rome", lat: 41.9180, lon: 12.4460,
    stars: 5, tier: "luxury", cash: 600, points: 100000,
    description: "A 15-acre hilltop estate on Monte Mario with Rome's only three-Michelin-star restaurant, La Pergola, three outdoor pools and an art collection with Tiepolos. The city-view rooms and Imperial Club lounge are the award to pursue on points.",
    amenities: ["Three pools", "Grand Spa", "Imperial Club", "La Pergola", "Tennis", "Shuttle to centre"],
    vibe: ["hilltop", "michelin", "resort", "art"], art: ["#2d3a2a", "#f3c57a", "skyline"],
  },
  {
    name: "InterContinental Rome Ambasciatori Palace", brand: "InterContinental", program: "ihg-one-rewards", city: "Rome", lat: 41.9060, lon: 12.4890,
    stars: 5, tier: "luxury", cash: 500, points: 80000,
    description: "A 1900 palazzo on Via Veneto reopened in 2023 after a full restoration, with 160 rooms, the Charlie's bar and Scarpetta NYC's first Italian outpost. Club InterContinental and the Dolce Vita address make it IHG's best Rome play.",
    amenities: ["Club lounge", "Fitness center", "Spa", "Scarpetta restaurant", "Charlie's bar", "Concierge"],
    vibe: ["via veneto", "palazzo", "new", "club lounge"], art: ["#2f2538", "#e8b36b", "skyline"],
  },
  {
    name: "Park Hyatt Milano", brand: "Park Hyatt", program: "world-of-hyatt", city: "Milan", lat: 45.4655, lon: 9.1900,
    category: 8, stars: 5, tier: "luxury", cash: 1100,
    description: "A 1870 palazzo beside the Galleria Vittorio Emanuele II with a glass-cupola lounge, travertine bathrooms and the Michelin-starred Mio Lab. It is the fashion crowd's hotel and the 40,000-point rate covers four-figure cash nights during Salone and fashion week.",
    amenities: ["Spa", "Fitness center", "La Cupola lounge", "Mio Lab bar", "Butler service", "Concierge"],
    vibe: ["galleria", "fashion week", "sweet spot", "palazzo"], art: ["#2b2838", "#d8b073", "skyline"],
  },
  {
    name: "Excelsior Hotel Gallia, a Luxury Collection Hotel", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "Milan", lat: 45.4860, lon: 9.2030,
    stars: 5, tier: "luxury", cash: 550, points: 80000,
    description: "A 1932 Liberty-style landmark on Piazza Duca d'Aosta beside Milano Centrale, with a 1,000-square-meter Shiseido spa, a rooftop Terrazza Gallia and 235 rooms. It is the elegant Bonvoy choice for Milan and convenient for train travel.",
    amenities: ["Shiseido Spa", "Indoor pool", "Fitness center", "Terrazza Gallia", "Executive lounge", "Station access"],
    vibe: ["liberty style", "spa", "station access", "grand"], art: ["#2c2a44", "#e6b56e", "skyline"],
  },
  // ── Vienna & Zurich ────────────────────────────────────────────
  {
    name: "Park Hyatt Vienna", brand: "Park Hyatt", program: "world-of-hyatt", city: "Vienna", lat: 48.2100, lon: 16.3690,
    category: 6, stars: 5, tier: "luxury", cash: 620,
    description: "A 1915 bank headquarters on Am Hof in the Goldenes Quartier, with a swimming pool in the former vault, the Arany Spa and Bank Brasserie beneath a 22-foot ceiling. It is one of Europe's grandest Park Hyatts at 25,000 points.",
    amenities: ["Vault pool", "Arany Spa", "Fitness center", "Bank Brasserie", "Living Room lounge", "Concierge"],
    vibe: ["vault pool", "goldenes quartier", "grand", "heritage"], art: ["#2a2640", "#dcb86f", "skyline"],
  },
  {
    name: "Hotel Imperial, a Luxury Collection Hotel", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "Vienna", lat: 48.2010, lon: 16.3730,
    stars: 5, tier: "luxury", cash: 600, points: 85000,
    description: "The 1863 Württemberg palace on the Ringstrasse that became Vienna's state guest house, with the Imperial Torte, butlers and royal staircase intact. Rooms have Biedermeier antiques and the Musikverein is across the street.",
    amenities: ["Butler service", "Fitness center", "Café Imperial", "Afternoon tea", "Concierge", "Heritage building"],
    vibe: ["ringstrasse", "palace", "butler", "imperial"], art: ["#352a3e", "#e9c27a", "skyline"],
  },
  {
    name: "Park Hyatt Zurich", brand: "Park Hyatt", program: "world-of-hyatt", city: "Zurich", lat: 47.3680, lon: 8.5370,
    category: 7, stars: 5, tier: "luxury", cash: 850,
    description: "A 138-room contemporary hotel between Paradeplatz and Lake Zurich with vast rooms, the Parkhuus restaurant's glass wine tower and a quiet spa. Swiss cash rates make the 30,000-point rate a consistent winner.",
    amenities: ["Spa", "Fitness center", "Parkhuus restaurant", "Onyx Bar", "Concierge", "Lake access"],
    vibe: ["paradeplatz", "spacious", "lakeside", "refined"], art: ["#223550", "#b3cde6", "mountain"],
  },
  {
    name: "Zurich Marriott Hotel", brand: "Marriott Hotels", program: "marriott-bonvoy", city: "Zurich", lat: 47.3830, lon: 8.5390,
    stars: 4, tier: "upscale", cash: 350, points: 50000,
    description: "A 266-room riverside hotel on the Limmat with Alpine views from upper floors, an M Club lounge and White Elephant Thai. It is a ten-minute walk to the Hauptbahnhof and Bonvoy points stretch further here than most of Switzerland.",
    amenities: ["M Club lounge", "Fitness center", "White Elephant restaurant", "River views", "Concierge", "Bike rental"],
    vibe: ["riverside", "value", "business", "alpine views"], art: ["#2b3f5f", "#a9c6e4", "mountain"],
  },
  // ── New York ───────────────────────────────────────────────────
  {
    name: "Park Hyatt New York", brand: "Park Hyatt", program: "world-of-hyatt", city: "New York", lat: 40.7655, lon: -73.9790,
    category: 8, stars: 5, tier: "luxury", cash: 1200,
    description: "The first 25 floors of One57 on Billionaires' Row, with a 25th-floor indoor pool piped with underwater music, a Spa Nalai and rooms starting at 475 square feet. Central Park is a block away and 40,000 points regularly replaces a four-figure cash rate.",
    amenities: ["Indoor pool", "Spa Nalai", "Fitness center", "The Living Room bar", "Butler service", "Concierge"],
    vibe: ["billionaires' row", "sweet spot", "pool", "midtown"], art: ["#1c2033", "#c7a76a", "skyline"],
  },
  {
    name: "Andaz 5th Avenue", brand: "Andaz", program: "world-of-hyatt", city: "New York", lat: 40.7527, lon: -73.9810,
    category: 6, stars: 5, tier: "luxury", cash: 520,
    description: "A Tony Chi-designed loft-style hotel opposite the New York Public Library with 12-foot ceilings, oversized windows and The Bar Downstairs in the cellar. Rooms are among Midtown's largest and the free minibar snacks are an Andaz signature.",
    amenities: ["Fitness center", "The Bar Downstairs", "Free minibar snacks", "Concierge", "Pet friendly", "Library views"],
    vibe: ["loft style", "bryant park", "design", "spacious"], art: ["#242836", "#e0a05a", "skyline"],
  },
  {
    name: "Thompson Central Park New York", brand: "Thompson Hotels", program: "world-of-hyatt", city: "New York", lat: 40.7640, lon: -73.9790,
    category: 6, stars: 4, tier: "luxury", cash: 450,
    description: "The former Parker New York on West 56th, reborn in 2021 with 587 rooms, the Burger Joint still hidden behind the lobby curtain and the Indian Accent restaurant. Central Park South is a block away and 25,000 points is fair for this corner of Midtown.",
    amenities: ["Fitness center", "Burger Joint", "Indian Accent", "Parker's bar", "Concierge", "Pet friendly"],
    vibe: ["central park", "lifestyle", "burger joint", "midtown"], art: ["#1e2a3c", "#8fa9c7", "skyline"],
  },
  {
    name: "Conrad New York Downtown", brand: "Conrad", program: "hilton-honors", city: "New York", lat: 40.7150, lon: -74.0155,
    stars: 5, tier: "luxury", cash: 480, points: 95000,
    description: "An all-suite Battery Park City hotel with a 100-foot Sol LeWitt mural in the atrium, a seasonal rooftop bar overlooking the Hudson and Statue of Liberty, and 463 suites averaging 430 square feet. It is the roomiest Hilton redemption in Manhattan.",
    amenities: ["All suites", "Loopy Doopy rooftop", "Fitness center", "Executive lounge", "Hudson views", "Concierge"],
    vibe: ["all-suite", "hudson views", "rooftop", "downtown"], art: ["#15233a", "#73a8d8", "skyline"],
  },
  {
    name: "The St. Regis New York", brand: "St. Regis", program: "marriott-bonvoy", city: "New York", lat: 40.7616, lon: -73.9748,
    stars: 5, tier: "luxury", cash: 1300, points: 130000,
    description: "John Jacob Astor's 1904 Beaux-Arts hotel on Fifth Avenue, home of the Bloody Mary at the King Cole Bar beneath Maxfield Parrish's mural and butlers on every floor. It is Marriott's flagship points stay in Manhattan and the fifth night free matters at this price.",
    amenities: ["Butler service", "King Cole Bar", "Fitness center", "Spa", "Astor Court", "Bentley house car"],
    vibe: ["beaux-arts", "butler", "fifth avenue", "iconic"], art: ["#2a2235", "#d9b36a", "skyline"],
  },
  {
    name: "Kimpton Hotel Eventi", brand: "Kimpton", program: "ihg-one-rewards", city: "New York", lat: 40.7467, lon: -73.9905,
    stars: 4, tier: "upscale", cash: 350, points: 65000,
    description: "A 292-room Chelsea tower on Sixth Avenue with a 4,000-square-foot plaza screen, the Monarch rooftop bar and L'Amico's Italian. Kimpton's wine hour and pet policy apply and Madison Square Garden is a block away.",
    amenities: ["Monarch rooftop", "Fitness center", "L'Amico restaurant", "Evening wine hour", "Pet friendly", "Concierge"],
    vibe: ["chelsea", "rooftop", "lifestyle", "value"], art: ["#2e2440", "#f09a6b", "skyline"],
  },
  {
    name: "Cambria Hotel New York – Chelsea", brand: "Cambria", program: "choice-privileges", city: "New York", lat: 40.7458, lon: -73.9880,
    stars: 3, tier: "midscale", cash: 280, points: 25000,
    description: "A 21-storey Chelsea hotel on West 28th with Empire State Building views from upper floors, a lobby bar and compact but well-finished rooms. It is Choice's best Manhattan redemption and Citi ThankYou's 1:2 transfer makes it cheap in bank points.",
    amenities: ["Fitness center", "Lobby bar", "Empire State views", "Concierge", "Free Wi-Fi", "Bike storage"],
    vibe: ["value", "chelsea", "empire state views", "citi transfer"], art: ["#273347", "#f2b35c", "skyline"],
  },
  // ── Chicago ────────────────────────────────────────────────────
  {
    name: "Park Hyatt Chicago", brand: "Park Hyatt", program: "world-of-hyatt", city: "Chicago", lat: 41.8972, lon: -87.6246,
    category: 7, stars: 5, tier: "luxury", cash: 650,
    description: "Hyatt's hometown flagship on Water Tower Square, refreshed in 2021 with 198 rooms, a 7th-floor NoMI terrace overlooking the Water Tower and an indoor pool with lake views. It is where Hyatt executives host guests and 30,000 points covers it.",
    amenities: ["Indoor pool", "Spa", "Fitness center", "NoMI restaurant", "NoMI Garden terrace", "Concierge"],
    vibe: ["magnificent mile", "flagship", "lake views", "refined"], art: ["#1d2a44", "#9fc5e8", "skyline"],
  },
  {
    name: "Hyatt Regency Chicago", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Chicago", lat: 41.8875, lon: -87.6225,
    category: 4, stars: 4, tier: "upscale", cash: 230,
    description: "The 2,032-room riverfront giant on East Wacker, the largest Hyatt in the world, with a renovated Regency Club and the Big Bar's 120-foot counter. River-view rooms at 15,000 points are a dependable convention-week escape.",
    amenities: ["Regency Club", "Fitness center", "Big Bar", "Stetsons steakhouse", "River views", "Riverwalk access"],
    vibe: ["riverfront", "convention", "value", "huge"], art: ["#223a5a", "#b9d3ea", "skyline"],
  },
  {
    name: "Waldorf Astoria Chicago", brand: "Waldorf Astoria", program: "hilton-honors", city: "Chicago", lat: 41.8999, lon: -87.6265,
    stars: 5, tier: "luxury", cash: 550, points: 85000,
    description: "A Parisian-style Gold Coast hotel entered through a cobblestone courtyard off Rush Street, with 215 rooms, fireplaces in many suites and an indoor pool beneath a glass ceiling. It is consistently rated Chicago's top hotel and a strong Hilton redemption.",
    amenities: ["Indoor pool", "Spa", "Fitness center", "Brass Tack restaurant", "Petit Margeaux café", "Courtyard"],
    vibe: ["gold coast", "parisian", "fireplaces", "refined"], art: ["#2a2740", "#d8b27a", "skyline"],
  },
  {
    name: "The St. Regis Chicago", brand: "St. Regis", program: "marriott-bonvoy", city: "Chicago", lat: 41.8876, lon: -87.6180,
    stars: 5, tier: "luxury", cash: 550, points: 85000,
    description: "Jeanne Gang's 101-storey frosted-glass tower at the river's mouth, opened in 2023 with 192 rooms, an indoor pool overlooking Lake Michigan and Miru's Japanese dining. Butlers and lake views from the 11th-floor pool deck make it Chicago's showiest Marriott.",
    amenities: ["Butler service", "Indoor pool", "Spa", "Fitness center", "Miru restaurant", "Lake views"],
    vibe: ["jeanne gang", "lakefront", "new", "butler"], art: ["#172a45", "#8ec9e9", "skyline"],
  },
  {
    name: "Wyndham Grand Chicago Riverfront", brand: "Wyndham Grand", program: "wyndham-rewards", city: "Chicago", lat: 41.8878, lon: -87.6265,
    stars: 4, tier: "upscale", cash: 280, points: 30000,
    description: "The former Hotel 71 on East Wacker with 334 river-view rooms, a fitness center and direct Riverwalk access, two blocks from Michigan Avenue. At the 30,000-point Wyndham tier it is a flat-rate alternative when downtown cash rates spike for conventions.",
    amenities: ["Fitness center", "River views", "Hoyt's restaurant", "Riverwalk access", "Concierge", "Business center"],
    vibe: ["riverfront", "flat rate", "convention", "value"], art: ["#243b5c", "#a8c8e8", "skyline"],
  },
  {
    name: "Radisson Blu Aqua Hotel Chicago", brand: "Radisson Blu", program: "choice-privileges", city: "Chicago", lat: 41.8870, lon: -87.6190,
    stars: 4, tier: "upscale", cash: 300, points: 30000,
    description: "Floors 1–18 of Jeanne Gang's rippling Aqua tower in Lakeshore East, with 334 rooms, an indoor and outdoor pool deck, and a park below. Choice took over Radisson Americas, so this design-forward hotel now books with Choice points.",
    amenities: ["Indoor pool", "Outdoor pool", "Fitness center", "Filini restaurant", "Park access", "Concierge"],
    vibe: ["architecture", "lakeshore east", "pools", "design"], art: ["#1c3450", "#9ad1e6", "skyline"],
  },
  // ── Washington ─────────────────────────────────────────────────
  {
    name: "Park Hyatt Washington D.C.", brand: "Park Hyatt", program: "world-of-hyatt", city: "Washington", lat: 38.9052, lon: -77.0506,
    category: 6, stars: 5, tier: "luxury", cash: 500,
    description: "A Tony Chi-designed West End hotel with a Tea Cellar of rare vintages, the Blue Duck Tavern's wood-fired cooking and an indoor pool with a retractable roof. Georgetown is a ten-minute walk and 25,000 points is sensible for a Park Hyatt.",
    amenities: ["Indoor pool", "Spa", "Fitness center", "Blue Duck Tavern", "Tea Cellar", "Concierge"],
    vibe: ["west end", "tea cellar", "quiet", "refined"], art: ["#243049", "#c9b58a", "skyline"],
  },
  {
    name: "Conrad Washington, DC", brand: "Conrad", program: "hilton-honors", city: "Washington", lat: 38.9008, lon: -77.0228,
    stars: 5, tier: "luxury", cash: 450, points: 80000,
    description: "Herzog & de Meuron's 2019 glass hotel at CityCenterDC, with a 10th-floor rooftop terrace, the Estuary restaurant by the Voltaggio brothers and 360 rooms with floor-to-ceiling glass. It is Hilton's most architecturally interesting DC stay.",
    amenities: ["Rooftop terrace", "Fitness center", "Estuary restaurant", "Summit bar", "Concierge", "Pet friendly"],
    vibe: ["architecture", "citycenter", "rooftop", "modern"], art: ["#1f2b44", "#9fb6d2", "skyline"],
  },
  {
    name: "Waldorf Astoria Washington DC", brand: "Waldorf Astoria", program: "hilton-honors", city: "Washington", lat: 38.8940, lon: -77.0278,
    stars: 5, tier: "luxury", cash: 800, points: 110000,
    description: "The 1899 Old Post Office on Pennsylvania Avenue, reflagged in 2022 with 263 rooms around a nine-storey atrium, the Bazaar by José Andrés and a clock-tower view over the Mall. It is the capital's most dramatic points hotel.",
    amenities: ["Spa", "Fitness center", "The Bazaar restaurant", "Peacock Alley", "Clock tower access", "Butler service"],
    vibe: ["old post office", "atrium", "josé andrés", "landmark"], art: ["#2c2a3e", "#d4b06f", "skyline"],
  },
  {
    name: "Kimpton Hotel Monaco Washington DC", brand: "Kimpton", program: "ihg-one-rewards", city: "Washington", lat: 38.8970, lon: -77.0225,
    stars: 4, tier: "upscale", cash: 280, points: 50000,
    description: "The 1839 General Post Office in Penn Quarter, a marble Robert Mills building with vaulted corridors, the Dirty Habit courtyard bar and rooms with 15-foot ceilings. Wine hour, pets and the National Portrait Gallery across the street make it a favourite.",
    amenities: ["Fitness center", "Dirty Habit bar", "Evening wine hour", "Pet friendly", "Bike loaners", "Concierge"],
    vibe: ["penn quarter", "historic", "lifestyle", "value"], art: ["#332a3c", "#e5a46e", "skyline"],
  },
  {
    name: "Cambria Hotel Washington D.C. Convention Center", brand: "Cambria", program: "choice-privileges", city: "Washington", lat: 38.9060, lon: -77.0220,
    stars: 3, tier: "midscale", cash: 220, points: 20000,
    description: "A 182-room hotel on M Street NW two blocks from the convention center with a rooftop bar, fitness center and Shaw's restaurants nearby. It is a sensible flat-ish Choice redemption when cherry blossom or inauguration pricing takes hold.",
    amenities: ["Rooftop bar", "Fitness center", "Bistro", "Free Wi-Fi", "Business center", "Metro access"],
    vibe: ["shaw", "value", "rooftop bar", "convention"], art: ["#263650", "#f0b26a", "skyline"],
  },
  // ── Los Angeles ────────────────────────────────────────────────
  {
    name: "Waldorf Astoria Beverly Hills", brand: "Waldorf Astoria", program: "hilton-honors", city: "Los Angeles", lat: 34.0705, lon: -118.4115,
    stars: 5, tier: "luxury", cash: 1100, points: 150000,
    description: "A 12-storey Pierre-Yves Rochon tower at Wilshire and Santa Monica Boulevards with a rooftop pool, Jean-Georges Beverly Hills and a La Prairie spa. Hilton's 150,000-point cap against $1,100 cash makes it a top Aspire card redemption on the mainland.",
    amenities: ["Rooftop pool", "La Prairie Spa", "Fitness center", "Jean-Georges", "Butler service", "House car"],
    vibe: ["beverly hills", "rooftop pool", "capped points", "glamour"], art: ["#2a2440", "#f1b66e", "skyline"],
  },
  {
    name: "Andaz West Hollywood", brand: "Andaz", program: "world-of-hyatt", city: "Los Angeles", lat: 34.0908, lon: -118.3826,
    category: 5, stars: 4, tier: "upscale", cash: 380,
    description: "The infamous Riot House on the Sunset Strip where Led Zeppelin rode motorcycles down the halls, now a sleek Andaz with a rooftop pool overlooking the city. Rooms have Strip or Hollywood Hills views and 20,000 points is strong value for West Hollywood.",
    amenities: ["Rooftop pool", "Fitness center", "Riot House restaurant", "Free minibar snacks", "Pet friendly", "Concierge"],
    vibe: ["sunset strip", "rock history", "rooftop pool", "value"], art: ["#2d1f3a", "#ff8c69", "skyline"],
  },
  {
    name: "Hotel Figueroa", brand: "The Unbound Collection", program: "world-of-hyatt", city: "Los Angeles", lat: 34.0423, lon: -118.2650,
    category: 3, stars: 4, tier: "upscale", cash: 250,
    description: "A 1926 Spanish Colonial YWCA turned bohemian hotel across from Crypto.com Arena, with a coffin-shaped pool, Moroccan-tiled lobby and rooftop bar. It is one of the cheapest Hyatt awards in a major US downtown.",
    amenities: ["Outdoor pool", "Fitness center", "Rooftop bar", "Café Fig", "Pet friendly", "Concierge"],
    vibe: ["downtown", "bohemian", "sweet spot", "historic"], art: ["#3b2a2f", "#f2a65e", "skyline"],
  },
  {
    name: "The Ritz-Carlton, Los Angeles", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Los Angeles", lat: 34.0450, lon: -118.2670,
    stars: 5, tier: "luxury", cash: 550, points: 80000,
    description: "Floors 22–26 of the L.A. LIVE tower above the arena, with a rooftop pool, a club lounge and WP24 by Wolfgang Puck on the 24th floor. Views sweep from downtown to the Hollywood sign and the club lounge opens to Platinum members.",
    amenities: ["Club lounge", "Rooftop pool", "Spa", "Fitness center", "WP24 restaurant", "Arena access"],
    vibe: ["l.a. live", "club lounge", "rooftop pool", "city views"], art: ["#1b2340", "#c9a46a", "skyline"],
  },
  {
    name: "Fairmont Century Plaza", brand: "Fairmont", program: "accor-all", city: "Los Angeles", lat: 34.0580, lon: -118.4160,
    stars: 5, tier: "luxury", cash: 600,
    description: "The 1966 Minoru Yamasaki crescent reopened in 2021 after a $2.5 billion restoration, with 400 rooms, a palm-lined rooftop pool and a 14,000-square-foot spa. Accor's fixed-value points make this the clearest luxury Los Angeles redemption outside Hilton.",
    amenities: ["Rooftop pool", "Fairmont Spa", "Fitness center", "Lumière brasserie", "Fairmont Gold lounge", "Concierge"],
    vibe: ["century city", "mid-century", "spa", "grand"], art: ["#2a3450", "#f0c78a", "skyline"],
  },
  {
    name: "Hyatt Regency Los Angeles International Airport", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Los Angeles", lat: 33.9440, lon: -118.3860,
    category: 2, stars: 4, tier: "upscale", cash: 200,
    description: "A 580-room airport hotel on Century Boulevard with an outdoor pool, 24-hour fitness center, Regency Club and free LAX shuttle. At 8,000 points it is the obvious pre-dawn-flight stay for Hyatt members.",
    amenities: ["Regency Club", "Outdoor pool", "Fitness center", "Airport shuttle", "Unity LA restaurant", "Business center"],
    vibe: ["airport", "sweet spot", "practical", "pool"], art: ["#2a3a5c", "#a9c7e8", "skyline"],
  },
  // ── Orange County & San Diego ──────────────────────────────────
  {
    name: "Hyatt Regency Huntington Beach Resort and Spa", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Orange County", lat: 33.6530, lon: -118.0030,
    category: 6, stars: 4, tier: "upscale", cash: 450,
    description: "A Spanish-style oceanfront resort with a pedestrian bridge over PCH to the beach, a waterslide pool complex, Pacific Waters Spa and fire pits for sunset. It is Southern California's go-to family Hyatt and 25,000 points dodges steep resort cash rates.",
    amenities: ["Waterslide pools", "Beach access", "Pacific Waters Spa", "Kids club", "Fitness center", "Fire pits"],
    vibe: ["beach", "family", "waterslides", "sunsets"], art: ["#1c4e72", "#f6c47f", "coast"],
  },
  {
    name: "The Ritz-Carlton, Laguna Niguel", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Orange County", lat: 33.4780, lon: -117.7190,
    stars: 5, tier: "luxury", cash: 900, points: 110000,
    description: "A 1984 blufftop resort above Salt Creek Beach in Dana Point, with two pools, a renovated club lounge and the Raya restaurant by Richard Sandoval. Ocean-view rooms and the fifth night free make a five-night California coast stay worth considering.",
    amenities: ["Club lounge", "Two pools", "Spa", "Fitness center", "Beach access", "Raya restaurant"],
    vibe: ["blufftop", "ocean views", "club lounge", "classic"], art: ["#1f4b70", "#f5cd8a", "coast"],
  },
  {
    name: "Waldorf Astoria Monarch Beach Resort & Club", brand: "Waldorf Astoria", program: "hilton-honors", city: "Orange County", lat: 33.4730, lon: -117.7090,
    stars: 5, tier: "luxury", cash: 750, points: 110000,
    description: "A Tuscan-style Dana Point resort with a Robert Trent Jones Jr. golf course, three pools, a Miraval Life in Balance spa and a private beach club. Hilton Diamonds get breakfast and the 110,000-point rate beats peak summer cash comfortably.",
    amenities: ["Golf course", "Three pools", "Miraval Spa", "Beach club", "Kids club", "Fitness center"],
    vibe: ["golf", "beach club", "family", "resort"], art: ["#1e4a6e", "#f2c58c", "coast"],
  },
  {
    name: "Alila Marea Beach Resort Encinitas", brand: "Alila", program: "world-of-hyatt", city: "San Diego", lat: 33.0700, lon: -117.3040,
    category: 6, stars: 5, tier: "luxury", cash: 500,
    description: "A 2021 clifftop resort carved into the bluffs above South Ponto Beach, with 130 ocean-view rooms, a rooftop pool, Spa Alila and the VAGA restaurant. It is the newest coastal Alila and 25,000 points is well below its summer cash rates.",
    amenities: ["Rooftop pool", "Spa Alila", "Fitness center", "VAGA restaurant", "Beach access", "Surf lessons"],
    vibe: ["clifftop", "surf", "new", "ocean views"], art: ["#1b4d6e", "#f5b982", "coast"],
  },
  {
    name: "Hotel del Coronado, Curio Collection by Hilton", brand: "Curio Collection", program: "hilton-honors", city: "San Diego", lat: 32.6808, lon: -117.1780,
    stars: 5, tier: "luxury", cash: 600, points: 100000,
    description: "The 1888 red-turreted Victorian beach resort of Some Like It Hot fame, concluding a $550 million restoration in 2025 with the Victorian building rooms, beachfront pools and the Shore House villas. It is the most famous Hilton points stay on the West Coast.",
    amenities: ["Beachfront", "Two pools", "Spa", "Fitness center", "Babcock & Story bar", "Ice rink in winter"],
    vibe: ["victorian", "beach", "iconic", "family"], art: ["#1f4f74", "#f7d08a", "coast"],
  },
  // ── San Francisco & Big Sur ────────────────────────────────────
  {
    name: "Grand Hyatt San Francisco", brand: "Grand Hyatt", program: "world-of-hyatt", city: "San Francisco", lat: 37.7885, lon: -122.4065,
    category: 4, stars: 4, tier: "upscale", cash: 300,
    description: "A 36-storey Union Square tower with Grand Club views across the bay, a 2019 room refresh and the OneUP restaurant. Cable cars stop at the door and 15,000 points is modest for a city that spikes during conferences.",
    amenities: ["Grand Club", "Fitness center", "OneUP restaurant", "Concierge", "Bay views", "Cable car access"],
    vibe: ["union square", "bay views", "value", "central"], art: ["#223a58", "#b5c9e4", "skyline"],
  },
  {
    name: "Palace Hotel, a Luxury Collection Hotel", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "San Francisco", lat: 37.7880, lon: -122.4015,
    stars: 5, tier: "luxury", cash: 350, points: 60000,
    description: "The 1909 Market Street landmark with the Garden Court's stained-glass dome, the Maxfield Parrish Pied Piper bar and a skylit rooftop pool. Points rates have softened with the city's cash rates, which makes it a heritage bargain.",
    amenities: ["Indoor pool", "Fitness center", "Garden Court", "Pied Piper bar", "Spa", "Concierge"],
    vibe: ["garden court", "heritage", "value", "downtown"], art: ["#2f2a3c", "#e0bd7a", "skyline"],
  },
  {
    name: "The St. Regis San Francisco", brand: "St. Regis", program: "marriott-bonvoy", city: "San Francisco", lat: 37.7860, lon: -122.4010,
    stars: 5, tier: "luxury", cash: 550, points: 85000,
    description: "A 40-storey SoMa tower beside SFMOMA with a Remède Spa, an indoor infinity pool and butler service on every floor. The Astor bar and the museum-district location make it the polished Marriott choice in the city.",
    amenities: ["Butler service", "Indoor pool", "Remède Spa", "Fitness center", "Astor Lounge", "Concierge"],
    vibe: ["soma", "butler", "museum district", "polished"], art: ["#1c2540", "#c8b07a", "skyline"],
  },
  {
    name: "Fairmont San Francisco", brand: "Fairmont", program: "accor-all", city: "San Francisco", lat: 37.7924, lon: -122.4103,
    stars: 5, tier: "luxury", cash: 400,
    description: "The 1907 Nob Hill grande dame where the UN Charter was drafted, with the Tonga Room's tiki rainstorms, a rooftop garden with beehives and the Laurel Court. Accor points apply at fixed value, so this is the way to use ALL points in California.",
    amenities: ["Fitness center", "Tonga Room", "Laurel Court", "Fairmont Gold lounge", "Rooftop garden", "Concierge"],
    vibe: ["nob hill", "tonga room", "heritage", "grand"], art: ["#2b2d48", "#e5b474", "skyline"],
  },
  {
    name: "InterContinental Mark Hopkins San Francisco", brand: "InterContinental", program: "ihg-one-rewards", city: "San Francisco", lat: 37.7923, lon: -122.4107,
    stars: 4, tier: "upscale", cash: 320, points: 55000,
    description: "The 1926 Nob Hill tower with the Top of the Mark sky lounge, where wartime sailors toasted the Golden Gate, and 380 rooms with city views. Club InterContinental and the cable-car corner make it IHG's classic San Francisco stay.",
    amenities: ["Top of the Mark", "Fitness center", "Club lounge", "Nob Hill Club restaurant", "Concierge", "Cable car access"],
    vibe: ["nob hill", "sky lounge", "heritage", "views"], art: ["#243550", "#a9c0dd", "skyline"],
  },
  {
    name: "Alila Ventana Big Sur", brand: "Alila", program: "world-of-hyatt", city: "Big Sur", lat: 36.2320, lon: -121.7590,
    category: 8, stars: 5, tier: "luxury", cash: 2000,
    description: "An adults-only, all-inclusive 59-room resort on 160 acres of redwoods above the Pacific, with Japanese hot baths, a clothing-optional pool and the Sur House restaurant included in the rate. At 40,000 points for a $2,000 all-inclusive night, it is the highest-value Hyatt award in the United States.",
    amenities: ["All-inclusive dining", "Japanese hot baths", "Two pools", "Spa", "Redwood hikes", "Glamping"],
    vibe: ["redwoods", "all-inclusive", "adults only", "sweet spot"], art: ["#1f3a2e", "#8fb98a", "forest"],
  },
  // ── Miami ──────────────────────────────────────────────────────
  {
    name: "Hyatt Centric South Beach Miami", brand: "Hyatt Centric", program: "world-of-hyatt", city: "Miami", lat: 25.7920, lon: -80.1300,
    category: 5, stars: 4, tier: "upscale", cash: 380,
    description: "A 105-room Collins Avenue hotel a block from the beach with the Deck Sixteen rooftop pool and bar, the Eden Roc-era Art Deco district outside and bikes to borrow. It is the practical South Beach Hyatt at 20,000 points.",
    amenities: ["Rooftop pool", "Fitness center", "Deck Sixteen bar", "Beach access", "Bike rental", "Pet friendly"],
    vibe: ["south beach", "rooftop pool", "value", "art deco"], art: ["#1c4a6e", "#ff9f80", "coast"],
  },
  {
    name: "Andaz Miami Beach", brand: "Andaz", program: "world-of-hyatt", city: "Miami", lat: 25.8130, lon: -80.1225,
    category: 6, stars: 5, tier: "luxury", cash: 450,
    description: "The former Confidante Miami Beach reopened in 2025 as an Andaz after a top-to-bottom redesign, with two oceanfront pools, a spa and Mid-Beach sand. It brings the Andaz free-minibar, local-flavor approach to Miami's beachfront at 25,000 points.",
    amenities: ["Two pools", "Beachfront", "Spa", "Fitness center", "Free minibar snacks", "Beach club"],
    vibe: ["mid-beach", "new", "beachfront", "pools"], art: ["#1b4d70", "#f8b88a", "coast"],
  },
  {
    name: "The St. Regis Bal Harbour Resort", brand: "St. Regis", program: "marriott-bonvoy", city: "Miami", lat: 25.8880, lon: -80.1230,
    stars: 5, tier: "luxury", cash: 1200, points: 140000,
    description: "An oceanfront Bal Harbour resort opposite the Bal Harbour Shops with butlers, three pools, the Remède Spa and the Atlantikós Greek restaurant. Rooms open onto wide ocean balconies and the fifth night free is the only way most members afford it.",
    amenities: ["Butler service", "Three pools", "Remède Spa", "Beachfront", "Fitness center", "Kids club"],
    vibe: ["bal harbour", "butler", "oceanfront", "opulent"], art: ["#1a4f78", "#f7c98a", "coast"],
  },
  {
    name: "The Miami Beach EDITION", brand: "EDITION", program: "marriott-bonvoy", city: "Miami", lat: 25.8095, lon: -80.1230,
    stars: 5, tier: "luxury", cash: 700, points: 100000,
    description: "Ian Schrager's revival of the 1955 Seville on Mid-Beach with a basement ice rink and bowling alley, the Matador Room and two ocean pools. It is the party-ready Marriott in Miami and points rates sink in late summer.",
    amenities: ["Two pools", "Beachfront", "Ice rink", "Bowling alley", "Spa", "Matador Room"],
    vibe: ["nightlife", "mid-beach", "ice rink", "scene"], art: ["#15202e", "#f5a97f", "coast"],
  },
  {
    name: "Conrad Miami", brand: "Conrad", program: "hilton-honors", city: "Miami", lat: 25.7620, lon: -80.1920,
    stars: 5, tier: "upscale", cash: 300, points: 55000,
    description: "Floors 25–36 of the Espirito Santo Plaza on Brickell Avenue, with a 25th-floor sky lobby, a rooftop pool and tennis court overlooking Biscayne Bay. It is the Hilton points base for Brickell business trips and bay-view rooms are cheap.",
    amenities: ["Rooftop pool", "Executive lounge", "Spa", "Fitness center", "Tennis", "Bay views"],
    vibe: ["brickell", "bay views", "value", "business"], art: ["#17395c", "#8fd0e8", "skyline"],
  },
  // ── Las Vegas ──────────────────────────────────────────────────
  {
    name: "Waldorf Astoria Las Vegas", brand: "Waldorf Astoria", program: "hilton-honors", city: "Las Vegas", lat: 36.1070, lon: -115.1760,
    stars: 5, tier: "luxury", cash: 500, points: 90000,
    description: "A non-gaming, non-smoking 47-storey tower in CityCenter with a 23rd-floor sky lobby, an eight-storey spa with a hammam and Strip-view rooms. The absence of a casino and the Tea Lounge make it the serene Hilton on the Strip.",
    amenities: ["Spa with hammam", "Outdoor pool", "Fitness center", "Tea Lounge", "Zen Kitchen", "Strip views"],
    vibe: ["non-gaming", "serene", "spa", "strip views"], art: ["#2a1f3f", "#f3b96a", "desert"],
  },
  {
    name: "Conrad Las Vegas at Resorts World", brand: "Conrad", program: "hilton-honors", city: "Las Vegas", lat: 36.1350, lon: -115.1640,
    stars: 5, tier: "upscale", cash: 250, points: 55000,
    description: "A 1,496-room tower inside the $4.3 billion Resorts World complex with a 5.5-acre pool deck, a Zouk nightclub and over 40 dining options. Diamond members get solid upgrades and executive lounge access, and points rates are low midweek.",
    amenities: ["Pool complex", "Executive lounge", "Spa", "Fitness center", "Casino", "40+ restaurants"],
    vibe: ["resorts world", "pool deck", "value", "nightlife"], art: ["#241a3a", "#f0a85e", "desert"],
  },
  {
    name: "Bellagio Las Vegas", brand: "MGM Collection with Marriott Bonvoy", program: "marriott-bonvoy", city: "Las Vegas", lat: 36.1126, lon: -115.1767,
    stars: 5, tier: "luxury", cash: 350, points: 60000,
    description: "The Fountains, the Conservatory and the Chihuly lobby ceiling need no introduction, and Bonvoy members can now book it on points through the MGM Collection. Fountain-view rooms are the award to request and Bonvoy status earns MGM Rewards perks.",
    amenities: ["Pools", "Spa", "Fitness center", "Casino", "Conservatory", "Fountain views"],
    vibe: ["fountains", "iconic", "mgm collection", "strip"], art: ["#1b1f3b", "#f5c76a", "desert"],
  },
  {
    name: "The Venetian Resort Las Vegas", brand: "IHG Hotels & Resorts", program: "ihg-one-rewards", city: "Las Vegas", lat: 36.1212, lon: -115.1697,
    stars: 5, tier: "upscale", cash: 250, points: 40000,
    description: "The all-suite Venetian and Palazzo, bookable on IHG points with its gondola canals, Canyon Ranch spa and 650-square-foot standard suites. It is the best-value IHG award on the Strip and Diamond members get upgraded suites.",
    amenities: ["All suites", "Pools", "Canyon Ranch spa", "Casino", "Grand Canal Shoppes", "Fitness center"],
    vibe: ["all-suite", "canals", "ihg", "value"], art: ["#2b2240", "#f6b872", "desert"],
  },
  // ── Austin ─────────────────────────────────────────────────────
  {
    name: "Miraval Austin Resort & Spa", brand: "Miraval", program: "world-of-hyatt", city: "Austin", lat: 30.3990, lon: -97.8830,
    category: 8, stars: 5, tier: "luxury", cash: 1000,
    description: "A 220-acre all-inclusive wellness resort on Lake Travis with equine therapy, a Life in Balance spa, challenge courses and all meals, classes and a daily resort credit included. Points stays book at the Category 8 rate for one guest, so it is among Hyatt's most generous all-inclusive awards.",
    amenities: ["All-inclusive dining", "Life in Balance Spa", "Equine therapy", "Wellness classes", "Pools", "Lake Travis views"],
    vibe: ["wellness", "all-inclusive", "hill country", "retreat"], art: ["#3a4a2e", "#e6c27a", "forest"],
  },
  {
    name: "Thompson Austin", brand: "Thompson Hotels", program: "world-of-hyatt", city: "Austin", lat: 30.2660, lon: -97.7390,
    category: 5, stars: 4, tier: "luxury", cash: 330,
    description: "A 2022 downtown tower on 5th Street with a rooftop pool, The Diner Bar by Mashama Bailey and the tommie Austin micro-hotel in the same building. Rainey Street and the convention center are a short walk and 20,000 points beats SXSW and F1 cash.",
    amenities: ["Rooftop pool", "Fitness center", "The Diner Bar", "Wax Myrtle's", "Pet friendly", "Concierge"],
    vibe: ["downtown", "rooftop pool", "lifestyle", "new"], art: ["#2b2f4a", "#f3a35f", "skyline"],
  },
  {
    name: "Fairmont Austin", brand: "Fairmont", program: "accor-all", city: "Austin", lat: 30.2630, lon: -97.7390,
    stars: 5, tier: "luxury", cash: 350,
    description: "A 37-storey 1,048-room tower attached to the convention center by a skybridge, with a 7th-floor pool deck, the Fairmont Spa and Garrison's steaks. It is one of the few places to burn Accor points in Texas.",
    amenities: ["Pool deck", "Fairmont Spa", "Fitness center", "Fairmont Gold lounge", "Garrison restaurant", "Convention access"],
    vibe: ["convention", "pool deck", "accor", "tower"], art: ["#243a58", "#f2b870", "skyline"],
  },
  {
    name: "Kimpton Hotel Van Zandt", brand: "Kimpton", program: "ihg-one-rewards", city: "Austin", lat: 30.2600, lon: -97.7390,
    stars: 4, tier: "upscale", cash: 300, points: 50000,
    description: "A 319-room Rainey Street hotel named after Townes Van Zandt, with a 4th-floor pool deck, live music at Geraldine's and Kimpton's nightly wine hour. Lady Bird Lake trails start a block away.",
    amenities: ["Pool deck", "Fitness center", "Geraldine's", "Evening wine hour", "Pet friendly", "Live music"],
    vibe: ["rainey street", "live music", "lifestyle", "pool"], art: ["#2f2a40", "#f0a46a", "skyline"],
  },
  {
    name: "Cambria Hotel Austin Downtown", brand: "Cambria", program: "choice-privileges", city: "Austin", lat: 30.2690, lon: -97.7380,
    stars: 3, tier: "midscale", cash: 220, points: 20000,
    description: "A 2021 hotel on East 7th with a rooftop pool and bar, 218 rooms and Austin-made beer on tap in the lobby. It is Choice's strongest Texas city redemption and holds a flat points rate while festival cash rates triple.",
    amenities: ["Rooftop pool", "Fitness center", "Rooftop bar", "Free Wi-Fi", "Business center", "Pet friendly"],
    vibe: ["value", "rooftop pool", "festival hedge", "downtown"], art: ["#263650", "#f4b263", "skyline"],
  },
  // ── Arizona ────────────────────────────────────────────────────
  {
    name: "Andaz Scottsdale Resort & Bungalows", brand: "Andaz", program: "world-of-hyatt", city: "Scottsdale", lat: 33.5120, lon: -111.9520,
    category: 5, stars: 5, tier: "luxury", cash: 400,
    description: "A 201-bungalow desert resort beneath Camelback Mountain inspired by the Cattle Track artists' colony, with the Palo Verde Spa, three pools and Weft & Warp's Sonoran cooking. Winter weekends run high in cash, which is when 20,000 points shine.",
    amenities: ["Three pools", "Palo Verde Spa", "Fitness center", "Bungalows", "Weft & Warp", "Artist residencies"],
    vibe: ["camelback views", "bungalows", "artsy", "desert"], art: ["#8a4a2b", "#f4c27a", "desert"],
  },
  {
    name: "Grand Hyatt Scottsdale Resort", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Scottsdale", lat: 33.5550, lon: -111.9150,
    category: 6, stars: 5, tier: "luxury", cash: 450,
    description: "The former Hyatt Regency Gainey Ranch rebranded in 2024 after a $115 million renovation, with the 2.5-acre water playground of ten pools, a sand beach and the Spa Avania. It is the family Hyatt of the Valley and 25,000 points avoids spring-training cash spikes.",
    amenities: ["Ten pools", "Waterslides", "Spa Avania", "Golf", "Kids club", "Gondola rides"],
    vibe: ["water park", "family", "golf", "renovated"], art: ["#8f4f2e", "#f6cd8c", "desert"],
  },
  {
    name: "The Phoenician, a Luxury Collection Resort", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "Scottsdale", lat: 33.5020, lon: -111.9450,
    stars: 5, tier: "luxury", cash: 600, points: 90000,
    description: "A 250-acre Camelback Mountain estate with a 27-hole golf course, nine pools including a mother-of-pearl-tiled oval, and a three-storey Phoenician Spa. The Canyon Suites enclave within is its own Marriott luxury tier.",
    amenities: ["Golf course", "Nine pools", "Phoenician Spa", "Tennis", "Kids club", "Fitness center"],
    vibe: ["camelback", "golf", "grand", "pools"], art: ["#7e3f2a", "#f2c17c", "desert"],
  },
  {
    name: "Fairmont Scottsdale Princess", brand: "Fairmont", program: "accor-all", city: "Scottsdale", lat: 33.6500, lon: -111.9150,
    stars: 5, tier: "luxury", cash: 500,
    description: "A 65-acre Spanish-colonial resort beside the TPC Scottsdale stadium course, with six pools, a lazy river, the Well & Being spa and a winter Christmas light festival. It is Accor's flagship in Arizona and the Phoenix Open week doubles cash rates.",
    amenities: ["Six pools", "Lazy river", "Well & Being Spa", "Golf access", "Kids club", "Fairmont Gold lounge"],
    vibe: ["golf", "family", "lazy river", "grand"], art: ["#8c4b2c", "#f5c98a", "desert"],
  },
  {
    name: "Miraval Arizona Resort & Spa", brand: "Miraval", program: "world-of-hyatt", city: "Tucson", lat: 32.4430, lon: -110.9550,
    category: 8, stars: 5, tier: "luxury", cash: 1100,
    description: "The original Miraval, a 400-acre all-inclusive wellness resort in the Santa Catalina foothills with the Equine Experience, a Life in Balance spa and meals, classes and a daily spa credit included. Points stays follow the Category 8 chart for one guest.",
    amenities: ["All-inclusive dining", "Life in Balance Spa", "Equine Experience", "Wellness classes", "Pools", "Desert hikes"],
    vibe: ["wellness", "all-inclusive", "sonoran desert", "retreat"], art: ["#874a2f", "#f3bf7a", "desert"],
  },
  // ── Mountains ──────────────────────────────────────────────────
  {
    name: "Grand Hyatt Vail", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Vail", lat: 39.6360, lon: -106.4030,
    category: 6, stars: 5, tier: "luxury", cash: 550,
    description: "A ski-in, ski-out resort in Cascade Village with its own chairlift, a heated outdoor pool on Gore Creek and the Fireside Lounge for après. It is the only Hyatt in Vail proper and 25,000 points is a fraction of holiday-week cash rates.",
    amenities: ["Ski-in/ski-out", "Heated outdoor pool", "Spa", "Fitness center", "Ski valet", "Creekside fire pits"],
    vibe: ["ski-in/ski-out", "creekside", "winter", "value"], art: ["#1f3350", "#dfe8f0", "mountain"],
  },
  {
    name: "Park Hyatt Beaver Creek Resort and Spa", brand: "Park Hyatt", program: "world-of-hyatt", city: "Vail", lat: 39.6040, lon: -106.5170,
    category: 7, stars: 5, tier: "luxury", cash: 700,
    description: "Slopeside in Beaver Creek Village with a ski valet at the base of the Centennial lift, the Exhale spa and an outdoor pool with mountain views. The 30,000-point rate covers four-figure Christmas-week nights.",
    amenities: ["Ski-in/ski-out", "Exhale Spa", "Outdoor pool", "Fitness center", "Ski valet", "8100 Mountainside"],
    vibe: ["slopeside", "beaver creek", "spa", "winter"], art: ["#223a5e", "#e8f0f6", "mountain"],
  },
  {
    name: "The Ritz-Carlton, Bachelor Gulch", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Vail", lat: 39.5930, lon: -106.5420,
    stars: 5, tier: "luxury", cash: 800, points: 100000,
    description: "A log-and-stone lodge on the Bachelor Gulch side of Beaver Creek with ski-in, ski-out access, a 21,000-square-foot spa and Bachelor the resident Labrador. Fifth night free makes a full ski week 400,000 points instead of 500,000.",
    amenities: ["Ski-in/ski-out", "Spa", "Outdoor pool", "Fitness center", "Club lounge", "Buffalos restaurant"],
    vibe: ["lodge", "ski-in/ski-out", "spa", "fifth night free"], art: ["#2a3650", "#f0e6d2", "mountain"],
  },
  {
    name: "Hyatt Regency Lake Tahoe Resort, Spa and Casino", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Lake Tahoe", lat: 39.2440, lon: -119.9440,
    category: 6, stars: 4, tier: "upscale", cash: 450,
    description: "A lakefront Incline Village resort with a private beach, a year-round heated pool, the Stillwater Spa and the Lone Eagle Grille on the water. Summer and ski-season weekends price high in cash, and 25,000 points is the escape hatch.",
    amenities: ["Private beach", "Heated pool", "Stillwater Spa", "Casino", "Fitness center", "Lone Eagle Grille"],
    vibe: ["lakefront", "beach", "casino", "year-round"], art: ["#1d3a5c", "#9fd4ec", "mountain"],
  },
  {
    name: "The Ritz-Carlton, Lake Tahoe", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Lake Tahoe", lat: 39.3000, lon: -120.2030,
    stars: 5, tier: "luxury", cash: 800, points: 100000,
    description: "A mid-mountain ski-in, ski-out lodge at Northstar with a gondola to the village, a 17,000-square-foot spa and the Living Room's fireplace lounge. It is the Sierra's only Ritz-Carlton and summer rates on points are a relative bargain.",
    amenities: ["Ski-in/ski-out", "Spa", "Outdoor pool", "Fitness center", "Club lounge", "Gondola access"],
    vibe: ["northstar", "lodge", "spa", "ski-in/ski-out"], art: ["#203552", "#e4edf3", "mountain"],
  },
  {
    name: "Miraval Berkshires Resort & Spa", brand: "Miraval", program: "world-of-hyatt", city: "Lenox", lat: 42.3480, lon: -73.2600,
    category: 8, stars: 5, tier: "luxury", cash: 1000,
    description: "A 380-acre all-inclusive wellness retreat on the Cranwell estate in the Berkshires, with a historic mansion, a Life in Balance spa, beekeeping and an indoor pool, meals and classes included. Points stays follow the Category 8 chart for one guest.",
    amenities: ["All-inclusive dining", "Life in Balance Spa", "Indoor pool", "Wellness classes", "Beekeeping", "Historic mansion"],
    vibe: ["wellness", "all-inclusive", "berkshires", "retreat"], art: ["#2f4a35", "#d9c48a", "forest"],
  },
  // ── Hawaii ─────────────────────────────────────────────────────
  {
    name: "Andaz Maui at Wailea Resort", brand: "Andaz", program: "world-of-hyatt", city: "Maui", lat: 20.6870, lon: -156.4420,
    category: 8, stars: 5, tier: "luxury", cash: 1000,
    description: "A 15-acre Mokapu Beach resort with cascading infinity pools, Morimoto Maui and the Awili Spa's apothecary blending bar. It is the most-booked Hyatt Category 8 in the world, and the $50 resort fee is waived on points.",
    amenities: ["Cascading pools", "Beachfront", "Awili Spa", "Morimoto Maui", "Fitness center", "Kids club"],
    vibe: ["wailea", "infinity pools", "sweet spot", "beach"], art: ["#0f5c7a", "#f8b56b", "coast"],
  },
  {
    name: "Hyatt Regency Maui Resort and Spa", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Maui", lat: 20.9200, lon: -156.6950,
    category: 6, stars: 4, tier: "upscale", cash: 550,
    description: "A 40-acre Kaanapali Beach resort with a half-acre pool featuring a lava-tube waterslide, penguins in the lobby, a rooftop observatory and the Drums of the Pacific luau. Families fill it year-round and 25,000 points is well under summer cash.",
    amenities: ["Waterslide pool", "Beachfront", "Marilyn Monroe Spa", "Luau", "Observatory", "Kids club"],
    vibe: ["kaanapali", "family", "luau", "waterslide"], art: ["#105e7c", "#ffc07a", "coast"],
  },
  {
    name: "The Ritz-Carlton Maui, Kapalua", brand: "The Ritz-Carlton", program: "marriott-bonvoy", city: "Maui", lat: 21.0030, lon: -156.6560,
    stars: 5, tier: "luxury", cash: 900, points: 110000,
    description: "A 54-acre resort above D.T. Fleming Beach on Maui's northwest tip with a three-tiered pool, a Hawaiian cultural center and the Banyan Tree restaurant. Club-level rooms and the fifth night free turn a long Kapalua stay into reasonable points.",
    amenities: ["Three-tiered pool", "Beach access", "Spa", "Club lounge", "Golf access", "Cultural center"],
    vibe: ["kapalua", "club lounge", "golf", "secluded"], art: ["#0e5a76", "#f3c585", "coast"],
  },
  {
    name: "Grand Wailea, A Waldorf Astoria Resort", brand: "Waldorf Astoria", program: "hilton-honors", city: "Maui", lat: 20.6830, lon: -156.4410,
    stars: 5, tier: "luxury", cash: 1100, points: 150000,
    description: "The 40-acre Wailea icon with a nine-pool Wailea Canyon water park, a water elevator, the 50,000-square-foot Kilolani Spa and Botero sculptures in the gardens. Hilton's 150,000-point cap against $1,100-plus cash rates makes it the top Aspire card play in Hawaii.",
    amenities: ["Nine-pool water park", "Beachfront", "Kilolani Spa", "Kids club", "Fitness center", "Luau"],
    vibe: ["water park", "family", "capped points", "wailea"], art: ["#0c5b7d", "#ffd18a", "coast"],
  },
  {
    name: "Grand Hyatt Kauai Resort & Spa", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Kauai", lat: 21.8740, lon: -159.4420,
    category: 7, stars: 5, tier: "luxury", cash: 700,
    description: "A 50-acre Poipu resort with a 1.5-acre saltwater lagoon, a lazy river and waterslide pool complex, the Anara Spa and Tidepools' thatched huts over a koi pond. It is the definitive family Hyatt in Hawaii and 30,000 points waives the resort fee.",
    amenities: ["Saltwater lagoon", "Lazy river", "Anara Spa", "Golf course", "Kids club", "Luau"],
    vibe: ["poipu", "lagoon", "family", "lush"], art: ["#0f6a63", "#f6c77c", "coast"],
  },
  {
    name: "Koloa Landing Resort at Poipu, Autograph Collection", brand: "Autograph Collection", program: "marriott-bonvoy", city: "Kauai", lat: 21.8830, lon: -159.4660,
    stars: 4, tier: "upscale", cash: 500, points: 75000,
    description: "A 25-acre condo-style resort in Poipu with a 350,000-gallon main pool rated the best in the US, full kitchens in every unit and the Hanakai Spa. Multi-bedroom villas on points suit families staying a week with the fifth night free.",
    amenities: ["Three pools", "Full kitchens", "Hanakai Spa", "Fitness center", "Pickleball", "Beach shuttle"],
    vibe: ["condo-style", "family", "pool", "poipu"], art: ["#126e66", "#f9d28c", "coast"],
  },
  {
    name: "Hyatt Regency Waikiki Beach Resort and Spa", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Honolulu", lat: 21.2770, lon: -157.8250,
    category: 5, stars: 4, tier: "upscale", cash: 380,
    description: "Twin 40-storey towers across Kalakaua Avenue from Waikiki Beach with ocean-view rooms, a Na Ho'ola spa, a Tuesday farmers market in the atrium and the Regency Club. Diamond Head-facing rooms at 20,000 points are the pick.",
    amenities: ["Regency Club", "Outdoor pool", "Na Ho'ola Spa", "Fitness center", "Farmers market", "Beach access"],
    vibe: ["waikiki", "ocean views", "value", "central"], art: ["#0f5c80", "#ffb47a", "coast"],
  },
  {
    name: "The Royal Hawaiian, a Luxury Collection Resort", brand: "The Luxury Collection", program: "marriott-bonvoy", city: "Honolulu", lat: 21.2770, lon: -157.8290,
    stars: 5, tier: "luxury", cash: 550, points: 75000,
    description: "The 1927 Pink Palace of the Pacific on the best stretch of Waikiki sand, with the Mai Tai Bar, the Abhasa garden spa and the Aha'aina luau on the Coconut Grove lawn. Historic-wing rooms on points carry the glamour of the original.",
    amenities: ["Beachfront", "Mai Tai Bar", "Abhasa Spa", "Outdoor pool", "Luau", "Fitness center"],
    vibe: ["pink palace", "heritage", "beachfront", "mai tais"], art: ["#9a4a63", "#ffd1a3", "coast"],
  },
  {
    name: "Hilton Hawaiian Village Waikiki Beach Resort", brand: "Hilton", program: "hilton-honors", city: "Honolulu", lat: 21.2830, lon: -157.8370,
    stars: 4, tier: "upscale", cash: 380, points: 70000,
    description: "A 22-acre, 2,860-room mini-city on Duke Kahanamoku Beach with five pools, a saltwater lagoon, Friday fireworks and more than 20 restaurants. Rainbow Tower ocean-front rooms on points are the classic Hawaii Hilton redemption.",
    amenities: ["Five pools", "Lagoon", "Beachfront", "Mandara Spa", "Fireworks", "Kids club"],
    vibe: ["family", "lagoon", "fireworks", "mega-resort"], art: ["#0e5f85", "#ffc488", "coast"],
  },
  // ── Mexico ─────────────────────────────────────────────────────
  {
    name: "Hyatt Ziva Cancún", brand: "Hyatt Ziva", program: "world-of-hyatt", city: "Cancún", lat: 21.1360, lon: -86.7450,
    category: 6, stars: 5, tier: "luxury", cash: 550,
    description: "An all-inclusive resort on Punta Cancún's peninsula with beaches on three sides, a dolphin habitat, a swim-up Turquoize adults-only tower and 15 restaurants. Hyatt prices it on the Inclusive Collection chart for two guests, so the all-inclusive value is the point.",
    amenities: ["All-inclusive", "Three beaches", "Adults-only tower", "Spa", "Kids club", "15 restaurants"],
    vibe: ["all-inclusive", "peninsula", "family", "beach"], art: ["#0d6b8a", "#ffd27a", "coast"],
  },
  {
    name: "Hyatt Zilara Cancún", brand: "Hyatt Zilara", program: "world-of-hyatt", city: "Cancún", lat: 21.1210, lon: -86.7580,
    category: 5, stars: 5, tier: "luxury", cash: 500,
    description: "An adults-only all-inclusive on the Hotel Zone's widest beach with a 1,100-foot infinity pool, a Zen Spa and swim-up suites. The Inclusive Collection chart prices two guests per room, and the points rate covers food and drink entirely.",
    amenities: ["All-inclusive", "Adults only", "Infinity pool", "Zen Spa", "Beachfront", "Swim-up suites"],
    vibe: ["adults only", "all-inclusive", "infinity pool", "beach"], art: ["#0c6586", "#f9c072", "coast"],
  },
  {
    name: "Secrets The Vine Cancún", brand: "Secrets", program: "world-of-hyatt", city: "Cancún", lat: 21.0980, lon: -86.7680,
    category: 5, stars: 5, tier: "luxury", cash: 450,
    description: "A wine-themed adults-only all-inclusive tower in the Hotel Zone with a 12,000-bottle cellar, three infinity pools and the Unlimited-Luxury inclusions of the Inclusive Collection. It is the Secrets property Hyatt members book most on points.",
    amenities: ["All-inclusive", "Adults only", "Three infinity pools", "Spa", "Wine cellar", "Beachfront"],
    vibe: ["adults only", "wine", "all-inclusive", "beach"], art: ["#2d1f3f", "#f4a66e", "coast"],
  },
  {
    name: "Hilton Cancun Mar Caribe All-Inclusive Resort", brand: "Hilton", program: "hilton-honors", city: "Cancún", lat: 21.1030, lon: -86.7650,
    stars: 5, tier: "upscale", cash: 600, points: 120000,
    description: "A 2024 all-inclusive on the Hotel Zone's Playa Marlin with 466 rooms, an eforea spa, a lazy river and a dozen restaurants and bars. Hilton points cover the full all-inclusive rate, which makes 5th night free especially valuable here.",
    amenities: ["All-inclusive", "Lazy river", "eforea Spa", "Beachfront", "Kids club", "12 restaurants"],
    vibe: ["all-inclusive", "new", "family", "beach"], art: ["#0f6388", "#ffcc7f", "coast"],
  },
  {
    name: "Presidente InterContinental Cancún Resort", brand: "InterContinental", program: "ihg-one-rewards", city: "Cancún", lat: 21.1480, lon: -86.7850,
    stars: 5, tier: "upscale", cash: 220, points: 40000,
    description: "A long-running lagoon-side Hotel Zone resort on a calm, swimmable beach with a pool overlooking the Caribbean, a Club InterContinental lounge and the La Madonna Italian. It is a non-all-inclusive IHG option with gentle points pricing.",
    amenities: ["Calm beach", "Outdoor pool", "Club lounge", "Spa", "Fitness center", "Kids club"],
    vibe: ["calm beach", "value", "club lounge", "classic"], art: ["#146a8c", "#f6c680", "coast"],
  },
  {
    name: "Thompson Playa del Carmen", brand: "Thompson Hotels", program: "world-of-hyatt", city: "Playa del Carmen", lat: 20.6280, lon: -87.0720,
    category: 4, stars: 4, tier: "upscale", cash: 250,
    description: "An adults-only rooftop hotel on Calle 12 with a rooftop infinity pool, Cinco bar and a beach club on Playa Mamitas. The 15,000-point rate puts a lively Riviera Maya base within easy reach, and Hyatt Centric-style beach shuttles cover the sand.",
    amenities: ["Rooftop pool", "Beach club", "Fitness center", "Spa", "Cinco bar", "Adults only"],
    vibe: ["rooftop", "adults only", "nightlife", "value"], art: ["#1c5f7e", "#ffb27a", "coast"],
  },
  {
    name: "Andaz Mayakoba Resort Riviera Maya", brand: "Andaz", program: "world-of-hyatt", city: "Playa del Carmen", lat: 20.6830, lon: -87.0500,
    category: 6, stars: 5, tier: "luxury", cash: 500,
    description: "A 214-room resort in the gated Mayakoba enclave with lagoon-side casitas, a beachfront pool, the Naum Wellness spa and boat rides through mangrove canals. At 25,000 points it undercuts neighbours Rosewood and Fairmont by a wide margin.",
    amenities: ["Beachfront", "Lagoon casitas", "Naum Spa", "Kids club", "Golf access", "Mangrove boat tours"],
    vibe: ["mayakoba", "lagoon", "beach", "family"], art: ["#0f5e73", "#f8c67c", "coast"],
  },
  {
    name: "Fairmont Mayakoba", brand: "Fairmont", program: "accor-all", city: "Playa del Carmen", lat: 20.6880, lon: -87.0450,
    stars: 5, tier: "luxury", cash: 550,
    description: "A 45-acre mangrove-and-lagoon resort inside Mayakoba with 401 rooms, five pools, the Willow Stream spa and the El Camaleón golf course. Accor points apply at fixed value, so it is the natural luxury ALL redemption in Mexico.",
    amenities: ["Five pools", "Beachfront", "Willow Stream Spa", "Golf course", "Kids club", "Fairmont Gold lounge"],
    vibe: ["mayakoba", "golf", "mangroves", "family"], art: ["#11617a", "#f5c98a", "coast"],
  },
  {
    name: "Viva Maya by Wyndham", brand: "Viva by Wyndham", program: "wyndham-rewards", city: "Playa del Carmen", lat: 20.5990, lon: -87.0950,
    stars: 4, tier: "midscale", cash: 280, points: 30000,
    description: "A beachfront all-inclusive south of Playa del Carmen with a circus school, a dive center and themed restaurants, priced at Wyndham's flat 30,000-point all-inclusive tier. It is one of the most straightforward all-inclusive awards in any program.",
    amenities: ["All-inclusive", "Beachfront", "Dive center", "Circus school", "Kids club", "Pools"],
    vibe: ["all-inclusive", "flat rate", "family", "beach"], art: ["#176f8c", "#ffd58c", "coast"],
  },
  {
    name: "Waldorf Astoria Los Cabos Pedregal", brand: "Waldorf Astoria", program: "hilton-honors", city: "Cabo San Lucas", lat: 22.8780, lon: -109.9150,
    stars: 5, tier: "luxury", cash: 1300, points: 150000,
    description: "Reached through a 1,000-foot tunnel carved into the Pedregal mountain, with private plunge pools on every terrace, the Pacific crashing below and the El Farallón cliffside seafood grill. It is the Hilton points trophy of Mexico and 5th night free applies.",
    amenities: ["Private plunge pools", "Spa", "Beach access", "El Farallón", "Fitness center", "Butler service"],
    vibe: ["cliffside", "plunge pools", "capped points", "dramatic"], art: ["#7a3b2e", "#f6c078", "coast"],
  },
  {
    name: "Hilton Los Cabos", brand: "Hilton", program: "hilton-honors", city: "Cabo San Lucas", lat: 22.9580, lon: -109.8030,
    stars: 5, tier: "upscale", cash: 450, points: 90000,
    description: "A Corridor resort with one of the few swimmable beaches between the two Cabos, an adults-only infinity pool, a 2022 renovation and the eforea spa. Diamond members get breakfast and the executive lounge, which stretch points further.",
    amenities: ["Swimmable beach", "Infinity pool", "eforea Spa", "Executive lounge", "Kids club", "Fitness center"],
    vibe: ["swimmable beach", "family", "value", "corridor"], art: ["#8a4a2e", "#f8cc86", "coast"],
  },
  {
    name: "JW Marriott Los Cabos Beach Resort & Spa", brand: "JW Marriott", program: "marriott-bonvoy", city: "Cabo San Lucas", lat: 23.0450, lon: -109.7100,
    stars: 5, tier: "luxury", cash: 500, points: 70000,
    description: "A Puerto Los Cabos resort designed by Jim Olson with 299 rooms, a Griffin Club adults-only enclave and a Jacques Grange-style Jasha Spa. Sea of Cortez views and the fifth night free make a long stay reasonable on points.",
    amenities: ["Multiple pools", "Griffin Club", "Jasha Spa", "Beach access", "Golf access", "Kids club"],
    vibe: ["architecture", "sea of cortez", "club", "family"], art: ["#7f4330", "#f3c17e", "coast"],
  },
  {
    name: "Hyatt Ziva Los Cabos", brand: "Hyatt Ziva", program: "world-of-hyatt", city: "Cabo San Lucas", lat: 23.0450, lon: -109.6950,
    category: 5, stars: 5, tier: "upscale", cash: 500,
    description: "An all-inclusive family resort on the San José del Cabo coast with a waterpark, seven pools and nine restaurants, priced on the Inclusive Collection chart for two guests. Cash rates climb past $500 in winter, so the 20,000-point rate is good value.",
    amenities: ["All-inclusive", "Water park", "Seven pools", "Spa", "Kids club", "Nine restaurants"],
    vibe: ["all-inclusive", "family", "water park", "beach"], art: ["#86452f", "#f9cf85", "coast"],
  },
  {
    name: "Hyatt Regency Mexico City", brand: "Hyatt Regency", program: "world-of-hyatt", city: "Mexico City", lat: 19.4280, lon: -99.1960,
    category: 3, stars: 5, tier: "upscale", cash: 230,
    description: "A 755-room Polanco tower beside Chapultepec Park with a Regency Club, an indoor pool and the Yoshimi Japanese restaurant. At 12,000 points it is a strong base for Polanco's restaurants and the Anthropology Museum next door.",
    amenities: ["Regency Club", "Indoor pool", "Fitness center", "Spa", "Yoshimi restaurant", "Park access"],
    vibe: ["polanco", "sweet spot", "business", "park"], art: ["#3a2d4a", "#f2a860", "skyline"],
  },
  {
    name: "The St. Regis Mexico City", brand: "St. Regis", program: "marriott-bonvoy", city: "Mexico City", lat: 19.4270, lon: -99.1750,
    stars: 5, tier: "luxury", cash: 450, points: 60000,
    description: "Floors 1–15 of César Pelli's Torre Libertad on Paseo de la Reforma with butlers, a 15th-floor indoor pool overlooking Chapultepec and the King Cole Bar's Sangrita Mary. It is the plushest points hotel in the capital at a modest rate.",
    amenities: ["Butler service", "Indoor pool", "Remède Spa", "Fitness center", "King Cole Bar", "Diana restaurant"],
    vibe: ["reforma", "butler", "views", "refined"], art: ["#2a2545", "#e8b36a", "skyline"],
  },
  {
    name: "Hilton Mexico City Reforma", brand: "Hilton", program: "hilton-honors", city: "Mexico City", lat: 19.4330, lon: -99.1470,
    stars: 4, tier: "upscale", cash: 180, points: 35000,
    description: "A 456-room hotel on Avenida Juárez facing the Alameda Central and the Palacio de Bellas Artes, with an executive lounge, rooftop pool and a 2022 refresh. It is a low-points way into the historic centre.",
    amenities: ["Executive lounge", "Rooftop pool", "Fitness center", "Spa", "Alameda views", "Metro access"],
    vibe: ["historic centre", "value", "lounge", "bellas artes"], art: ["#2d3552", "#f0b36e", "skyline"],
  },
  // ── Central & South America ────────────────────────────────────
  {
    name: "Andaz Costa Rica Resort at Peninsula Papagayo", brand: "Andaz", program: "world-of-hyatt", city: "Liberia", lat: 10.6260, lon: -85.6620,
    category: 6, stars: 5, tier: "luxury", cash: 600,
    description: "A Ronald Zürcher-designed resort of thatched pavilions on Culebra Bay with two beaches, three pools, the Onda Spa and kayaks to the Four Seasons' reef. Dry-season cash rates pass $700, which the 25,000-point rate neatly sidesteps.",
    amenities: ["Two beaches", "Three pools", "Onda Spa", "Kids club", "Kayaks", "Golf access"],
    vibe: ["papagayo", "jungle", "beaches", "architecture"], art: ["#1f5a46", "#f6bf6e", "coast"],
  },
  {
    name: "Secrets Papagayo Costa Rica", brand: "Secrets", program: "world-of-hyatt", city: "Liberia", lat: 10.5950, lon: -85.6660,
    category: 5, stars: 5, tier: "upscale", cash: 500,
    description: "An adults-only all-inclusive on Playa Arenilla inside the Papagayo gulf with a swim-up bar, a spa under the trees and Unlimited-Luxury dining. The Inclusive Collection points rate covers two guests and all meals and drinks.",
    amenities: ["All-inclusive", "Adults only", "Beachfront", "Spa", "Swim-up bar", "Seven restaurants"],
    vibe: ["adults only", "all-inclusive", "gulf", "beach"], art: ["#1d5c4b", "#f2b56c", "coast"],
  },
  {
    name: "JW Marriott Guanacaste Resort & Spa", brand: "JW Marriott", program: "marriott-bonvoy", city: "Liberia", lat: 10.3640, lon: -85.8460,
    stars: 5, tier: "luxury", cash: 450, points: 60000,
    description: "A Spanish-hacienda resort on Hacienda Pinilla with Central America's largest pool, a beach on the Pacific and the Hacienda Spa. Fifth night free and the pool make it the family Bonvoy base on the Guanacaste coast.",
    amenities: ["Giant pool", "Beachfront", "Hacienda Spa", "Kids club", "Golf access", "Fitness center"],
    vibe: ["hacienda", "pool", "family", "pacific"], art: ["#245a48", "#f7c374", "coast"],
  },
  {
    name: "Palacio Duhau – Park Hyatt Buenos Aires", brand: "Park Hyatt", program: "world-of-hyatt", city: "Buenos Aires", lat: -34.5890, lon: -58.3830,
    category: 5, stars: 5, tier: "luxury", cash: 450,
    description: "A 1934 Recoleta palace joined by terraced gardens to a modern tower, with the Ahín spa, a cheese room with 50 Argentine varieties and the Oak Bar in the original library. At 20,000 points it is one of the finest Park Hyatts for the price anywhere.",
    amenities: ["Indoor pool", "Ahín Spa", "Fitness center", "Gardens", "Cheese room", "Oak Bar"],
    vibe: ["palace", "recoleta", "gardens", "sweet spot"], art: ["#2a2a44", "#e3b36f", "skyline"],
  },
  {
    name: "Hilton Buenos Aires", brand: "Hilton", program: "hilton-honors", city: "Buenos Aires", lat: -34.6100, lon: -58.3630,
    stars: 5, tier: "upscale", cash: 220, points: 40000,
    description: "A 417-room Puerto Madero hotel with a seven-storey glass atrium, a rooftop pool and an executive lounge, beside the Puente de la Mujer. It is the Hilton points base for Buenos Aires and dockside restaurants are at the door.",
    amenities: ["Executive lounge", "Rooftop pool", "Fitness center", "Spa", "Atrium", "Dockside access"],
    vibe: ["puerto madero", "atrium", "value", "business"], art: ["#223a5a", "#a9c8e8", "skyline"],
  },
  {
    name: "Grand Hyatt Rio de Janeiro", brand: "Grand Hyatt", program: "world-of-hyatt", city: "Rio de Janeiro", lat: -23.0060, lon: -43.3320,
    category: 3, stars: 5, tier: "upscale", cash: 280,
    description: "A 436-room resort between Barra da Tijuca beach and the Marapendi lagoon with three pools, the Atiaia spa and the Shiso Japanese restaurant. At 12,000 points it is the cheapest beach-adjacent Grand Hyatt in the Americas.",
    amenities: ["Three pools", "Beach access", "Atiaia Spa", "Grand Club", "Fitness center", "Kids club"],
    vibe: ["barra", "beach", "sweet spot", "resort"], art: ["#146a7a", "#ffc97a", "coast"],
  },
  {
    name: "Hilton Copacabana Rio de Janeiro", brand: "Hilton", program: "hilton-honors", city: "Rio de Janeiro", lat: -22.9640, lon: -43.1740,
    stars: 5, tier: "upscale", cash: 250, points: 45000,
    description: "A 545-room tower across from Copacabana Beach with a rooftop pool, an executive lounge with Sugarloaf views and the Isabel restaurant. It is the obvious Hilton redemption for Carnival or New Year's on the beach.",
    amenities: ["Rooftop pool", "Executive lounge", "Fitness center", "Spa", "Beach access", "Sugarloaf views"],
    vibe: ["copacabana", "rooftop pool", "carnival", "beach"], art: ["#176b84", "#ffd07d", "coast"],
  },
  {
    name: "Fairmont Rio de Janeiro Copacabana", brand: "Fairmont", program: "accor-all", city: "Rio de Janeiro", lat: -22.9870, lon: -43.1900,
    stars: 5, tier: "luxury", cash: 300,
    description: "The former Sofitel at the Ipanema end of Copacabana, reopened as a Fairmont in 2019 with 375 rooms, two rooftop pools facing Sugarloaf and the Marine Restô. It is Accor's flagship in Brazil and a clean fixed-value points redemption.",
    amenities: ["Two rooftop pools", "Fairmont Spa", "Fitness center", "Beach access", "Fairmont Gold lounge", "Marine Restô"],
    vibe: ["copacabana", "rooftop pools", "accor", "beach"], art: ["#135f7c", "#f8c983", "coast"],
  },
];

export const HOTELS: HotelProperty[] = SEEDS.map(toProperty);

const HOTEL_BY_ID: Record<string, HotelProperty> = Object.fromEntries(HOTELS.map((h) => [h.id, h]));

function cityMatches(c: HotelCity, q: string): boolean {
  if (c.name.toLowerCase() === q) return true;
  if (c.airport.toLowerCase() === q) return true;
  if (c.countryCode.toLowerCase() === q) return true;
  return (c.aliases ?? []).some((a) => a.toLowerCase() === q);
}

/**
 * Hotels in a city. Matches the city name case-insensitively, and also accepts the
 * city's airport code ("OGG"), an alias ("NYC", "Malé") or a country code ("MV").
 */
export function hotelsInCity(city: string): HotelProperty[] {
  const q = city.trim().toLowerCase().normalize("NFC");
  if (!q) return [];
  const cities = HOTEL_CITIES.filter((c) => cityMatches(c, q));
  if (cities.length === 0) return [];
  const names = new Set(cities.map((c) => c.name));
  return HOTELS.filter((h) => names.has(h.city));
}

export function getHotel(id: string): HotelProperty | undefined {
  return HOTEL_BY_ID[id];
}

/** Fuzzy city search by name, alias, airport or country code; prefix matches rank first. */
export function searchHotelCities(query: string, limit = 8): HotelCity[] {
  const q = query.trim().toLowerCase();
  if (!q) return HOTEL_CITIES.slice(0, limit);
  const scored = HOTEL_CITIES.map((c) => {
    const name = c.name.toLowerCase();
    const aliases = (c.aliases ?? []).map((a) => a.toLowerCase());
    let score = 0;
    if (name === q || c.airport.toLowerCase() === q) score = 5;
    else if (name.startsWith(q)) score = 4;
    else if (aliases.some((a) => a === q || a.startsWith(q))) score = 3;
    else if (name.includes(q) || aliases.some((a) => a.includes(q))) score = 2;
    else if (c.countryCode.toLowerCase() === q) score = 1;
    return { c, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name))
    .slice(0, limit)
    .map((s) => s.c);
}

/** Hotels within `radiusMiles` of a point, nearest first. */
export function hotelsNear(lat: number, lon: number, radiusMiles = 25): (HotelProperty & { distanceMiles: number })[] {
  return HOTELS.map((h) => ({ ...h, distanceMiles: haversineMiles(lat, lon, h.lat, h.lon) }))
    .filter((h) => h.distanceMiles <= radiusMiles)
    .sort((a, b) => a.distanceMiles - b.distanceMiles || a.name.localeCompare(b.name));
}

/** Hotels bookable with a given program. */
export function hotelsByProgram(programId: string): HotelProperty[] {
  return HOTELS.filter((h) => h.programId === programId);
}
