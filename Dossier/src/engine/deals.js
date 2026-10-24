// Deal finder: rank a pool of candidate homes against a buyer profile.
// Each candidate gets the full dossier treatment (rules, grades, carry), then a fit check and a 0 to 100 deal score.
import { buildReport } from "../report.js";
import { budget, evaluate } from "./afford.js";
import { commute } from "../knowledge/places.js";

const GRADE_VALUE = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const DIM_WEIGHT = { price: 1.2, carry: 1.0, building: 1.1, association: 1.1, hazard: 0.9, location: 1.0, resale: 1.0 };

export function defaultMinBeds(household) {
  const n = Number(household) || 1;
  return n <= 2 ? 1 : n <= 4 ? 2 : 3;
}

// profile: budget fields plus { household, minBeds, types[], maxCommuteMin, work:{lat,lon,name}, minGrade, needsPets, mustFinance }
export function findDeals(profile, candidates) {
  const b = budget(profile);
  const minBeds = Number(profile.minBeds) || defaultMinBeds(profile.household);
  const types = profile.types?.length ? profile.types : ["condo", "townhouse", "house"];
  const poolPpsf = medianPpsfByType(candidates);

  const rows = candidates.map((facts) => {
    const p = facts.property;
    const price = p.listPrice;
    const ev = evaluate(profile, facts, price, b);
    const report = buildReport(facts, { carry: { downPct: ev.downPct, rate: b.rate, homestead: profile.homestead !== false, loanType: profile.loanType } });
    const grades = Object.fromEntries(report.grades.map((g) => [g.key, g.grade]));
    const trip = profile.work?.lat ? commute(profile.work, facts.location) : null;
    const reasons = [];
    const exclusions = [];

    // ---- hard fit
    if (!types.includes(p.type)) exclusions.push(`Type ${p.type} not wanted`);
    if ((p.beds || 0) < minBeds) exclusions.push(`${p.beds ?? "?"} beds, you need ${minBeds}`);
    if (ev.tier === "over") exclusions.push(`Housing cost $${ev.housing.toLocaleString()}/mo is ${ev.frontPct}% of income`);
    if (!ev.cashOk || !ev.downOk) exclusions.push(`Needs $${ev.carry.cashToClose.toLocaleString()} to close; you have $${b.cashAvailable.toLocaleString()}`);
    if (trip && profile.maxCommuteMin && trip.peakMin > Number(profile.maxCommuteMin)) exclusions.push(`${trip.peakMin} min commute, limit ${profile.maxCommuteMin}`);
    const minG = GRADE_VALUE[profile.minGrade] ?? -1;
    const worst = Math.min(...Object.values(grades).map((g) => GRADE_VALUE[g]));
    const meetsGradeFloor = worst >= minG;

    // ---- score
    const gradeScore = Object.entries(grades).reduce((a, [k, g]) => a + GRADE_VALUE[g] * (DIM_WEIGHT[k] || 1), 0) / (4 * Object.values(DIM_WEIGHT).reduce((a, w) => a + w, 0)); // 0..1
    const affordScore = ev.tier === "comfortable" ? 1 - Math.min(1, ev.housing / Math.max(1, b.comfortableHousing)) * 0.5 : ev.tier === "stretch" ? 0.35 : 0;
    const ppsf = price && p.sqft ? price / p.sqft : null;
    const ref = poolPpsf[p.type];
    const valueScore = ppsf && ref ? clamp(1 - (ppsf / ref - 0.75) / 0.6, 0, 1) : 0.5; // 25% under pool median = 1.0; 35% over = 0
    const commuteScore = trip ? clamp(1 - trip.peakMin / 60, 0, 1) : 0.5;
    const motivated = (p.daysOnMarket || 0) > 90 || (p.priceHistory?.length || 0) >= 2;
    const leverageScore = motivated ? 1 : 0.4;
    const score = Math.round(100 * (gradeScore * 0.4 + affordScore * 0.2 + valueScore * 0.2 + commuteScore * 0.12 + leverageScore * 0.08));

    // ---- reasons
    if (ev.tier === "comfortable") reasons.push(`Fits comfortably: $${ev.housing.toLocaleString()}/mo housing, ${ev.frontPct}% of gross income (${ev.backPct}% with your debts).`);
    else if (ev.tier === "stretch") reasons.push(`A stretch: ${ev.frontPct}% of income on housing, ${ev.backPct}% with debts. Lenders may approve; your budget may not.`);
    if (ppsf && ref) reasons.push(`$${Math.round(ppsf)}/sq ft against a pool median of $${Math.round(ref)} for ${p.type}s (${ppsf < ref ? "cheaper" : "pricier"} by ${Math.abs(Math.round((ppsf / ref - 1) * 100))}%).`);
    const strong = report.grades.filter((g) => g.grade === "A" || g.grade === "B").map((g) => g.label);
    const weak = report.grades.filter((g) => g.grade === "D" || g.grade === "F").map((g) => g.label);
    if (strong.length) reasons.push(`Strong: ${strong.join(", ").toLowerCase()}.`);
    if (weak.length) reasons.push(`Weak: ${weak.join(", ").toLowerCase()}.`);
    if (trip) reasons.push(`About ${trip.peakMin} min to work at peak (${trip.miles} road miles).`);
    if (motivated) reasons.push(`Seller signals: ${p.daysOnMarket ? p.daysOnMarket + " days on market" : ""}${p.priceHistory?.length >= 2 ? (p.daysOnMarket ? ", " : "") + (p.priceHistory.length - 1) + (p.priceHistory.length === 2 ? " price cut" : " price cuts") : ""}. Room to negotiate.`);
    const crit = report.watch.filter((w) => w.severity === "critical").length;
    if (crit) reasons.push(`${crit} deal-breaker check${crit > 1 ? "s" : ""} open: ${report.watch.filter((w) => w.severity === "critical").map((w) => w.title.toLowerCase()).join("; ")}.`);
    if (ev.reserveMonths < 2 && ev.cashOk) reasons.push(`Only ${ev.reserveMonths} months of housing cost left in cash after closing.`);
    if (ev.carry.assumptions.hoaEstimated && p.type !== "house") reasons.push("HOA fee not in the listing; an estimate is used.");

    const label = exclusions.length ? "Pass" : score >= 70 && meetsGradeFloor ? "Strong buy" : score >= 55 ? "Good" : score >= 40 ? "Fair" : "Weak";

    return {
      id: facts.meta?.id, title: facts.meta?.title || `${p.address}${p.unit ? " " + p.unit : ""}, ${p.city}`,
      price, type: p.type, beds: p.beds, baths: p.baths, sqft: p.sqft, yearBuilt: p.yearBuilt, city: p.city, source: facts.meta?.source, seenOn: facts.meta?.seenOn,
      grades, worstGrade: Object.keys(GRADE_VALUE).find((k) => GRADE_VALUE[k] === worst), meetsGradeFloor,
      afford: { tier: ev.tier, housing: ev.housing, totalMonthly: ev.carry.totalMonthly, frontPct: ev.frontPct, backPct: ev.backPct, downPct: Math.round(ev.downPct * 1000) / 10, cashToClose: ev.carry.cashToClose, reserveMonths: ev.reserveMonths },
      commute: trip, score, label, reasons, exclusions, facts, report,
    };
  });

  const eligible = rows.filter((r) => !r.exclusions.length);
  const matchingFloor = eligible.filter((r) => r.meetsGradeFloor);
  const ranked = (matchingFloor.length ? matchingFloor : eligible).sort((a, b) => b.score - a.score);
  return {
    budget: b,
    minBeds,
    ranked,
    relaxedGradeFloor: Boolean(profile.minGrade) && !matchingFloor.length && eligible.length > 0,
    excluded: rows.filter((r) => r.exclusions.length).sort((a, b) => b.score - a.score),
    poolPpsf,
  };
}

function medianPpsfByType(cands) {
  const by = {};
  for (const c of cands) {
    const p = c.property;
    if (p.listPrice && p.sqft) (by[p.type] ||= []).push(p.listPrice / p.sqft);
  }
  const out = {};
  for (const [t, arr] of Object.entries(by)) {
    arr.sort((a, b) => a - b);
    out[t] = arr[Math.floor(arr.length / 2)];
  }
  return out;
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
