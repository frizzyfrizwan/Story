// Florida-specific reference data used by the rules engine and the cost model.
// Every figure carries its source and an "asOf" date so the report can show provenance.
// Numbers here are planning figures, not quotes. The report labels them as estimates.

export const FLORIDA = {
  asOf: "2026-10",

  // Chapter 718 (Condominium Act) after SB 4-D (2022), SB 154 (2023) and HB 913 (2025).
  condoLaw: {
    milestoneInspection: {
      appliesToHabitableStories: 3,
      ageYears: 30,
      coastalAgeYears: 25, // local authority may require at 25 within 3 miles of the coast
      repeatEveryYears: 10,
      note: "Structural milestone inspection, Fla. Stat. 553.899. Buildings under three habitable stories are exempt.",
    },
    sirs: {
      appliesToHabitableStories: 3,
      deadline: "2025-12-31",
      deadlineIfCoordinatedWithMilestone: "2026-12-31",
      fundingStarts: "2026-01-01",
      itemThresholdUsd: 25000,
      note: "Structural Integrity Reserve Study, Fla. Stat. 718.112(2)(g). Reserves for SIRS items cannot be waived.",
    },
    nonSirsReserves: {
      note: "Buildings under three habitable stories may still waive or reduce reserves by majority vote (718.112(2)(f)). A low fee can mean waived reserves, not a cheap building.",
    },
    resaleDisclosure: {
      statute: "718.503(2)",
      rescissionBusinessDays: 3,
      docs: [
        "Declaration, articles, bylaws, rules",
        "Most recent year-end financial statement and current budget",
        "Milestone inspection summary (or statement that none is required)",
        "SIRS (or statement that none is required)",
        "Frequently asked questions sheet",
        "Approved board minutes for the prior 12 months",
      ],
    },
    estoppel: { statute: "718.116(8)", maxFeeUsd: 250, rushFeeUsd: 100, delinquentExtraUsd: 150, businessDays: 10 },
    termination: {
      statute: "718.117",
      note: "A condominium can be terminated with 80% owner approval if no more than 5% object. Older low-rise buildings on large coastal parcels are the usual targets.",
    },
  },

  // Broward County building recertification (older than the state milestone program, still in force).
  browardRecert: {
    firstAtYears: 40,
    repeatEveryYears: 10,
    exemptBelowSqft: 3500,
    note: "Broward County Board of Rules and Appeals: structural and electrical recertification at 40 years and every 10 years after.",
  },

  // Lending. Fannie Mae LL-2026-03 and the matching Freddie Mac bulletin (2026-03-18).
  lending: {
    limitedReviewRetired: "2026-08-03",
    minReservesPctOfBudget: 10,
    minReservesPctOfBudgetFrom: { date: "2027-01-04", pct: 15 },
    masterDeductibleCapPerUnitUsd: { amount: 50000, from: "2026-07-01" },
    delinquencyRedFlagPct: 15,
    note: "Projects that fail the full review become non-warrantable: cash or portfolio loans only, which shrinks the buyer pool on resale.",
  },

  // Property tax. Millage is per $1,000 of taxable value.
  tax: {
    saveOurHomesCapPct: 3,
    nonHomesteadCapPct: 10,
    homesteadExemptionUsd: 50000,
    homesteadExemptionSchoolUsd: 25000,
    // Broward County Property Appraiser practice: just value on resale lands near 85% of the sale price.
    justValueRatioOfSale: 0.85,
    millage: {
      // Used when a city has no entry. Broward municipalities ran about 17.5 to 21 mills on the 2025 roll.
      "_default": {
        asOf: "2025 tax roll, Broward county-typical estimate",
        county: 5.6658,
        school: 6.4845,
        city: 6.1,
        cityDebt: 0,
        ems: 0,
        otherDistrictsEstimate: 1.5,
        total: 19.8,
        estimated: true,
        sources: ["Broward County FY26 adopted millage; FDOE Broward school millage; municipal rates vary"],
      },
      "Pompano Beach": {
        asOf: "2025 tax roll (FY2025-26)",
        county: 5.6658,
        school: 6.4845,
        city: 5.2181,
        cityDebt: 0.4427,
        ems: 0.5,
        otherDistrictsEstimate: 1.5, // hospital district, children's services council, SFWMD, FIND, Everglades
        total: 19.81,
        sources: [
          "Pompano Beach Resolution 2025-215 (operating 5.2181) and 2025-218 (EMS 0.5000)",
          "Broward County FY26 adopted millage 5.6658",
          "FDOE Broward district summary FY2025-26 school millage 6.4845",
        ],
      },
    },
  },

  // Insurance planning ranges for a unit owner (HO-6) and NFIP contents, Broward coastal, older building.
  insurance: {
    ho6AnnualRange: [1500, 2800],
    // Single-family HO-3 with windstorm, coastal Broward, older roof: planning range.
    ho3AnnualRange: [4500, 8500],
    pmiAnnualPctOfLoan: 0.006, // conventional PMI when down payment is under 20%
    fhaMipAnnualPct: 0.0055,
    floodContentsAnnualRange: [450, 1500],
    lossAssessmentRiderAnnualUsd: 30,
    citizens2026AvgChangePct: -8.7,
    sources: [
      "Florida OIR: HO-6 average about $1,729/yr statewide (Q1 2025); Miami about $2,570/yr",
      "Florida OIR Jan 2026: Citizens average -8.7% at renewal from spring 2026",
    ],
  },

  // Debt-to-income guidelines. Front = housing cost / gross income; back = housing + other debts / gross income.
  dti: {
    comfortable: { front: 0.28, back: 0.36, label: "Comfortable (28/36)" },
    stretch: { front: 0.31, back: 0.43, label: "Stretch (31/43, needs automated underwriting approval)" },
    minDownPct: { conventional: 0.03, fha: 0.035 },
    closingCostPct: 0.03,
    reserveMonths: 2, // lenders like to see two months of housing cost left after closing
  },

  // Typical monthly HOA when the listing does not say, $ per sq ft per month, by type and age.
  hoaEstimatePerSqft: { condoOld: 0.55, condoNew: 0.75, townhouse: 0.25, house: 0 },

  mortgage: {
    rate30yr: 0.0732,
    rateAsOf: "2026-10-16",
    source: "Zillow daily average 30-year fixed, 2026-10-16 (Freddie Mac weekly 7.28% on 2026-10-01)",
  },

  // Southeast Florida Regional Climate Compact, Unified Sea Level Rise Projection (2019).
  seaLevel: {
    by2040InchesRange: [10, 17],
    by2070InchesRange: [21, 54],
    by2120InchesRange: [40, 136],
    baseline: "2000 mean sea level, Key West tide gauge",
    browardTidalBarrierStandardFtNavd: { until2035: 4, by2050: 5 },
  },

  evacuation: {
    "Broward": {
      A: "East of the Intracoastal Waterway and all mobile home parks. Mandatory for Category 1 and 2 storms.",
      B: "East of US 1 (Federal Highway). Mandatory for Category 3 and higher.",
    },
  },

  shortTermRental: {
    "Pompano Beach": {
      permitRequired: true,
      initialFeeUsd: 675,
      renewalFeeUsd: 375,
      permitYear: "Oct 1 to Sep 30",
      contactWithinMiles: 25,
      occupancyPerBedroom: 2,
      source: "City of Pompano Beach BTR Division short-term rental submittal requirements (form rev. 2026-07-16)",
    },
  },
};

// Component lifecycles used for "what breaks next" projections (years).
export const LIFECYCLES = {
  castIronDrain: { life: 50, note: "Pre-1975 buildings used cast iron drain lines; slab-on-grade coastal buildings often fail at 40 to 50 years." },
  galvanizedSupply: { life: 45 },
  flatRoofModifiedBitumen: { life: 18 },
  tileRoof: { life: 35 },
  shingleRoof: { life: 17 },
  electricalPanel: { life: 40, note: "Federal Pacific and Zinsco panels are uninsurable with most Florida carriers." },
  aluminumWiringEra: [1965, 1973],
  windowImpactUpgradeCycle: 30,
  hvac: { life: 14 },
  waterHeater: { life: 11 },
  elevator: { life: 25 },
  seawall: { life: 50 },
  exteriorPaintWaterproofing: { life: 8 },
  asphaltPaving: { life: 20 },
};
