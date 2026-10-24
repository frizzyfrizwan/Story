// Dimension grades. Each grade is A to F with a one-line reason, derived from facts and watch items.
// The verdict is a plain-language stance, not a number, because a single score hides the trade-offs.

export function grade(facts, watch, carry) {
  const p = facts.property || {};
  const loc = facts.location || {};
  const mk = facts.market || {};
  const sev = (id) => watch.find((w) => w.id === id)?.severity;
  const count = (s) => watch.filter((w) => w.severity === s).length;

  const dims = [];

  // Price vs market
  {
    const ppsf = p.listPrice && p.sqft ? p.listPrice / p.sqft : null;
    const mkt = mk.medianPricePerSqft;
    let g = "C", why = "No market price-per-square-foot comparison available.";
    if (ppsf && mkt) {
      const ratio = ppsf / mkt;
      g = ratio < 0.8 ? "A" : ratio < 0.95 ? "B" : ratio < 1.1 ? "C" : "D";
      why = `$${Math.round(ppsf)}/sq ft asked against about $${Math.round(mkt)}/sq ft for comparable listings nearby. ${sev("price-cuts") ? "Multiple price cuts already taken." : ""}`.trim();
    }
    dims.push({ key: "price", label: "Asking price", grade: g, why });
  }
  // Carrying cost: the costs that belong to the home (taxes, HOA, insurance, utilities), not to your mortgage rate.
  {
    const own = carry ? carry.totalMonthlyExcludingMortgage : null;
    const ratio = own && p.listPrice ? (own * 12) / p.listPrice : null;
    let g = "C", why = "Carrying cost not modeled.";
    if (ratio) {
      g = ratio < 0.03 ? "A" : ratio < 0.042 ? "B" : ratio < 0.055 ? "C" : "D";
      why = `About $${own.toLocaleString()}/mo in taxes, HOA, insurance and utilities (${(ratio * 100).toFixed(1)}% of price per year) on top of $${carry.totalMonthly - own}/mo of mortgage${carry.monthly.pmi ? " and PMI" : ""} at ${Math.round(carry.assumptions.downPct * 100)}% down.${carry.assumptions.hoaEstimated ? " HOA is an estimate." : ""}`;
    }
    dims.push({ key: "carry", label: "Cost to own", grade: g, why });
  }
  // Building condition
  {
    const age = p.yearBuilt ? new Date().getFullYear() - p.yearBuilt : null;
    const unknowns = ["cast-iron", "roof", "electrical", "windows"].filter((id) => watch.find((w) => w.id === id && w.confidence !== "high")).length;
    let g = age === null ? "C" : age >= 50 ? "D" : age >= 30 ? "C" : age >= 10 ? "B" : "A";
    if (facts.building?.drainsReplaced && facts.building?.roofYear && new Date().getFullYear() - facts.building.roofYear < 10 && g === "D") g = "C";
    const kind = p.type === "house" ? "house" : p.type === "townhouse" ? "townhouse" : "building";
    dims.push({ key: "building", label: "Building", grade: g, why: age === null ? `Year built unknown; ${unknowns} major systems have no documented replacement date.` : `${age}-year-old ${kind}. ${unknowns} major systems have no documented replacement date.` });
  }
  // Association health (a house with no association gets a pass on this dimension)
  {
    if (p.type === "house" && !p.hoaMonthly) {
      dims.push({ key: "association", label: "Association", grade: "A", why: "No association. You control the maintenance budget, and you carry all of it." });
    } else {
      const bad = ["fee-low", "reserves", "sa", "master"].filter((id) => ["high", "critical"].includes(sev(id))).length;
      const g = bad === 0 ? "B" : bad <= 2 ? "D" : "F";
      dims.push({ key: "association", label: "Association", grade: g, why: bad ? `${bad} of 4 core financial facts are missing or alarming (fee level, reserves, assessments, master insurance).` : "Core financial facts documented." });
    }
  }
  // Hazards
  {
    let g = "C";
    if (loc.evacuationZone === "B") g = "C";
    if (loc.evacuationZone === "C" || loc.evacuationZone === "none") g = "B";
    if (loc.barrierIsland || loc.evacuationZone === "A") g = "D";
    if (/^V/.test(loc.floodZone || "")) g = "F";
    if (/^X/.test(loc.floodZone || "") && !loc.barrierIsland) g = "B";
    dims.push({ key: "hazard", label: "Hazards", grade: g, why: `${loc.barrierIsland ? "Barrier island, evacuation zone A." : ""} Flood zone ${loc.floodZone || "unconfirmed"}. Extreme wind and heat exposure.`.trim() });
  }
  // Location and lifestyle
  {
    const g = loc.walkScore >= 70 ? "A" : loc.distanceToBeachFt && loc.distanceToBeachFt < 1500 ? "A" : loc.walkScore >= 50 ? "B" : loc.walkScore ? "C" : "C";
    dims.push({ key: "location", label: "Location", grade: g, why: loc.summary || (loc.neighborhood ? `${loc.neighborhood}.` : "No location summary.") });
  }
  // Liquidity / resale
  {
    let g = "C";
    if (sev("warrantable") === "critical") g = "D";
    if (mk.monthsOfSupply > 8) g = g === "D" ? "D" : "C";
    dims.push({ key: "resale", label: "Resale and financing", grade: g, why: `${mk.monthsOfSupply ? mk.monthsOfSupply + " months of condo supply." : ""} ${sev("warrantable") ? "Agency financing unconfirmed; a non-warrantable verdict halves the buyer pool." : ""}`.trim() });
  }

  const verdict = buildVerdict(facts, watch, dims, count);
  return { dimensions: dims, verdict };
}

function buildVerdict(facts, watch, dims, count) {
  const p = facts.property || {};
  const crit = count("critical");
  const high = count("high");
  const location = dims.find((d) => d.key === "location")?.grade;
  const assoc = dims.find((d) => d.key === "association")?.grade;
  const stance = crit > 0 || assoc === "F" ? "Conditional" : high > 4 ? "Proceed with caution" : "Reasonable";
  const lines = [];
  const ageText = p.yearBuilt ? `in a ${new Date().getFullYear() - p.yearBuilt}-year-old ${p.type === "house" ? "house" : "building"}` : `${p.type === "house" ? "house" : "unit"} of unknown age`;
  lines.push(`${stance}. ${p.beds ?? "?"}-bed, ${p.baths ?? "?"}-bath ${p.type === "house" ? "" : "unit "}${ageText}, ${location === "A" ? "in a location that is hard to replace" : "in a decent location"}, asking $${p.listPrice?.toLocaleString()}.`);
  if (crit) lines.push(`${crit} item${crit > 1 ? "s" : ""} could end the deal: ${watch.filter((w) => w.severity === "critical").map((w) => w.title.toLowerCase()).join("; ")}.`);
  lines.push(`${high} high-priority items need documents or an inspection before the contingency period ends. The price already reflects some of this; it does not reflect a special assessment or a non-warrantable verdict.`);
  return { stance, summary: lines.join(" ") };
}
