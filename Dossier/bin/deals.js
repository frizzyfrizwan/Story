#!/usr/bin/env node
// CLI: rank the candidate pool for a buyer profile.
//   node bin/deals.js profile.json [pool.json]
//   profile.json: { "grossAnnualIncome": 110000, "monthlyDebts": 600, "cashAvailable": 80000, "household": 3,
//                   "loanType": "conventional", "maxCommuteMin": 45, "minGrade": "B", "hub": "ftl-downtown" }
import fs from "node:fs";
import { findDeals } from "../src/engine/deals.js";
import { maxPrice } from "../src/engine/afford.js";
import { HUBS } from "../src/knowledge/places.js";

const [profilePath, poolPath = new URL("../data/candidates/south-florida-2026-10.json", import.meta.url)] = process.argv.slice(2);
if (!profilePath) { console.error("usage: deals <profile.json> [pool.json]"); process.exit(2); }
const profile = JSON.parse(fs.readFileSync(profilePath, "utf8"));
if (profile.hub && !profile.work) { const h = HUBS.find((x) => x.id === profile.hub); if (h) profile.work = h; }
const pool = JSON.parse(fs.readFileSync(poolPath, "utf8"));
const sample = JSON.parse(fs.readFileSync(new URL("../data/samples/3204-colony-club-rd-6.json", import.meta.url), "utf8"));
const r = findDeals(profile, [sample, ...(pool.candidates || pool)]);
const usd = (n) => "$" + Math.round(n).toLocaleString();
console.log(`Budget: ${usd(r.budget.comfortableHousing)}/mo comfortable, ${usd(r.budget.stretchHousing)}/mo stretch; cash ${usd(r.budget.cashAvailable)}`);
console.log(`Comfortable max price: condo ${usd(maxPrice(profile).price)}, house ${usd(maxPrice(profile, { type: "house", sqft: 1400, hoaMonthly: 0, city: "Pompano Beach" }).price)}\n`);
r.ranked.forEach((d, i) => {
  console.log(`${i + 1}. [${d.score}] ${d.label}: ${d.title} — ${usd(d.price)}, ${d.beds}bd/${d.baths}ba, grades ${Object.values(d.grades).join("")}, housing ${usd(d.afford.housing)}/mo${d.commute ? `, ${d.commute.peakMin} min to work` : ""}`);
  for (const why of d.reasons) console.log(`     - ${why}`);
});
console.log(`\n${r.excluded.length} excluded:`);
for (const d of r.excluded) console.log(`   ${d.title}: ${d.exclusions.join("; ")}`);
