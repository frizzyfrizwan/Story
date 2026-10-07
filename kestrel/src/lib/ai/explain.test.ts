import { describe, expect, it } from "vitest";
import type { AwardFare, Deal, Itinerary, LoyaltyProgram } from "@/lib/types";
import { dealDigest, dealDigestTemplate, explainRedemption, explainRedemptionTemplate, monthNumber, tripIdeas, tripIdeasHeuristic } from "./explain";

/** Minimal program fixtures so the tests don't depend on the curated dataset. */
function prog(id: string, name: string, shortName: string, kind: LoyaltyProgram["kind"], valuationCpp: number, extra: Partial<LoyaltyProgram> = {}): LoyaltyProgram {
  return {
    id,
    name,
    shortName,
    kind,
    currency: `${shortName} points`,
    valuationCpp,
    chartType: "zone",
    surcharges: "low",
    typicalTaxesUsd: { economy: 50, premium: 80, business: 120, first: 150 },
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "n/a",
    bookingUrl: `https://${id}.example`,
    color: "#000",
    summary: "",
    sweetSpots: [],
    bookableCarriers: [],
    oneWay: true,
    routingRules: "",
    ...extra,
  };
}
const PROGRAM_FIXTURES: Record<string, LoyaltyProgram> = {
  "amex-mr": prog("amex-mr", "American Express Membership Rewards", "Amex MR", "bank", 2.0),
  "chase-ur": prog("chase-ur", "Chase Ultimate Rewards", "Chase UR", "bank", 2.0),
  aeroplan: prog("aeroplan", "Air Canada Aeroplan", "Aeroplan", "airline", 1.5, { surcharges: "none", oneWay: true, changeFeeUsd: 100, cancelFeeUsd: 150, bookingUrl: "https://aeroplan.com" }),
  "american-aadvantage": prog("american-aadvantage", "American AAdvantage", "AAdvantage", "airline", 1.5),
  "british-airways-club": prog("british-airways-club", "British Airways Club", "Avios", "airline", 1.4),
  "alaska-mileage-plan": prog("alaska-mileage-plan", "Alaska Mileage Plan", "Mileage Plan", "airline", 1.6),
};
const withFixtures = { getProgram: (id: string) => PROGRAM_FIXTURES[id] };

const fare: AwardFare = {
  programId: "aeroplan",
  cabin: "business",
  miles: 70000,
  taxesUsd: 112,
  seats: 2,
  transferOptions: [
    { bankProgramId: "chase-ur", ratio: [1, 1], bankPointsNeeded: 70000, transferTime: "instant" },
    { bankProgramId: "amex-mr", ratio: [1, 1], bankPointsNeeded: 60000, bonusPercent: 20, transferTime: "instant" },
  ],
  cpp: 6.2,
  valueScore: 88,
  badges: ["Sweet spot", "Low taxes"],
  source: "simulated",
  fetchedAt: "2026-10-07T00:00:00Z",
};

const itinerary: Itinerary = {
  id: "itin-1",
  segments: [
    { carrier: "AC", flightNumber: "AC8", origin: "JFK", destination: "YYZ", departure: "2027-05-14T08:00", arrival: "2027-05-14T09:35", durationMin: 95, cabin: "business" },
    { carrier: "AC", flightNumber: "AC1", origin: "YYZ", destination: "NRT", departure: "2027-05-14T13:40", arrival: "2027-05-15T15:50", durationMin: 790, aircraft: "787-9", cabin: "business" },
  ],
  totalDurationMin: 1130,
  stops: 1,
  distanceMiles: 7100,
};

function sentenceCount(text: string): number {
  return (text.match(/[.!?](?=\s|$)/g) ?? []).length;
}

describe("explainRedemptionTemplate", () => {
  it("writes a 3–5 sentence verdict with price, transfer advice and a booking tip", () => {
    const text = explainRedemptionTemplate(fare, { itinerary, cashPriceUsd: 4500 }, withFixtures);
    const n = sentenceCount(text);
    expect(n).toBeGreaterThanOrEqual(3);
    expect(n).toBeLessThanOrEqual(5);
    expect(text).toContain("JFK → NRT");
    expect(text).toContain("70,000 Aeroplan points");
    expect(text).toContain("$112");
    expect(text).toContain("$4,500");
    expect(text).toContain("we value Aeroplan points at 1.5¢");
    expect(text).toMatch(/excellent/i);
    expect(text).toContain("sweet spot, low taxes");
    // cheapest transfer first (Amex 60k with bonus), Chase as the alternative
    expect(text).toMatch(/60,000 Amex MR points \(1:1, with a 20% bonus/);
    expect(text).toContain("70,000 Chase UR");
    expect(text).toMatch(/only 2 seats left at this price, so book promptly/i);
    expect(text).toContain("changes run $100 and cancellations $150");
    expect(text).toContain("book at https://aeroplan.com");
  });

  it("warns about high taxes and handles missing cash price / transfer options", () => {
    const pricey: AwardFare = { ...fare, taxesUsd: 650, cpp: undefined, transferOptions: [], badges: [], seats: null };
    const text = explainRedemptionTemplate(pricey, { itinerary }, withFixtures);
    expect(text).toContain("Heads up");
    expect(text).toContain("$650");
    expect(text).toContain("strong redemption on our value score");
    expect(text).toContain("No bank currencies transfer into Air Canada Aeroplan");
    expect(sentenceCount(text)).toBeGreaterThanOrEqual(3);
    expect(sentenceCount(text)).toBeLessThanOrEqual(5);
  });

  it("flags mixed-cabin itineraries and still works with no program data at all", () => {
    expect(explainRedemptionTemplate({ ...fare, mixedCabin: true, badges: [] }, { itinerary }, withFixtures)).toMatch(/mixed-cabin/);
    const bare = explainRedemptionTemplate(fare, { itinerary }, { getProgram: () => undefined });
    expect(bare).toContain("70,000 miles");
    expect(bare).toContain("60,000 amex-mr points");
  });
});

describe("explainRedemption without a key", () => {
  it("falls back to the template when the LLM is disabled or no client exists", async () => {
    const template = explainRedemptionTemplate(fare, { itinerary, cashPriceUsd: 4500 }, withFixtures);
    await expect(explainRedemption(fare, { itinerary, cashPriceUsd: 4500 }, { llm: false, ...withFixtures })).resolves.toBe(template);
    await expect(explainRedemption(fare, { itinerary, cashPriceUsd: 4500 }, { client: null, ...withFixtures })).resolves.toBe(template);
  });
});

const deals: Deal[] = [
  { id: "d1", title: "Qsuite to Doha", origin: "JFK", destination: "DOH", carrier: "QR", cabin: "business", programId: "american-aadvantage", miles: 70000, taxesUsd: 35, cpp: 7.1, savingsPct: 30, dates: ["2027-02-03", "2027-02-10", "2027-02-17"], seats: 4, badge: "sweet-spot", source: "simulated", note: "Wide open in February" },
  { id: "d2", title: "Avios to Honolulu", origin: "LAX", destination: "HNL", carrier: "AS", cabin: "economy", programId: "british-airways-club", miles: 13000, taxesUsd: 6, cpp: 3.2, savingsPct: 20, dates: ["2027-04-02"], seats: 7, badge: "wide-open", source: "simulated" },
];

describe("dealDigest", () => {
  it("renders a markdown digest from the template", () => {
    const md = dealDigestTemplate(deals, withFixtures);
    expect(md.startsWith("## 2 award deals")).toBe(true);
    expect(md).toContain("at 7.1¢ per point via AAdvantage");
    expect(md).toContain("JFK→DOH in business on QR via AAdvantage: 70,000 + $35 (7.1¢/pt, 30% below typical) · 4 seats · 2027-02-03, 2027-02-10… · _sweet-spot_ — Wide open in February");
    expect(md).toContain("[search](/search?from=JFK&to=DOH&date=2027-02-03&cabin=business)");
    expect(md).toContain("Demo data");
  });

  it("handles an empty list and skips the LLM without a key", async () => {
    expect(dealDigestTemplate([])).toContain("Nothing standout");
    await expect(dealDigest(deals, { llm: false, ...withFixtures })).resolves.toBe(dealDigestTemplate(deals, withFixtures));
    await expect(dealDigest([], { client: null })).resolves.toBe(dealDigestTemplate([]));
  });
});

describe("tripIdeas", () => {
  it("returns five affordable-first ideas from the static table", () => {
    const ideas = tripIdeasHeuristic({ origin: "JFK", points: [{ programId: "amex-mr", amount: 80000 }], month: "May" }, withFixtures);
    expect(ideas).toHaveLength(5);
    expect(new Set(ideas.map((i) => i.destination)).size).toBe(5);
    expect(ideas.some((i) => i.affordable && i.via === "amex-mr")).toBe(true);
    expect(ideas.every((i) => i.href.startsWith("/search?from=JFK&to="))).toBe(true);
    expect(ideas.every((i) => i.miles > 0 && i.title.length > 0 && i.why.length > 0)).toBe(true);
    expect(ideas.map((i) => i.destination)).not.toContain("NYC");
    expect(ideas.find((i) => i.via === "amex-mr")?.why).toContain("Amex MR points to cover it");
    // affordable ideas sort before aspirational ones
    const firstUnaffordable = ideas.findIndex((i) => !i.affordable);
    const lastAffordable = ideas.map((i) => i.affordable).lastIndexOf(true);
    if (firstUnaffordable !== -1 && lastAffordable !== -1) expect(lastAffordable).toBeLessThan(firstUnaffordable);
  });

  it("still inspires with an empty wallet and accepts program names", () => {
    const none = tripIdeasHeuristic({ origin: "SFO", points: [] }, withFixtures);
    expect(none).toHaveLength(5);
    expect(none.every((i) => !i.affordable)).toBe(true);
    const named = tripIdeasHeuristic({ origin: "SFO", points: [{ programId: "Alaska miles", amount: 90000 }], month: 10 }, withFixtures);
    expect(named.some((i) => i.affordable && i.programId === "alaska-mileage-plan")).toBe(true);
  });

  it("uses the heuristic when the LLM is unavailable", async () => {
    const input = { origin: "BOS", points: [{ programId: "chase-ur", amount: 120000 }], month: 6 };
    await expect(tripIdeas(input, { llm: false, ...withFixtures })).resolves.toEqual(tripIdeasHeuristic(input, withFixtures));
  });

  it("parses month inputs", () => {
    expect(monthNumber("May")).toBe(5);
    expect(monthNumber("sept")).toBe(9);
    expect(monthNumber(12)).toBe(12);
    expect(monthNumber("13")).toBeUndefined();
    expect(monthNumber(undefined)).toBeUndefined();
  });
});
