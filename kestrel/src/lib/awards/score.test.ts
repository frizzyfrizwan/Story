import { describe, expect, it } from "vitest";
import { BADGE, cpp, CPP_BENCHMARK, scoreFare, type ScoreInput } from "./score";

const base: ScoreInput = {
  programId: "british-airways-club",
  cabin: "business",
  miles: 50_000,
  taxesUsd: 450,
  cashUsd: 3_600,
  distanceMiles: 3451,
  seats: 2,
  stops: 0,
};

describe("cpp", () => {
  it("is (cash − taxes) / miles × 100, floored at zero", () => {
    expect(cpp(50_000, 450, 3_600)).toBeCloseTo(6.3, 5);
    expect(cpp(0, 0, 1000)).toBe(0);
    expect(cpp(10_000, 500, 400)).toBe(0);
  });
});

describe("scoreFare", () => {
  it("is monotonic non-decreasing in cpp (holding everything else fixed)", () => {
    let prevScore = -1;
    let prevCpp = -1;
    for (let cash = 200; cash <= 12_000; cash += 200) {
      const r = scoreFare({ ...base, cashUsd: cash });
      expect(r.cpp).toBeGreaterThanOrEqual(prevCpp);
      expect(r.valueScore, `cash=${cash}`).toBeGreaterThanOrEqual(prevScore);
      prevScore = r.valueScore;
      prevCpp = r.cpp;
    }
    const lowMiles = scoreFare({ ...base, miles: 30_000 });
    const highMiles = scoreFare({ ...base, miles: 120_000 });
    expect(lowMiles.valueScore).toBeGreaterThan(highMiles.valueScore);
  });

  it("scores ≈ 70 at the cabin benchmark and stays within 0–100", () => {
    for (const cabin of ["economy", "premium", "business", "first"] as const) {
      const miles = 50_000;
      const taxes = 0;
      const cash = (CPP_BENCHMARK[cabin] / 100) * miles;
      const r = scoreFare({ ...base, cabin, miles, taxesUsd: taxes, cashUsd: cash, seats: null, stops: 0 });
      expect(r.valueScore).toBeGreaterThanOrEqual(68);
      expect(r.valueScore).toBeLessThanOrEqual(72);
    }
    expect(scoreFare({ ...base, cashUsd: 0 }).valueScore).toBe(0);
    expect(scoreFare({ ...base, miles: 1_000, cashUsd: 50_000, taxesUsd: 0, seats: 9 }).valueScore).toBe(100);
  });

  it("penalises taxes and stops, rewards open availability", () => {
    const clean = scoreFare({ ...base, taxesUsd: 20 });
    const heavy = scoreFare({ ...base, taxesUsd: 900 });
    expect(clean.valueScore).toBeGreaterThan(heavy.valueScore);
    const nonstop = scoreFare({ ...base, stops: 0 });
    const twoStops = scoreFare({ ...base, stops: 2 });
    expect(nonstop.valueScore).toBeGreaterThan(twoStops.valueScore);
    const open = scoreFare({ ...base, seats: 6 });
    const lone = scoreFare({ ...base, seats: 1 });
    expect(open.valueScore).toBeGreaterThan(lone.valueScore);
  });

  it("awards badges from thresholds", () => {
    const sweet = scoreFare({ ...base, taxesUsd: 40, seats: 5, stops: 0 });
    expect(sweet.badges).toEqual(
      expect.arrayContaining([BADGE.sweetSpot, BADGE.lowTaxes, BADGE.wideOpen, BADGE.nonstop]),
    );
    expect(sweet.badges).not.toContain(BADGE.surchargeHeavy);
    expect(sweet.badges).not.toContain(BADGE.rare);

    const rare = scoreFare({
      ...base,
      cabin: "first",
      miles: 90_000,
      cashUsd: 9_000,
      taxesUsd: 650,
      seats: 1,
      stops: 1,
    });
    expect(rare.badges).toContain(BADGE.rare);
    expect(rare.badges).toContain(BADGE.surchargeHeavy);
    expect(rare.badges).not.toContain(BADGE.nonstop);
    expect(rare.badges).not.toContain(BADGE.lowTaxes);

    const economyLone = scoreFare({ ...base, cabin: "economy", miles: 30_000, cashUsd: 700, taxesUsd: 50, seats: 1 });
    expect(economyLone.badges).not.toContain(BADGE.rare); // Rare only for business/first

    const unknownSeats = scoreFare({ ...base, seats: null });
    expect(unknownSeats.badges).not.toContain(BADGE.wideOpen);
    expect(unknownSeats.badges).not.toContain(BADGE.rare);

    const noSweet = scoreFare({ ...base, miles: 150_000 }); // 2.1¢ < 1.8 × 2.5¢
    expect(noSweet.badges).not.toContain(BADGE.sweetSpot);
  });
});
