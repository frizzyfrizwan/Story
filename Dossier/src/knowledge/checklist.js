// Due-diligence questions. Each item names who answers it and which fact it unlocks,
// so the UI can hide questions that the facts already answer.

export const CHECKLIST = [
  // Unit
  { id: "sqft", group: "Unit", ask: "Which square footage and bath count is correct? Listings for this unit disagree.", who: "Listing agent, Broward Property Appraiser record", unlocks: "property.sqft" },
  { id: "floor", group: "Unit", ask: "Which floor is the unit on, and what is the finished-floor elevation?", who: "Agent; elevation certificate from the association", unlocks: "location.elevationFt" },
  { id: "windows", group: "Unit", ask: "Are the windows and doors impact-rated, and is there a wind mitigation report?", who: "Agent, inspector", unlocks: "property.impactWindows" },
  { id: "plumbing", group: "Unit", ask: "Has the unit been re-piped? Have the building's cast-iron drain lines been lined or replaced?", who: "Association, inspector (sewer camera scope)", unlocks: "building.drainsReplaced" },
  { id: "electrical", group: "Unit", ask: "What panel brand is in the unit and in the meter room? When was the building's electrical last recertified?", who: "Inspector, 40-year recertification report", unlocks: "building.panelBrand" },
  { id: "fourpoint", group: "Unit", ask: "Get a 4-point inspection and a written HO-6 quote inside the inspection period.", who: "Inspector, insurance agent", unlocks: "insurance.ho6Annual" },
  // Association
  { id: "docs", group: "Association", ask: "Request the full 718.503 package: declaration, bylaws, rules, budget, year-end financials, FAQ sheet, 12 months of minutes.", who: "Seller (at seller's expense by statute)", unlocks: "association.docsReceived" },
  { id: "reserves", group: "Association", ask: "How much is in reserves, and were reserves waived or reduced in the last three budgets?", who: "Budget, minutes", unlocks: "association.reservesUsd" },
  { id: "assessments", group: "Association", ask: "Any special assessments passed, pending, or discussed in the last 24 months of minutes?", who: "Minutes, estoppel certificate", unlocks: "association.specialAssessments" },
  { id: "recert", group: "Association", ask: "Produce the latest Broward 40/50-year recertification report (structural and electrical) and any engineer's follow-up.", who: "Association, city building department", unlocks: "building.recertYear" },
  { id: "roof", group: "Association", ask: "Roof type, age, and warranty. When is replacement budgeted?", who: "Association", unlocks: "building.roofYear" },
  { id: "master", group: "Association", ask: "Master policy declarations page: carrier, wind deductible, flood policy (RCBAP) and limits, per-unit deductible, loss assessment history.", who: "Association, its insurance agent", unlocks: "association.masterDeductible" },
  { id: "litigation", group: "Association", ask: "Any pending litigation, code violations, or open permits on the building?", who: "Association, city permit portal, Broward clerk search", unlocks: "association.litigation" },
  { id: "rules", group: "Association", ask: "Rental minimum term, approval process, pet rules, age restriction (55+?), parking assignment, owner-occupancy ratio.", who: "Rules, FAQ sheet", unlocks: "association.rentalMinDays" },
  { id: "delinquency", group: "Association", ask: "What share of units are 60+ days delinquent? How many units does any single owner hold?", who: "Lender questionnaire, association", unlocks: "association.delinquencyPct" },
  { id: "warrantable", group: "Financing", ask: "Ask your lender to run the full condo project review before you waive financing contingencies.", who: "Lender", unlocks: "financing.warrantable" },
  // Hazards
  { id: "floodzone", group: "Hazards", ask: "Confirm the FEMA flood zone and base flood elevation on the 2024 effective coastal maps, and get the elevation certificate.", who: "City Building Division 954-786-4669, floodzoneinfo@copbfl.com; FEMA Map Service Center", unlocks: "location.floodZone" },
  { id: "floodquote", group: "Hazards", ask: "Get an NFIP or private flood contents quote for the unit.", who: "Insurance agent", unlocks: "insurance.floodAnnual" },
  { id: "history", group: "Hazards", ask: "Any history of water intrusion, mold remediation, or insurance claims on the building (CLUE report)?", who: "Seller disclosure, association, CLUE report", unlocks: "building.claimsHistory" },
  // Title and taxes
  { id: "estoppel", group: "Closing", ask: "Order the estoppel certificate early (fee capped at $250, 10 business days).", who: "Title company", unlocks: "association.estoppelReceived" },
  { id: "taxes", group: "Closing", ask: "Model taxes on the purchase price, not the seller's bill. Seller's capped assessment resets at closing.", who: "Broward Property Appraiser tax estimator", unlocks: "taxes.annualEstimate" },
];
