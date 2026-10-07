import { describe, expect, it } from "vitest";
import { CABINS } from "@/lib/types";
import { estimateCashFare, seasonalFareMultiplier, typicalMilesFor } from "./cash";

describe("estimateCashFare", () => {
  it("lands in realistic one-way ranges for a transatlantic flight", () => {
    const d = 3451; // JFK–LHR
    for (const date of ["2026-02-03", "2026-05-12", "2026-07-15", "2026-10-07", "2026-12-23"]) {
      const y = estimateCashFare(d, "economy", date);
      const w = estimateCashFare(d, "premium", date);
      const j = estimateCashFare(d, "business", date);
      const f = estimateCashFare(d, "first", date);
      expect(y, `Y ${date}`).toBeGreaterThanOrEqual(550);
      expect(y, `Y ${date}`).toBeLessThanOrEqual(1_150);
      expect(w).toBeGreaterThan(y);
      expect(j, `J ${date}`).toBeGreaterThanOrEqual(2_800);
      expect(j, `J ${date}`).toBeLessThanOrEqual(5_200);
      expect(f, `F ${date}`).toBeGreaterThanOrEqual(6_000);
      expect(f, `F ${date}`).toBeLessThanOrEqual(10_500);
    }
  });

  it("prices long-haul business $3.5k–6.5k and first $8k–14k", () => {
    for (const d of [5_500, 7_000, 8_500]) {
      const j = estimateCashFare(d, "business", "2026-05-12");
      const f = estimateCashFare(d, "first", "2026-05-12");
      expect(j, `J ${d}`).toBeGreaterThanOrEqual(3_500);
      expect(j, `J ${d}`).toBeLessThanOrEqual(6_500);
      expect(f, `F ${d}`).toBeGreaterThanOrEqual(8_000);
      expect(f, `F ${d}`).toBeLessThanOrEqual(14_000);
    }
  });

  it("is deterministic and increases with distance per cabin", () => {
    expect(estimateCashFare(3451, "business", "2026-05-12")).toBe(estimateCashFare(3451, "business", "2026-05-12"));
    for (const cabin of CABINS) {
      const short = estimateCashFare(500, cabin, "2026-05-12");
      const long = estimateCashFare(7_000, cabin, "2026-05-12");
      expect(long, cabin).toBeGreaterThan(short);
    }
    expect(estimateCashFare(500, "economy")).toBeGreaterThan(0); // date optional
  });

  it("applies seasonal multipliers", () => {
    expect(seasonalFareMultiplier("2026-07-15")).toBeGreaterThan(1);
    expect(seasonalFareMultiplier("2026-12-24")).toBeGreaterThan(seasonalFareMultiplier("2026-07-15"));
    expect(seasonalFareMultiplier("2026-02-03")).toBeLessThan(1);
    expect(seasonalFareMultiplier()).toBe(1);
  });
});

describe("typicalMilesFor", () => {
  it("orders cabins and grows with distance, rounded to 500", () => {
    for (const d of [500, 2_500, 3_500, 7_000, 9_500]) {
      const y = typicalMilesFor("economy", d);
      const w = typicalMilesFor("premium", d);
      const j = typicalMilesFor("business", d);
      const f = typicalMilesFor("first", d);
      expect(y).toBeLessThan(w);
      expect(w).toBeLessThan(j);
      expect(j).toBeLessThan(f);
      for (const v of [y, w, j, f]) expect(v % 500).toBe(0);
    }
    expect(typicalMilesFor("business", 7_000)).toBeGreaterThan(typicalMilesFor("business", 3_500));
  });

  it("calibration: transatlantic business ≈ 60–70k, economy ≈ 25–30k", () => {
    expect(typicalMilesFor("business", 3_451)).toBeGreaterThanOrEqual(55_000);
    expect(typicalMilesFor("business", 3_451)).toBeLessThanOrEqual(70_000);
    expect(typicalMilesFor("economy", 3_451)).toBeGreaterThanOrEqual(24_000);
    expect(typicalMilesFor("economy", 3_451)).toBeLessThanOrEqual(31_000);
  });
});
