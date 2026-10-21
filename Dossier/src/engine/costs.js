// Carrying-cost model. Pure functions, no I/O. Everything returns numbers in USD.
import { FLORIDA } from "../knowledge/florida.js";

export function monthlyPayment(principal, annualRate, years = 30) {
  if (principal <= 0) return 0;
  const r = annualRate / 12;
  const n = years * 12;
  if (r === 0) return principal / n;
  return (principal * r) / (1 - Math.pow(1 + r, -n));
}

// Florida property tax estimate on a fresh purchase.
export function estimateTaxes({ price, millageTable, homestead = false }) {
  const m = millageTable;
  if (!m) return null;
  const justValue = price * FLORIDA.tax.justValueRatioOfSale;
  const nonSchoolMillage = m.total - m.school;
  let taxable = justValue;
  let taxableSchool = justValue;
  if (homestead) {
    taxable = Math.max(0, justValue - FLORIDA.tax.homesteadExemptionUsd);
    taxableSchool = Math.max(0, justValue - FLORIDA.tax.homesteadExemptionSchoolUsd);
  }
  const annual = (taxable * nonSchoolMillage + taxableSchool * m.school) / 1000;
  return {
    justValue: Math.round(justValue),
    taxableValue: Math.round(taxable),
    millage: m.total,
    annual: Math.round(annual),
    monthly: Math.round(annual / 12),
    homestead,
    note: homestead
      ? "Homestead: $50,000 exemption ($25,000 against school levy); future assessment growth capped at 3%/yr."
      : "Non-homestead: assessment growth capped at 10%/yr; no exemption.",
  };
}

export function carryingCosts(facts, opts = {}) {
  const p = facts.property;
  const price = opts.price ?? p.listPrice;
  const downPct = opts.downPct ?? 0.2;
  const rate = opts.rate ?? facts.financing?.rate ?? FLORIDA.mortgage.rate30yr;
  const homestead = opts.homestead ?? true;
  const city = p.city;
  const millage = FLORIDA.tax.millage[city];

  const loan = price * (1 - downPct);
  const pi = monthlyPayment(loan, rate);
  const taxes = estimateTaxes({ price, millageTable: millage, homestead });
  const ins = facts.insurance || {};
  const ho6 = ins.ho6Annual ?? avg(FLORIDA.insurance.ho6AnnualRange);
  const flood = ins.floodAnnual ?? (facts.location?.floodZone?.startsWith("A") || facts.location?.floodZone?.startsWith("V") || facts.location?.barrierIsland ? avg(FLORIDA.insurance.floodContentsAnnualRange) : 0);
  const hoa = p.hoaMonthly ?? 0;
  const utilities = opts.utilitiesMonthly ?? estimateUtilities(p.sqft);

  const monthly = {
    principalAndInterest: Math.round(pi),
    taxes: taxes ? taxes.monthly : null,
    hoa,
    ho6: Math.round(ho6 / 12),
    flood: Math.round(flood / 12),
    utilities,
  };
  const total = Object.values(monthly).reduce((a, b) => a + (b || 0), 0);
  const cashToClose = Math.round(price * downPct + price * 0.03); // closing costs about 3% for a buyer in Broward

  return {
    assumptions: { price, downPct, rate, homestead, termYears: 30, loan: Math.round(loan), ho6Annual: Math.round(ho6), floodAnnual: Math.round(flood) },
    monthly,
    totalMonthly: total,
    totalMonthlyExcludingMortgage: total - monthly.principalAndInterest,
    cashToClose,
    taxes,
  };
}

function estimateUtilities(sqft = 900) {
  // Electric (South Florida, cooling-heavy) plus water/sewer where not in the HOA fee.
  return Math.round(110 + (sqft / 1000) * 60);
}

export function avg([a, b]) {
  return (a + b) / 2;
}

// Project monthly HOA and total carry over N years under a scenario.
export function projection(carry, { years = 10, hoaGrowthPct = 7, insuranceGrowthPct = 6, taxGrowthPct = 3, specialAssessments = [] } = {}) {
  const rows = [];
  let hoa = carry.monthly.hoa;
  let ho6 = carry.monthly.ho6;
  let flood = carry.monthly.flood;
  let taxes = carry.monthly.taxes || 0;
  const pi = carry.monthly.principalAndInterest;
  const util = carry.monthly.utilities;
  const start = new Date().getFullYear();
  for (let y = 0; y <= years; y++) {
    const year = start + y;
    const sa = specialAssessments.filter((s) => s.year === year).reduce((a, s) => a + s.amount, 0);
    rows.push({
      year,
      hoa: Math.round(hoa),
      insurance: Math.round(ho6 + flood),
      taxes: Math.round(taxes),
      monthly: Math.round(pi + hoa + ho6 + flood + taxes + util),
      specialAssessment: sa,
      annualTotal: Math.round((pi + hoa + ho6 + flood + taxes + util) * 12 + sa),
    });
    hoa *= 1 + hoaGrowthPct / 100;
    ho6 *= 1 + insuranceGrowthPct / 100;
    flood *= 1 + Math.min(18, insuranceGrowthPct + 4) / 100; // NFIP glide path allows up to 18%/yr
    taxes *= 1 + taxGrowthPct / 100;
  }
  return rows;
}

// Rental math for an investor view.
export function rentalMath(facts, carry) {
  const rent = facts.rents?.estimateMonthly;
  if (!rent) return null;
  const price = carry.assumptions.price;
  const vacancyPct = 8;
  const mgmtPct = facts.rents?.managementPct ?? 8;
  const gross = rent * 12;
  const effective = gross * (1 - vacancyPct / 100);
  const opex = (carry.monthly.hoa + carry.monthly.ho6 + carry.monthly.flood + (carry.monthly.taxes || 0)) * 12 + effective * (mgmtPct / 100) + 600; // repairs
  // Non-homestead taxes for a rental
  const noi = effective - opex;
  return {
    rentMonthly: rent,
    grossYieldPct: round1((gross / price) * 100),
    capRatePct: round1((noi / price) * 100),
    noiAnnual: Math.round(noi),
    cashFlowMonthly: Math.round(noi / 12 - carry.monthly.principalAndInterest),
    assumptions: { vacancyPct, managementPct: mgmtPct, repairsAnnual: 600, note: "Taxes shown use the homestead figure if the carry model did; a rental pays non-homestead taxes, about 20% more." },
  };
}

function round1(x) {
  return Math.round(x * 10) / 10;
}
