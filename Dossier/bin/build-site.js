#!/usr/bin/env node
// Builds site/index.html: one self-contained file (engine + sample + UI inlined) for GitHub Pages or any static host.
// The ES modules are concatenated in dependency order with import/export lines stripped; they share no names.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const strip = (src) => src
  .replace(/^import[^;]*;\s*$/gm, "")
  .replace(/^export\s+(const|function|async function|let)\s/gm, "$1 ")
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, "");

const order = ["src/knowledge/florida.js", "src/knowledge/checklist.js", "src/knowledge/places.js", "src/engine/costs.js", "src/engine/rules.js", "src/engine/score.js", "src/engine/afford.js", "src/adapters/http.js", "src/adapters/public.js", "src/report.js", "src/engine/deals.js", "web/app.js"];
const sample = read("data/samples/3204-colony-club-rd-6.json");
const candidates = read("data/candidates/south-florida-2026-10.json");
const js = order.map((f) => `// ---- ${f}\n${strip(read(f))}`).join("\n");
const css = read("web/style.css");
let html = read("web/index.html");
// Function replacers: a string replacement would turn "$$" in the source into "$" and eat every "$${" template.
html = html.replace('<link rel="stylesheet" href="style.css">', () => `<style>\n${css}\n</style>`);
html = html.replace('<script type="module" src="app.js"></script>', () => `<script>window.DOSSIER_SAMPLE = ${sample};\nwindow.DOSSIER_CANDIDATES = ${candidates};</script>\n<script>\n${js}\n</script>`);
fs.mkdirSync(path.join(root, "site"), { recursive: true });
fs.writeFileSync(path.join(root, "site/index.html"), html);
console.log(`site/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
