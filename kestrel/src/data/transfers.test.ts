import { describe, expect, it } from "vitest";
import { TRANSFER_LINKS, transferLink, transfersFrom, transfersTo } from "./transfers";
import { BANK_PROGRAMS, PROGRAM_BY_ID } from "./programs";

const BANK_IDS = new Set(BANK_PROGRAMS.map((p) => p.id));
const TIMES = ["instant", "hours", "1-2 days", "3-7 days", "1-2 weeks"];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

describe("TRANSFER_LINKS", () => {
  it("only originates from bank currencies", () => {
    for (const l of TRANSFER_LINKS) {
      expect(BANK_IDS.has(l.from), `${l.from} → ${l.to}`).toBe(true);
    }
  });

  it("only lands on airline or hotel programs that exist", () => {
    for (const l of TRANSFER_LINKS) {
      const dest = PROGRAM_BY_ID[l.to];
      expect(dest, `${l.from} → ${l.to}`).toBeDefined();
      expect(dest?.kind, `${l.from} → ${l.to}`).not.toBe("bank");
    }
  });

  it("has no duplicate bank→program pairs", () => {
    const keys = TRANSFER_LINKS.map((l) => `${l.from}→${l.to}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("uses positive integer ratios, valid times and minimums", () => {
    for (const l of TRANSFER_LINKS) {
      const label = `${l.from} → ${l.to}`;
      expect(l.ratio, label).toHaveLength(2);
      for (const n of l.ratio) {
        expect(Number.isInteger(n), label).toBe(true);
        expect(n, label).toBeGreaterThan(0);
      }
      expect(TIMES, label).toContain(l.transferTime);
      expect(l.minimum, label).toBeGreaterThan(0);
    }
  });

  it("dates bonuses sensibly", () => {
    const bonuses = TRANSFER_LINKS.filter((l) => l.bonus);
    expect(bonuses.length).toBeGreaterThanOrEqual(4);
    for (const l of bonuses) {
      const b = l.bonus!;
      const label = `${l.from} → ${l.to}`;
      expect(b.percent, label).toBeGreaterThanOrEqual(5);
      expect(b.percent, label).toBeLessThanOrEqual(100);
      for (const d of [b.startsAt, b.endsAt, b.verifiedAt]) expect(d, label).toMatch(ISO_DATE);
      expect(b.startsAt <= b.endsAt, label).toBe(true);
      expect(b.startsAt >= "2026-09-01" && b.endsAt <= "2026-11-30", label).toBe(true);
    }
  });

  it("covers every bank with a realistic partner count", () => {
    for (const bank of BANK_IDS) {
      expect(transfersFrom(bank).length, bank).toBeGreaterThanOrEqual(10);
    }
    expect(TRANSFER_LINKS.length).toBeGreaterThanOrEqual(90);
  });

  it("encodes the well-known ratios", () => {
    expect(transferLink("amex-mr", "hilton-honors")?.ratio).toEqual([1, 2]);
    expect(transferLink("amex-mr", "aeromexico-rewards")?.ratio).toEqual([5, 8]);
    expect(transferLink("amex-mr", "cathay-asia-miles")?.ratio).toEqual([5, 4]);
    expect(transferLink("capital-one", "jetblue-trueblue")?.ratio).toEqual([5, 3]);
    expect(transferLink("capital-one", "eva-infinity")?.ratio).toEqual([4, 3]);
    expect(transferLink("wells-fargo", "choice-privileges")?.ratio).toEqual([1, 2]);
    expect(transferLink("bilt", "accor-all")?.ratio).toEqual([3, 2]);
    expect(transferLink("chase-ur", "world-of-hyatt")?.ratio).toEqual([1, 1]);
  });

  it("reflects ended partnerships", () => {
    expect(transferLink("chase-ur", "emirates-skywards")).toBeUndefined();
    expect(transferLink("amex-mr", "etihad-guest")).toBeUndefined();
    expect(transferLink("bilt", "american-aadvantage")).toBeUndefined();
    expect(transferLink("amex-mr", "world-of-hyatt")).toBeUndefined();
  });

  it("finds all feeders of universal partners", () => {
    const fb = transfersTo("flying-blue").map((l) => l.from).sort();
    expect(fb).toEqual([...BANK_IDS].sort());
    expect(transfersTo("virgin-atlantic-flying-club")).toHaveLength(6);
    expect(transfersTo("ana-mileage-club").map((l) => l.from)).toEqual(["amex-mr"]);
    expect(transfersTo("alaska-mileage-plan").map((l) => l.from)).toEqual(["bilt"]);
    expect(transfersTo("korean-air-skypass")).toEqual([]);
  });
});
