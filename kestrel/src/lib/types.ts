/**
 * Kestrel domain types — the contract every module builds against.
 * Keep this file dependency-free (no imports from app code).
 */

// ─── Core enums ────────────────────────────────────────────────

export type Cabin = "economy" | "premium" | "business" | "first";
export const CABINS: readonly Cabin[] = ["economy", "premium", "business", "first"] as const;
export const CABIN_LABEL: Record<Cabin, string> = {
  economy: "Economy",
  premium: "Premium Economy",
  business: "Business",
  first: "First",
};
export const CABIN_SHORT: Record<Cabin, string> = { economy: "Y", premium: "W", business: "J", first: "F" };

export type Alliance = "star" | "oneworld" | "skyteam" | "none";

export type AwardRegion =
  | "north-america"
  | "hawaii"
  | "central-america"
  | "caribbean"
  | "south-america"
  | "europe"
  | "middle-east"
  | "north-africa"
  | "sub-saharan-africa"
  | "central-asia"
  | "north-asia"
  | "south-asia"
  | "southeast-asia"
  | "oceania";

export type DataSource = "live" | "cached" | "simulated";

// ─── Geography ────────────────────────────────────────────────

export interface Airport {
  iata: string;
  icao?: string;
  name: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2 */
  countryCode: string;
  lat: number;
  lon: number;
  tz: string;
  region: AwardRegion;
  /** Major international hub — used for ranking and default suggestions */
  hub?: boolean;
  /** Metro code grouping e.g. NYC for JFK/EWR/LGA, LON for LHR/LGW */
  metro?: string;
}

export interface Airline {
  iata: string;
  icao?: string;
  name: string;
  alliance: Alliance;
  /** Loyalty program slug this airline owns, if any */
  programId?: string;
  countryCode: string;
  /** Brand colour for chips / route arcs */
  color: string;
  /** Primary hubs */
  hubs: string[];
}

/** A real nonstop route operated by a carrier — the backbone of the simulator and explorer. */
export interface RouteDef {
  origin: string;
  destination: string;
  carrier: string;
  /** Typical aircraft types, e.g. ["A350-900"] */
  aircraft: string[];
  /** Block time in minutes */
  durationMin: number;
  /** Flights per week (approx) */
  weeklyFrequency: number;
  /** Cabins sold on this route */
  cabins: Cabin[];
  /** Flight number prefix, e.g. "SQ"; number assigned by simulator */
  flightNumber?: string;
}

// ─── Loyalty ──────────────────────────────────────────────────

export type ProgramKind = "airline" | "hotel" | "bank";
export type ChartType = "distance" | "zone" | "dynamic" | "fixed" | "hybrid";

export interface SweetSpot {
  title: string;
  description: string;
  cabin?: Cabin;
  miles?: number;
  example?: string;
  tags?: string[];
}

export interface LoyaltyProgram {
  id: string;
  name: string;
  shortName: string;
  kind: ProgramKind;
  alliance?: Alliance;
  /** Airline IATA code that owns this program (airline programs) */
  airline?: string;
  /** What the points are called, e.g. "Aeroplan points", "Avios" */
  currency: string;
  /** Estimated value in cents per point (editorial valuation) */
  valuationCpp: number;
  chartType: ChartType;
  /** Does the program levy fuel surcharges (YQ) on partner awards? */
  surcharges: "none" | "low" | "medium" | "high";
  /** Typical taxes on a long-haul business award in USD, used by the simulator */
  typicalTaxesUsd: { economy: number; premium: number; business: number; first: number };
  /** Change / cancel fee in USD (editorial) */
  changeFeeUsd: number;
  cancelFeeUsd: number;
  expirationPolicy: string;
  bookingUrl: string;
  color: string;
  /** Short editorial summary shown on program pages */
  summary: string;
  sweetSpots: SweetSpot[];
  /** Which airlines (IATA) can be booked with this currency */
  bookableCarriers: string[];
  /** Does the program allow one-way awards? */
  oneWay: boolean;
  /** Stopover / open-jaw rules in one line */
  routingRules: string;
}

/** A bank or hotel currency that transfers into an airline/hotel program. */
export interface TransferLink {
  from: string; // bank program id, e.g. "amex-mr"
  to: string; // destination program id
  /** [fromUnits, toUnits] e.g. [1, 1] or [1000, 800] */
  ratio: [number, number];
  /** Typical time to post */
  transferTime: "instant" | "hours" | "1-2 days" | "3-7 days" | "1-2 weeks";
  /** Minimum transfer amount in source points */
  minimum: number;
  /** Currently running or recently-seen bonus */
  bonus?: TransferBonus;
}

export interface TransferBonus {
  percent: number;
  startsAt: string;
  endsAt: string;
  verifiedAt: string;
  note?: string;
}

export interface CreditCard {
  id: string;
  name: string;
  issuer: string;
  /** Program id of the currency earned */
  currency: string;
  annualFeeUsd: number;
  earn: { category: SpendCategory; multiplier: number; note?: string }[];
  welcomeBonus?: { points: number; minSpendUsd: number; months: number; asOf: string };
  credits: string[];
  /** Short pitch */
  tagline: string;
  url: string;
  network: "visa" | "mastercard" | "amex";
  /** Design gradient for the card artwork (procedural, no images) */
  art: { from: string; to: string; accent: string };
}

export type SpendCategory =
  | "everything"
  | "dining"
  | "groceries"
  | "travel"
  | "flights"
  | "hotels"
  | "gas"
  | "transit"
  | "streaming"
  | "online"
  | "rent"
  | "business";

// ─── Flights & awards ─────────────────────────────────────────

export interface FlightSegment {
  carrier: string;
  flightNumber: string;
  origin: string;
  destination: string;
  /** Local ISO datetime without offset, e.g. 2026-05-14T08:35 */
  departure: string;
  arrival: string;
  aircraft?: string;
  durationMin: number;
  operatedBy?: string;
  cabin: Cabin;
}

export interface Itinerary {
  id: string;
  segments: FlightSegment[];
  totalDurationMin: number;
  stops: number;
  /** Total great-circle distance in miles */
  distanceMiles: number;
}

export interface TransferOption {
  bankProgramId: string;
  ratio: [number, number];
  /** Bank points required after ratio + bonus */
  bankPointsNeeded: number;
  bonusPercent?: number;
  transferTime: TransferLink["transferTime"];
}

export interface AwardFare {
  programId: string;
  cabin: Cabin;
  miles: number;
  taxesUsd: number;
  /** null when unknown (dynamic programs often hide inventory) */
  seats: number | null;
  mixedCabin?: boolean;
  bookUrl?: string;
  transferOptions: TransferOption[];
  /** Cents per point versus cash fare, when cash is known */
  cpp?: number;
  /** 0–100 Kestrel value score */
  valueScore: number;
  /** Short reason strings used for badges, e.g. "Sweet spot", "Low taxes" */
  badges: string[];
  source: DataSource;
  fetchedAt: string;
}

export interface AwardResult {
  itinerary: Itinerary;
  fares: AwardFare[];
  bestFare: AwardFare;
  cashPriceUsd?: number;
}

export interface AwardSearchQuery {
  origin: string[];
  destination: string[];
  /** YYYY-MM-DD */
  date: string;
  /** +/- days of flexibility (0–7) */
  flexDays?: number;
  cabin: Cabin;
  passengers: number;
  /** Restrict to these program ids */
  programs?: string[];
  maxStops?: number;
  /** Only show fares bookable with points the user holds (wallet-aware) */
  onlyAffordable?: boolean;
}

export interface AwardSearchResponse {
  query: AwardSearchQuery;
  results: AwardResult[];
  source: DataSource;
  /** Providers that contributed, with timing */
  providers: { id: string; ms: number; count: number; error?: string }[];
  generatedAt: string;
}

export interface AvailabilityDay {
  date: string;
  cabin: Cabin;
  programId: string;
  miles: number;
  taxesUsd: number;
  seats: number;
  carrier: string;
  source: DataSource;
}

export interface RouteAvailability {
  origin: string;
  destination: string;
  cabin: Cabin;
  days: AvailabilityDay[];
  source: DataSource;
}

export interface Deal {
  id: string;
  title: string;
  origin: string;
  destination: string;
  carrier: string;
  cabin: Cabin;
  programId: string;
  miles: number;
  taxesUsd: number;
  cpp: number;
  /** Percentage below the typical price for this route/cabin */
  savingsPct: number;
  dates: string[];
  seats: number;
  badge: "sweet-spot" | "transfer-bonus" | "rare" | "wide-open" | "ai-pick";
  source: DataSource;
  /** One-line AI/editorial note */
  note?: string;
}

// ─── Hotels ───────────────────────────────────────────────────

export interface HotelProgram {
  id: string;
  name: string;
  currency: string;
  chartType: "category" | "dynamic" | "fixed";
  valuationCpp: number;
  /** 5th night free on award stays? */
  fifthNightFree: boolean;
  color: string;
  bookingUrl: string;
  summary: string;
}

export interface HotelProperty {
  id: string;
  name: string;
  brand: string;
  programId: string;
  city: string;
  countryCode: string;
  lat: number;
  lon: number;
  /** Award category (Hyatt 1–8, IHG etc.); undefined for dynamic programs */
  category?: number;
  stars: 3 | 4 | 5;
  tier: "luxury" | "upscale" | "midscale";
  /** Typical cash rate per night in USD */
  avgCashUsd: number;
  /** Typical points per night (standard) */
  avgPointsPerNight: number;
  description: string;
  amenities: string[];
  vibe: string[];
  /** Procedural artwork seed */
  art: { from: string; to: string; motif: "skyline" | "coast" | "mountain" | "desert" | "island" | "forest" };
}

export interface HotelAwardQuote {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  pointsPerNight: number;
  totalPoints: number;
  cashPerNightUsd: number;
  totalCashUsd: number;
  cpp: number;
  valueScore: number;
  available: boolean;
  fifthNightFreeApplied: boolean;
  /** Peak / standard / off-peak for category charts */
  tier?: "off-peak" | "standard" | "peak";
  transferOptions: TransferOption[];
  source: DataSource;
  fetchedAt: string;
}

export interface HotelSearchQuery {
  city: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  programs?: string[];
}

// ─── Live flights ─────────────────────────────────────────────

export interface LiveAircraft {
  icao24: string;
  callsign: string | null;
  originCountry: string;
  lat: number;
  lon: number;
  altitudeM: number | null;
  velocityMs: number | null;
  heading: number | null;
  verticalRateMs: number | null;
  onGround: boolean;
  lastContact: number;
  /** Derived carrier IATA from callsign ICAO prefix, if known */
  carrier?: string;
}

export type FlightStatusState = "scheduled" | "active" | "landed" | "cancelled" | "diverted" | "delayed" | "unknown";

export interface FlightStatus {
  carrier: string;
  flightNumber: string;
  date: string;
  origin: string;
  destination: string;
  scheduledDeparture: string;
  estimatedDeparture?: string;
  scheduledArrival: string;
  estimatedArrival?: string;
  status: FlightStatusState;
  delayMin?: number;
  aircraft?: string;
  registration?: string;
  terminal?: string;
  gate?: string;
  /** Progress 0–1 while airborne */
  progress?: number;
  position?: { lat: number; lon: number; altitudeM: number | null; heading: number | null };
  source: DataSource;
}

// ─── Wallet ───────────────────────────────────────────────────

export interface Balance {
  programId: string;
  amount: number;
  updatedAt: string;
  source: "manual" | "import" | "connected";
  /** Elite status label if any */
  status?: string;
  expiresAt?: string;
}

// ─── Social ───────────────────────────────────────────────────

export interface FindAuthor {
  id: string;
  handle: string;
  name: string;
  /** Deterministic avatar seed */
  avatarSeed: string;
  plan: "free" | "pro";
}

export interface Find {
  id: string;
  author: FindAuthor;
  title: string;
  body: string;
  origin?: string;
  destination?: string;
  carrier?: string;
  cabin?: Cabin;
  programId?: string;
  miles?: number;
  taxesUsd?: number;
  cpp?: number;
  travelDate?: string;
  tags: string[];
  likes: number;
  comments: number;
  likedByMe?: boolean;
  createdAt: string;
}

export interface FindComment {
  id: string;
  findId: string;
  author: FindAuthor;
  body: string;
  createdAt: string;
}

// ─── Alerts ───────────────────────────────────────────────────

export interface AlertRule {
  id: string;
  userId: string;
  name: string;
  origins: string[];
  destinations: string[];
  dateFrom: string;
  dateTo: string;
  cabin: Cabin;
  passengers: number;
  maxMiles?: number;
  programs?: string[];
  channels: ("email" | "push" | "inapp")[];
  active: boolean;
  createdAt: string;
  lastCheckedAt?: string;
  lastHitAt?: string;
  hitCount: number;
}

export interface AlertHit {
  id: string;
  alertId: string;
  date: string;
  origin: string;
  destination: string;
  carrier: string;
  programId: string;
  cabin: Cabin;
  miles: number;
  taxesUsd: number;
  seats: number;
  foundAt: string;
}

// ─── AI ───────────────────────────────────────────────────────

export interface ParsedTravelIntent {
  origin: string[];
  destination: string[];
  /** YYYY-MM-DD or null when the user gave a window */
  date: string | null;
  /** Inclusive window when the user was vague ("in May") */
  window?: { from: string; to: string };
  flexDays: number;
  cabin: Cabin;
  passengers: number;
  /** Programs the user mentioned holding, by id */
  programs: string[];
  /** Free-text constraints like "nonstop only", "avoid surcharges" */
  constraints: string[];
  confidence: number;
}
