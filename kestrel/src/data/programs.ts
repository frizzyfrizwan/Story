import type { LoyaltyProgram } from "@/lib/types";

/**
 * Curated loyalty-program reference data (editorial, verified Oct 2026).
 * Canonical ids live in docs/ARCHITECTURE.md → "Program ids" — use those strings everywhere.
 *
 * Conventions
 * - valuationCpp is cents per point/mile. Air New Zealand is the one outlier: an Airpoints Dollar
 *   is a fixed NZ$1 voucher, so its "cpp" is ~58.
 * - typicalTaxesUsd is a long-haul one-way estimate per cabin used by the simulator.
 * - bookableCarriers are IATA codes of carriers redeemable with the currency (alliance + bilateral).
 */

const tx = (economy: number, premium: number, business: number, first: number) => ({
  economy,
  premium,
  business,
  first,
});

/** Star Alliance members (SAS left for SkyTeam in Sept 2024). */
const STAR = ["AC", "UA", "LH", "LX", "OS", "SN", "NH", "SQ", "TK", "BR", "TG", "OZ", "AV", "CM", "TP", "LO", "ET", "AI", "NZ", "MS", "SA", "A3", "CA", "ZH", "OU"];
/** oneworld members incl. Fiji Airways and Oman Air (both joined 2025). S7 remains suspended. */
const ONEWORLD = ["AA", "BA", "CX", "AY", "IB", "JL", "MH", "QF", "QR", "RJ", "UL", "AT", "AS", "FJ", "WY"];
/** SkyTeam members incl. Virgin Atlantic (2023) and SAS (2024). */
const SKYTEAM = ["DL", "AF", "KL", "KE", "AM", "AZ", "SV", "VN", "GA", "CI", "MU", "UX", "RO", "ME", "KQ", "AR", "MF", "VS", "SK"];
/** Lufthansa Group leisure/regional brands bookable through most Star programs. */
const LH_GROUP_EXTRA = ["EW", "4Y", "WK", "EN"];

const uniq = (...lists: string[][]) => Array.from(new Set(lists.flat()));

// ─── Bank currencies ──────────────────────────────────────────

const BANKS: LoyaltyProgram[] = [
  {
    id: "amex-mr",
    name: "American Express Membership Rewards",
    shortName: "Amex MR",
    kind: "bank",
    currency: "Membership Rewards points",
    valuationCpp: 2.0,
    chartType: "fixed",
    surcharges: "none",
    typicalTaxesUsd: tx(0, 0, 0, 0),
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "Never expire while you hold an eligible Membership Rewards card.",
    bookingUrl: "https://global.americanexpress.com/rewards/transfer",
    color: "#006FCF",
    summary:
      "The deepest transfer-partner bench of any US bank, anchored by ANA, Aeroplan, Avianca, Flying Blue and Virgin Atlantic. Amex runs the most frequent transfer bonuses (20–40% to Avios, Virgin, Aeromexico and Flying Blue several times a year), which is where most of the value lives. Watch the exceptions: Cathay and Emirates now move at 5:4, JetBlue at 5:4, Aeromexico at 1:1.6, and Hilton at 1:2.",
    sweetSpots: [
      { title: "ANA business class via Virgin Atlantic", description: "Transfer to Flying Club and book ANA business to Tokyo from 52.5k (West Coast) or 60k (East Coast) one-way; ANA Mileage Club itself (also an Amex partner) is 50k one-way in low season but books only round-trips or one-ways on its own metal.", cabin: "business", miles: 52500, example: "LAX–HND ANA 'The Room' 52.5k via Virgin", tags: ["transfer", "japan"] },
      { title: "Frequent 30% bonuses to Virgin Atlantic and Avios", description: "With a 30% bonus, 100k MR becomes 130k Virgin Points — enough for Delta One or ANA First one-way.", tags: ["bonus"] },
      { title: "Aeromexico at 1:1.6", description: "The richest ratio on the board; useful for SkyTeam awards priced on Aeromexico's distance chart.", tags: ["ratio"] },
      { title: "Hilton at 1:2 with periodic bonuses", description: "100k MR → 200k Hilton (260k with a 30% bonus): roughly two nights at a Waldorf Astoria or Conrad resort.", tags: ["hotel"] },
      { title: "Flying Blue Promo Rewards", description: "Monthly 25% discounts put transatlantic business at 45k one-way; Amex transfers post instantly so you can book while the promo is live.", cabin: "business", miles: 45000, tags: ["promo"] },
    ],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "Transfers are one-way and irreversible; 1,000-point minimum (250 to JetBlue, 500 to Qantas); US airlines (Delta, JetBlue) carry a 0.06¢/pt excise fee capped at $99.",
  },
  {
    id: "chase-ur",
    name: "Chase Ultimate Rewards",
    shortName: "Chase UR",
    kind: "bank",
    currency: "Ultimate Rewards points",
    valuationCpp: 2.0,
    chartType: "fixed",
    surcharges: "none",
    typicalTaxesUsd: tx(0, 0, 0, 0),
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "Never expire while the account is open.",
    bookingUrl: "https://www.chase.com/personal/credit-cards/ultimate-rewards",
    color: "#117ACA",
    summary:
      "Fourteen partners — ten airlines and four hotels — almost all at 1:1 and usually instant. World of Hyatt is the crown jewel, although from 1 Oct 2026 only the Sapphire Reserve keeps 1:1 to Hyatt (Sapphire Preferred and Ink Preferred transfer at 4:3). Emirates left the roster in Oct 2025; Wyndham joined in Feb 2026. Points Boost (up to 2¢ on select Chase Travel bookings) replaced the old flat 1.5¢ portal multiplier.",
    sweetSpots: [
      { title: "World of Hyatt", description: "Category 1–4 Hyatts from 3k–25k points a night under the May 2026 five-tier chart; Park Hyatts top out at 75k. Still the best hotel transfer in the industry on the Sapphire Reserve.", tags: ["hotel"] },
      { title: "Aeroplan for Star Alliance premium cabins", description: "No fuel surcharges on Lufthansa, Swiss, ANA or EVA; frequent 20–30% Chase→Aeroplan bonuses.", cabin: "business", miles: 75000, tags: ["transfer"] },
      { title: "Southwest Companion Pass top-ups", description: "The only transferable currency that feeds Rapid Rewards 1:1 (transfers don't count toward the Pass, but they fund flights for the pass holder).", tags: ["domestic"] },
      { title: "Virgin Atlantic for ANA and Delta One", description: "Instant transfers make it practical to book ANA First at 72.5k the moment space appears.", cabin: "first", miles: 72500, tags: ["japan"] },
      { title: "Flying Blue and Avios short-haul", description: "Iberia off-peak business Madrid–East Coast and Flying Blue Promo Rewards both post instantly from Chase.", tags: ["europe"] },
    ],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "Transfers in 1,000-point increments, most post instantly; points are pooled across Chase cards in the same household.",
  },
  {
    id: "citi-ty",
    name: "Citi ThankYou Rewards",
    shortName: "Citi TY",
    kind: "bank",
    currency: "ThankYou Points",
    valuationCpp: 1.7,
    chartType: "fixed",
    surcharges: "none",
    typicalTaxesUsd: tx(0, 0, 0, 0),
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "Never expire while a ThankYou card is open (points from closed cards expire after 90 days).",
    bookingUrl: "https://www.thankyou.com",
    color: "#056DAE",
    summary:
      "Fifteen airlines and five hotel partners, and the only major bank that feeds American AAdvantage (1:1 on Strata Premier, Strata Elite and Prestige; 1:0.7 on no-fee cards). Qatar Privilege Club (2024) and the Avios family make it a strong oneworld currency, and Citi runs regular 20–30% bonuses to Qatar, Avianca and Turkish. Emirates moved to 5:4 in 2025 and Choice fell to 1:1.5 in April 2026.",
    sweetSpots: [
      { title: "AAdvantage at 1:1", description: "Qsuites US–Doha for 70k, Japan Airlines business for 60k, Europe business for 57.5k — all off AA's fixed partner chart.", cabin: "business", miles: 70000, tags: ["oneworld"] },
      { title: "Qatar Privilege Club with 25% bonuses", description: "Qsuites off-peak 70k Avios one-way; with a 25% bonus that's 56k ThankYou points.", cabin: "business", miles: 70000, tags: ["bonus"] },
      { title: "Avianca LifeMiles", description: "Star Alliance business to Europe for 69k–80k with no surcharges; frequent Citi→LifeMiles bonuses.", cabin: "business", miles: 69000 },
      { title: "Turkish Miles&Smiles", description: "US–Istanbul or Europe business for 45k one-way on Turkish or Star partners.", cabin: "business", miles: 45000 },
      { title: "EVA Air Infinity MileageLands", description: "Citi is one of only two banks that transfer to EVA (1:1) for Royal Laurel business to Taipei.", cabin: "business" },
    ],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "1,000-point minimum; most partners post within 1–2 days; AAdvantage and Wyndham ratios depend on which Citi card you hold.",
  },
  {
    id: "capital-one",
    name: "Capital One Miles",
    shortName: "Capital One",
    kind: "bank",
    currency: "Capital One miles",
    valuationCpp: 1.7,
    chartType: "fixed",
    surcharges: "none",
    typicalTaxesUsd: tx(0, 0, 0, 0),
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "Never expire while the account is open.",
    bookingUrl: "https://www.capitalone.com/credit-cards/benefits/rewards/transfer/",
    color: "#D03027",
    summary:
      "Twenty-two partners after Japan Airlines, Qatar Airways and I Prefer joined in Sept 2025. Most airlines are 1:1 (Aeroplan, Avianca, BA, Cathay, Flying Blue, Qantas, Singapore, Turkish, Virgin Red, Etihad, Finnair, TAP, JAL, Qatar); EVA is 4:3, JetBlue 5:3, Accor 2:1 and Emirates dropped to 4:3 in Jan 2026. Transfers are instant to most partners and bonuses of 20–30% appear a few times a year.",
    sweetSpots: [
      { title: "Avianca LifeMiles", description: "Star Alliance business to Europe without surcharges; Capital One is the only issuer besides Citi/Amex/Bilt/Wells feeding LifeMiles and transfers post instantly.", cabin: "business", miles: 69000 },
      { title: "Turkish Miles&Smiles to Europe", description: "45k one-way business to Istanbul or beyond on Turkish's fixed chart.", cabin: "business", miles: 45000 },
      { title: "Qatar Avios", description: "Qsuites from 70k off-peak with the frequent Capital One→Qatar bonuses.", cabin: "business", miles: 70000 },
      { title: "Japan Airlines Mileage Bank", description: "Added Sept 2025 — JAL business to Tokyo for 55k one-way on JAL's own chart.", cabin: "business", miles: 55000, tags: ["japan"] },
      { title: "Accor ALL at 2:1", description: "A fixed-value hotel fallback (2,000 ALL points = €40) when award charts are ugly.", tags: ["hotel"] },
    ],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "1,000-mile minimum; most transfers are instant; miles are pooled across Venture/Spark cards.",
  },
  {
    id: "bilt",
    name: "Bilt Rewards",
    shortName: "Bilt",
    kind: "bank",
    currency: "Bilt Points",
    valuationCpp: 2.0,
    chartType: "fixed",
    surcharges: "none",
    typicalTaxesUsd: tx(0, 0, 0, 0),
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "Never expire while the account is active (24 months of inactivity forfeits points).",
    bookingUrl: "https://www.biltrewards.com/travel",
    color: "#111111",
    summary:
      "Born as the rent-rewards program, Bilt now has the best partner roster per point: 1:1 to Aeroplan, Alaska Atmos Rewards (the only bank that does), United, Flying Blue, Virgin Red, Cathay, Emirates (still 1:1), Avianca, Turkish, Japan Airlines, Southwest, TAP, Etihad, Iberia, BA and Aer Lingus, plus Hyatt, Hilton, Marriott, IHG, Accor (3:2) and I Prefer. AA transfers ended June 2024. Rent Day (the 1st) brings headline bonuses of 50–100% to a rotating partner.",
    sweetSpots: [
      { title: "Alaska Atmos Rewards", description: "The only bank transfer into Atmos: Cathay First JFK–HKG for 130k, JAL business West Coast–Tokyo for 75k, Starlux and Qatar on distance charts.", cabin: "first", miles: 130000, tags: ["exclusive"] },
      { title: "World of Hyatt at 1:1", description: "Every Bilt card keeps 1:1 to Hyatt — now better than a Sapphire Preferred.", tags: ["hotel"] },
      { title: "Rent Day transfer bonuses", description: "First-of-the-month bonuses have hit 50% to Flying Blue, 75% to Virgin Atlantic and 100% to Avianca.", tags: ["bonus"] },
      { title: "United and Aeroplan for Star Alliance", description: "Two 1:1 Star currencies with no surcharges; Aeroplan adds a 5k-point stopover.", cabin: "business", miles: 75000 },
      { title: "Emirates at 1:1", description: "The last US program still moving to Skywards at par; business to Dubai from 87k Saver.", cabin: "business", miles: 87000 },
    ],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "Transfers post instantly to most partners; Bilt 2.0 cards (Blue/Obsidian/Palladium) earn up to 1.25× on rent with no transaction fee.",
  },
  {
    id: "wells-fargo",
    name: "Wells Fargo Rewards",
    shortName: "Wells Fargo",
    kind: "bank",
    currency: "Wells Fargo Rewards points",
    valuationCpp: 1.5,
    chartType: "fixed",
    surcharges: "none",
    typicalTaxesUsd: tx(0, 0, 0, 0),
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "Never expire while the account is open.",
    bookingUrl: "https://www.wellsfargo.com/rewards/",
    color: "#D71E28",
    summary:
      "The newest transferable currency (partners launched April 2024) and growing fast: Flying Blue, British Airways, Iberia, Aer Lingus, Avianca, Virgin Atlantic, JetBlue (Nov 2025) and Cathay Pacific (April 2026) at 1:1, plus Choice and Wyndham at a generous 1:2. Only the Autograph Journey (and Autograph paired with it) can transfer; bonuses have been rare but reached 25% to Flying Blue.",
    sweetSpots: [
      { title: "Choice and Wyndham at 1:2", description: "The best hotel ratios anywhere: 15k Wells points → 30k Wyndham, enough for any Vacasa-tier or top-category Wyndham night.", tags: ["hotel"] },
      { title: "Flying Blue Promo Rewards", description: "Business to Europe from 45k during promos; Wells Fargo transfers post within minutes.", cabin: "business", miles: 45000 },
      { title: "Avianca LifeMiles", description: "No-surcharge Star Alliance awards on Lufthansa, Swiss, Turkish and United.", cabin: "business", miles: 69000 },
      { title: "Cathay Pacific Asia Miles", description: "Added April 2026 — Cathay business Hong Kong–Asia short-hauls and the oneworld multi-carrier chart.", cabin: "business" },
    ],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "1,000-point minimum; points are pooled across Wells Fargo cards but only an Autograph Journey unlocks transfers.",
  },
];
