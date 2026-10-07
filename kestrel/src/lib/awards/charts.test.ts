import { describe, expect, it } from "vitest";
import { CABINS, type AwardRegion, type Cabin } from "@/lib/types";
import { ALL_CHART_PROGRAM_IDS, priceAward, type PriceInput } from "./index";
import { anaSeason } from "./charts/ana";
import { kePeak } from "./charts/korean";
import { easterMd, ukSchoolPeak, govTaxes, carrierSurcharge, seasonalDemand } from "./charts/common";

const OFF = "2026-02-03"; // Tuesday, deep winter
const PEAK = "2026-07-15";

interface Route {
  origin: string;
  destination: string;
  originRegion: AwardRegion;
  destinationRegion: AwardRegion;
  distanceMiles: number;
}

const R = {
  JFK_LHR: {
    origin: "JFK",
    destination: "LHR",
    originRegion: "north-america",
    destinationRegion: "europe",
    distanceMiles: 3451,
  },
  JFK_FRA: {
    origin: "JFK",
    destination: "FRA",
    originRegion: "north-america",
    destinationRegion: "europe",
    distanceMiles: 3851,
  },
  SFO_SIN: {
    origin: "SFO",
    destination: "SIN",
    originRegion: "north-america",
    destinationRegion: "southeast-asia",
    distanceMiles: 8446,
  },
  SFO_HND: {
    origin: "SFO",
    destination: "HND",
    originRegion: "north-america",
    destinationRegion: "north-asia",
    distanceMiles: 5130,
  },
  HKG_JFK: {
    origin: "HKG",
    destination: "JFK",
    originRegion: "north-asia",
    destinationRegion: "north-america",
    distanceMiles: 8072,
  },
  DOH_LHR: {
    origin: "DOH",
    destination: "LHR",
    originRegion: "middle-east",
    destinationRegion: "europe",
    distanceMiles: 3253,
  },
  DXB_LHR: {
    origin: "DXB",
    destination: "LHR",
    originRegion: "middle-east",
    destinationRegion: "europe",
    distanceMiles: 3414,
  },
  SYD_LAX: {
    origin: "SYD",
    destination: "LAX",
    originRegion: "oceania",
    destinationRegion: "north-america",
    distanceMiles: 7488,
  },
  LAX_HNL: {
    origin: "LAX",
    destination: "HNL",
    originRegion: "north-america",
    destinationRegion: "hawaii",
    distanceMiles: 2556,
  },
  ORD_DEN: {
    origin: "ORD",
    destination: "DEN",
    originRegion: "north-america",
    destinationRegion: "north-america",
    distanceMiles: 888,
  },
  ICN_JFK: {
    origin: "ICN",
    destination: "JFK",
    originRegion: "north-asia",
    destinationRegion: "north-america",
    distanceMiles: 6879,
  },
  NRT_LAX: {
    origin: "NRT",
    destination: "LAX",
    originRegion: "north-asia",
    destinationRegion: "north-america",
    distanceMiles: 5451,
  },
  LHR_JFK: {
    origin: "LHR",
    destination: "JFK",
    originRegion: "europe",
    destinationRegion: "north-america",
    distanceMiles: 3451,
  },
  AUH_LHR: {
    origin: "AUH",
    destination: "LHR",
    originRegion: "middle-east",
    destinationRegion: "europe",
    distanceMiles: 3410,
  },
  MIA_GRU: {
    origin: "MIA",
    destination: "GRU",
    originRegion: "north-america",
    destinationRegion: "south-america",
    distanceMiles: 4078,
  },
} satisfies Record<string, Route>;

function mk(
  programId: string,
  carrier: string,
  route: Route,
  cabin: Cabin = "business",
  date = OFF,
  demand?: number,
): PriceInput {
  return { programId, carrier, cabin, date, demand, ...route };
}

describe("published chart values (as published 2025)", () => {
  it("United: partner saver NA–Europe business lands in 70–88k; UA metal surges with demand", () => {
    const lh = priceAward(mk("united-mileageplus", "LH", R.JFK_FRA, "business", OFF, 0.5));
    expect(lh!.miles).toBeGreaterThanOrEqual(70_000);
    expect(lh!.miles).toBeLessThanOrEqual(88_000);
    expect(lh!.basis).toBe("dynamic");
    const ua0 = priceAward(mk("united-mileageplus", "UA", R.ORD_DEN, "economy", OFF, 0));
    const ua1 = priceAward(mk("united-mileageplus", "UA", R.ORD_DEN, "economy", OFF, 1));
    expect(ua0!.miles).toBe(6_500);
    expect(ua1!.miles).toBeGreaterThan(30_000);
    expect(ua0!.taxesUsd).toBeLessThan(20); // US domestic, no surcharges
  });

  it("AAdvantage: partner MileSAAver NA–Europe J 57.5k, NA–Asia 2 J 70k / F 110k; BA surcharges passed through", () => {
    const ib = priceAward(mk("american-aadvantage", "IB", R.JFK_FRA));
    expect(ib!.miles).toBe(57_500);
    expect(ib!.basis).toBe("chart");
    const cx = priceAward(mk("american-aadvantage", "CX", R.HKG_JFK));
    expect(cx!.miles).toBe(70_000);
    expect(priceAward(mk("american-aadvantage", "CX", R.HKG_JFK, "first"))!.miles).toBe(110_000);
    const ba = priceAward(mk("american-aadvantage", "BA", R.JFK_LHR));
    expect(ba!.taxesUsd).toBeGreaterThan(400);
    const aa = priceAward(mk("american-aadvantage", "AA", R.JFK_LHR, "business", OFF, 1));
    expect(aa!.basis).toBe("dynamic");
    expect(aa!.miles).toBeGreaterThan(100_000);
  });

  it("Delta: NA–Europe business is dynamic and expensive (120k–350k on Delta metal)", () => {
    const lo = priceAward(mk("delta-skymiles", "DL", R.JFK_LHR, "business", OFF, 0));
    const hi = priceAward(mk("delta-skymiles", "DL", R.JFK_LHR, "business", OFF, 1));
    expect(lo!.miles).toBe(120_000);
    expect(hi!.miles).toBe(350_000);
    const af = priceAward(mk("delta-skymiles", "AF", R.JFK_LHR, "business", OFF, 1));
    expect(af!.miles).toBeLessThan(hi!.miles); // partner space capped below Delta-metal peaks
    expect(priceAward(mk("delta-skymiles", "VS", R.LHR_JFK))!.taxesUsd).toBeGreaterThan(400);
  });

  it("Flying Blue: NA–Europe J 50–75k, Y 20–35k; La Première not bookable", () => {
    const j0 = priceAward(mk("flying-blue", "AF", R.JFK_FRA, "business", OFF, 0));
    const j1 = priceAward(mk("flying-blue", "AF", R.JFK_FRA, "business", OFF, 1));
    expect(j0!.miles).toBeGreaterThanOrEqual(37_500); // 50k floor, possibly −25 % Promo Reward
    expect(j1!.miles).toBeLessThanOrEqual(75_000);
    const y = priceAward(mk("flying-blue", "KL", R.JFK_FRA, "economy", OFF, 0.5));
    expect(y!.miles).toBeGreaterThanOrEqual(15_000);
    expect(y!.miles).toBeLessThanOrEqual(35_000);
    expect(y!.taxesUsd).toBeGreaterThanOrEqual(150);
    expect(y!.taxesUsd).toBeLessThanOrEqual(400);
    expect(priceAward(mk("flying-blue", "AF", R.JFK_FRA, "first"))).toBeNull();
  });

  it("Virgin Atlantic: VS metal ex-LHR carries high surcharges; Delta partner chart NA–Europe J 50k", () => {
    const vs = priceAward(mk("virgin-atlantic-flying-club", "VS", R.LHR_JFK, "business", OFF, 0.2));
    expect(vs!.miles).toBe(47_500);
    expect(vs!.taxesUsd).toBeGreaterThanOrEqual(500);
    expect(vs!.taxesUsd).toBeLessThanOrEqual(900);
    const vsPeak = priceAward(mk("virgin-atlantic-flying-club", "VS", R.LHR_JFK, "business", PEAK, 0.2));
    expect(vsPeak!.miles).toBe(57_500);
    expect(priceAward(mk("virgin-atlantic-flying-club", "DL", R.JFK_FRA))!.miles).toBe(50_000);
  });

  it("Avios family: Qatar Qsuite DOH–LHR 70k on its own table; Iberia zone chart; Aer Lingus DUB–US East 50k/60k", () => {
    const qr = priceAward(mk("qatar-privilege-club", "QR", R.DOH_LHR));
    expect(qr!.miles).toBe(70_000);
    expect(priceAward(mk("qatar-privilege-club", "QR", R.DOH_LHR, "premium"))).toBeNull(); // Qatar sells no PE
    const ibMad = priceAward(
      mk("iberia-plus", "IB", {
        origin: "MAD",
        destination: "JFK",
        originRegion: "europe",
        destinationRegion: "north-america",
        distanceMiles: 3589,
      }),
    );
    expect(ibMad!.miles).toBe(34_000);
    expect(ibMad!.taxesUsd).toBeLessThan(250);
    const ei = priceAward(
      mk("aer-lingus-aerclub", "EI", {
        origin: "DUB",
        destination: "BOS",
        originRegion: "europe",
        destinationRegion: "north-america",
        distanceMiles: 2993,
      }),
    );
    expect(ei!.miles).toBe(50_000);
    expect(
      priceAward(
        mk(
          "aer-lingus-aerclub",
          "EI",
          {
            origin: "DUB",
            destination: "BOS",
            originRegion: "europe",
            destinationRegion: "north-america",
            distanceMiles: 2993,
          },
          "business",
          PEAK,
        ),
      )!.miles,
    ).toBe(60_000);
    const ay = priceAward(
      mk("finnair-plus", "AY", {
        origin: "HEL",
        destination: "JFK",
        originRegion: "europe",
        destinationRegion: "north-america",
        distanceMiles: 4120,
      }),
    );
    expect(ay!.miles).toBe(62_500);
  });

  it("ANA: NA–Japan business round trip 75k/85k/90k by season; partner NA–Europe J 88k round trip", () => {
    expect(anaSeason("2026-02-03")).toBe("low");
    expect(anaSeason("2026-05-01")).toBe("high");
    expect(anaSeason("2026-10-10")).toBe("regular");
    const low = priceAward(mk("ana-mileage-club", "NH", R.SFO_HND, "business", "2026-02-03"));
    const high = priceAward(mk("ana-mileage-club", "NH", R.SFO_HND, "business", "2026-08-10"));
    const reg = priceAward(mk("ana-mileage-club", "NH", R.SFO_HND, "business", "2026-10-10"));
    expect(low!.miles).toBe(75_000);
    expect(reg!.miles).toBe(85_000);
    expect(high!.miles).toBe(90_000);
    expect(low!.note).toMatch(/round-trip/i);
    expect(priceAward(mk("ana-mileage-club", "LH", R.JFK_FRA))!.miles).toBe(88_000);
    expect(priceAward(mk("ana-mileage-club", "NH", R.SFO_HND, "first", "2026-02-03"))!.miles).toBe(150_000);
  });

  it("KrisFlyer: SFO–SIN Saver J 99k, JFK Y 44k; Star partner chart", () => {
    const j = priceAward(mk("singapore-krisflyer", "SQ", R.SFO_SIN, "business", OFF, 0.3));
    expect(j!.miles).toBe(99_000);
    expect(j!.basis).toBe("chart");
    const y = priceAward(
      mk("singapore-krisflyer", "SQ", { ...R.SFO_SIN, origin: "JFK", distanceMiles: 9537 }, "economy", OFF, 0.3),
    );
    expect(y!.miles).toBe(44_000);
    const adv = priceAward(mk("singapore-krisflyer", "SQ", R.SFO_SIN, "business", OFF, 0.95));
    expect(adv!.miles).toBeGreaterThan(99_000);
    expect(priceAward(mk("singapore-krisflyer", "UA", R.JFK_FRA))!.miles).toBe(82_500);
  });

  it("Miles&Smiles: US domestic / Hawaii on United 7.5k Y / 12.5k J; NA–Europe J 45k; TK metal carries YQ", () => {
    expect(priceAward(mk("turkish-miles-smiles", "UA", R.LAX_HNL, "economy"))!.miles).toBe(7_500);
    expect(priceAward(mk("turkish-miles-smiles", "UA", R.LAX_HNL, "business"))!.miles).toBe(12_500);
    expect(priceAward(mk("turkish-miles-smiles", "LH", R.JFK_FRA))!.miles).toBe(45_000);
    const tk = priceAward(
      mk(
        "turkish-miles-smiles",
        "TK",
        {
          origin: "IST",
          destination: "JFK",
          originRegion: "europe",
          destinationRegion: "north-america",
          distanceMiles: 5009,
        },
        "business",
        OFF,
        0.2,
      ),
    );
    expect(tk!.miles).toBe(45_000);
    expect(tk!.taxesUsd).toBeGreaterThanOrEqual(200);
    expect(tk!.taxesUsd).toBeLessThanOrEqual(400);
  });

  it("Mileage Plan: NA–Europe J from 55k, NA–Asia J from 60k, Cathay First 70k; only BA surcharges", () => {
    expect(priceAward(mk("alaska-mileage-plan", "AA", R.JFK_LHR, "business", OFF, 0.3))!.miles).toBe(55_000);
    expect(
      priceAward(
        mk(
          "alaska-mileage-plan",
          "CX",
          {
            ...R.HKG_JFK,
            origin: "SFO",
            destination: "HKG",
            originRegion: "north-america",
            destinationRegion: "north-asia",
            distanceMiles: 6927,
          },
          "business",
          OFF,
          0.3,
        ),
      )!.miles,
    ).toBe(60_000);
    expect(priceAward(mk("alaska-mileage-plan", "CX", R.HKG_JFK, "first", OFF, 0.3))!.miles).toBe(85_000);
    expect(priceAward(mk("alaska-mileage-plan", "CX", R.HKG_JFK, "business", OFF, 0.3))!.taxesUsd).toBeLessThan(120);
    expect(priceAward(mk("alaska-mileage-plan", "BA", R.JFK_LHR, "business", OFF, 0.3))!.taxesUsd).toBeGreaterThan(400);
  });

  it("Asia Miles: HKG–JFK Standard J 85k / F 125k; partner table higher", () => {
    expect(priceAward(mk("cathay-asia-miles", "CX", R.HKG_JFK, "business", OFF, 0.3))!.miles).toBe(85_000);
    expect(priceAward(mk("cathay-asia-miles", "CX", R.HKG_JFK, "first", OFF, 0.3))!.miles).toBe(125_000);
    expect(priceAward(mk("cathay-asia-miles", "AA", R.JFK_LHR))!.miles).toBe(50_000);
  });

  it("JAL: Japan–NA Standard J 50k one-way; partner distance chart (JFK–LHR J 40k, LAX–NRT J 55k)", () => {
    expect(priceAward(mk("jal-mileage-bank", "JL", R.NRT_LAX, "business", OFF, 0.3))!.miles).toBe(50_000);
    expect(priceAward(mk("jal-mileage-bank", "AA", R.JFK_LHR))!.miles).toBe(40_000);
    expect(priceAward(mk("jal-mileage-bank", "AA", R.NRT_LAX))!.miles).toBe(55_000);
    expect(priceAward(mk("jal-mileage-bank", "CX", R.HKG_JFK))!.miles).toBe(75_000);
  });

  it("SKYPASS: Korea–NA J 62.5k, +50 % in peak season; SkyTeam partner chart", () => {
    expect(kePeak("2026-08-01")).toBe(true);
    expect(kePeak("2026-02-03")).toBe(false);
    expect(priceAward(mk("korean-air-skypass", "KE", R.ICN_JFK, "business", "2026-02-03"))!.miles).toBe(62_500);
    expect(priceAward(mk("korean-air-skypass", "KE", R.ICN_JFK, "business", "2026-08-01"))!.miles).toBe(93_750);
    expect(priceAward(mk("korean-air-skypass", "DL", R.JFK_FRA))!.miles).toBe(80_000);
  });

  it("Skywards: DXB–LHR Saver J 72.5k with heavy surcharges; Flex when demand is high", () => {
    const saver = priceAward(mk("emirates-skywards", "EK", R.DXB_LHR, "business", OFF, 0.3));
    expect(saver!.miles).toBe(72_500);
    expect(saver!.taxesUsd).toBeGreaterThan(300);
    expect(priceAward(mk("emirates-skywards", "EK", R.DXB_LHR, "business", OFF, 0.8))!.miles).toBe(108_750);
  });

  it("Etihad Guest: dynamic from Abu Dhabi within typical ranges", () => {
    const lo = priceAward(mk("etihad-guest", "EY", R.AUH_LHR, "business", OFF, 0));
    const hi = priceAward(mk("etihad-guest", "EY", R.AUH_LHR, "business", OFF, 1));
    expect(lo!.miles).toBe(55_000);
    expect(hi!.miles).toBe(100_000);
    expect(lo!.basis).toBe("dynamic");
  });

  it("Qantas: SYD–LAX Classic Y 41,900 / J 108,400 / F 162,800", () => {
    expect(priceAward(mk("qantas-frequent-flyer", "QF", R.SYD_LAX, "economy"))!.miles).toBe(41_900);
    expect(priceAward(mk("qantas-frequent-flyer", "QF", R.SYD_LAX, "business"))!.miles).toBe(108_400);
    expect(priceAward(mk("qantas-frequent-flyer", "QF", R.SYD_LAX, "first"))!.miles).toBe(162_800);
    expect(priceAward(mk("qantas-frequent-flyer", "AA", R.SYD_LAX, "business"))!.miles).toBe(119_200);
  });

  it("estimate-tier programs return basis 'estimate' and respect alliances", () => {
    const lh = priceAward(mk("lufthansa-miles-more", "LH", R.JFK_FRA));
    expect(lh!.basis).toBe("estimate");
    expect(lh!.miles).toBeGreaterThanOrEqual(45_000);
    expect(lh!.miles).toBeLessThanOrEqual(75_000);
    expect(lh!.taxesUsd).toBeGreaterThan(300); // LH surcharges
    expect(priceAward(mk("lufthansa-miles-more", "BA", R.JFK_LHR))).toBeNull();
    expect(priceAward(mk("copa-connectmiles", "CM", R.MIA_GRU))!.basis).toBe("estimate");
    expect(priceAward(mk("latam-pass", "LA", R.MIA_GRU))!.basis).toBe("estimate");
    expect(priceAward(mk("sas-eurobonus", "SK", R.JFK_FRA))!.basis).toBe("estimate");
    expect(priceAward(mk("tap-miles-go", "TP", R.JFK_FRA))!.basis).toBe("estimate");
    expect(priceAward(mk("eva-infinity", "BR", R.SFO_HND))!.basis).toBe("estimate");
    expect(priceAward(mk("thai-royal-orchid", "TG", R.SFO_SIN))!.basis).toBe("estimate");
    expect(priceAward(mk("asiana-club", "OZ", R.ICN_JFK))!.basis).toBe("estimate");
    expect(priceAward(mk("air-india-maharaja", "AI", R.JFK_FRA))!.basis).toBe("estimate");
    expect(priceAward(mk("aeromexico-rewards", "AM", R.MIA_GRU))!.basis).toBe("estimate");
    expect(priceAward(mk("virgin-australia-velocity", "VA", R.SYD_LAX))!.basis).toBe("estimate");
    const nz = priceAward(mk("air-new-zealand-airpoints", "NZ", R.SYD_LAX));
    expect(nz!.basis).toBe("estimate");
    expect(nz!.note).toMatch(/Airpoints Dollars/);
  });

  it("revenue-based programs: JetBlue and Southwest price off the cash fare", () => {
    const b6 = priceAward(mk("jetblue-trueblue", "B6", R.ORD_DEN, "economy", OFF, 0.5));
    expect(b6!.basis).toBe("dynamic");
    expect(b6!.miles).toBeGreaterThan(5_000);
    expect(b6!.miles).toBeLessThan(40_000);
    const wn = priceAward(mk("southwest-rapid-rewards", "WN", R.ORD_DEN, "economy", OFF, 0.5));
    expect(wn!.miles).toBeGreaterThan(5_000);
    expect(priceAward(mk("southwest-rapid-rewards", "WN", R.JFK_LHR, "economy"))).toBeNull();
    expect(priceAward(mk("southwest-rapid-rewards", "UA", R.ORD_DEN, "economy"))).toBeNull();
  });
});

describe("chart invariants across every program", () => {
  const routes = Object.values(R);
  const carriers = [
    "UA",
    "AA",
    "DL",
    "BA",
    "LH",
    "AF",
    "SQ",
    "NH",
    "CX",
    "JL",
    "QR",
    "EK",
    "KE",
    "QF",
    "AC",
    "TK",
    "AV",
    "IB",
    "VS",
    "EY",
    "WN",
    "B6",
    "LA",
    "NZ",
  ];

  it("every quote has positive integer miles, non-negative taxes and a valid basis", () => {
    let quotes = 0;
    for (const programId of ALL_CHART_PROGRAM_IDS)
      for (const carrier of carriers)
        for (const route of routes)
          for (const cabin of CABINS) {
            const q = priceAward(mk(programId, carrier, route, cabin, PEAK));
            if (!q) continue;
            quotes++;
            expect(
              Number.isInteger(q.miles),
              `${programId} ${carrier} ${route.origin}-${route.destination} ${cabin}`,
            ).toBe(true);
            expect(q.miles).toBeGreaterThan(0);
            expect(q.miles).toBeLessThan(600_000);
            expect(q.taxesUsd).toBeGreaterThanOrEqual(0);
            expect(q.taxesUsd).toBeLessThan(2_000); // round-trip ANA quotes on surcharge-heavy metal ex-UK approach $1.5k
            expect(["chart", "dynamic", "estimate"]).toContain(q.basis);
            if (q.peak) expect(["off-peak", "standard", "peak"]).toContain(q.peak);
          }
    expect(quotes).toBeGreaterThan(500);
  });

  it("premium cabins never price below economy on the same chart row", () => {
    for (const programId of ALL_CHART_PROGRAM_IDS)
      for (const route of routes)
        for (const carrier of carriers) {
          const y = priceAward(mk(programId, carrier, route, "economy", OFF, 0.5));
          const j = priceAward(mk(programId, carrier, route, "business", OFF, 0.5));
          const f = priceAward(mk(programId, carrier, route, "first", OFF, 0.5));
          if (y && j)
            expect(j.miles, `${programId} ${carrier} ${route.origin}-${route.destination} J<Y`).toBeGreaterThanOrEqual(
              y.miles,
            );
          if (j && f)
            expect(f.miles, `${programId} ${carrier} ${route.origin}-${route.destination} F<J`).toBeGreaterThanOrEqual(
              j.miles,
            );
        }
  });

  it("dynamic charts are monotonic in demand", () => {
    const dynamicIds = [
      "united-mileageplus",
      "delta-skymiles",
      "american-aadvantage",
      "flying-blue",
      "etihad-guest",
      "aeroplan",
      "avianca-lifemiles",
      "alaska-mileage-plan",
    ];
    const carrierFor: Record<string, string> = {
      "united-mileageplus": "UA",
      "delta-skymiles": "DL",
      "american-aadvantage": "AA",
      "flying-blue": "AF",
      "etihad-guest": "EY",
      aeroplan: "AC",
      "avianca-lifemiles": "AV",
      "alaska-mileage-plan": "AS",
    };
    const route = R.JFK_FRA;
    for (const id of dynamicIds) {
      const r = id === "etihad-guest" ? R.AUH_LHR : route;
      let prev = 0;
      for (const d of [0, 0.25, 0.5, 0.75, 1]) {
        const q = priceAward(mk(id, carrierFor[id], r, "business", OFF, d));
        expect(q, `${id} d=${d}`).not.toBeNull();
        expect(q!.miles, `${id} d=${d}`).toBeGreaterThanOrEqual(prev);
        prev = q!.miles;
      }
    }
  });
});

describe("calendar & tax helpers", () => {
  it("computes Easter and UK school peaks", () => {
    expect(easterMd(2026)).toEqual({ m: 4, d: 5 });
    expect(easterMd(2025)).toEqual({ m: 4, d: 20 });
    expect(ukSchoolPeak("2026-04-03")).toBe(true); // Easter fortnight
    expect(ukSchoolPeak("2026-07-20")).toBe(true);
    expect(ukSchoolPeak("2026-12-24")).toBe(true);
    expect(ukSchoolPeak("2026-02-03")).toBe(false);
    expect(ukSchoolPeak("2026-10-07")).toBe(false);
  });

  it("seasonal demand is in [0,1] and higher in summer than deep winter", () => {
    const winter = seasonalDemand("2026-02-03");
    const summer = seasonalDemand("2026-07-15");
    expect(winter).toBeGreaterThanOrEqual(0);
    expect(summer).toBeLessThanOrEqual(1);
    expect(summer).toBeGreaterThan(winter);
  });

  it("government taxes: US domestic ≈ $11, ex-UK premium ≈ $350+, no surcharge for carriers without YQ", () => {
    const dom = govTaxes({ programId: "x", carrier: "UA", ...R.ORD_DEN, cabin: "economy", date: OFF });
    expect(dom).toBeGreaterThanOrEqual(10);
    expect(dom).toBeLessThanOrEqual(12);
    const exUk = govTaxes({ programId: "x", carrier: "BA", ...R.LHR_JFK, cabin: "business", date: OFF });
    expect(exUk).toBeGreaterThanOrEqual(350);
    expect(carrierSurcharge("UA", "business", 5000)).toBe(0);
    expect(carrierSurcharge("LH", "business", 5000)).toBe(350);
    expect(carrierSurcharge("LH", "business", 500)).toBeLessThan(100);
  });
});
