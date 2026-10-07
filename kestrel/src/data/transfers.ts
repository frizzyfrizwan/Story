import type { TransferBonus, TransferLink } from "@/lib/types";

/**
 * Bank → airline/hotel transfer matrix (verified Oct 2026).
 *
 * Ratios are [bankUnits, destinationUnits]. Notable non-1:1 pairs:
 * Amex→Aeromexico 5:8 (1:1.6), Amex→Cathay/Emirates/JetBlue 5:4, Amex→Hilton 1:2,
 * Citi→Emirates 5:4, Citi→Choice 2:3 (1:1.5), Citi/Capital One→Accor 2:1,
 * Capital One→Emirates 4:3, Capital One→EVA 4:3, Capital One→JetBlue 5:3,
 * Bilt→Accor 3:2, Wells Fargo→Choice/Wyndham 1:2.
 *
 * Partnerships that ended (not listed): Amex→Hawaiian (Jun 2025), Amex→Etihad (Jun 2026),
 * Chase→Emirates (Oct 2025), Bilt→American (Jun 2024).
 * Chase→Hyatt is 1:1 from the Sapphire Reserve; Sapphire Preferred and Ink Preferred move at 4:3
 * from 1 Oct 2026 — the link below records the Reserve ratio.
 */

type Time = TransferLink["transferTime"];

const link = (
  from: string,
  to: string,
  ratio: [number, number] = [1, 1],
  transferTime: Time = "instant",
  minimum = 1000,
  bonus?: TransferBonus,
): TransferLink => ({ from, to, ratio, transferTime, minimum, ...(bonus ? { bonus } : {}) });

const VERIFIED = "2026-10-01";

const AMEX: TransferLink[] = [
  link("amex-mr", "aeroplan"),
  link("amex-mr", "flying-blue"),
  link("amex-mr", "ana-mileage-club", [1, 1], "1-2 days"),
  link("amex-mr", "avianca-lifemiles"),
  link("amex-mr", "british-airways-club"),
  link("amex-mr", "iberia-plus"),
  link("amex-mr", "aer-lingus-aerclub"),
  link("amex-mr", "cathay-asia-miles", [5, 4], "1-2 days"),
  link("amex-mr", "delta-skymiles"),
  link("amex-mr", "emirates-skywards", [5, 4]),
  link("amex-mr", "jetblue-trueblue", [5, 4], "instant", 250),
  link("amex-mr", "qantas-frequent-flyer", [1, 1], "instant", 500),
  link("amex-mr", "singapore-krisflyer", [1, 1], "1-2 days"),
  link("amex-mr", "virgin-atlantic-flying-club", [1, 1], "instant", 1000, {
    percent: 30,
    startsAt: "2026-09-15",
    endsAt: "2026-10-31",
    verifiedAt: VERIFIED,
    note: "30% bonus to Virgin Atlantic Flying Club — ANA First from 56k MR.",
  }),
  link("amex-mr", "aeromexico-rewards", [5, 8], "1-2 days"),
  link("amex-mr", "hilton-honors", [1, 2], "instant", 1000, {
    percent: 30,
    startsAt: "2026-10-01",
    endsAt: "2026-11-15",
    verifiedAt: VERIFIED,
    note: "Honors receives 2.6 points per MR point during the bonus.",
  }),
  link("amex-mr", "marriott-bonvoy", [1, 1], "1-2 days"),
  link("amex-mr", "choice-privileges"),
];

const CHASE: TransferLink[] = [
  link("chase-ur", "aeroplan", [1, 1], "instant", 1000, {
    percent: 25,
    startsAt: "2026-10-01",
    endsAt: "2026-11-15",
    verifiedAt: VERIFIED,
    note: "25% bonus to Aeroplan — Lufthansa business transatlantic for 60k UR.",
  }),
  link("chase-ur", "flying-blue"),
  link("chase-ur", "british-airways-club"),
  link("chase-ur", "iberia-plus"),
  link("chase-ur", "aer-lingus-aerclub"),
  link("chase-ur", "jetblue-trueblue"),
  link("chase-ur", "singapore-krisflyer", [1, 1], "1-2 days"),
  link("chase-ur", "southwest-rapid-rewards"),
  link("chase-ur", "united-mileageplus"),
  link("chase-ur", "virgin-atlantic-flying-club"),
  link("chase-ur", "world-of-hyatt"),
  link("chase-ur", "marriott-bonvoy", [1, 1], "1-2 days"),
  link("chase-ur", "ihg-one-rewards", [1, 1], "1-2 days"),
  link("chase-ur", "wyndham-rewards"),
];

const CITI: TransferLink[] = [
  link("citi-ty", "aeromexico-rewards", [1, 1], "1-2 days"),
  link("citi-ty", "american-aadvantage", [1, 1], "1-2 days"),
  link("citi-ty", "avianca-lifemiles"),
  link("citi-ty", "cathay-asia-miles", [1, 1], "1-2 days"),
  link("citi-ty", "emirates-skywards", [5, 4], "1-2 days"),
  link("citi-ty", "etihad-guest", [1, 1], "1-2 days"),
  link("citi-ty", "eva-infinity", [1, 1], "1-2 days"),
  link("citi-ty", "flying-blue"),
  link("citi-ty", "jetblue-trueblue"),
  link("citi-ty", "qantas-frequent-flyer", [1, 1], "1-2 days"),
  link("citi-ty", "qatar-privilege-club", [1, 1], "1-2 days", 1000, {
    percent: 25,
    startsAt: "2026-09-20",
    endsAt: "2026-11-05",
    verifiedAt: VERIFIED,
    note: "25% bonus to Qatar Privilege Club — off-peak Qsuites for 56k ThankYou points.",
  }),
  link("citi-ty", "singapore-krisflyer", [1, 1], "1-2 days"),
  link("citi-ty", "thai-royal-orchid", [1, 1], "1-2 days"),
  link("citi-ty", "turkish-miles-smiles", [1, 1], "1-2 days"),
  link("citi-ty", "virgin-atlantic-flying-club"),
  link("citi-ty", "accor-all", [2, 1], "1-2 days"),
  link("citi-ty", "choice-privileges", [2, 3]),
  link("citi-ty", "wyndham-rewards"),
];

const CAPITAL_ONE: TransferLink[] = [
  link("capital-one", "aeromexico-rewards"),
  link("capital-one", "aeroplan"),
  link("capital-one", "flying-blue"),
  link("capital-one", "avianca-lifemiles", [1, 1], "instant", 1000, {
    percent: 30,
    startsAt: "2026-10-05",
    endsAt: "2026-10-31",
    verifiedAt: VERIFIED,
    note: "30% bonus to LifeMiles — Swiss business to Europe for ~53k Capital One miles.",
  }),
  link("capital-one", "british-airways-club"),
  link("capital-one", "cathay-asia-miles", [1, 1], "1-2 days"),
  link("capital-one", "emirates-skywards", [4, 3]),
  link("capital-one", "etihad-guest", [1, 1], "1-2 days"),
  link("capital-one", "eva-infinity", [4, 3], "1-2 days"),
  link("capital-one", "finnair-plus", [1, 1], "1-2 days"),
  link("capital-one", "jal-mileage-bank", [1, 1], "1-2 days"),
  link("capital-one", "qantas-frequent-flyer"),
  link("capital-one", "qatar-privilege-club", [1, 1], "1-2 days"),
  link("capital-one", "singapore-krisflyer", [1, 1], "1-2 days"),
  link("capital-one", "tap-miles-go"),
  link("capital-one", "turkish-miles-smiles"),
  link("capital-one", "virgin-atlantic-flying-club"),
  link("capital-one", "jetblue-trueblue", [5, 3]),
  link("capital-one", "accor-all", [2, 1], "1-2 days"),
  link("capital-one", "choice-privileges"),
  link("capital-one", "wyndham-rewards"),
];

const BILT: TransferLink[] = [
  link("bilt", "aeroplan"),
  link("bilt", "alaska-mileage-plan"),
  link("bilt", "avianca-lifemiles"),
  link("bilt", "british-airways-club"),
  link("bilt", "iberia-plus"),
  link("bilt", "aer-lingus-aerclub"),
  link("bilt", "cathay-asia-miles", [1, 1], "1-2 days"),
  link("bilt", "emirates-skywards"),
  link("bilt", "etihad-guest", [1, 1], "1-2 days"),
  link("bilt", "flying-blue", [1, 1], "instant", 1000, {
    percent: 50,
    startsAt: "2026-11-01",
    endsAt: "2026-11-01",
    verifiedAt: VERIFIED,
    note: "Rent Day (1 Nov) 50% bonus to Flying Blue — transatlantic business from 40k Bilt points on a Promo Reward.",
  }),
  link("bilt", "jal-mileage-bank", [1, 1], "1-2 days"),
  link("bilt", "southwest-rapid-rewards"),
  link("bilt", "tap-miles-go"),
  link("bilt", "turkish-miles-smiles"),
  link("bilt", "united-mileageplus"),
  link("bilt", "virgin-atlantic-flying-club"),
  link("bilt", "world-of-hyatt"),
  link("bilt", "hilton-honors"),
  link("bilt", "marriott-bonvoy", [1, 1], "1-2 days"),
  link("bilt", "ihg-one-rewards", [1, 1], "1-2 days"),
  link("bilt", "accor-all", [3, 2], "1-2 days"),
];

const WELLS_FARGO: TransferLink[] = [
  link("wells-fargo", "flying-blue", [1, 1], "instant", 1000, {
    percent: 25,
    startsAt: "2026-10-15",
    endsAt: "2026-11-30",
    verifiedAt: VERIFIED,
    note: "25% bonus to Flying Blue from Autograph Journey points.",
  }),
  link("wells-fargo", "british-airways-club"),
  link("wells-fargo", "iberia-plus"),
  link("wells-fargo", "aer-lingus-aerclub"),
  link("wells-fargo", "avianca-lifemiles"),
  link("wells-fargo", "virgin-atlantic-flying-club"),
  link("wells-fargo", "jetblue-trueblue"),
  link("wells-fargo", "cathay-asia-miles", [1, 1], "1-2 days"),
  link("wells-fargo", "choice-privileges", [1, 2]),
  link("wells-fargo", "wyndham-rewards", [1, 2]),
];

export const TRANSFER_LINKS: TransferLink[] = [...AMEX, ...CHASE, ...CITI, ...CAPITAL_ONE, ...BILT, ...WELLS_FARGO];

export function transfersTo(programId: string): TransferLink[] {
  return TRANSFER_LINKS.filter((l) => l.to === programId);
}

export function transfersFrom(bankId: string): TransferLink[] {
  return TRANSFER_LINKS.filter((l) => l.from === bankId);
}

export function transferLink(from: string, to: string): TransferLink | undefined {
  return TRANSFER_LINKS.find((l) => l.from === from && l.to === to);
}
