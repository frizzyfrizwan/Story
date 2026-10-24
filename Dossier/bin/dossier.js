#!/usr/bin/env node
// CLI: print a report as JSON or as a plain-text brief.
//   node bin/dossier.js data/samples/3204-colony-club-rd-6.json          # text brief
//   node bin/dossier.js data/samples/3204-colony-club-rd-6.json --json   # full report JSON
//   node bin/dossier.js facts.json --enrich                              # add live public layers first
import fs from "node:fs";
import { buildReport, enrich } from "../src/report.js";

const [file, ...flags] = process.argv.slice(2);
if (!file) { console.error("usage: dossier <facts.json> [--json] [--enrich]"); process.exit(2); }
let facts = JSON.parse(fs.readFileSync(file, "utf8"));
if (flags.includes("--enrich")) ({ facts } = await enrich(facts));
const r = buildReport(facts);
if (flags.includes("--json")) { console.log(JSON.stringify(r, null, 2)); process.exit(0); }

const usd = (n) => "$" + Math.round(n).toLocaleString();
console.log(`${r.facts.meta?.title || r.facts.property.address}\nAsking ${usd(r.facts.property.listPrice)} · ${r.verdict.stance}\n`);
console.log(r.verdict.summary + "\n");
console.log("Grades: " + r.grades.map((g) => `${g.label} ${g.grade}`).join(" · ") + "\n");
console.log(`Cost to own: ${usd(r.costs.homestead.totalMonthly)}/mo (20% down, ${(r.costs.homestead.assumptions.rate * 100).toFixed(2)}%, homestead); ${usd(r.costs.nonHomestead.totalMonthly)}/mo non-homestead\n`);
for (const h of r.watchByHorizon) {
  if (!h.items.length) continue;
  console.log(`== ${h.label} ==`);
  for (const w of h.items) console.log(`  [${w.severity.toUpperCase()}] ${w.title}\n      ${w.action}`);
  console.log();
}
console.log(`Open questions: ${r.checklist.length}`);
