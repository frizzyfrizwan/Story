import { describe, expect, it } from "vitest";
import type { HotelProperty, TransferLink } from "@/lib/types";
import { getHotelProgram, hyattPoints } from "@/data/hotel-programs";
import { getHotel } from "@/data/hotels";
import {
  compareQuotes,
  easterSunday,
  holidayFor,
  hotelValueBadges,
  quoteHotel,
  quoteHotelDetailed,
  quoteNight,
  seasonFor,
  seasonContextFor,
  transferOptionFor,
  valueScoreFor,
} from "./engine";

/** A synthetic Hyatt Category 1 city hotel in Hanoi (peak Oct–Dec + Mar, low Jun–Aug). */
const CAT1: HotelProperty = {
  id: "test-hyatt-cat1",
  name: "Test Hyatt Place",
  brand: "Hyatt Place",
  programId: "world-of-hyatt",
  city: "Hanoi",
  countryCode: "VN",
  lat: 21.03,
  lon: 105.85,
  category: 1,
  stars: 3,
  tier: "midscale",
  avgCashUsd: 100,
  avgPointsPerNight: 5000,
  description: "Test property. Used for engine tests.",
  amenities: ["Wi-Fi", "Pool", "Gym", "Breakfast", "Bar"],
  vibe: ["test", "simple", "city"],
  art: { from: "#000000", to: "#ffffff", motif: "skyline" },
};

const TRANSFERS: TransferLink[] = [
  { from: "chase-ur", to: "world-of-hyatt", ratio: [1, 1], transferTime: "instant", minimum: 1000 },
  {
    from: "bilt",
    to: "world-of-hyatt",
    ratio: [1, 1],
    transferTime: "instant",
    minimum: 1000,
    bonus: { percent: 25, startsAt: "2026-04-01", endsAt: "2026-04-30", verifiedAt: "2026-04-01" },
  },
  { from: "amex-mr", to: "hilton-honors", ratio: [1, 2], transferTime: "instant", minimum: 1000 },
  { from: "amex-mr", to: "marriott-bonvoy", ratio: [1, 1], transferTime: "1-2 days", minimum: 1000 },
];

const STANDARD_TUESDAY = "2026-04-14"; // April in Hanoi: not peak, not low, no holiday
const FESTIVE = "2026-12-25";
const OFF_PEAK_TUESDAY = "2026-07-14"; // July is a low month in Hanoi

function must<T>(v: T | undefined, label: string): T {
  if (v == null) throw new Error(`missing ${label}`);
  return v;
}

describe("Hyatt category chart", () => {
  it("prices category 1 at 5,000 standard / 3,500 off-peak / 6,500 peak", () => {
    expect(hyattPoints(1, "standard")).toBe(5000);
    expect(hyattPoints(1, "off-peak")).toBe(3500);
    expect(hyattPoints(1, "peak")).toBe(6500);
    expect(hyattPoints(8, "standard")).toBe(40000);
    expect(hyattPoints(8, "peak")).toBe(45000);
  });

  it("quotes a category 1 night at 5,000 on a standard date", () => {
    const q = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
    });
    expect(q.nights).toBe(1);
    expect(q.tier).toBe("standard");
    expect(q.pointsPerNight).toBe(5000);
    expect(q.totalPoints).toBe(5000);
  });

  it("prices peak dates higher and off-peak dates lower than standard", () => {
    const standard = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
    });
    const peak = quoteHotel({ property: CAT1, checkIn: FESTIVE, checkOut: "2026-12-26", guests: 2, transfers: [] });
    const off = quoteHotel({
      property: CAT1,
      checkIn: OFF_PEAK_TUESDAY,
      checkOut: "2026-07-15",
      guests: 2,
      transfers: [],
    });
    expect(peak.tier).toBe("peak");
    expect(peak.pointsPerNight).toBe(6500);
    expect(off.tier).toBe("off-peak");
    expect(off.pointsPerNight).toBe(3500);
    expect(peak.pointsPerNight).toBeGreaterThan(standard.pointsPerNight);
    expect(off.pointsPerNight).toBeLessThan(standard.pointsPerNight);
    expect(peak.cashPerNightUsd).toBeGreaterThan(off.cashPerNightUsd);
  });

  it("never applies a 5th night free for Hyatt", () => {
    const d = quoteHotelDetailed({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-19",
      guests: 2,
      transfers: [],
    });
    expect(d.quote.nights).toBe(5);
    expect(d.quote.fifthNightFreeApplied).toBe(false);
    expect(d.freeNights).toBe(0);
    expect(d.quote.totalPoints).toBe(d.nights.reduce((s, n) => s + n.points, 0));
  });
});

describe("5th night free (Hilton / Marriott)", () => {
  it("waives the cheapest night in a 5-night Hilton stay", () => {
    const conrad = must(getHotel("conrad-tokyo"), "conrad-tokyo");
    const d = quoteHotelDetailed({
      property: conrad,
      checkIn: "2026-05-11",
      checkOut: "2026-05-16",
      guests: 2,
      transfers: [],
    });
    expect(d.quote.nights).toBe(5);
    expect(d.quote.fifthNightFreeApplied).toBe(true);
    expect(d.freeNights).toBe(1);
    const gross = d.nights.reduce((s, n) => s + n.points, 0);
    const cheapest = Math.min(...d.nights.map((n) => n.points));
    expect(d.freePoints).toBe(cheapest);
    expect(d.quote.totalPoints).toBe(gross - cheapest);
    expect(d.nights.filter((n) => n.free)).toHaveLength(1);
    expect(d.quote.totalPoints).toBeLessThan(d.quote.pointsPerNight * 5);
  });

  it("does not apply on 4 nights, and applies twice on 10 nights", () => {
    const conrad = must(getHotel("conrad-tokyo"), "conrad-tokyo");
    const four = quoteHotelDetailed({
      property: conrad,
      checkIn: "2026-05-11",
      checkOut: "2026-05-15",
      guests: 2,
      transfers: [],
    });
    expect(four.quote.fifthNightFreeApplied).toBe(false);
    const ten = quoteHotelDetailed({
      property: conrad,
      checkIn: "2026-05-11",
      checkOut: "2026-05-21",
      guests: 2,
      transfers: [],
    });
    expect(ten.freeNights).toBe(2);
  });

  it("applies for Marriott but not IHG", () => {
    const stRegis = must(getHotel("the-st-regis-new-york"), "st regis ny");
    const regent = must(getHotel("regent-hong-kong"), "regent hk");
    expect(
      quoteHotel({ property: stRegis, checkIn: "2026-05-11", checkOut: "2026-05-16", guests: 2, transfers: [] })
        .fifthNightFreeApplied,
    ).toBe(true);
    expect(
      quoteHotel({ property: regent, checkIn: "2026-05-11", checkOut: "2026-05-16", guests: 2, transfers: [] })
        .fifthNightFreeApplied,
    ).toBe(false);
  });
});

describe("fixed-value programs", () => {
  it("prices Accor at 2,000 points per €40 of the cash rate", () => {
    const sofitel = must(getHotel("sofitel-lisbon-liberdade"), "sofitel lisbon");
    const q = quoteHotel({
      property: sofitel,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
      liveCashPerNightUsd: 400,
    });
    // $400 × 0.92 = €368 → 9.2 blocks → rounded up to 10 blocks of 2,000
    expect(q.cashPerNightUsd).toBe(400);
    expect(q.pointsPerNight).toBe(20000);
    expect(q.totalPoints).toBe(20000);
    expect(q.cpp).toBe(2);
    expect(q.source).toBe("cached");
  });

  it("keeps Wyndham at its flat tier regardless of season", () => {
    const wyndham = must(getHotel("wyndham-grand-chicago-riverfront"), "wyndham chicago");
    const a = quoteHotel({
      property: wyndham,
      checkIn: "2026-02-10",
      checkOut: "2026-02-11",
      guests: 2,
      transfers: [],
    });
    const b = quoteHotel({
      property: wyndham,
      checkIn: "2026-07-18",
      checkOut: "2026-07-19",
      guests: 2,
      transfers: [],
    });
    expect(a.pointsPerNight).toBe(30000);
    expect(b.pointsPerNight).toBe(30000);
  });
});

describe("dynamic programs", () => {
  it("tracks cash and clamps to the program ceiling", () => {
    const waldorf = must(getHotel("waldorf-astoria-maldives-ithaafushi"), "waldorf maldives");
    const q = quoteHotel({
      property: waldorf,
      checkIn: "2026-01-12",
      checkOut: "2026-01-13",
      guests: 2,
      transfers: [],
      liveCashPerNightUsd: 6000,
    });
    expect(q.pointsPerNight).toBe(150000);
    expect(q.pointsPerNight % 1000).toBe(0);
  });

  it("stays within ±15% demand noise of cash × k for Hilton", () => {
    const hilton = must(getHotel("hilton-tokyo"), "hilton tokyo");
    const n = quoteNight(hilton, STANDARD_TUESDAY, { liveCashPerNightUsd: 320 });
    const anchorK = hilton.avgPointsPerNight / hilton.avgCashUsd; // ≈ 203
    const k = (200 + anchorK) / 2;
    expect(n.points).toBeGreaterThanOrEqual(Math.floor(320 * k * 0.85) - 1000);
    expect(n.points).toBeLessThanOrEqual(Math.ceil(320 * k * 1.15) + 1000);
  });
});

describe("cpp, value score and badges", () => {
  it("computes cpp as cents of cash per point", () => {
    const q = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
      liveCashPerNightUsd: 100,
    });
    expect(q.totalPoints).toBe(5000);
    expect(q.totalCashUsd).toBe(100);
    expect(q.cpp).toBe(2); // $100 / 5,000 pts = 2.0¢
    // benchmark 1.9¢ → ratio 1.0526 → 50 + 50 × (0.0526 / 1.2) ≈ 52
    expect(q.valueScore).toBe(52);
  });

  it("scores 50 at benchmark, 100 at 2.2× and 0 at zero", () => {
    expect(valueScoreFor(1.9, 1.9)).toBe(50);
    expect(valueScoreFor(1.9 * 2.2, 1.9)).toBe(100);
    expect(valueScoreFor(5, 1.9)).toBe(100);
    expect(valueScoreFor(0.95, 1.9)).toBe(25);
    expect(valueScoreFor(0, 1.9)).toBe(0);
  });

  it("emits the expected badges", () => {
    const peak = quoteHotel({ property: CAT1, checkIn: FESTIVE, checkOut: "2026-12-26", guests: 2, transfers: [] });
    expect(hotelValueBadges(peak, getHotelProgram("world-of-hyatt"))).toContain("Peak pricing");

    const great = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
      liveCashPerNightUsd: 300,
    });
    const badges = hotelValueBadges(great, getHotelProgram("world-of-hyatt"));
    expect(great.cpp).toBe(6);
    expect(badges).toContain("Great value");
    expect(badges).toContain("Points > cash");
    expect(badges).toContain("Under 10k/night");

    const conrad = must(getHotel("conrad-tokyo"), "conrad-tokyo");
    const five = quoteHotel({
      property: conrad,
      checkIn: "2026-05-11",
      checkOut: "2026-05-16",
      guests: 2,
      transfers: [],
    });
    expect(hotelValueBadges(five)).toContain("5th night free");

    const poor = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
      liveCashPerNightUsd: 40,
    });
    expect(hotelValueBadges(poor, getHotelProgram("world-of-hyatt"))).toContain("Pay cash instead");
  });

  it("sorts available, high-value, cheap quotes first", () => {
    const base = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: [],
      fetchedAt: "x",
    });
    const unavailable = { ...base, available: false, valueScore: 99 };
    const better = { ...base, valueScore: base.valueScore + 10, propertyId: "b" };
    const cheaper = { ...base, totalPoints: base.totalPoints - 1000, propertyId: "c" };
    const sorted = [unavailable, base, cheaper, better].sort(compareQuotes);
    expect(sorted.map((q) => q.propertyId)).toEqual(["b", "c", "test-hyatt-cat1", "test-hyatt-cat1"]);
    expect(sorted[3].available).toBe(false);
  });
});

describe("transfer options", () => {
  it("filters links to the property's program and rounds up to 1,000", () => {
    const q = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: TRANSFERS,
    });
    expect(q.transferOptions.map((t) => t.bankProgramId).sort()).toEqual(["bilt", "chase-ur"]);
    const chase = q.transferOptions.find((t) => t.bankProgramId === "chase-ur");
    const bilt = q.transferOptions.find((t) => t.bankProgramId === "bilt");
    expect(chase?.bankPointsNeeded).toBe(5000);
    expect(bilt?.bonusPercent).toBe(25);
    expect(bilt?.bankPointsNeeded).toBe(4000); // 5,000 / 1.25
    expect(q.transferOptions[0].bankProgramId).toBe("bilt"); // cheapest first
  });

  it("ignores a bonus outside its window when asOf is given, and honours ratios and minimums", () => {
    const q = quoteHotel({
      property: CAT1,
      checkIn: STANDARD_TUESDAY,
      checkOut: "2026-04-15",
      guests: 2,
      transfers: TRANSFERS,
      asOf: "2026-06-01",
    });
    const bilt = q.transferOptions.find((t) => t.bankProgramId === "bilt");
    expect(bilt?.bonusPercent).toBeUndefined();
    expect(bilt?.bankPointsNeeded).toBe(5000);

    const opt = transferOptionFor(TRANSFERS[2], 70500);
    expect(opt.bankPointsNeeded).toBe(36000); // 70,500 / 2 = 35,250 → 36,000
    expect(transferOptionFor({ ...TRANSFERS[0], minimum: 10000 }, 500).bankPointsNeeded).toBe(10000);
  });
});

describe("determinism and availability", () => {
  it("returns identical quotes for identical input", () => {
    const park = must(getHotel("park-hyatt-tokyo"), "park hyatt tokyo");
    const a = quoteHotel({
      property: park,
      checkIn: "2026-10-09",
      checkOut: "2026-10-12",
      guests: 2,
      transfers: TRANSFERS,
      fetchedAt: "t",
    });
    const b = quoteHotel({
      property: park,
      checkIn: "2026-10-09",
      checkOut: "2026-10-12",
      guests: 2,
      transfers: TRANSFERS,
      fetchedAt: "t",
    });
    expect(a).toEqual(b);
    expect(a.nights).toBe(3);
    expect(a.totalCashUsd).toBeGreaterThan(0);
    expect(a.source).toBe("simulated");
  });

  it("is available most of the time, less so in peak season", () => {
    const hyatt = must(getHotel("hyatt-regency-tokyo"), "hyatt regency tokyo");
    const nights = Array.from({ length: 365 }, (_, i) => {
      const d = new Date(2026, 0, 1 + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      return quoteNight(hyatt, iso);
    });
    const rate = (xs: typeof nights) => xs.filter((n) => n.available).length / Math.max(1, xs.length);
    expect(rate(nights)).toBeGreaterThan(0.8);
    expect(rate(nights)).toBeLessThan(1);
    const peak = nights.filter((n) => n.tier === "peak");
    const std = nights.filter((n) => n.tier === "standard");
    expect(peak.length).toBeGreaterThan(20);
    expect(rate(peak)).toBeLessThanOrEqual(rate(std));
  });

  it("treats resort weekends as peak and city weekends as standard", () => {
    const maui = must(getHotel("andaz-maui-at-wailea-resort"), "andaz maui");
    const ctxMaui = seasonContextFor(maui);
    expect(ctxMaui.resort).toBe(true);
    expect(seasonFor("2026-11-07", ctxMaui).tier).toBe("peak"); // Saturday in a standard month
    expect(seasonFor("2026-11-10", ctxMaui).tier).toBe("standard"); // Tuesday
    expect(seasonFor("2026-10-13", ctxMaui).tier).toBe("off-peak"); // Tuesday in a low month
    const ctxCity = seasonContextFor(CAT1);
    expect(ctxCity.resort).toBe(false);
    expect(seasonFor("2026-04-11", ctxCity).tier).toBe("standard"); // Saturday in a standard month for Hanoi
    expect(seasonFor("2026-10-10", ctxCity).tier).toBe("peak"); // October is a Hanoi peak month
  });
});

describe("holidays", () => {
  it("knows Easter, Thanksgiving, Golden Week and Lunar New Year", () => {
    expect(easterSunday(2026)).toBe("2026-04-05");
    expect(easterSunday(2025)).toBe("2025-04-20");
    expect(holidayFor("2026-11-26", "US")).toBe("Thanksgiving");
    expect(holidayFor("2026-11-10", "US")).toBeUndefined();
    expect(holidayFor("2026-05-03", "JP")).toBe("Golden Week");
    expect(holidayFor("2026-02-18", "HK")).toBe("Lunar New Year");
    expect(holidayFor("2026-02-14", "BR")).toBe("Carnival");
    expect(holidayFor("2026-12-24", "FR")).toBe("Festive season");
    expect(holidayFor("2026-06-10", "FR")).toBeUndefined();
  });
});
