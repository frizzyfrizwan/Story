import { buildReport, factsFromListing } from "../src/report.js";
import { findDeals, defaultMinBeds } from "../src/engine/deals.js";
import { maxPrice } from "../src/engine/afford.js";
import { HUBS } from "../src/knowledge/places.js";

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const usd = (n) => (n === null || n === undefined ? "n/a" : "$" + Math.round(n).toLocaleString());
const SAMPLE_URL = "../data/samples/3204-colony-club-rd-6.json";

let state = { report: null, filter: "all" };

async function loadSample() {
  const facts = window.DOSSIER_SAMPLE || (await (await fetch(SAMPLE_URL)).json());
  render(buildReport(structuredClone(facts)));
}

function render(report) {
  state.report = report;
  const r = report, f = r.facts, p = f.property;
  const specs = [p.beds && `${p.beds} bd`, p.baths && `${p.baths} ba`, p.sqft && `${p.sqft.toLocaleString()} sq ft`, p.yearBuilt && `built ${p.yearBuilt}`, p.hoaMonthly && `HOA $${p.hoaMonthly}/mo`].filter(Boolean).join(" · ");
  $("#report").innerHTML = `
  <section class="band hero" id="top">
    <div>
      <h1>${esc(f.meta?.title || p.address)}</h1>
      <div class="specs">${esc(specs)}</div>
      <p class="muted" style="margin-top:.4rem">${esc(f.meta?.mode === "researched" ? `Researched ${f.meta.researchedOn}. ` : "")}${esc(p.listingSource || "")}</p>
    </div>
    <div>
      <div class="price num">${usd(p.listPrice)}</div>
      <div class="muted num">${p.pricePerSqft ? "$" + p.pricePerSqft + "/sq ft" : ""}</div>
      <div style="margin-top:.5rem"><span class="stance ${esc(r.verdict.stance.split(" ")[0])}">${esc(r.verdict.stance)}</span></div>
    </div>
    <p class="verdict" style="grid-column:1/-1">${esc(r.verdict.summary)}</p>
    ${r.narrative ? `<div class="narrative" style="grid-column:1/-1">${esc(r.narrative)}</div>` : ""}
    <div style="grid-column:1/-1"><button type="button" id="add-pool" class="btn ghost">Add to my deals pool</button> <span id="add-pool-status" class="muted"></span></div>
  </section>
  <section class="band"><h2>Grades</h2><div class="grades">${r.grades.map((g) => `<div class="grade" data-g="${g.grade}"><div class="letter">${g.grade}</div><div class="label">${esc(g.label)}</div><div class="why">${esc(g.why)}</div></div>`).join("")}</div></section>
  <section class="band" id="watch">
    <h2>What will come up, and when</h2>
    <p class="muted">${r.watch.length} items. Each names the document or inspection that settles it.</p>
    <div class="filters" role="group" aria-label="Filter by severity">${["all", "critical", "high", "watch", "info"].map((s) => `<button type="button" class="chip" data-f="${s}" aria-pressed="${state.filter === s}">${s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>`).join("")}</div>
    <div id="watch-list">${renderWatch(r)}</div>
  </section>
  <section class="band" id="costs"><h2>Cost to own</h2>${renderCosts(r)}</section>
  <section class="band" id="building"><h2>Building and association</h2>${renderFacts(f)}</section>
  <section class="band" id="place"><h2>Location, hazards and neighborhood</h2>${renderPlace(f)}</section>
  <section class="band" id="market"><h2>Market and comparable sales</h2>${renderMarket(f)}</section>
  <section class="band" id="history"><h2>History</h2>${renderHistory(f)}</section>
  <section class="band" id="checklist"><h2>Questions to ask before you waive contingencies</h2>${renderChecklist(r)}</section>
  <section class="band" id="sources"><h2>Sources</h2>${renderSources(f, r)}</section>`;
  $("#report").querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => { state.filter = b.dataset.f; $("#report").querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", c === b)); $("#watch-list").innerHTML = renderWatch(state.report); }));
  wireCosts();
  wireChecklist();
  $("#add-pool")?.addEventListener("click", () => { addToPool(state.report.facts); $("#add-pool-status").textContent = "Added. Open Find deals to see it ranked."; });
}

function renderWatch(r) {
  return r.watchByHorizon.map((h) => {
    const items = h.items.filter((w) => state.filter === "all" || w.severity === state.filter);
    if (!items.length) return "";
    return `<div class="horizon"><h3>${esc(h.label)} <span class="count num">${items.length}</span></h3><div class="watch">${items.map((w) => `
      <details class="item" data-s="${w.severity}" ${w.severity === "critical" ? "open" : ""}>
        <summary><span class="sev">${w.severity}</span> ${esc(w.title)} ${w.confidence !== "high" ? `<span class="conf">(${w.confidence} confidence)</span>` : ""}</summary>
        <div class="body"><p>${esc(w.why)}</p><p class="action"><b>Do:</b> ${esc(w.action)}</p></div>
      </details>`).join("")}</div></div>`;
  }).join("") || `<p class="muted">Nothing at this severity.</p>`;
}

function renderCosts(r) {
  const c = r.costs.homestead, n = r.costs.nonHomestead;
  const parts = [["Mortgage (P&I)", c.monthly.principalAndInterest, "c0"], ["Property tax", c.monthly.taxes, "c1"], ["HOA", c.monthly.hoa, "c4"], ["HO-6 insurance", c.monthly.ho6, "c2"], ["Flood (contents)", c.monthly.flood, "c3"], ["Utilities", c.monthly.utilities, "c5"]];
  const total = c.totalMonthly;
  return `<div class="costs">
    <div>
      <div class="muted">Estimated monthly, ${Math.round(c.assumptions.downPct * 100)}% down at ${(c.assumptions.rate * 100).toFixed(2)}%, 30 years, homestead</div>
      <div class="big num" id="cost-total">${usd(total)}<span class="muted" style="font-size:1rem;font-weight:400">/mo</span></div>
      <div class="stack" aria-hidden="true">${parts.map(([, v, cls]) => `<span class="${cls}" style="width:${((v || 0) / total) * 100}%"></span>`).join("")}</div>
      <div class="legend">${parts.map(([k, v, cls]) => `<i class="${cls}"></i><span>${k}</span><span class="num">${usd(v)}</span>`).join("")}</div>
      <p class="muted" style="margin-top:.6rem">Cash to close about ${usd(c.cashToClose)} (down payment plus about 3% closing costs). As a second home or rental the tax line is ${usd(n.monthly.taxes)}/mo and the total ${usd(n.totalMonthly)}/mo. ${esc(c.taxes?.note || "")} Insurance lines are planning ranges, not quotes.</p>
      <div class="toggle"><label class="muted">Down payment <select id="down"><option value="0.05">5%</option><option value="0.1">10%</option><option value="0.2" selected>20%</option><option value="0.3">30%</option><option value="1">Cash</option></select></label>
      <label class="muted">Rate <input id="rate" type="number" step="0.05" value="${(c.assumptions.rate * 100).toFixed(2)}" style="width:5.5em"> %</label></div>
    </div>
    <div>
      <h3>Ten-year projection</h3>
      <p class="muted">HOA +7%/yr, insurance +6%/yr (flood up to +10%), taxes +3%/yr, plus a special-assessment scenario drawn from the watch list.</p>
      <div class="tablewrap"><table><thead><tr><th>Year</th><th class="num">HOA</th><th class="num">Insurance</th><th class="num">Monthly</th><th class="num">Special</th></tr></thead>
      <tbody>${r.costs.projection.map((p) => `<tr><td class="num">${p.year}</td><td class="num">${usd(p.hoa)}</td><td class="num">${usd(p.insurance)}</td><td class="num">${usd(p.monthly)}</td><td class="num">${p.specialAssessment ? usd(p.specialAssessment) : ""}</td></tr>`).join("")}</tbody></table></div>
      ${r.costs.specialAssessmentScenario.length ? `<p class="muted" style="margin-top:.5rem">Scenario assessments: ${r.costs.specialAssessmentScenario.map((s) => `${s.year} ${esc(s.label)} ${usd(s.amount)}`).join("; ")}. These are illustrations of the kind of bill a building this age produces, not predictions of this board's decisions.</p>` : ""}
      ${r.costs.rental ? `<h3 style="margin-top:1rem">As a rental</h3><p>Rent about ${usd(r.costs.rental.rentMonthly)}/mo. Gross yield ${r.costs.rental.grossYieldPct}%, cap rate ${r.costs.rental.capRatePct}% after HOA, non-homestead taxes, insurance, ${r.costs.rental.assumptions.vacancyPct}% vacancy and ${r.costs.rental.assumptions.managementPct}% management. With a ${Math.round(c.assumptions.downPct * 100)}% down mortgage, monthly cash flow is about ${usd(r.costs.rental.cashFlowMonthly)}.</p>` : ""}
    </div></div>`;
}

function wireCosts() {
  const recompute = () => {
    const down = Number($("#down").value), rate = Number($("#rate").value) / 100;
    const facts = state.report.facts;
    const rep = buildReport(facts, { carry: { downPct: down, rate } });
    rep.narrative = state.report.narrative;
    state.report = rep;
    $("#costs").innerHTML = `<h2>Cost to own</h2>${renderCosts(rep)}`;
    $("#down").value = String(down); $("#rate").value = (rate * 100).toFixed(2);
    wireCosts();
  };
  $("#down")?.addEventListener("change", recompute);
  $("#rate")?.addEventListener("change", recompute);
}

const fact = (k, v, note) => {
  const u = v === undefined || v === null || v === "unknown" || (typeof v === "string" && v.startsWith("unknown"));
  return `<div><span>${esc(k)}</span><span class="${u ? "unknown" : ""}">${u ? esc(typeof v === "string" && v.length > 7 ? v : "Unknown: ask") : esc(v)}${note ? ` <span class="muted">${esc(note)}</span>` : ""}</span></div>`;
};

function renderFacts(f) {
  const p = f.property, b = f.building || {}, a = f.association || {}, fin = f.financing || {};
  return `<div class="cols">
    <div><h3>Unit</h3><div class="facts">
      ${fact("Type", p.type)}${fact("Beds / baths", `${p.beds ?? "?"} / ${p.baths ?? "?"}`)}${fact("Square feet", p.sqft)}${fact("Floor", p.floor)}${fact("Parking", p.parking)}${fact("Impact windows", p.impactWindows)}${fact("Days on market", p.daysOnMarket)}
    </div>${p.listingDiscrepancies?.length ? `<p class="muted" style="margin-top:.5rem">${esc(p.listingDiscrepancies.join(" "))}</p>` : ""}
    ${p.priceHistory?.length ? `<h3 style="margin-top:.8rem">Asking price history</h3><div class="tablewrap"><table><tbody>${p.priceHistory.map((h) => `<tr><td class="num">${esc(h.date)}</td><td class="num">${usd(h.price)}</td><td>${esc(h.event)}</td></tr>`).join("")}</tbody></table></div>` : ""}
    ${p.salesHistoryNote ? `<p class="muted" style="margin-top:.5rem">${esc(p.salesHistoryNote)}</p>` : ""}</div>
    <div><h3>Building</h3><div class="facts">
      ${fact("Name", b.name)}${fact("Year built", p.yearBuilt)}${fact("Habitable stories", b.habitableStories)}${fact("Units", b.unitsInBuilding)}${fact("Construction", b.construction)}${fact("Roof year / type", b.roofYear === "unknown" ? "unknown" : `${b.roofYear} ${b.roofType || ""}`)}${fact("Drain lines replaced", b.drainsReplaced)}${fact("Electrical panel", b.panelBrand)}${fact("Last recertification", b.recertYear)}${fact("Elevator", b.elevator ? "Yes" : "No")}
    </div>${b.habitableStoriesNote ? `<p class="muted" style="margin-top:.5rem">${esc(b.habitableStoriesNote)}</p>` : ""}${b.recertNote ? `<p class="muted">${esc(b.recertNote)}</p>` : ""}
    <h3 style="margin-top:.8rem">Association</h3><div class="facts">
      ${fact("Association", a.name)}${fact("Fee", p.hoaMonthly ? `$${p.hoaMonthly}/mo` : undefined)}${fact("Fee includes", a.feeIncludes)}${fact("Reserves", a.reservesUsd)}${fact("Special assessments", a.specialAssessments)}${fact("Master policy deductible", a.masterDeductible)}${fact("Litigation", a.litigation)}${fact("Rental minimum", a.rentalMinDays)}${fact("Pets", a.pets)}${fact("Age restriction", a.ageRestricted)}${fact("Delinquency", a.delinquencyPct)}${fact("Agency-warrantable", fin.warrantable)}
    </div></div></div>`;
}

function renderPlace(f) {
  const l = f.location || {}, d = f.demographics || {}, c = f.crime || {};
  const nearby = l.nearby?.length ? `<h3 style="margin-top:.8rem">Within a mile (OpenStreetMap)</h3><ul>${l.nearby.slice(0, 12).map((n) => `<li>${esc(n.name)} <span class="muted">${esc(n.kind)}, ${n.distanceFt.toLocaleString()} ft</span></li>`).join("")}</ul>` : "";
  return `<div class="cols">
    <div>${l.summary ? `<p>${esc(l.summary)}</p>` : ""}<div class="facts">
      ${fact("Neighborhood", l.neighborhood)}${fact("Beach", l.distanceToBeachFt ? `${l.distanceToBeachFt.toLocaleString()} ft` : undefined)}${fact("Walk / transit / bike", [l.walkScore, l.transitScore, l.bikeScore].filter((x) => x !== undefined).join(" / ") || undefined)}${fact("Transit", l.transit)}${fact("Commute", l.commute)}${fact("Airport noise", l.airport)}${fact("Schools", l.schools?.note)}
    </div>${nearby}</div>
    <div><h3>Hazards</h3><div class="facts">
      ${fact("Evacuation zone", l.evacuationZone)}${fact("FEMA flood zone", l.floodZone, l.baseFloodElevationFt ? `BFE ${l.baseFloodElevationFt} ft` : "")}${fact("Ground elevation", l.groundElevationFt !== undefined ? `${l.groundElevationFt} ft NAVD88` : l.elevationFt)}${fact("Finished-floor elevation", l.elevationFt)}${fact("Sea level trend", l.seaLevelTrend ? `${l.seaLevelTrend.mmPerYear} mm/yr at ${l.seaLevelTrend.station}` : "3.95 mm/yr at Virginia Key (NOAA)")}
    </div>${l.floodZoneNote ? `<p class="muted" style="margin-top:.5rem">${esc(l.floodZoneNote)}</p>` : ""}${l.firstStreet?.note ? `<p class="muted">${esc(l.firstStreet.note)}</p>` : ""}
    <h3 style="margin-top:.8rem">Who lives here</h3><div class="facts">
      ${fact("ZIP", d.zip)}${fact("Population", d.population2024 || d.population)}${fact("Median age", d.medianAge)}${fact("Median household income", d.medianHouseholdIncome ? usd(d.medianHouseholdIncome) : undefined)}${fact("Owner-occupied", d.ownerOccupiedPct ? d.ownerOccupiedPct + "%" : undefined)}${fact("Vacant (seasonal)", d.vacantPct ? d.vacantPct + "%" : undefined)}
    </div>${c.note ? `<h3 style="margin-top:.8rem">Crime</h3><div class="facts">${fact("Property crime, city", c.cityPropertyCrimePer1000 ? c.cityPropertyCrimePer1000 + " per 1,000" : undefined)}${fact("Violent crime, city", c.cityViolentPer100k ? c.cityViolentPer100k + " per 100k" : undefined)}</div><p class="muted" style="margin-top:.5rem">${esc(c.note)}</p>` : ""}
    </div></div>`;
}

function renderMarket(f) {
  const m = f.market || {}, comps = f.comps || [], r = f.rents;
  return `<div class="cols"><div><div class="facts">
    ${fact("City condo median", m.cityCondoMedianPrice ? `${usd(m.cityCondoMedianPrice)} (${m.cityCondoMedianPriceYoYPct > 0 ? "+" : ""}${m.cityCondoMedianPriceYoYPct ?? "?"}% YoY)` : undefined)}${fact("Months of supply", m.monthsOfSupply)}${fact("Active condo listings", m.activeCondoListings ? `${m.activeCondoListings} (${m.activeListingsYoYPct}% YoY)` : undefined)}${fact("Listing $/sq ft, city condos", m.medianPricePerSqft ? "$" + m.medianPricePerSqft : undefined)}${fact("Broward condo median", m.browardCondoMedian ? `${usd(m.browardCondoMedian)} (${m.browardCondoMedianYoYPct}% YoY)` : undefined)}${fact("ZIP median, all types", m.zip33062MedianAllTypes ? usd(m.zip33062MedianAllTypes) : undefined)}${fact("Days to sell, ZIP", m.zipDaysToSell)}
    </div>${m.note ? `<p class="muted" style="margin-top:.5rem">${esc(m.note)}</p>` : ""}${m.medianPricePerSqftNote ? `<p class="muted">${esc(m.medianPricePerSqftNote)}</p>` : ""}${m.vintageHeadwind ? `<p class="muted">${esc(m.vintageHeadwind)}</p>` : ""}
    ${r?.evidence ? `<h3 style="margin-top:.8rem">Rent evidence</h3><ul>${r.evidence.map((e) => `<li>${esc(e)}</li>`).join("")}</ul>` : ""}</div>
    <div>${comps.length ? `<h3>Comparables on this street</h3><div class="tablewrap"><table><thead><tr><th>Address</th><th>Bd/ba</th><th class="num">Sq ft</th><th class="num">Price</th><th>Status</th></tr></thead><tbody>${comps.map((c) => `<tr><td>${esc(c.address)}${c.note ? `<div class="muted">${esc(c.note)}</div>` : ""}</td><td>${c.beds}/${c.baths}</td><td class="num">${c.sqft?.toLocaleString() ?? ""}</td><td class="num">${c.price ? usd(c.price) : ""}${c.price && c.sqft ? `<div class="muted">$${Math.round(c.price / c.sqft)}/sf</div>` : ""}</td><td>${esc(c.status)}${c.hoa ? `<div class="muted">HOA $${c.hoa}</div>` : ""}</td></tr>`).join("")}</tbody></table></div>` : `<p class="muted">No comparables loaded.</p>`}
    ${f.development?.length ? `<h3 style="margin-top:.8rem">Nearby development</h3><ul>${f.development.map((d) => `<li><b>${esc(d.title)}</b><div class="muted">${esc(d.why)}</div></li>`).join("")}</ul>` : ""}</div></div>`;
}

function renderHistory(f) {
  const t = f.history?.timeline || [];
  return t.length ? `<ul class="timeline">${t.map((e) => `<li><span class="yr num">${e.year}</span><span>${esc(e.event)}</span></li>`).join("")}</ul>` : `<p class="muted">No history loaded. Add the Property Appraiser sales history and permit history to the facts file.</p>`;
}

function renderChecklist(r) {
  const groups = [...new Set(r.checklist.map((c) => c.group))];
  return `<div class="checklist">${groups.map((g) => `<div class="group-title">${esc(g)}</div>${r.checklist.filter((c) => c.group === g).map((c) => `<label><input type="checkbox" data-ck="${c.id}"><span>${esc(c.ask)}<div class="who">${esc(c.who)}</div></span></label>`).join("")}`).join("")}</div>`;
}

function wireChecklist() {
  const key = "dossier-ck-" + (state.report.facts.meta?.id || "x");
  let done = {};
  try { done = JSON.parse(localStorage.getItem(key) || "{}"); } catch {}
  document.querySelectorAll("[data-ck]").forEach((cb) => {
    cb.checked = Boolean(done[cb.dataset.ck]);
    cb.closest("label").classList.toggle("done", cb.checked);
    cb.addEventListener("change", () => {
      done[cb.dataset.ck] = cb.checked;
      cb.closest("label").classList.toggle("done", cb.checked);
      try { localStorage.setItem(key, JSON.stringify(done)); } catch {}
    });
  });
}

function renderSources(f, r) {
  const prov = r.provenance?.length ? `<p class="prov">Live layers: ${r.provenance.map((p) => `<span>${esc(p.source)}: ${p.status}${p.error ? ` (${esc(p.error)})` : ""}</span>`).join("")}</p>` : "";
  return `${prov}<ol class="sources">${(f.sources || []).map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a></li>`).join("")}</ol><p class="muted" style="margin-top:.8rem">Reference tables (millage, condo statutes, lending rules, sea level) as of ${esc(r.reference.florida.asOf)}.</p>`;
}

// ---- deals ----
const CANDIDATES_URL = "../data/candidates/south-florida-2026-10.json";
let pool = null;

async function loadPool() {
  if (pool) return pool;
  const data = window.DOSSIER_CANDIDATES || (await (await fetch(CANDIDATES_URL)).json());
  const sample = window.DOSSIER_SAMPLE || (await (await fetch(SAMPLE_URL)).json());
  let mine = [];
  try { mine = JSON.parse(localStorage.getItem("dossier-pool") || "[]"); } catch {}
  pool = [structuredClone(sample), ...data.candidates, ...mine];
  return pool;
}

function readProfile() {
  const f = $("#profile-form");
  const data = Object.fromEntries(new FormData(f).entries());
  const types = [...$("#p-types").selectedOptions].map((o) => o.value);
  const hub = HUBS.find((h) => h.id === data.hub);
  const p = {
    grossAnnualIncome: Number(data.grossAnnualIncome), monthlyDebts: Number(data.monthlyDebts) || 0, cashAvailable: Number(data.cashAvailable),
    household: Number(data.household) || 1, minBeds: data.minBeds ? Number(data.minBeds) : undefined, loanType: data.loanType, preferredDownPct: Number(data.preferredDownPct),
    rate: Number(data.ratePct) / 100, types, minGrade: data.minGrade || undefined, maxCommuteMin: Number(data.maxCommuteMin) || undefined,
    homestead: $("#p-homestead").checked, workAddress: data.workAddress, hub: data.hub,
    work: hub ? { lat: hub.lat, lon: hub.lon, name: hub.name } : undefined,
  };
  return p;
}

function fillProfile(p) {
  if (!p) return;
  const set = (id, v) => { const el = $(id); if (el && v !== undefined && v !== null) el.value = v; };
  set("#p-income", p.grossAnnualIncome); set("#p-debts", p.monthlyDebts); set("#p-cash", p.cashAvailable); set("#p-household", p.household); set("#p-beds", p.minBeds ?? "");
  set("#p-loan", p.loanType); set("#p-down", String(p.preferredDownPct ?? 0.2)); set("#p-rate", p.rate ? (p.rate * 100).toFixed(2) : "7.32"); set("#p-grade", p.minGrade || ""); set("#p-commute", p.maxCommuteMin ?? 45);
  set("#p-hub", p.hub || ""); set("#p-work", p.workAddress || ""); $("#p-homestead").checked = p.homestead !== false;
  if (p.types) [...$("#p-types").options].forEach((o) => (o.selected = p.types.includes(o.value)));
}

async function geocodeWork(address) {
  if (!address) return null;
  try {
    const res = await fetch(`/api/geocode?address=${encodeURIComponent(address)}`);
    if (!res.ok) return null;
    const g = await res.json();
    return g.status === "live" ? { lat: g.data.lat, lon: g.data.lon, name: g.data.matched } : null;
  } catch { return null; }
}

async function runDeals() {
  const profile = readProfile();
  const status = $("#deals-status");
  status.textContent = "Working…";
  if (profile.workAddress) {
    const g = await geocodeWork(profile.workAddress);
    if (g) profile.work = g;
    else if (!profile.work) status.textContent = "Could not look up the work address (no server). Pick a hub from the list for commute times.";
  }
  try { localStorage.setItem("dossier-profile", JSON.stringify(profile)); } catch {}
  const cands = await loadPool();
  const result = findDeals(profile, cands);
  if (status.textContent === "Working…") status.textContent = "";
  renderDeals(profile, result);
  $("#deals").hidden = false;
  $("#report").hidden = true;
  $("#deals").scrollIntoView({ behavior: "smooth" });
}

function renderDeals(profile, r) {
  const b = r.budget;
  const condoMax = maxPrice(profile, { type: "condo", sqft: 1000, hoaMonthly: 450, city: "Pompano Beach" });
  const houseMax = maxPrice(profile, { type: "house", sqft: 1400, hoaMonthly: 0, city: "Pompano Beach" });
  const stretch = maxPrice(profile, { type: "condo", sqft: 1000, hoaMonthly: 450, city: "Pompano Beach" }, "stretch");
  const workName = profile.work?.name ? ` · work: ${profile.work.name}` : "";
  const gradeNote = r.relaxedGradeFloor ? `<p class="muted">Nothing in the pool has every grade at ${esc(profile.minGrade)} or better, mostly because reserves, roof age and master insurance are unknown until you ask. Showing everything that fits your budget instead, ranked.</p>` : "";
  const dealCard = (d, i) => `
    <article class="deal" id="deal-${esc(d.id)}">
      <div><h3>${i !== undefined ? `${i + 1}. ` : ""}${esc(d.title)}</h3>
        <div class="meta num">${usd(d.price)} · ${d.beds ?? "?"} bd / ${d.baths ?? "?"} ba · ${d.sqft ? d.sqft.toLocaleString() + " sq ft" : "size unknown"} · ${d.yearBuilt && d.yearBuilt !== "unknown" ? "built " + d.yearBuilt : "year built unknown"} · ${esc(d.type)}</div>
        <div class="meta num">Housing ${usd(d.afford.housing)}/mo (${d.afford.frontPct}% of income, ${d.afford.backPct}% with debts) · ${d.afford.downPct}% down · ${usd(d.afford.cashToClose)} to close${d.commute ? ` · ${d.commute.peakMin} min to work` : ""}</div></div>
      <div class="score"><div class="n num">${d.score}</div><div class="l ${esc(d.label.split(" ")[0])}">${esc(d.label)}</div></div>
      <div class="fitbar" title="Housing cost against your comfortable limit"><span class="${d.afford.tier}" style="width:${Math.min(100, (d.afford.housing / Math.max(1, b.comfortableHousing)) * 100)}%"></span></div>
      <div class="gradechips">${Object.entries(d.grades).map(([k, g]) => `<span class="gchip" data-g="${g}"><b>${g}</b> ${esc(GRADE_LABEL[k] || k)}</span>`).join("")}</div>
      <ul>${d.reasons.map((x) => `<li>${esc(x)}</li>`).join("")}${d.exclusions.map((x) => `<li><b>Why it is out:</b> ${esc(x)}</li>`).join("")}</ul>
      <div class="actions2"><button type="button" class="btn ghost open-dossier" data-id="${esc(d.id)}">Open full dossier</button><span class="muted">${esc(d.source || "")}${d.seenOn ? `, seen ${esc(d.seenOn)}` : ""}. Verify status on the MLS before acting.</span></div>
    </article>`;
  $("#deals").innerHTML = `
    <section class="band">
      <h2>Your budget</h2>
      <p class="muted num">Income ${usd(b.monthlyIncome)}/mo gross${workName}. Comfortable housing cost (28% front / 36% back): <b>${usd(b.comfortableHousing)}/mo</b>. Stretch (31/43): ${usd(b.stretchHousing)}/mo. Cash on hand ${usd(b.cashAvailable)}; minimum down ${Math.round(b.minDownPct * 1000) / 10}%.</p>
      <div class="budget">
        <div class="tile"><div class="k">Comfortable max, condo (HOA $450)</div><div class="v num">${usd(condoMax.price)}</div><div class="k">${condoMax.price ? Math.round(condoMax.downPct * 100) + "% down, " + usd(condoMax.cashNeeded) + " to close" : esc(condoMax.reason || "")}</div></div>
        <div class="tile"><div class="k">Comfortable max, house (no HOA)</div><div class="v num">${usd(houseMax.price)}</div><div class="k">${houseMax.price ? Math.round(houseMax.downPct * 100) + "% down" : esc(houseMax.reason || "")}</div></div>
        <div class="tile"><div class="k">Stretch max, condo</div><div class="v num">${usd(stretch.price)}</div><div class="k">Needs underwriting approval; leaves little slack for assessments</div></div>
        <div class="tile"><div class="k">Bedrooms you need</div><div class="v num">${r.minBeds}+</div><div class="k">for ${profile.household} ${profile.household === 1 ? "person" : "people"}</div></div>
      </div>
      <p class="muted">The maximums assume a typical home shape; each listing below is priced on its own taxes, HOA and insurance. House insurance uses a coastal HO-3 planning range ($4,500 to $8,500/yr), which is why houses cost more to carry than their price suggests.</p>
    </section>
    <section class="band">
      <h2>${r.ranked.length} ${r.ranked.length === 1 ? "home fits" : "homes fit"}${profile.minGrade && !r.relaxedGradeFloor ? ` with every grade ${esc(profile.minGrade)} or better` : ""}</h2>
      ${gradeNote}
      <div class="deals">${r.ranked.map((d, i) => dealCard(d, i)).join("") || `<p class="muted">Nothing in the pool fits. Loosen the bedroom count, commute, or home types, or add listings from a report page.</p>`}</div>
    </section>
    <section class="band">
      <details class="excluded"><summary>${r.excluded.length} homes that do not fit, and why</summary><div class="deals" style="margin-top:.75rem">${r.excluded.map((d) => dealCard(d)).join("")}</div></details>
      <p class="muted" style="margin-top:.8rem">Pool: ${pool.length} homes seen on public listing sites on 2026-10-21 plus any you add. Open any report and use "Add to my pool" to score a listing you found.</p>
    </section>`;
  $("#deals").querySelectorAll(".open-dossier").forEach((btn) => btn.addEventListener("click", () => {
    const d = [...r.ranked, ...r.excluded].find((x) => x.id === btn.dataset.id);
    if (!d) return;
    $("#deals").hidden = true; $("#report").hidden = false;
    render(buildReport(d.facts, { carry: { downPct: d.afford.downPct / 100, rate: b.rate, homestead: profile.homestead !== false, loanType: profile.loanType } }));
    window.scrollTo({ top: 0 });
  }));
}

const GRADE_LABEL = { price: "Price", carry: "Cost", building: "Building", association: "Association", hazard: "Hazards", location: "Location", resale: "Resale" };

function addToPool(facts) {
  let mine = [];
  try { mine = JSON.parse(localStorage.getItem("dossier-pool") || "[]"); } catch {}
  if (!mine.find((m) => m.meta?.id === facts.meta?.id)) mine.push(facts);
  try { localStorage.setItem("dossier-pool", JSON.stringify(mine)); } catch {}
  pool = null;
}

$("#show-deals").addEventListener("click", () => {
  const p = $("#deals-panel"); p.hidden = !p.hidden; $("#form-panel").hidden = true;
  if (!p.hidden) { try { fillProfile(JSON.parse(localStorage.getItem("dossier-profile") || "null")); } catch {} p.scrollIntoView({ behavior: "smooth" }); }
});
$("#profile-form").addEventListener("submit", (e) => { e.preventDefault(); runDeals(); });
$("#p-household").addEventListener("change", () => { $("#p-beds").placeholder = `auto: ${defaultMinBeds($("#p-household").value)}`; });
for (const h of HUBS) { const o = document.createElement("option"); o.value = h.id; o.textContent = h.name; $("#p-hub").appendChild(o); }

// ---- form ----
$("#new-report").addEventListener("click", () => { const p = $("#form-panel"); p.hidden = !p.hidden; $("#deals-panel").hidden = true; if (!p.hidden) p.scrollIntoView({ behavior: "smooth" }); });
$("#load-sample").addEventListener("click", () => { $("#form-panel").hidden = true; loadSample(); });
$("#listing-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target).entries());
  data.barrierIsland = $("#f-island").checked;
  let facts = factsFromListing(data);
  const status = $("#enrich-status");
  status.textContent = "Checking public records…";
  try {
    const res = await fetch("/api/enrich", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(facts) });
    if (res.ok) { facts = await res.json(); status.textContent = "Public layers added."; } else status.textContent = "No server: report built from the listing facts only.";
  } catch { status.textContent = "No server: report built from the listing facts only."; }
  $("#form-panel").hidden = true;
  $("#deals").hidden = true; $("#report").hidden = false;
  render(buildReport(facts));
  window.scrollTo({ top: 0 });
});

loadSample();
