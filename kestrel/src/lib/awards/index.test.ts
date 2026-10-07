import { describe, expect, it } from "vitest";
import type { TransferLink } from "@/lib/types";
import { ALL_CHART_PROGRAM_IDS, buildTransferOptions, hasChart, priceAward, type PriceInput } from "./index";

/** JFK–LHR, 3,451 mi, business, mid-week in early February (off-peak everywhere). */
const base: PriceInput = {
  programId: "british-airways-club",
  carrier: "BA",
  origin: "JFK",
  destination: "LHR",
  originRegion: "north-america",
  destinationRegion: "europe",
  distanceMiles: 3451,
  cabin: "business",
  date: "2026-02-03",
};

const mk = (o: Partial<PriceInput>): PriceInput => ({ ...base, ...o });

describe("priceAward — dispatch", () => {
  it("covers every airline program id from docs/ARCHITECTURE.md", () => {
    const expected = [
      "aeroplan", "united-mileageplus", "ana-mileage-club", "singapore-krisflyer", "avianca-lifemiles",
      "turkish-miles-smiles", "eva-infinity", "thai-royal-orchid", "asiana-club", "lufthansa-miles-more",
      "american-aadvantage", "british-airways-club", "qatar-privilege-club", "cathay-asia-miles", "jal-mileage-bank",
      "alaska-mileage-plan", "qantas-frequent-flyer", "iberia-plus", "finnair-plus", "aer-lingus-aerclub",
      "delta-skymiles", "flying-blue", "virgin-atlantic-flying-club", "korean-air-skypass", "aeromexico-rewards",
      "etihad-guest", "emirates-skywards", "jetblue-trueblue", "southwest-rapid-rewards", "virgin-australia-velocity",
      "copa-connectmiles", "latam-pass", "air-india-maharaja", "air-new-zealand-airpoints", "sas-eurobonus", "tap-miles-go",
    ];
    for (const id of expected) expect(ALL_CHART_PROGRAM_IDS, id).toContain(id);
    expect(ALL_CHART_PROGRAM_IDS).toHaveLength(expected.length);
    expect(hasChart("aeroplan")).toBe(true);
    expect(hasChart("nope")).toBe(false);
  });

  it("BA JFK–LHR business: 50,000 off-peak / 60,000 peak with heavy BA surcharges", () => {
    const off = priceAward(mk({ date: "2026-02-03" }));
    const peak = priceAward(mk({ date: "2026-07-15" }));
    expect(off).not.toBeNull();
    expect(peak).not.toBeNull();
    expect(off!.miles).toBe(50_000);
    expect(off!.peak).toBe("off-peak");
    expect(peak!.miles).toBe(60_000);
    expect(peak!.peak).toBe("peak");
    expect(off!.basis).toBe("chart");
    expect(off!.taxesUsd).toBeGreaterThanOrEqual(350);
    expect(off!.taxesUsd).toBeLessThanOrEqual(700);
    expect(off!.note).toMatch(/3,001–4,000 mi/);
  });

  it("BA partner awards (AA metal) are always charged at the peak rate", () => {
    const q = priceAward(mk({ carrier: "AA", date: "2026-02-03" }));
    expect(q!.miles).toBe(60_000);
    expect(q!.taxesUsd).toBeLessThan(200); // no BA surcharges on AA metal
  });

  it("Aeroplan prices Lufthansa JFK–FRA business in the 60–70k band with low taxes", () => {
    const q = priceAward(mk({ programId: "aeroplan", carrier: "LH", destination: "FRA", distanceMiles: 3851 }));
    expect(q).not.toBeNull();
    expect(q!.basis).toBe("chart");
    expect(q!.miles).toBeGreaterThanOrEqual(60_000);
    expect(q!.miles).toBeLessThanOrEqual(70_000);
    expect(q!.taxesUsd).toBeGreaterThanOrEqual(40);
    expect(q!.taxesUsd).toBeLessThanOrEqual(150);
    expect(q!.note).toMatch(/Atlantic/);
  });

  it("Aeroplan: Air Canada metal is dynamic and scales with demand", () => {
    const lo = priceAward(mk({ programId: "aeroplan", carrier: "AC", destination: "FRA", distanceMiles: 3851, demand: 0 }));
    const hi = priceAward(mk({ programId: "aeroplan", carrier: "AC", destination: "FRA", distanceMiles: 3851, demand: 1 }));
    expect(lo!.basis).toBe("dynamic");
    expect(hi!.miles).toBeGreaterThan(lo!.miles);
  });

  it("LifeMiles prices North America ↔ Europe business at 63,000 with no surcharges", () => {
    const q = priceAward(mk({ programId: "avianca-lifemiles", carrier: "LH", destination: "FRA", distanceMiles: 3851 }));
    expect(q!.miles).toBe(63_000);
    expect(q!.basis).toBe("chart");
    expect(q!.taxesUsd).toBeLessThan(120);
  });

  it("Virgin Atlantic × ANA returns the round-trip requirement with a note", () => {
    const q = priceAward(
      mk({
        programId: "virgin-atlantic-flying-club",
        carrier: "NH",
        origin: "SFO",
        destination: "HND",
        originRegion: "north-america",
        destinationRegion: "north-asia",
        distanceMiles: 5130,
      }),
    );
    expect(q).not.toBeNull();
    expect(q!.miles).toBe(45_000);
    expect(q!.note).toMatch(/ROUND-TRIP/i);
    const first = priceAward(mk({ programId: "virgin-atlantic-flying-club", carrier: "NH", origin: "JFK", destination: "HND", destinationRegion: "north-asia", distanceMiles: 6730, cabin: "first" }));
    expect(first!.miles).toBe(85_000);
  });

  it("unknown program ids fall back to a generic estimate", () => {
    const q = priceAward(mk({ programId: "mystery-miles", carrier: "ZZ" }));
    expect(q).not.toBeNull();
    expect(q!.basis).toBe("estimate");
    expect(q!.miles).toBeGreaterThan(20_000);
    expect(q!.note).toMatch(/generic/i);
  });

  it("returns null when the program cannot book the carrier", () => {
    expect(priceAward(mk({ programId: "aeroplan", carrier: "BA" }))).toBeNull(); // oneworld on a Star program
    expect(priceAward(mk({ programId: "british-airways-club", carrier: "UA" }))).toBeNull();
    expect(priceAward(mk({ programId: "delta-skymiles", carrier: "AA" }))).toBeNull();
    expect(priceAward(mk({ programId: "southwest-rapid-rewards", carrier: "WN", cabin: "business", distanceMiles: 800 }))).toBeNull();
  });

  it("normalises carrier case and never returns non-positive miles", () => {
    const q = priceAward(mk({ carrier: "ba" }));
    expect(q!.miles).toBe(50_000);
    const tiny = priceAward(mk({ programId: "aeroplan", carrier: "ua", origin: "LGA", destination: "BOS", destinationRegion: "north-america", distanceMiles: 0, cabin: "economy" }));
    expect(tiny!.miles).toBeGreaterThan(0);
    expect(Number.isInteger(tiny!.miles)).toBe(true);
    expect(Number.isInteger(tiny!.taxesUsd)).toBe(true);
  });

  it("is deterministic for identical input", () => {
    const a = priceAward(mk({ programId: "delta-skymiles", carrier: "DL" }));
    const b = priceAward(mk({ programId: "delta-skymiles", carrier: "DL" }));
    expect(a).toEqual(b);
  });
});

describe("buildTransferOptions", () => {
  const link = (o: Partial<TransferLink> = {}): TransferLink => ({
    from: "amex-mr",
    to: "aeroplan",
    ratio: [1, 1],
    transferTime: "instant",
    minimum: 1000,
    ...o,
  });

  it("applies a running transfer bonus", () => {
    const [plain] = buildTransferOptions(60_000, [link()]);
    const [bonus] = buildTransferOptions(60_000, [link({ bonus: { percent: 30, startsAt: "2026-01-01", endsAt: "2026-02-01", verifiedAt: "2026-01-01" } })]);
    expect(plain.bankPointsNeeded).toBe(60_000);
    expect(plain.bonusPercent).toBeUndefined();
    expect(bonus.bankPointsNeeded).toBe(47_000); // 60,000 / 1.3 = 46,154 → next 1,000
    expect(bonus.bonusPercent).toBe(30);
  });

  it("honours non-1:1 ratios", () => {
    const [opt] = buildTransferOptions(60_000, [link({ from: "marriott-bonvoy", ratio: [3, 1] })]);
    expect(opt.bankPointsNeeded).toBe(180_000);
    const [opt2] = buildTransferOptions(60_000, [link({ ratio: [1000, 800] })]);
    expect(opt2.bankPointsNeeded).toBe(75_000);
  });

  it("rounds to 1,000 only above 10k, and applies the link minimum / 1-point floor", () => {
    const [small] = buildTransferOptions(4_500, [link({ minimum: 0 })]);
    expect(small.bankPointsNeeded).toBe(4_500);
    const [min] = buildTransferOptions(500, [link({ minimum: 1000 })]);
    expect(min.bankPointsNeeded).toBe(1000);
    const [floor] = buildTransferOptions(0, [link({ minimum: 0 })]);
    expect(floor.bankPointsNeeded).toBe(1);
    const [big] = buildTransferOptions(10_001, [link({ minimum: 0 })]);
    expect(big.bankPointsNeeded).toBe(11_000);
  });
});
