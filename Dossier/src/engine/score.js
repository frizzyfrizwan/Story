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
  // Carrying cost
  {
    const ratio = carry?.totalMonthly && p.listPrice ? (carry.totalMonthly * 12) / p.listPrice : null;
    let g = "C", why = "Carrying cost not modeled.";
    if (ratio) {
      g = ratio < 0.07 ? "A" : ratio < 0.085 ? "B" : ratio < 0.1 ? "C" : "D";
      why = `About $${carry.totalMonthly.toLocaleString()}/mo all-in at 20% down, ${(ratio * 100).toFixed(1)}% of price per year. HOA is cheap today; the model assumes it will not stay cheap.`;
    }
    dims.push({ key: "carry", label: "Cost to own", grade: g, why });
  }
  // Building condition
  {
    const age = p.yearBuilt ? new Date().getFullYear() - p.yearBuilt : null;
    const unknowns = ["cast-iron", "roof", "electrical", "windows"].filter((id) => watch.find((w) => w.id === id && w.confidence !== "high")).length;
    let g = age >= 50 ? "D" : age >= 30 ? "C" : "B";
    if (facts.building?.drainsReplaced && facts.building?.roofYear && new Date().getFullYear() - facts.building.roofYear < 10) g = "B";
    dims.push({ key: "building", label: "Building", grade: g, why: `${age}-year-old low-rise. ${unknowns} major systems have no documented replacement date.` });
  }
  // Association health
  {
    const bad = ["fee-low", "reserves", "sa", "master"].filter((id) => ["high", "critical"].includes(sev(id))).length;
    const g = bad === 0 ? "B" : bad <= 2 ? "D" : "F";
    dims.push({ key: "association", label: "Association", grade: g, why: bad ? `${bad} of 4 core financial facts are missing or alarming (fee level, reserves, assessments, master insurance).` : "Core financial facts documented." });
  }
  // Hazards
  {
    let g = "C";
    if (loc.barrierIsland) g = "D";
    if (/^V/.test(loc.floodZone || "")) g = "F";
    if (/^X/.test(loc.floodZone || "") && !loc.barrierIsland) g = "B";
    dims.push({ key: "hazard", label: "Hazards", grade: g, why: `${loc.barrierIsland ? "Barrier island, evacuation zone A." : ""} Flood zone ${loc.floodZone || "unconfirmed"}. Extreme wind and heat exposure.`.trim() });
  }
  // Location and lifestyle
  {
    const g = loc.walkScore >= 70 ? "A" : loc.distanceToBeachFt && loc.distanceToBeachFt < 1500 ? "A" : loc.walkScore >= 50 ? "B" : "C";
    dims.push({ key: "location", label: "Location", grade: g, why: loc.summary || "No location summary." });
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
  lines.push(`${stance}. ${p.beds}-bed, ${p.baths}-bath unit in a ${new Date().getFullYear() - p.yearBuilt}-year-old building, ${location === "A" ? "in a location that is hard to replace" : "in a decent location"}, asking $${p.listPrice?.toLocaleString()}.`);
  if (crit) lines.push(`${crit} item${crit > 1 ? "s" : ""} could end the deal: ${watch.filter((w) => w.severity === "critical").map((w) => w.title.toLowerCase()).join("; ")}.`);
  lines.push(`${high} high-priority items need documents or an inspection before the contingency period ends. The price already reflects some of this; it does not reflect a special assessment or a non-warrantable verdict.`);
  return { stance, summary: lines.join(" ") };
}
