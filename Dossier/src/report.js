// Report pipeline: facts in, dossier out.
// facts can come from a researched sample, from a user's listing form, or from live adapters merged on top.
import { runRules, HORIZON_LABELS } from "./engine/rules.js";
import { carryingCosts, projection, rentalMath } from "./engine/costs.js";
import { grade } from "./engine/score.js";
import { CHECKLIST } from "./knowledge/checklist.js";
import { FLORIDA } from "./knowledge/florida.js";
import * as pub from "./adapters/public.js";

export function buildReport(facts, options = {}) {
  const carry = carryingCosts(facts, options.carry);
  const carryNonHomestead = carryingCosts(facts, { ...options.carry, homestead: false });
  const watch = runRules(facts);
  const grades = grade(facts, watch, carry);
  const sa = inferSpecialAssessments(facts, watch);
  const proj = projection(carry, { years: 10, specialAssessments: sa });
  const rental = rentalMath(facts, carryNonHomestead);
  const checklist = CHECKLIST.filter((c) => !isAnswered(facts, c.unlocks));
  const byHorizon = {};
  for (const w of watch) (byHorizon[w.horizon] ||= []).push(w);

  return {
    generatedAt: new Date().toISOString(),
    meta: facts.meta,
    facts,
    verdict: grades.verdict,
    grades: grades.dimensions,
    costs: { homestead: carry, nonHomestead: carryNonHomestead, projection: proj, rental, specialAssessmentScenario: sa },
    watch,
    watchByHorizon: Object.keys(HORIZON_LABELS).map((h) => ({ horizon: h, label: HORIZON_LABELS[h], items: byHorizon[h] || [] })),
    checklist,
    reference: { florida: FLORIDA },
    provenance: facts.provenance || [],
  };
}

function isAnswered(facts, path) {
  if (!path) return false;
  const v = path.split(".").reduce((o, k) => (o ? o[k] : undefined), facts);
  return v !== undefined && v !== null && v !== "unknown" && !(typeof v === "string" && v.startsWith("unknown"));
}

// A plausible special-assessment scenario for the projection, so the 10-year table is not a fantasy of flat fees.
function inferSpecialAssessments(facts, watch) {
  const out = [];
  const year = new Date().getFullYear();
  const units = Number(String(facts.building?.unitsInBuilding || "").match(/\d+/)?.[0]) || 6;
  if (watch.find((w) => w.id === "cast-iron")) out.push({ year: year + 2, amount: 15000, label: "Drain-line repipe (share of building cost)" });
  if (watch.find((w) => w.id === "roof" && w.confidence !== "high")) out.push({ year: year + 5, amount: Math.round(90000 / units), label: "Roof replacement share" });
  if (watch.find((w) => w.id === "recert")) {
    const m = watch.find((w) => w.id === "recert").title.match(/next due (\d{4})/);
    if (m) out.push({ year: Number(m[1]), amount: 6000, label: "Recertification repairs" });
  }
  return out;
}

// Live enrichment: run every public adapter against an address and merge what comes back onto the facts.
export async function enrich(facts) {
  const prov = [];
  const address = [facts.property.address, facts.property.city, facts.property.state, facts.property.zip].filter(Boolean).join(", ");
  const geo = await pub.geocode(address);
  prov.push(geo);
  if (geo.status !== "live") return { facts, provenance: prov };
  const { lat, lon } = geo.data;
  facts.location = { ...(facts.location || {}), lat, lon };
  const [fz, el, acs, near] = await Promise.all([pub.floodZone(lat, lon), pub.elevation(lat, lon), pub.acsProfile(facts.property.zip), pub.nearby(lat, lon)]);
  prov.push(fz, el, acs, near);
  if (fz.status === "live") Object.assign(facts.location, { floodZone: fz.data.floodZone, baseFloodElevationFt: fz.data.baseFloodElevationFt, sfha: fz.data.sfha });
  if (el.status === "live") facts.location.groundElevationFt = el.data.groundElevationFt;
  if (acs.status === "live") facts.demographics = { ...(facts.demographics || {}), ...acs.data, source: acs.source };
  if (near.status === "live") {
    facts.location.nearby = near.data;
    const beach = near.data.find((n) => n.kind === "beach");
    if (beach && !facts.location.distanceToBeachFt) facts.location.distanceToBeachFt = beach.distanceFt;
    const market = near.data.find((n) => n.kind === "supermarket");
    if (market) facts.location.nearestSupermarket = market;
  }
  const st = pub.nearestTrendStation(lat, lon);
  facts.location.seaLevelTrend = { station: st.name, mmPerYear: st.mmPerYear, since: st.since, distanceMiles: Math.round(st.distanceM / 1609) };
  prov.push({ source: "NOAA Sea Level Trends (local table)", status: "live" });
  facts.provenance = prov;
  return { facts, provenance: prov };
}

// Build a facts object from a plain listing form (what a user can read off Zillow in 30 seconds).
export function factsFromListing(input) {
  const n = (v) => (v === "" || v === undefined || v === null ? undefined : Number(v));
  const price = n(input.listPrice);
  const sqft = n(input.sqft);
  return {
    meta: { id: slug(`${input.address} ${input.unit || ""}`), title: [input.address, input.unit, `${input.city}, ${input.state} ${input.zip}`].filter(Boolean).join(", "), mode: "live", researchedOn: new Date().toISOString().slice(0, 10) },
    property: {
      address: input.address, unit: input.unit || "", city: input.city, state: input.state || "FL", zip: input.zip, county: input.county || "Broward",
      type: input.type || "condo", beds: n(input.beds), baths: n(input.baths), sqft, yearBuilt: n(input.yearBuilt), lotAcres: n(input.lotAcres),
      listPrice: price, pricePerSqft: price && sqft ? Math.round(price / sqft) : undefined, hoaMonthly: n(input.hoaMonthly), daysOnMarket: n(input.daysOnMarket),
      priceHistory: [], listingDiscrepancies: [], impactWindows: "unknown",
    },
    building: { habitableStories: n(input.stories) ?? "unknown", unitsInBuilding: input.units || "unknown", roofYear: n(input.roofYear) ?? "unknown", drainsReplaced: "unknown", panelBrand: "unknown" },
    association: { reservesUsd: "unknown", specialAssessments: "unknown", masterDeductible: "unknown", rentalMinDays: "unknown", pets: "unknown", ageRestricted: "unknown" },
    financing: { warrantable: "unknown" },
    location: { county: input.county || "Broward", barrierIsland: input.barrierIsland === true || input.barrierIsland === "true", evacuationZone: input.evacuationZone || undefined, floodZone: "unknown", elevationFt: "unknown" },
    market: {},
    rents: input.rentEstimate ? { estimateMonthly: n(input.rentEstimate), evidence: ["User-supplied estimate"] } : undefined,
    insurance: {},
    sources: [],
  };
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
