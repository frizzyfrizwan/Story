// Dossier server: serves the web app and exposes two JSON routes.
//   POST /api/enrich     facts in, facts with public layers out (geocode, FEMA flood zone, USGS elevation, Census ACS, OSM nearby)
//   POST /api/report     facts in, full report out (adds a Claude narrative when the SDK and credentials are present)
//   GET  /api/sample     the researched sample facts
// No dependencies. Node 20+.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReport, enrich } from "./src/report.js";
import { writeNarrative, narrativeAvailable } from "./src/narrative.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };

function send(res, code, body, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store" });
  res.end(typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => { data += c; if (data.length > 2e6) reject(new Error("body too large")); });
    req.on("end", () => { try { resolve(data ? JSON.parse(data) : {}); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  // Map "/" to web/index.html; allow web/, src/ and data/ so the browser can import the engine as real ES modules.
  let url = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (url === "/") url = "/web/index.html";
  else if (!url.startsWith("/src/") && !url.startsWith("/data/") && !url.startsWith("/web/")) url = "/web" + url;
  const file = path.normalize(path.join(here, url));
  if (!file.startsWith(here)) return send(res, 403, { error: "forbidden" });
  fs.readFile(file, (err, buf) => {
    if (err) return send(res, 404, { error: "not found" });
    send(res, 200, buf, MIME[path.extname(file)] || "application/octet-stream");
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, "http://x");
    if (req.method === "GET" && pathname === "/api/sample") {
      return send(res, 200, fs.readFileSync(path.join(here, "data/samples/3204-colony-club-rd-6.json"), "utf8"));
    }
    if (req.method === "POST" && pathname === "/api/enrich") {
      const facts = await readBody(req);
      const { facts: out } = await enrich(facts);
      return send(res, 200, out);
    }
    if (req.method === "POST" && pathname === "/api/report") {
      const facts = await readBody(req);
      const { facts: enriched } = facts.meta?.mode === "researched" ? { facts } : await enrich(facts);
      const report = buildReport(enriched);
      if (await narrativeAvailable()) {
        try { report.narrative = await writeNarrative(report); } catch (e) { report.narrativeError = e.message; }
      }
      return send(res, 200, report);
    }
    if (pathname.startsWith("/api/")) return send(res, 404, { error: "no such route" });
    return serveStatic(req, res);
  } catch (e) {
    send(res, 500, { error: e.message });
  }
});

server.listen(PORT, () => console.log(`Dossier at http://localhost:${PORT}`));
