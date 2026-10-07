import { describe, expect, it } from "vitest";
import {
  AIRLINE_PROGRAMS,
  BANK_PROGRAMS,
  HOTEL_LOYALTY_PROGRAMS,
  PROGRAMS,
  PROGRAM_BY_ID,
  getProgram,
  programsForCarrier,
} from "./programs";
import { CARDS, getCard } from "./cards";

/** Canonical ids from docs/ARCHITECTURE.md → "Program ids". */
const CANONICAL_BANKS = ["amex-mr", "chase-ur", "citi-ty", "capital-one", "bilt", "wells-fargo"];
const CANONICAL_AIRLINES = [
  "aeroplan",
  "united-mileageplus",
  "ana-mileage-club",
  "singapore-krisflyer",
  "avianca-lifemiles",
  "turkish-miles-smiles",
  "eva-infinity",
  "thai-royal-orchid",
  "asiana-club",
  "lufthansa-miles-more",
  "american-aadvantage",
  "british-airways-club",
  "qatar-privilege-club",
  "cathay-asia-miles",
  "jal-mileage-bank",
  "alaska-mileage-plan",
  "qantas-frequent-flyer",
  "iberia-plus",
  "finnair-plus",
  "aer-lingus-aerclub",
  "delta-skymiles",
  "flying-blue",
  "virgin-atlantic-flying-club",
  "korean-air-skypass",
  "aeromexico-rewards",
  "etihad-guest",
  "emirates-skywards",
  "jetblue-trueblue",
  "southwest-rapid-rewards",
  "virgin-australia-velocity",
  "copa-connectmiles",
  "latam-pass",
  "air-india-maharaja",
  "air-new-zealand-airpoints",
  "sas-eurobonus",
  "tap-miles-go",
];
const CANONICAL_HOTELS = [
  "world-of-hyatt",
  "marriott-bonvoy",
  "hilton-honors",
  "ihg-one-rewards",
  "accor-all",
  "choice-privileges",
  "wyndham-rewards",
];
const CANONICAL = [...CANONICAL_BANKS, ...CANONICAL_AIRLINES, ...CANONICAL_HOTELS];

/** Fixed-value currencies denominated in dollars rather than points. */
const DOLLAR_DENOMINATED = new Set(["air-new-zealand-airpoints"]);

const AIRLINE_PROGRAM_OWNER: Record<string, string> = {
  aeroplan: "AC",
  "united-mileageplus": "UA",
  "ana-mileage-club": "NH",
  "singapore-krisflyer": "SQ",
  "avianca-lifemiles": "AV",
  "turkish-miles-smiles": "TK",
  "eva-infinity": "BR",
  "thai-royal-orchid": "TG",
  "asiana-club": "OZ",
  "lufthansa-miles-more": "LH",
  "american-aadvantage": "AA",
  "british-airways-club": "BA",
  "qatar-privilege-club": "QR",
  "cathay-asia-miles": "CX",
  "jal-mileage-bank": "JL",
  "alaska-mileage-plan": "AS",
  "qantas-frequent-flyer": "QF",
  "iberia-plus": "IB",
  "finnair-plus": "AY",
  "aer-lingus-aerclub": "EI",
  "delta-skymiles": "DL",
  "flying-blue": "AF",
  "virgin-atlantic-flying-club": "VS",
  "korean-air-skypass": "KE",
  "aeromexico-rewards": "AM",
  "etihad-guest": "EY",
  "emirates-skywards": "EK",
  "jetblue-trueblue": "B6",
  "southwest-rapid-rewards": "WN",
  "virgin-australia-velocity": "VA",
  "copa-connectmiles": "CM",
  "latam-pass": "LA",
  "air-india-maharaja": "AI",
  "air-new-zealand-airpoints": "NZ",
  "sas-eurobonus": "SK",
  "tap-miles-go": "TP",
};

describe("PROGRAMS", () => {
  it("has exactly the canonical ids, each once", () => {
    const ids = PROGRAMS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...CANONICAL].sort());
  });

  it("has the expected kind counts", () => {
    expect(BANK_PROGRAMS.map((p) => p.id).sort()).toEqual([...CANONICAL_BANKS].sort());
    expect(AIRLINE_PROGRAMS.map((p) => p.id).sort()).toEqual([...CANONICAL_AIRLINES].sort());
    expect(HOTEL_LOYALTY_PROGRAMS.map((p) => p.id).sort()).toEqual([...CANONICAL_HOTELS].sort());
    expect(PROGRAMS).toHaveLength(49);
  });

  it("keeps valuations within 0.3–2.5¢ (except dollar-denominated currencies)", () => {
    for (const p of PROGRAMS) {
      if (DOLLAR_DENOMINATED.has(p.id)) {
        expect(p.valuationCpp).toBeGreaterThan(2.5);
        continue;
      }
      expect(p.valuationCpp, p.id).toBeGreaterThanOrEqual(0.3);
      expect(p.valuationCpp, p.id).toBeLessThanOrEqual(2.5);
    }
  });

  it("lists bookable carriers as unique 2-character IATA codes", () => {
    for (const p of PROGRAMS) {
      expect(new Set(p.bookableCarriers).size, p.id).toBe(p.bookableCarriers.length);
      for (const c of p.bookableCarriers) {
        expect(c, `${p.id}:${c}`).toMatch(/^[A-Z0-9]{2}$/);
      }
    }
  });

  it("gives every airline program an alliance, its owning carrier and that carrier in its bookable list", () => {
    for (const p of AIRLINE_PROGRAMS) {
      expect(p.alliance, p.id).toBeDefined();
      expect(p.airline, p.id).toBe(AIRLINE_PROGRAM_OWNER[p.id]);
      expect(p.bookableCarriers, p.id).toContain(p.airline);
      expect(p.bookableCarriers.length, p.id).toBeGreaterThanOrEqual(1);
    }
  });

  it("leaves banks and hotels without carriers", () => {
    for (const p of [...BANK_PROGRAMS, ...HOTEL_LOYALTY_PROGRAMS]) {
      expect(p.bookableCarriers, p.id).toEqual([]);
      expect(p.airline, p.id).toBeUndefined();
    }
  });

  it("fills every editorial field", () => {
    for (const p of PROGRAMS) {
      expect(p.name.length, p.id).toBeGreaterThan(3);
      expect(p.shortName.length, p.id).toBeGreaterThan(1);
      expect(p.currency.length, p.id).toBeGreaterThan(3);
      expect(p.summary.length, p.id).toBeGreaterThan(120);
      expect(p.expirationPolicy.length, p.id).toBeGreaterThan(10);
      expect(p.routingRules.length, p.id).toBeGreaterThan(20);
      expect(p.bookingUrl, p.id).toMatch(/^https:\/\//);
      expect(p.color, p.id).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(["none", "low", "medium", "high"], p.id).toContain(p.surcharges);
      expect(["distance", "zone", "dynamic", "fixed", "hybrid"], p.id).toContain(p.chartType);
      expect(p.changeFeeUsd, p.id).toBeGreaterThanOrEqual(0);
      expect(p.cancelFeeUsd, p.id).toBeGreaterThanOrEqual(0);
      for (const cabin of ["economy", "premium", "business", "first"] as const) {
        expect(p.typicalTaxesUsd[cabin], `${p.id}:${cabin}`).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("gives every program 3–6 sweet spots with real content", () => {
    for (const p of PROGRAMS) {
      expect(p.sweetSpots.length, p.id).toBeGreaterThanOrEqual(3);
      expect(p.sweetSpots.length, p.id).toBeLessThanOrEqual(6);
      for (const s of p.sweetSpots) {
        expect(s.title.length, p.id).toBeGreaterThan(5);
        expect(s.description.length, `${p.id}:${s.title}`).toBeGreaterThan(30);
        if (s.miles !== undefined) expect(s.miles).toBeGreaterThan(0);
        if (s.cabin) expect(["economy", "premium", "business", "first"]).toContain(s.cabin);
      }
    }
  });

  it("models surcharges consistently with typical business taxes", () => {
    for (const p of AIRLINE_PROGRAMS) {
      if (p.surcharges === "high") expect(p.typicalTaxesUsd.business, p.id).toBeGreaterThanOrEqual(300);
      if (p.surcharges === "none") expect(p.typicalTaxesUsd.business, p.id).toBeLessThanOrEqual(150);
    }
  });
});

describe("helpers", () => {
  it("indexes every program by id", () => {
    expect(Object.keys(PROGRAM_BY_ID)).toHaveLength(PROGRAMS.length);
    expect(getProgram("aeroplan")?.airline).toBe("AC");
    expect(getProgram("nope")).toBeUndefined();
  });

  it("finds programs that can book a carrier, case-insensitively", () => {
    const lh = programsForCarrier("lh").map((p) => p.id);
    expect(lh).toEqual(expect.arrayContaining(["aeroplan", "united-mileageplus", "avianca-lifemiles", "lufthansa-miles-more"]));
    expect(lh).not.toContain("delta-skymiles");
    expect(programsForCarrier("NH").map((p) => p.id)).toEqual(
      expect.arrayContaining(["ana-mileage-club", "virgin-atlantic-flying-club", "aeroplan"]),
    );
    expect(programsForCarrier("WN").map((p) => p.id)).toEqual(["southwest-rapid-rewards"]);
    expect(programsForCarrier("ZZ")).toEqual([]);
  });
});

describe("CARDS", () => {
  it("earns a currency that exists in PROGRAMS", () => {
    for (const c of CARDS) {
      expect(PROGRAM_BY_ID[c.currency], `${c.id} → ${c.currency}`).toBeDefined();
    }
  });

  it("has unique ids and well-formed fields", () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CARDS.length).toBeGreaterThanOrEqual(28);
    for (const c of CARDS) {
      expect(["visa", "mastercard", "amex"], c.id).toContain(c.network);
      expect(c.annualFeeUsd, c.id).toBeGreaterThanOrEqual(0);
      expect(c.earn.length, c.id).toBeGreaterThanOrEqual(1);
      for (const e of c.earn) expect(e.multiplier, `${c.id}:${e.category}`).toBeGreaterThan(0);
      expect(c.url, c.id).toMatch(/^https:\/\//);
      expect(c.tagline.length, c.id).toBeGreaterThan(10);
      for (const k of ["from", "to", "accent"] as const) {
        expect(c.art[k], `${c.id}:${k}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
      if (c.welcomeBonus) {
        expect(c.welcomeBonus.points).toBeGreaterThan(0);
        expect(c.welcomeBonus.minSpendUsd).toBeGreaterThan(0);
        expect(c.welcomeBonus.months).toBeGreaterThan(0);
        expect(c.welcomeBonus.asOf).toMatch(/^\d{4}-\d{2}$/);
      }
    }
  });

  it("matches issuer network conventions", () => {
    for (const c of CARDS) {
      if (c.issuer === "American Express") expect(c.network, c.id).toBe("amex");
      if (c.issuer === "Chase") expect(["visa", "mastercard"], c.id).toContain(c.network);
    }
    expect(getCard("chase-sapphire-reserve")?.currency).toBe("chase-ur");
    expect(getCard("missing")).toBeUndefined();
  });
});
