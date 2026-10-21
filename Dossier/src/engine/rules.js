// Rules engine: turns facts into watch items on a time horizon.
// A rule may fire on a known fact, or on an unknown one (then it asks for the fact).
// Horizons: now (before closing), 1-3y, 3-10y, 10-30y.
// Severity: critical > high > watch > info. "verify" marks items that depend on an unknown.
import { FLORIDA, LIFECYCLES } from "../knowledge/florida.js";

const YEAR = new Date().getFullYear();

const unknown = (v) => v === undefined || v === null || v === "unknown";

export function runRules(facts) {
  const items = [];
  const add = (item) => items.push({ confidence: "high", ...item });
  const p = facts.property || {};
  const loc = facts.location || {};
  const b = facts.building || {};
  const a = facts.association || {};
  const mk = facts.market || {};
  const fin = facts.financing || {};
  const age = p.yearBuilt ? YEAR - p.yearBuilt : null;
  const isCondo = p.type === "condo";

  // ---------- Listing integrity ----------
  if (p.listingDiscrepancies?.length) {
    add({
      id: "listing-discrepancy", horizon: "now", severity: "high", title: "Listing facts disagree across sites",
      why: p.listingDiscrepancies.join(" "),
      action: "Pull the Property Appraiser record and the condo declaration exhibit for the unit; price on the recorded square footage and bath count.",
    });
  }
  if (p.priceHistory?.length >= 2) {
    const first = p.priceHistory[0].price;
    const last = p.priceHistory[p.priceHistory.length - 1].price;
    const cut = Math.round((1 - last / first) * 100);
    if (cut >= 10) {
      add({
        id: "price-cuts", horizon: "now", severity: "watch", title: `Asking price cut ${cut}% since first listing`,
        why: `From $${first.toLocaleString()} to $${last.toLocaleString()} over ${p.priceHistory.length - 1} reductions. Long market time plus repeated cuts means the seller is motivated and buyers who looked walked away, often after reading the condo documents or getting a lending answer.`,
        action: "Ask the agent why earlier contracts fell through. Offer below asking with a financing and document-review contingency.",
      });
    }
  }
  if (p.daysOnMarket && p.daysOnMarket > 120) {
    add({
      id: "dom", horizon: "now", severity: "watch", title: `${p.daysOnMarket}+ days on market`,
      why: `Median market time for condos in this market is far shorter. Stale listings carry negotiating room and, sometimes, a reason.`,
      action: "Negotiate. Ask for the seller's own inspection reports and any prior buyer's inspection findings.",
    });
  }
  if (p.zestimateMissing) {
    add({
      id: "no-avm", horizon: "now", severity: "info", title: "No automated valuation shown",
      why: "Zillow shows no Zestimate for this unit. Thin sales data in the building, conflicting records, or an unusual unit mix can cause that. It also means appraisal risk if you finance.",
      action: "Order a pre-offer broker price opinion or pay for an appraisal early.",
    });
  }

  // ---------- Building age and systems ----------
  if (age !== null) {
    if (age >= 50) {
      add({
        id: "age", horizon: "now", severity: "high", title: `${age}-year-old building`,
        why: "Original drain lines, electrical risers, roofing and waterproofing are all past or near their design life unless replaced. The HOA budget has to carry those replacements or they land as special assessments.",
        action: "Get the capital-improvement history in writing: roof, re-pipe, electrical, waterproofing, paving, seawall.",
      });
    }
    if (p.yearBuilt < 1975 && unknown(b.drainsReplaced)) {
      add({
        id: "cast-iron", horizon: "1-3y", severity: "high", confidence: "medium", title: "Cast-iron drain lines likely original",
        why: `${LIFECYCLES.castIronDrain.note} At ${age} years these are past the ${LIFECYCLES.castIronDrain.life}-year mark. Failures show up as slow drains, sewer smell, and slab leaks; building-wide repipes in small South Florida buildings run $8,000 to $25,000 per unit.`,
        action: "Pay for a sewer camera scope of the unit line and ask the board for the building's drain-line assessment.",
      });
    }
    if (p.yearBuilt < 1980 && unknown(b.panelBrand)) {
      add({
        id: "electrical", horizon: "now", severity: "watch", confidence: "medium", title: "Electrical panel and service age",
        why: LIFECYCLES.electricalPanel.note + " Insurers also price 60-year-old service equipment harshly.",
        action: "Have the inspector photograph the unit panel and the main service; confirm the electrical recertification date.",
      });
    }
    if (p.yearBuilt >= LIFECYCLES.aluminumWiringEra[0] && p.yearBuilt <= LIFECYCLES.aluminumWiringEra[1]) {
      add({ id: "aluminum", horizon: "now", severity: "watch", title: "Aluminum branch wiring era", why: "Built in the 1965 to 1973 window when aluminum branch wiring was common.", action: "Inspector to check receptacles; insurers require copper pigtails." });
    }
    if (unknown(b.roofYear)) {
      add({
        id: "roof", horizon: "3-10y", severity: "watch", confidence: "medium", title: "Roof age unknown",
        why: `Low-rise 1960s Florida condos usually carry flat modified-bitumen or tile roofs. Flat roofs last about ${LIFECYCLES.flatRoofModifiedBitumen.life} years; carriers now refuse or surcharge roofs older than 15 to 20 years, which flows into the master policy and your HOA fee.`,
        action: "Get the roof permit history from the city permit portal and the master policy's roof schedule.",
      });
    } else {
      const roofAge = YEAR - b.roofYear;
      const life = b.roofType === "tile" ? LIFECYCLES.tileRoof.life : LIFECYCLES.flatRoofModifiedBitumen.life;
      const left = life - roofAge;
      add({
        id: "roof", horizon: left <= 3 ? "1-3y" : left <= 10 ? "3-10y" : "10-30y", severity: left <= 3 ? "high" : "watch",
        title: `Roof replaced ${b.roofYear}: about ${Math.max(0, left)} years of life left`,
        why: `Typical life for this roof type is about ${life} years.`, action: "Confirm the reserve line for roofing covers the replacement.",
      });
    }
    if (unknown(p.impactWindows)) {
      add({
        id: "windows", horizon: "now", severity: "watch", confidence: "medium", title: "Impact protection unknown",
        why: "Opening protection drives both your HO-6 wind premium and the building's master policy. Non-impact windows on the coast also mean shutters every storm.",
        action: "Ask for the wind mitigation report (OIR-B1-1802) for the building and the unit.",
      });
    }
    // Broward 40/50-year recertification cadence
    if (loc.county === "Broward" && age >= FLORIDA.browardRecert.firstAtYears) {
      const firstDue = p.yearBuilt + FLORIDA.browardRecert.firstAtYears;
      let next = firstDue;
      while (next <= YEAR) next += FLORIDA.browardRecert.repeatEveryYears;
      const last = next - FLORIDA.browardRecert.repeatEveryYears;
      add({
        id: "recert", horizon: next - YEAR <= 3 ? "1-3y" : "3-10y", severity: "high", title: `Broward recertification: last due ${last}, next due ${next}`,
        why: `${FLORIDA.browardRecert.note} The ${last} report (structural and electrical) tells you what an engineer found and what the board was ordered to fix. The ${next} cycle will produce the next repair list.`,
        action: `Obtain the ${last} recertification report and proof the city closed it out. Budget for ${next}.`,
      });
    }
  }

  // ---------- Florida condo law ----------
  if (isCondo) {
    const stories = b.habitableStories;
    if (unknown(stories)) {
      add({
        id: "stories", horizon: "now", severity: "high", title: "Confirm habitable stories: it decides which state inspection laws apply",
        why: "Three or more habitable stories triggers the milestone inspection and the Structural Integrity Reserve Study (SIRS), with reserves that cannot be waived. Under three stories, reserves can still be waived by vote, which is how low fees stay low.",
        action: "Ask the association; the declaration's survey exhibit shows it.",
      });
    } else if (stories >= FLORIDA.condoLaw.milestoneInspection.appliesToHabitableStories) {
      add({
        id: "milestone", horizon: "now", severity: "critical", title: "Milestone inspection and SIRS required",
        why: `Building age ${age} is past the ${FLORIDA.condoLaw.milestoneInspection.ageYears}-year trigger. SIRS reserves had to be funded in the budget from ${FLORIDA.condoLaw.sirs.fundingStarts}.`,
        action: "Get the Phase 1 (and Phase 2 if ordered) milestone report and the SIRS. No report means non-compliance and a DBPR enforcement risk.",
      });
    } else {
      add({
        id: "exempt-sirs", horizon: "now", severity: "watch", title: "Exempt from milestone inspection and SIRS, so reserves can be waived",
        why: FLORIDA.condoLaw.nonSirsReserves.note,
        action: "Read the last three budgets for 'reserves waived' or 'partially funded' votes.",
      });
    }

    // Fee adequacy heuristic: dollars per sqft per month vs what a coastal building this age needs.
    if (p.hoaMonthly && p.sqft && age !== null) {
      const perSqft = p.hoaMonthly / p.sqft;
      const needed = age >= 50 ? 0.55 : age >= 30 ? 0.45 : 0.35; // $/sqft/month incl. insurance and reserves, small coastal low-rise
      if (perSqft < needed * 0.6) {
        add({
          id: "fee-low", horizon: "1-3y", severity: "high", title: `HOA fee of $${p.hoaMonthly}/mo looks too low for this building`,
          why: `That is $${perSqft.toFixed(2)} per sq ft per month. A ${age}-year-old coastal low-rise with insurance, water, reserves and a roof to replace typically needs $${needed.toFixed(2)} or more. Low fees are usually either waived reserves, a self-insured or thinly insured master policy, or utilities billed separately. Expect the fee to rise or a special assessment to appear.`,
          action: `Model the fee at $${Math.round(needed * p.sqft)}/mo and ask what is excluded (water, insurance, reserves).`,
        });
      }
    }
    if (unknown(a.reservesUsd)) {
      add({ id: "reserves", horizon: "now", severity: "high", title: "Reserve balance unknown", why: "Reserves are the difference between a fee increase and a five-figure special assessment.", action: "Year-end balance sheet and the current budget's reserve schedule." });
    }
    if (unknown(a.masterDeductible)) {
      add({ id: "master", horizon: "now", severity: "high", title: "Master insurance terms unknown", why: `Master policy wind deductibles of 5% to 10% of insured value are common now, and the per-unit share can reach $10,000 to $50,000 after a storm. From ${FLORIDA.lending.masterDeductibleCapPerUnitUsd.from} agency lenders cap the per-unit deductible at $${FLORIDA.lending.masterDeductibleCapPerUnitUsd.amount.toLocaleString()}.`, action: "Get the master declarations page; buy loss-assessment coverage on your HO-6." });
    }
    if (unknown(a.rentalMinDays) || unknown(a.pets) || unknown(a.ageRestricted)) {
      add({ id: "rules", horizon: "now", severity: "watch", title: "Rental, pet and age rules unknown", why: "Neighboring buildings on this street list no pets and seasonal minimums; some 1960s buildings on this coast are 55+. Each rule changes who can buy from you later.", action: "Rules and FAQ sheet from the 718.503 package." });
    }
    if (unknown(a.specialAssessments)) {
      add({ id: "sa", horizon: "now", severity: "high", title: "Special assessment status unknown", why: "Assessments already voted follow the unit; assessments under discussion appear only in the minutes.", action: "Estoppel certificate plus 24 months of minutes." });
    }
    // Lending
    if (unknown(fin.warrantable)) {
      add({
        id: "warrantable", horizon: "now", severity: "critical", title: "Agency financing may not be available",
        why: `Fannie Mae and Freddie Mac retired the Limited Review on ${FLORIDA.lending.limitedReviewRetired}. A full review needs reserves of at least ${FLORIDA.lending.minReservesPctOfBudget}% of the budget (${FLORIDA.lending.minReservesPctOfBudgetFrom.pct}% from ${FLORIDA.lending.minReservesPctOfBudgetFrom.date}), adequate master insurance, no significant deferred maintenance, and delinquencies under ${FLORIDA.lending.delinquencyRedFlagPct}%. A ${age}-year-old building with a $${p.hoaMonthly}/mo fee is exactly the profile that fails. If it fails, your buyer pool at resale is cash and portfolio loans.`,
        action: "Have the lender complete the condo questionnaire and project review before the financing contingency expires. Price a portfolio loan as a fallback.",
      });
    }
    // Termination / redevelopment on a large parcel
    if (p.lotAcres && p.lotAcres >= 0.5 && age >= 50 && loc.barrierIsland) {
      add({
        id: "termination", horizon: "10-30y", severity: "watch", title: "Redevelopment and condo-termination exposure",
        why: `${p.lotAcres} acres on a barrier island one block from the beach, under a ${age}-year-old low-rise, is worth more as land to a developer than as the sum of its units. ${FLORIDA.condoLaw.termination.note} That can be a windfall or a forced sale at an appraised price you did not choose.`,
        action: "Read the declaration's termination clause and check whether any owner or LLC is accumulating units.",
      });
    }
  }

  // ---------- Hazards ----------
  if (loc.evacuationZone === "A") {
    add({ id: "evac", horizon: "now", severity: "high", title: "Evacuation Zone A", why: FLORIDA.evacuation.Broward.A + " You will be ordered out for every hurricane that threatens, which also means Zone A traffic, shutters, and a week without power on return.", action: "Have a plan and a place to go. Budget for generator-free living." });
  }
  if (unknown(loc.floodZone)) {
    add({ id: "flood-zone", horizon: "now", severity: "high", title: "FEMA flood zone not confirmed", why: "New coastal maps took effect July 31, 2024. Barrier-island parcels here are usually AE (base flood elevation about 6 to 7 ft) with pockets of X on the ridge. Zone decides lender flood insurance requirements and the NFIP price.", action: "FEMA Map Service Center lookup, then the city Building Division; request the elevation certificate." });
  } else if (/^(A|V)/.test(loc.floodZone)) {
    add({ id: "flood-zone", horizon: "now", severity: "high", title: `Special Flood Hazard Area (${loc.floodZone})`, why: "Lenders require flood insurance; NFIP Risk Rating 2.0 premiums can rise up to 18% a year until they reach full risk price.", action: "Get the elevation certificate and quotes." });
  }
  if (loc.barrierIsland || (loc.distanceToCoastFt && loc.distanceToCoastFt < 2000)) {
    add({
      id: "wind", horizon: "10-30y", severity: "high", title: "Hurricane wind and surge exposure",
      why: "First Street models an extreme wind factor here with a 99% chance of a damaging wind event in 30 years. Wilma (2005) stripped roofs across Pompano; Irma (2017) and Nicole (2022) took beach sand from NE 16th St north to the inlet.",
      action: "Impact openings, a roof with a current permit, and a master policy with a deductible you can fund.",
    });
    add({
      id: "slr", horizon: "10-30y", severity: "watch", title: `Sea level: +${FLORIDA.seaLevel.by2040InchesRange[0]} to ${FLORIDA.seaLevel.by2040InchesRange[1]} in by 2040, +${FLORIDA.seaLevel.by2070InchesRange[0]} to ${FLORIDA.seaLevel.by2070InchesRange[1]} in by 2070`,
      why: "Unified Southeast Florida projection. On a barrier island between the Intracoastal and the ocean, this shows up first as king-tide street flooding and salt in the stormwater system, then as insurance and resale friction. Broward's seawall standard rises to 5 ft NAVD by 2050.",
      action: "Check the city's 2025 Vulnerability Assessment maps for this street and ask how the drainage was upgraded.",
    });
    if (unknown(loc.elevationFt)) {
      add({ id: "elev", horizon: "now", severity: "watch", title: "Finished-floor elevation unknown", why: "A first-floor unit at grade on a 5 ft parcel and a second-floor unit are different risks and different premiums.", action: "Elevation certificate; floor number." });
    }
  }
  add({ id: "heat", horizon: "10-30y", severity: "info", title: "Heat and cooling cost", why: "First Street rates heat risk here as extreme; days above 100°F heat index roughly double by 2050. Cooling is most of a Florida electric bill, and old window units or an undersized split system in a 1963 building cost more each year.", action: "HVAC age and SEER rating; insulation above the top floor." });

  // ---------- Market ----------
  if (mk.monthsOfSupply && mk.monthsOfSupply > 6) {
    add({ id: "buyers-market", horizon: "now", severity: "info", title: `Buyer's market: ${mk.monthsOfSupply} months of condo supply`, why: `More than six months of supply favors buyers. ${mk.note || ""}`.trim(), action: "Offer below asking; ask for seller concessions toward rate buy-down or the first year of HOA." });
  }
  if (mk.vintageHeadwind) {
    add({ id: "vintage", horizon: "1-3y", severity: "watch", title: "Older-building discount is widening", why: mk.vintageHeadwind, action: "Underwrite for flat to negative price growth for 3 years; the upside is the land and the location, not the building." });
  }
  if (facts.development?.length) {
    for (const d of facts.development) {
      add({ id: `dev-${d.id}`, horizon: d.horizon || "1-3y", severity: d.severity || "info", title: d.title, why: d.why, action: d.action || "Track the city planning agenda.", confidence: d.confidence || "medium" });
    }
  }

  // ---------- Rental and use ----------
  if (facts.rents?.estimateMonthly && p.listPrice) {
    const gross = (facts.rents.estimateMonthly * 12) / p.listPrice;
    add({ id: "rent", horizon: "now", severity: "info", title: `Gross rent yield about ${(gross * 100).toFixed(1)}%`, why: `Comparable units in this building rented around $${facts.rents.estimateMonthly.toLocaleString()}/mo. After HOA, taxes, insurance and vacancy the cap rate lands near 3 to 5%, below a 7.3% mortgage, so this is a negative-leverage rental today.`, action: "Confirm the association's rental minimum and approval process before underwriting as a rental." });
  }
  const str = FLORIDA.shortTermRental[p.city];
  if (str) {
    add({ id: "str", horizon: "now", severity: "info", title: "Short-term rental needs a city permit and the association's consent", why: `${p.city} requires an annual permit ($${str.initialFeeUsd} initial, $${str.renewalFeeUsd} renewal), a local contact within ${str.contactWithinMiles} miles, and inspections. Most small condos here set a 30 to 90 day minimum, which rules out nightly rentals regardless of the city permit.`, action: "Read the rental section of the declaration first." });
  }

  // ---------- Tax ----------
  add({ id: "tax-reset", horizon: "now", severity: "watch", title: "Property tax resets to the purchase price at closing", why: "The seller's capped assessment does not transfer. Use the purchase-price estimate in the cost section, not the current tax bill. Homestead filing by March 1 after closing caps future growth at 3%.", action: "File for homestead the January after closing if this is your primary home." });
  add({ id: "homestead-2027", horizon: "1-3y", severity: "info", title: "Possible larger homestead exemption from 2027", why: "A 2026 ballot measure would raise the non-school homestead exemption to $150,000 in 2027 and $250,000 in 2028 and cut the non-homestead cap to 5%. If it passes, taxes on a primary residence fall; if not, nothing changes.", action: "Re-run the tax estimate after the November 2026 result.", confidence: "low" });

  // Sort: horizon order then severity
  const H = { now: 0, "1-3y": 1, "3-10y": 2, "10-30y": 3 };
  const S = { critical: 0, high: 1, watch: 2, info: 3 };
  items.sort((x, y) => H[x.horizon] - H[y.horizon] || S[x.severity] - S[y.severity]);
  return items;
}

export const HORIZON_LABELS = { now: "Before you close", "1-3y": "Years 1 to 3", "3-10y": "Years 3 to 10", "10-30y": "Years 10 to 30" };
