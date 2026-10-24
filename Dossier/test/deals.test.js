import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { budget, maxPrice, evaluate, chooseDown } from "../src/engine/afford.js";
import { findDeals, defaultMinBeds } from "../src/engine/deals.js";
import { commute, HUBS } from "../src/knowledge/places.js";
import { estimateHoa, carryingCosts } from "../src/engine/costs.js";

const pool = JSON.parse(fs.readFileSync(new URL("../data/candidates/south-florida-2026-10.json", import.meta.url), "utf8")).candidates;
const sample = JSON.parse(fs.readFileSync(new URL("../data/samples/3204-colony-club-rd-6.json", import.meta.url), "utf8"));
const profile = { grossAnnualIncome: 110000, monthlyDebts: 600, cashAvailable: 80000, household: 3, loanType: "conventional", work: HUBS[0], maxCommuteMin: 45 };

test("budget applies the lower of the front-end and back-end limits", () => {
  const b = budget(profile);
  assert.equal(b.monthlyIncome, 9167);
  assert.equal(b.comfortableHousing, Math.round(Math.min(9167 * 0.28, 9167 * 0.36 - 600)));
  const heavyDebt = budget({ ...profile, monthlyDebts: 2500 });
  assert.ok(heavyDebt.comfortableHousing < b.comfortableHousing, "debts shrink the housing budget");
});

test("maxPrice is monotone in the limit and respects cash", () => {
  const c = maxPrice(profile);
  const s = maxPrice(profile, undefined, "stretch");
  assert.ok(s.price > c.price);
  assert.ok(c.cashNeeded <= profile.cashAvailable);
  const poor = maxPrice({ ...profile, cashAvailable: 5000 });
  assert.ok(poor.price < c.price);
});

test("chooseDown falls back below 20% when cash is short, never below zero", () => {
  const b = budget({ ...profile, cashAvailable: 30000 });
  const pct = chooseDown(300000, b, 0.2);
  assert.ok(pct < 0.2 && pct > 0);
  assert.equal(chooseDown(300000, budget({ ...profile, cashAvailable: 0 }), 0.2), 0);
});

test("evaluate classifies tiers", () => {
  const cheap = evaluate(profile, pool.find((c) => c.meta.id === "52-canterbury-ln-tamarac"), 229000);
  assert.equal(cheap.tier, "comfortable");
  const pricey = evaluate(profile, pool.find((c) => c.meta.id === "401-briny-ave-708"), 445000);
  assert.equal(pricey.tier, "over");
});

test("PMI appears under 20% down and HOA is estimated when missing", () => {
  const f = pool.find((c) => c.meta.id === "605-oaks-dr-305");
  const c = carryingCosts(f, { downPct: 0.1 });
  assert.ok(c.monthly.pmi > 0);
  assert.equal(carryingCosts(f, { downPct: 0.2 }).monthly.pmi, 0);
  assert.equal(estimateHoa(f.property).estimated, true);
  assert.equal(estimateHoa({ type: "house", sqft: 1400 }).hoa, 0);
  assert.equal(estimateHoa({ type: "condo", sqft: 900, hoaMonthly: 175 }).hoa, 175);
});

test("findDeals excludes what does not fit and ranks the rest by score", () => {
  const r = findDeals(profile, [sample, ...pool]);
  assert.equal(r.minBeds, 2);
  assert.ok(r.ranked.length > 3);
  for (let i = 1; i < r.ranked.length; i++) assert.ok(r.ranked[i - 1].score >= r.ranked[i].score);
  for (const d of r.ranked) assert.equal(d.exclusions.length, 0);
  const sea = r.excluded.find((d) => d.id === "401-briny-ave-708");
  assert.ok(sea && /Housing cost/.test(sea.exclusions[0]));
  for (const d of r.ranked) assert.ok(d.commute && d.commute.peakMin <= 45);
});

test("bedroom and type filters apply", () => {
  const r = findDeals({ ...profile, minBeds: 3, types: ["house"] }, pool);
  for (const d of r.ranked) { assert.equal(d.type, "house"); assert.ok(d.beds >= 3); }
  const none = findDeals({ ...profile, grossAnnualIncome: 20000 }, pool);
  assert.equal(none.ranked.length, 0);
});

test("grade floor relaxes with a flag instead of returning nothing", () => {
  const r = findDeals({ ...profile, minGrade: "A" }, pool);
  assert.ok(r.relaxedGradeFloor);
  assert.ok(r.ranked.length > 0);
});

test("commute model and household defaults", () => {
  const t = commute(HUBS[0], { lat: 26.2345, lon: -80.0905 });
  assert.ok(t.miles > 8 && t.miles < 20);
  assert.ok(t.peakMin > t.offPeakMin);
  assert.equal(defaultMinBeds(1), 1);
  assert.equal(defaultMinBeds(4), 2);
  assert.equal(defaultMinBeds(5), 3);
});
