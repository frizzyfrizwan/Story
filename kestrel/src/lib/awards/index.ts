/**
 * Kestrel award pricing engine — public surface.
 *
 *   priceAward(input)          → miles/taxes quote for a program × carrier × route × date
 *   cpp / scoreFare            → value maths and badges (score.ts)
 *   estimateCashFare           → cash-fare model when no live fare exists (cash.ts)
 *   buildTransferOptions       → bank-points-needed per transfer link
 *   ALL_CHART_PROGRAM_IDS      → every program id with a dedicated chart module
 *
 * Charts live in ./charts/*, keyed by the canonical program ids in
 * docs/ARCHITECTURE.md and carrier IATA codes. Everything is pure and synchronous.
 */
import type { AwardFare, TransferLink, TransferOption } from "@/lib/types";
import type { ChartFn, PriceInput, PriceQuote } from "./charts/common";
import { genericEstimate } from "./charts/generic";
import { aeroplan } from "./charts/aeroplan";
import { unitedMileagePlus } from "./charts/united";
import { americanAAdvantage } from "./charts/american";
import { deltaSkyMiles } from "./charts/delta";
import { flyingBlue } from "./charts/flying-blue";
import { virginAtlanticFlyingClub } from "./charts/virgin-atlantic";
import { aerLingusAerClub, britishAirwaysClub, finnairPlus, iberiaPlus, qatarPrivilegeClub } from "./charts/avios";
import { anaMileageClub } from "./charts/ana";
import { singaporeKrisFlyer } from "./charts/singapore";
import { aviancaLifeMiles } from "./charts/lifemiles";
import { turkishMilesSmiles } from "./charts/turkish";
import { alaskaMileagePlan } from "./charts/alaska";
import { cathayAsiaMiles } from "./charts/cathay";
import { jalMileageBank } from "./charts/jal";
import { koreanAirSkypass } from "./charts/korean";
import { etihadGuest } from "./charts/etihad";
import { emiratesSkywards } from "./charts/emirates";
import { qantasFrequentFlyer } from "./charts/qantas";
import {
  aeromexicoRewards,
  airIndiaMaharaja,
  airNewZealandAirpoints,
  asianaClub,
  copaConnectMiles,
  evaInfinity,
  jetblueTrueBlue,
  latamPass,
  lufthansaMilesMore,
  sasEuroBonus,
  southwestRapidRewards,
  tapMilesGo,
  thaiRoyalOrchid,
  virginAustraliaVelocity,
} from "./charts/estimates";

export type { PriceInput, PriceQuote, ChartFn } from "./charts/common";
export type { ScoreInput } from "./score";
export { cpp, scoreFare, CPP_BENCHMARK, SCORE_THRESHOLDS, BADGE } from "./score";
export { estimateCashFare, typicalMilesFor, seasonalFareMultiplier } from "./cash";
export type { AwardFare };

/** Chart module per canonical program id (docs/ARCHITECTURE.md → "Program ids"). */
const CHARTS: Readonly<Record<string, ChartFn>> = {
  aeroplan,
  "united-mileageplus": unitedMileagePlus,
  "ana-mileage-club": anaMileageClub,
  "singapore-krisflyer": singaporeKrisFlyer,
  "avianca-lifemiles": aviancaLifeMiles,
  "turkish-miles-smiles": turkishMilesSmiles,
  "eva-infinity": evaInfinity,
  "thai-royal-orchid": thaiRoyalOrchid,
  "asiana-club": asianaClub,
  "lufthansa-miles-more": lufthansaMilesMore,
  "american-aadvantage": americanAAdvantage,
  "british-airways-club": britishAirwaysClub,
  "qatar-privilege-club": qatarPrivilegeClub,
  "cathay-asia-miles": cathayAsiaMiles,
  "jal-mileage-bank": jalMileageBank,
  "alaska-mileage-plan": alaskaMileagePlan,
  "qantas-frequent-flyer": qantasFrequentFlyer,
  "iberia-plus": iberiaPlus,
  "finnair-plus": finnairPlus,
  "aer-lingus-aerclub": aerLingusAerClub,
  "delta-skymiles": deltaSkyMiles,
  "flying-blue": flyingBlue,
  "virgin-atlantic-flying-club": virginAtlanticFlyingClub,
  "korean-air-skypass": koreanAirSkypass,
  "aeromexico-rewards": aeromexicoRewards,
  "etihad-guest": etihadGuest,
  "emirates-skywards": emiratesSkywards,
  "jetblue-trueblue": jetblueTrueBlue,
  "southwest-rapid-rewards": southwestRapidRewards,
  "virgin-australia-velocity": virginAustraliaVelocity,
  "copa-connectmiles": copaConnectMiles,
  "latam-pass": latamPass,
  "air-india-maharaja": airIndiaMaharaja,
  "air-new-zealand-airpoints": airNewZealandAirpoints,
  "sas-eurobonus": sasEuroBonus,
  "tap-miles-go": tapMilesGo,
};

export const ALL_CHART_PROGRAM_IDS: readonly string[] = Object.freeze(Object.keys(CHARTS));

/** Does a dedicated chart exist for this program id? */
export function hasChart(programId: string): boolean {
  return Object.prototype.hasOwnProperty.call(CHARTS, programId);
}

/**
 * Price an award for a program; null when the program cannot book this carrier
 * (or the cabin is not offered on that chart). Unknown program ids fall back
 * to a generic zone estimate with `basis: "estimate"`.
 */
export function priceAward(input: PriceInput): PriceQuote | null {
  const normalized: PriceInput = {
    ...input,
    carrier: input.carrier.trim().toUpperCase(),
    origin: input.origin.trim().toUpperCase(),
    destination: input.destination.trim().toUpperCase(),
    distanceMiles: Number.isFinite(input.distanceMiles) ? Math.max(0, input.distanceMiles) : 0,
  };
  const chart = CHARTS[normalized.programId];
  const quote = chart
    ? chart(normalized)
    : genericEstimate(normalized, { note: `${normalized.programId}: no published chart on file — generic zone estimate` });
  if (!quote) return null;
  return {
    ...quote,
    miles: Math.max(1, Math.round(quote.miles)),
    taxesUsd: Math.max(0, Math.round(quote.taxesUsd)),
  };
}

/**
 * Bank points needed via each transfer link, honouring ratio, running bonus and
 * the link's minimum. Amounts above 10,000 round up to the next 1,000 (banks
 * transfer in blocks); smaller amounts round up to the whole point, never below 1.
 */
export function buildTransferOptions(miles: number, links: TransferLink[]): TransferOption[] {
  return links.map((l) => {
    const bonus = l.bonus?.percent ?? 0;
    const effective = (l.ratio[1] / l.ratio[0]) * (1 + bonus / 100);
    const raw = effective > 0 ? Math.max(0, miles) / effective : Number.POSITIVE_INFINITY;
    let needed = raw > 10_000 ? Math.ceil(raw / 1000) * 1000 : Math.ceil(raw);
    if (l.minimum > 0) needed = Math.max(needed, l.minimum);
    return {
      bankProgramId: l.from,
      ratio: l.ratio,
      bankPointsNeeded: Math.max(1, Number.isFinite(needed) ? needed : 1),
      bonusPercent: bonus || undefined,
      transferTime: l.transferTime,
    };
  });
}
