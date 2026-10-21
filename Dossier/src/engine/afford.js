// Affordability: what a household can carry, and how a given home sits against that.
import { FLORIDA } from "../knowledge/florida.js";
import { carryingCosts } from "./costs.js";

// profile: { grossAnnualIncome, monthlyDebts, cashAvailable, loanType, rate, homestead, creditTier }
export function budget(profile) {
  const income = Number(profile.grossAnnualIncome) || 0;
  const debts = Number(profile.monthlyDebts) || 0;
  const cash = Number(profile.cashAvailable) || 0;
  const monthlyIncome = income / 12;
  const d = FLORIDA.dti;
  const lim = (t) => Math.max(0, Math.min(monthlyIncome * t.front, monthlyIncome * t.back - debts));
  return {
    monthlyIncome: Math.round(monthlyIncome),
    comfortableHousing: Math.round(lim(d.comfortable)),
    stretchHousing: Math.round(lim(d.stretch)),
    cashAvailable: cash,
    minDownPct: d.minDownPct[profile.loanType === "fha" ? "fha" : "conventional"],
    rate: Number(profile.rate) || FLORIDA.mortgage.rate30yr,
  };
}

// Solve the maximum price for a representative home shape (type, sqft, hoa) under a housing-cost limit and the cash on hand.
export function maxPrice(profile, shape = { type: "condo", sqft: 1000, hoaMonthly: 450, city: "Pompano Beach", barrierIsland: false }, tier = "comfortable") {
  const b = budget(profile);
  const limit = tier === "stretch" ? b.stretchHousing : b.comfortableHousing;
  if (limit <= 0) return { price: 0, limit, downPct: 0, reason: "No room under the debt-to-income limit." };
  let lo = 0, hi = 3_000_000, best = null;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const r = evaluate(profile, shapeFacts(shape), mid, b);
    if (r.fits(limit)) { best = { price: Math.round(mid), downPct: r.downPct, housing: r.carry.housingCostForDti, cashNeeded: r.carry.cashToClose }; lo = mid; } else hi = mid;
  }
  return best ? { ...best, limit } : { price: 0, limit, downPct: 0, reason: "Cash on hand does not cover the minimum down payment and closing costs at any price." };
}

function shapeFacts(s) {
  return { property: { type: s.type, sqft: s.sqft, hoaMonthly: s.hoaMonthly, city: s.city, yearBuilt: s.yearBuilt || 1990, listPrice: 0 }, location: { barrierIsland: Boolean(s.barrierIsland) }, insurance: {} };
}

// Down payment: as much of the cash as possible after closing costs and a reserve, capped at the price, floored at the program minimum.
export function chooseDown(price, b, preferredDownPct) {
  const closing = price * FLORIDA.dti.closingCostPct;
  const available = Math.max(0, b.cashAvailable - closing);
  let pct = preferredDownPct ?? 0.2;
  if (price > 0 && available < price * pct) pct = available / price;
  pct = Math.min(1, Math.max(0, pct));
  return pct;
}

export function evaluate(profile, facts, price, b = budget(profile)) {
  const downPct = chooseDown(price, b, profile.preferredDownPct);
  const carry = carryingCosts(facts, { price, downPct, rate: b.rate, homestead: profile.homestead !== false, loanType: profile.loanType || "conventional" });
  const housing = carry.housingCostForDti;
  const front = b.monthlyIncome ? housing / b.monthlyIncome : Infinity;
  const back = b.monthlyIncome ? (housing + (Number(profile.monthlyDebts) || 0)) / b.monthlyIncome : Infinity;
  const cashOk = carry.cashToClose <= b.cashAvailable + 1;
  const downOk = downPct >= b.minDownPct - 1e-9;
  const d = FLORIDA.dti;
  const tier = front <= d.comfortable.front && back <= d.comfortable.back ? "comfortable" : front <= d.stretch.front && back <= d.stretch.back ? "stretch" : "over";
  const reserveAfterClose = b.cashAvailable - carry.cashToClose;
  return {
    carry, downPct, housing, frontPct: Math.round(front * 1000) / 10, backPct: Math.round(back * 1000) / 10, tier, cashOk, downOk,
    reserveAfterClose: Math.round(reserveAfterClose),
    reserveMonths: housing ? Math.round((reserveAfterClose / housing) * 10) / 10 : 0,
    fits: (limit) => housing <= limit && cashOk && downOk,
  };
}
