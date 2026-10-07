import type { HotelProgram } from "@/lib/types";

/**
 * Hotel loyalty programs — the seven currencies Kestrel can price a stay in.
 *
 * `valuationCpp` is Kestrel's editorial cents-per-point used as the value benchmark
 * (a redemption at exactly this cpp scores 50/100). `fifthNightFree` reflects whether
 * the program waives the 5th night on a 5-night award stay for its general membership
 * (Hilton restricts it to Silver+ elites; since nearly every Hilton co-brand card grants
 * Silver or better we treat it as true).
 */
export const HOTEL_PROGRAMS: HotelProgram[] = [
  {
    id: "world-of-hyatt",
    name: "World of Hyatt",
    currency: "Hyatt points",
    chartType: "category",
    valuationCpp: 1.9,
    fifthNightFree: false,
    color: "#5C4B8C",
    bookingUrl: "https://www.hyatt.com/",
    summary:
      "The last major program with a published award chart: eight categories priced 5,000–45,000 points with off-peak, standard and peak dates, which makes Park Hyatt and Alila stays reliably outsized value. There is no 5th-night-free perk, but Chase Ultimate Rewards transfers 1:1 and Globalist status waives resort fees and parking on award nights.",
  },
  {
    id: "marriott-bonvoy",
    name: "Marriott Bonvoy",
    currency: "Bonvoy points",
    chartType: "dynamic",
    valuationCpp: 0.75,
    fifthNightFree: true,
    color: "#B5333A",
    bookingUrl: "https://www.marriott.com/",
    summary:
      "The largest footprint in the business, spanning St. Regis, Ritz-Carlton, EDITION and Luxury Collection with fully dynamic award pricing from roughly 20,000 to 150,000 points a night. Every fifth award night is free on stays of five nights or more, and Amex, Chase, Capital One, Citi and Bilt all transfer in at 1:1.",
  },
  {
    id: "hilton-honors",
    name: "Hilton Honors",
    currency: "Honors points",
    chartType: "dynamic",
    valuationCpp: 0.5,
    fifthNightFree: true,
    color: "#1E4B8E",
    bookingUrl: "https://www.hilton.com/en/hilton-honors/",
    summary:
      "Dynamic pricing loosely tethered to cash rates, so points stretch furthest at Waldorf Astoria and Conrad resorts where cash runs high. Silver and above get every fifth night free on award stays, and the Amex Surpass and Aspire cards earn so quickly that free Maldives overwater villas are a realistic target.",
  },
  {
    id: "ihg-one-rewards",
    name: "IHG One Rewards",
    currency: "IHG points",
    chartType: "dynamic",
    valuationCpp: 0.55,
    fifthNightFree: false,
    color: "#C8102E",
    bookingUrl: "https://www.ihg.com/onerewards/",
    summary:
      "InterContinental, Kimpton, Six Senses and Holiday Inn priced dynamically between about 10,000 and 120,000 points a night, with frequent points-and-cash and sale pricing. There is no program-wide fifth night free, but the IHG Premier credit card grants a fourth night free on award stays of four or more nights.",
  },
  {
    id: "accor-all",
    name: "ALL – Accor Live Limitless",
    currency: "Reward points",
    chartType: "fixed",
    valuationCpp: 2.1,
    fifthNightFree: false,
    color: "#1E1852",
    bookingUrl: "https://all.accor.com/",
    summary:
      "A fixed-value currency: every 2,000 points knocks €40 off a cash booking at Sofitel, Fairmont, Raffles, Pullman and MGallery, so the math is simply the cash rate converted to euros. There are no award charts or blackout dates, which makes it dependable for Europe but rarely a bargain.",
  },
  {
    id: "choice-privileges",
    name: "Choice Privileges",
    currency: "Choice points",
    chartType: "fixed",
    valuationCpp: 0.6,
    fifthNightFree: false,
    color: "#F58220",
    bookingUrl: "https://www.choicehotels.com/choice-privileges",
    summary:
      "Tiered award pricing from 8,000 to 35,000 points across Comfort, Cambria, Ascend and the Radisson Americas portfolio, with the best deals at Nordic Choice properties in Scandinavia. Citi ThankYou transfers at 1:2, which makes mid-tier Cambria stays cost the equivalent of just a few thousand bank points.",
  },
  {
    id: "wyndham-rewards",
    name: "Wyndham Rewards",
    currency: "Wyndham points",
    chartType: "fixed",
    valuationCpp: 1.0,
    fifthNightFree: false,
    color: "#1B5E9E",
    bookingUrl: "https://www.wyndhamhotels.com/wyndham-rewards",
    summary:
      "Simple three-tier chart: every property is 7,500, 15,000 or 30,000 points a night regardless of season, and Vacasa vacation rentals price at 15,000 per bedroom. Capital One and Citi transfer 1:1 and Wyndham Earner cardholders get a 10% points discount on every award.",
  },
];

export function getHotelProgram(id: string): HotelProgram | undefined {
  return HOTEL_PROGRAMS.find((p) => p.id === id);
}

export const HOTEL_PROGRAM_IDS: readonly string[] = HOTEL_PROGRAMS.map((p) => p.id);

export type HyattSeasonTier = "off-peak" | "standard" | "peak";

/**
 * World of Hyatt standard-room award chart (2025), points per night by category.
 * Index 0 is unused so `HYATT_CATEGORY_CHART[category]` reads naturally.
 */
export const HYATT_CATEGORY_CHART: readonly Record<HyattSeasonTier, number>[] = [
  { "off-peak": 0, standard: 0, peak: 0 },
  { "off-peak": 3_500, standard: 5_000, peak: 6_500 },
  { "off-peak": 6_500, standard: 8_000, peak: 9_500 },
  { "off-peak": 9_000, standard: 12_000, peak: 15_000 },
  { "off-peak": 12_000, standard: 15_000, peak: 18_000 },
  { "off-peak": 17_000, standard: 20_000, peak: 23_000 },
  { "off-peak": 21_000, standard: 25_000, peak: 29_000 },
  { "off-peak": 25_000, standard: 30_000, peak: 35_000 },
  { "off-peak": 35_000, standard: 40_000, peak: 45_000 },
];

/** Points per night for a Hyatt category at a given season tier; categories outside 1–8 clamp. */
export function hyattPoints(category: number, tier: HyattSeasonTier = "standard"): number {
  const cat = Math.min(8, Math.max(1, Math.round(category)));
  return HYATT_CATEGORY_CHART[cat][tier];
}

/** Dynamic-program pricing constants: points ≈ cash × k, clamped to [floor, ceiling], rounded to `step`. */
export const DYNAMIC_PRICING: Record<string, { k: number; floor: number; ceiling: number; step: number }> = {
  "marriott-bonvoy": { k: 1 / 0.0075, floor: 7_500, ceiling: 150_000, step: 500 },
  "hilton-honors": { k: 1 / 0.005, floor: 5_000, ceiling: 150_000, step: 1_000 },
  "ihg-one-rewards": { k: 1 / 0.0055, floor: 8_000, ceiling: 120_000, step: 500 },
};

/** Accor ALL: every 2,000 points is worth €40 off a booking. */
export const ACCOR_POINTS_PER_BLOCK = 2_000;
export const ACCOR_EUR_PER_BLOCK = 40;
/** Editorial USD→EUR rate used for Accor math (no FX I/O in the engine). */
export const USD_TO_EUR = 0.92;

/** Wyndham Rewards "go free" tiers. */
export const WYNDHAM_TIERS = [7_500, 15_000, 30_000] as const;

/** Choice Privileges award levels. */
export const CHOICE_LEVELS = [8_000, 10_000, 12_000, 16_000, 20_000, 25_000, 30_000, 35_000] as const;
