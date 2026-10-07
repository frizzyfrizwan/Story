/**
 * Programs modelled as reasonable zone/dynamic estimates (`basis: "estimate"`):
 * EVA Infinity MileageLands, Thai Royal Orchid Plus, Asiana Club, Lufthansa
 * Miles & More, Aeromexico Rewards, JetBlue TrueBlue, Southwest Rapid Rewards,
 * Virgin Australia Velocity, Copa ConnectMiles, LATAM Pass, Air India Maharaja
 * Club, Air New Zealand Airpoints, SAS EuroBonus, TAP Miles&Go.
 *
 * Each entry scales the market-typical award (see cash.ts) by a program factor
 * for its own metal versus partners, adds the carrier's surcharges where the
 * program passes them through, and applies the program's degree of dynamism.
 */
import type { Cabin } from "@/lib/types";
import { estimateCashFare } from "../cash";
import {
  allow,
  canBook,
  carrierSurcharge,
  demandOf,
  govTaxes,
  peakFromDemand,
  quote,
  SKYTEAM,
  STAR,
  type ChartFn,
} from "./common";
import { genericEstimate } from "./generic";

interface EstimateSpec {
  label: string;
  bookable: readonly string[];
  own: readonly string[];
  /** Scale vs. market-typical for own-metal awards (1 = typical). */
  ownFactor: number;
  partnerFactor: number;
  /** 0 = fixed chart, 0.6 = fully dynamic */
  dynamic: number;
  /** Pass partner surcharges through? Own-metal surcharges by cabin. */
  passPartnerYq: boolean;
  ownYq: Partial<Record<Cabin, number>>;
}

function zoneEstimate(spec: EstimateSpec): ChartFn {
  return (input) => {
    const carrier = input.carrier.toUpperCase();
    if (!canBook(carrier, spec.bookable)) return null;
    const own = spec.own.includes(carrier);
    const surcharge: Partial<Record<Cabin, number>> = own
      ? spec.ownYq
      : spec.passPartnerYq
        ? { [input.cabin]: carrierSurcharge(carrier, input.cabin, input.distanceMiles) }
        : {};
    return genericEstimate(input, {
      factor: own ? spec.ownFactor : spec.partnerFactor,
      dynamic: spec.dynamic,
      surcharge,
      note: `${spec.label}: ${own ? "own-metal" : `${carrier} partner`} zone estimate`,
    });
  };
}

export const evaInfinity = zoneEstimate({
  label: "EVA Infinity MileageLands",
  bookable: allow(STAR),
  own: ["BR", "B7"],
  ownFactor: 0.85,
  partnerFactor: 1.0,
  dynamic: 0.1,
  passPartnerYq: true,
  ownYq: { economy: 40, premium: 60, business: 120, first: 120 },
});

export const thaiRoyalOrchid = zoneEstimate({
  label: "Thai Royal Orchid Plus",
  bookable: allow(STAR, ["PG", "EK"]),
  own: ["TG", "WE"],
  ownFactor: 1.1,
  partnerFactor: 1.1,
  dynamic: 0.1,
  passPartnerYq: true,
  ownYq: { economy: 60, premium: 80, business: 150, first: 180 },
});

export const asianaClub = zoneEstimate({
  label: "Asiana Club",
  bookable: allow(STAR),
  own: ["OZ"],
  ownFactor: 0.9,
  partnerFactor: 1.0,
  dynamic: 0.1,
  passPartnerYq: true,
  ownYq: { economy: 50, premium: 70, business: 100, first: 120 },
});

/** Europe ↔ North America on Lufthansa-group metal lands near J 55k / F 91k one-way. */
export const lufthansaMilesMore = zoneEstimate({
  label: "Lufthansa Miles & More",
  bookable: allow(STAR, ["LG", "EW", "4Y", "WK", "AZ", "EN"]),
  own: ["LH", "LX", "OS", "SN", "EN", "4Y", "WK", "EW", "LG"],
  ownFactor: 0.88,
  partnerFactor: 1.0,
  dynamic: 0.15,
  passPartnerYq: true,
  ownYq: { economy: 150, premium: 200, business: 350, first: 450 },
});

export const aeromexicoRewards = zoneEstimate({
  label: "Aeromexico Rewards",
  bookable: allow(SKYTEAM),
  own: ["AM"],
  ownFactor: 1.0,
  partnerFactor: 1.05,
  dynamic: 0.5,
  passPartnerYq: true,
  ownYq: { economy: 40, premium: 60, business: 60, first: 60 },
});

export const virginAustraliaVelocity = zoneEstimate({
  label: "Virgin Australia Velocity",
  bookable: allow(["VA", "SQ", "EY", "QR", "VS", "UA", "AC", "SA", "NH", "DL"]),
  own: ["VA"],
  ownFactor: 0.95,
  partnerFactor: 1.05,
  dynamic: 0.4,
  passPartnerYq: true,
  ownYq: { economy: 40, premium: 60, business: 80, first: 80 },
});

export const copaConnectMiles = zoneEstimate({
  label: "Copa ConnectMiles",
  bookable: allow(STAR),
  own: ["CM"],
  ownFactor: 0.95,
  partnerFactor: 1.0,
  dynamic: 0.1,
  passPartnerYq: false,
  ownYq: {},
});

export const latamPass = zoneEstimate({
  label: "LATAM Pass",
  bookable: allow(["LA", "JJ", "LP", "4C", "XL", "DL", "QR", "JL"]),
  own: ["LA", "JJ", "LP", "4C", "XL"],
  ownFactor: 1.05,
  partnerFactor: 1.1,
  dynamic: 0.5,
  passPartnerYq: true,
  ownYq: { economy: 40, premium: 60, business: 80, first: 80 },
});

export const airIndiaMaharaja = zoneEstimate({
  label: "Air India Maharaja Club",
  bookable: allow(STAR),
  own: ["AI", "IX"],
  ownFactor: 0.9,
  partnerFactor: 1.0,
  dynamic: 0.2,
  passPartnerYq: true,
  ownYq: { economy: 60, premium: 80, business: 100, first: 120 },
});

export const sasEuroBonus = zoneEstimate({
  label: "SAS EuroBonus",
  bookable: allow(SKYTEAM, ["WF"]),
  own: ["SK", "WF"],
  ownFactor: 0.9,
  partnerFactor: 1.0,
  dynamic: 0.15,
  passPartnerYq: true,
  ownYq: { economy: 80, premium: 100, business: 150, first: 150 },
});

export const tapMilesGo = zoneEstimate({
  label: "TAP Miles&Go",
  bookable: allow(STAR, ["AD"]),
  own: ["TP"],
  ownFactor: 0.9,
  partnerFactor: 1.0,
  dynamic: 0.15,
  passPartnerYq: true,
  ownYq: { economy: 80, premium: 100, business: 150, first: 150 },
});

// ─── Revenue-based programs ────────────────────────────────────

/** Points required when a program prices at a fixed cents-per-point against the cash fare. */
function revenueBased(input: Parameters<ChartFn>[0], centsPerPoint: number, label: string, taxesUsd: number) {
  const d = demandOf(input);
  const cash = estimateCashFare(input.distanceMiles, input.cabin, input.date) * (0.85 + d * 0.5);
  const miles = Math.ceil(cash / (centsPerPoint / 100) / 100) * 100;
  return quote(
    miles,
    taxesUsd,
    "dynamic",
    `${label}: revenue-based (≈ ${centsPerPoint.toFixed(2)}¢ per point against the cash fare)`,
    peakFromDemand(d),
  );
}

/** JetBlue TrueBlue: ≈ 1.35¢/point on JetBlue metal; partner (Qatar, Etihad, Icelandair, JAL) awards are zone estimates. */
export const jetblueTrueBlue: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, ["B6", "QR", "EY", "FI", "JL"])) return null;
  if (carrier !== "B6")
    return genericEstimate(input, {
      factor: 1.15,
      surcharge: { [input.cabin]: carrierSurcharge(carrier, input.cabin, input.distanceMiles) },
      note: `TrueBlue: ${carrier} partner estimate`,
    });
  if (input.cabin === "first") return null; // JetBlue sells Mint as business
  // JetBlue's network: the Americas plus transatlantic to the UK/Ireland/France/Netherlands — nothing beyond ≈ 4,000 mi.
  const JETBLUE_REGIONS = new Set(["north-america", "caribbean", "central-america", "south-america", "europe"]);
  if (!JETBLUE_REGIONS.has(input.originRegion) || !JETBLUE_REGIONS.has(input.destinationRegion)) return null;
  if (input.distanceMiles > 4000) return null;
  return revenueBased(input, 1.35, "JetBlue TrueBlue", govTaxes(input));
};

/** Southwest Rapid Rewards: ≈ 1.35¢/point, economy only, no long-haul. */
export const southwestRapidRewards: ChartFn = (input) => {
  if (input.carrier.toUpperCase() !== "WN") return null;
  if (input.cabin !== "economy" || input.distanceMiles > 3000) return null;
  return revenueBased(input, 1.35, "Southwest Rapid Rewards", govTaxes(input));
};

/** Air New Zealand Airpoints: Airpoints Dollars are worth NZ$1 (≈ US$0.60) each; shown as "points" of that value. */
export const airNewZealandAirpoints: ChartFn = (input) => {
  const carrier = input.carrier.toUpperCase();
  if (!canBook(carrier, allow(STAR, ["NZ"]))) return null;
  const d = demandOf(input);
  const cash =
    estimateCashFare(input.distanceMiles, input.cabin, input.date) * (carrier === "NZ" ? 0.85 + d * 0.5 : 1.1);
  const apd = Math.ceil(cash / 0.6);
  const taxes = govTaxes(input) + (carrier === "NZ" ? 0 : carrierSurcharge(carrier, input.cabin, input.distanceMiles));
  return quote(
    apd,
    taxes,
    "estimate",
    "Airpoints: priced in Airpoints Dollars (1 APD ≈ NZ$1 ≈ US$0.60), not miles",
    peakFromDemand(d),
  );
};
