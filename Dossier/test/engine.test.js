import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { monthlyPayment, estimateTaxes, carryingCosts, projection, rentalMath } from "../src/engine/costs.js";
import { runRules } from "../src/engine/rules.js";
import { grade } from "../src/engine/score.js";
import { buildReport, factsFromListing } from "../src/report.js";
import { FLORIDA } from "../src/knowledge/florida.js";

const sample = JSON.parse(fs.readFileSync(new URL("../data/samples/3204-colony-club-rd-6.json", import.meta.url), "utf8"));

test("monthly payment matches the standard amortization formula", () => {
  // $239,920 at 7.32% for 30 years is about $1,648
  assert.equal(Math.round(monthlyPayment(239920, 0.0732)), 1648);
  assert.equal(monthlyPayment(0, 0.07), 0);
  assert.equal(Math.round(monthlyPayment(120000, 0, 30)), 333);
});

test("Florida tax estimate applies homestead exemptions by levy", () => {
  const m = FLORIDA.tax.millage["Pompano Beach"];
  const hs = estimateTaxes({ price: 299900, millageTable: m, homestead: true });
  const nh = estimateTaxes({ price: 299900, millageTable: m, homestead: false });
  assert.equal(hs.justValue, Math.round(299900 * 0.85));
  assert.ok(nh.annual > hs.annual, "non-homestead pays more");
  // Homestead saving = 50k on non-school millage + 25k on school millage
  const expectedSaving = (50000 * (m.total - m.school) + 25000 * m.school) / 1000;
  assert.ok(Math.abs(nh.annual - hs.annual - expectedSaving) < 2);
});

test("carrying cost adds every line and flood only on flood-exposed parcels", () => {
  const c = carryingCosts(sample);
  const sum = Object.values(c.monthly).reduce((a, b) => a + (b || 0), 0);
  assert.equal(c.totalMonthly, sum);
  assert.ok(c.monthly.flood > 0, "barrier island gets a flood line");
  const inland = structuredClone(sample);
  inland.location.barrierIsland = false;
  inland.location.floodZone = "X";
  assert.equal(carryingCosts(inland).monthly.flood, 0);
});

test("projection grows fees and places the special assessments in their years", () => {
  const c = carryingCosts(sample);
  const rows = projection(c, { years: 3, hoaGrowthPct: 10, specialAssessments: [{ year: new Date().getFullYear() + 1, amount: 5000 }] });
  assert.equal(rows.length, 4);
  assert.equal(rows[1].specialAssessment, 5000);
  assert.equal(rows[1].hoa, Math.round(c.monthly.hoa * 1.1));
});

test("rules flag the known problems for a 1963 coastal condo with a $175 fee", () => {
  const w = runRules(sample);
  const ids = w.map((x) => x.id);
  for (const id of ["warrantable", "fee-low", "cast-iron", "recert", "evac", "flood-zone", "slr", "wind", "termination", "price-cuts", "listing-discrepancy", "stories"]) {
    assert.ok(ids.includes(id), `expected rule ${id}`);
  }
  const recert = w.find((x) => x.id === "recert");
  assert.match(recert.title, /last due 2023, next due 2033/);
  assert.equal(w[0].severity, "critical", "sorted with critical first");
});

test("rules relax when the facts are supplied", () => {
  const f = structuredClone(sample);
  f.building.habitableStories = 2;
  f.building.drainsReplaced = 2019;
  f.building.roofYear = 2022;
  f.building.roofType = "flat";
  f.financing.warrantable = true;
  f.association.reservesUsd = 120000;
  const ids = runRules(f).map((x) => x.id);
  assert.ok(ids.includes("exempt-sirs"));
  assert.ok(!ids.includes("milestone"));
  assert.ok(!ids.includes("cast-iron"));
  assert.ok(!ids.includes("warrantable"));
  assert.ok(!ids.includes("reserves"));
  const roof = runRules(f).find((x) => x.id === "roof");
  assert.match(roof.title, /Roof replaced 2022/);
});

test("three or more habitable stories triggers the milestone and SIRS rule", () => {
  const f = structuredClone(sample);
  f.building.habitableStories = 4;
  const m = runRules(f).find((x) => x.id === "milestone");
  assert.equal(m.severity, "critical");
});

test("grades and verdict are produced for every dimension", () => {
  const w = runRules(sample);
  const c = carryingCosts(sample);
  const g = grade(sample, w, c);
  assert.equal(g.dimensions.length, 7);
  for (const d of g.dimensions) assert.match(d.grade, /^[A-F]$/);
  assert.equal(g.verdict.stance, "Conditional");
});

test("buildReport assembles horizons, checklist and rental math", () => {
  const r = buildReport(sample);
  assert.equal(r.watchByHorizon.length, 4);
  assert.ok(r.checklist.length >= 15);
  assert.ok(r.costs.rental.grossYieldPct > 7 && r.costs.rental.grossYieldPct < 10);
  assert.ok(r.costs.rental.cashFlowMonthly < 0, "negative leverage at 7.3%");
  assert.ok(r.costs.specialAssessmentScenario.length >= 2);
});

test("factsFromListing builds a usable facts object from form strings", () => {
  const f = factsFromListing({ address: "1 Main St", unit: "", city: "Pompano Beach", state: "FL", zip: "33062", listPrice: "250000", beds: "2", baths: "2", sqft: "900", yearBuilt: "1975", hoaMonthly: "400", stories: "3", barrierIsland: "true" });
  assert.equal(f.property.listPrice, 250000);
  assert.equal(f.property.pricePerSqft, 278);
  assert.equal(f.building.habitableStories, 3);
  assert.equal(f.location.barrierIsland, true);
  const r = buildReport(f);
  assert.ok(r.watch.find((w) => w.id === "milestone"));
  assert.ok(r.costs.homestead.totalMonthly > 0);
});
