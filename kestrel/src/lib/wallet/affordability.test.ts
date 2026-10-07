import { describe, expect, it } from "vitest";
import { planPayment, reachByProgram, effectiveRatio, walletValueUsd } from "./affordability";
import type { Balance, LoyaltyProgram, TransferLink } from "@/lib/types";

const programs = {
  "amex-mr": { id: "amex-mr", valuationCpp: 2.0 },
  "chase-ur": { id: "chase-ur", valuationCpp: 2.0 },
  aeroplan: { id: "aeroplan", valuationCpp: 1.5 },
  "virgin-atlantic-flying-club": { id: "virgin-atlantic-flying-club", valuationCpp: 1.4 },
} as unknown as Record<string, LoyaltyProgram>;

const links: TransferLink[] = [
  { from: "amex-mr", to: "aeroplan", ratio: [1, 1], transferTime: "instant", minimum: 1000 },
  { from: "chase-ur", to: "aeroplan", ratio: [1, 1], transferTime: "instant", minimum: 1000, bonus: { percent: 25, startsAt: "2026-10-01", endsAt: "2026-10-31", verifiedAt: "2026-10-01" } },
  { from: "amex-mr", to: "virgin-atlantic-flying-club", ratio: [1, 1], transferTime: "instant", minimum: 1000 },
];

const balances: Balance[] = [
  { programId: "aeroplan", amount: 20000, updatedAt: "", source: "manual" },
  { programId: "amex-mr", amount: 50000, updatedAt: "", source: "manual" },
  { programId: "chase-ur", amount: 30000, updatedAt: "", source: "manual" },
];

describe("affordability", () => {
  it("applies active transfer bonuses to the ratio", () => {
    expect(effectiveRatio(links[1], "2026-10-15")).toBeCloseTo(1.25);
    expect(effectiveRatio(links[1], "2026-12-01")).toBe(1);
  });

  it("uses direct balance first, then the cheapest transfer", () => {
    const plan = planPayment("aeroplan", 60000, balances, links, programs, "2026-10-15");
    expect(plan.direct).toBe(20000);
    expect(plan.affordable).toBe(true);
    // Chase with 25% bonus is cheaper per Aeroplan point than Amex, so it should come first.
    expect(plan.transfers[0].from).toBe("chase-ur");
    expect(plan.shortfall).toBe(0);
  });

  it("reports shortfall when the wallet cannot cover the fare", () => {
    const plan = planPayment("aeroplan", 200000, balances, links, programs, "2026-10-15");
    expect(plan.affordable).toBe(false);
    expect(plan.shortfall).toBeGreaterThan(0);
  });

  it("computes reach per program", () => {
    const reach = reachByProgram(balances, links, "2026-10-15");
    expect(reach.aeroplan.direct).toBe(20000);
    expect(reach.aeroplan.viaTransfer).toBe(50000 + 37500);
    expect(reach["virgin-atlantic-flying-club"].total).toBe(50000);
  });

  it("values the wallet", () => {
    expect(walletValueUsd(balances, programs)).toBeCloseTo(300 + 1000 + 600);
  });
});
