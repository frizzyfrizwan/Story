# Dossier on the App Store

Everything needed to take the iOS app from this repo to a live App Store listing. The code and CI are done; the steps marked **you** need the Apple account holder.

## How shipping works

| Step | Who | Where |
|---|---|---|
| Build and test the iOS app on every change | CI | `.github/workflows/ios-dossier.yml` (simulator build, unit and UI tests, screenshots to `Dossier/ios/Screenshots`) |
| Archive, sign and upload to TestFlight | CI | `.github/workflows/testflight-dossier.yml` on push to `master` touching `Dossier/ios/**`, or Run workflow |
| Create the app record, fill the listing, submit for review | **you** | App Store Connect |

The TestFlight workflow uses the same four repository secrets Folio already uses (`APPLE_TEAM_ID`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_API_KEY_P8`). If they are set for Folio, nothing else is needed for Dossier.

## One-time setup (you)

1. **App record.** App Store Connect → My Apps → + → New App. Platform iOS, name **Dossier**, primary language English (U.S.), bundle ID **com.faisalrizwan.dossier** (register it first at developer.apple.com → Identifiers if it is not offered), SKU `dossier-ios`.
2. **Merge PR #11** (or push `Dossier/ios/**` to `master`). The TestFlight workflow archives with automatic cloud signing and uploads build 1.0.0 (build number = workflow run number).
3. **TestFlight.** In App Store Connect → TestFlight, the build appears after processing (10 to 30 minutes). Answer the export compliance question once (the app sets `ITSAppUsesNonExemptEncryption = false`, so it is exempt). Install it on your phone through the TestFlight app and try it.
4. **Listing.** App Store Connect → App Store tab → 1.0 Prepare for Submission. Paste the copy below, upload screenshots, set the URLs, answer the privacy questions, pick the build, submit.

## Listing copy

**Name:** Dossier
**Subtitle (30 chars):** Everything about a home
**Category:** Finance (secondary: Lifestyle)
**Age rating:** 4+ (no objectionable content)
**Price:** Free

**Promotional text (170 chars):**
Grade any home before you sign. Price, cost to own, building, association, hazards, resale. See what will cost money in year 1, 5, 10 and 30, and what to ask.

**Description:**
Dossier is the report you wish came with every listing.

Type in what the listing shows. Dossier grades the home on seven things that decide whether it is a good buy: asking price, cost to own, the building, the association, hazards, location, and resale. Each grade comes with the reason.

Then it tells you what will come up, and when: before you close, in years 1 to 3, years 3 to 10, and years 10 to 30. Every item names the document or inspection that settles it. Unknowns never become guesses. They become questions, with who answers them.

COST TO OWN
Mortgage at your down payment and rate, property tax the way Florida actually bills it (homestead or not), insurance planning ranges, HOA, utilities. A ten-year projection with the kind of special assessment an older building produces. Rental yield and cash flow if you are buying to rent.

FIND DEALS
Enter your income, debts, cash, household size and where you work. Dossier works out what you can carry, grades every home in the pool the same way, and ranks the ones that fit, with the drive to work. Add any listing you find to your pool.

BUILT FOR FLORIDA CONDOS
Milestone inspections, structural reserve studies, Broward recertification cycles, the 2026 Fannie Mae and Freddie Mac condo review rules, evacuation zones, sea-level projections, and what a $175 HOA fee on a 1963 building really means.

PRIVATE BY DESIGN
No account. No analytics. No servers. Everything stays on your phone. Save reports for offline reading and share them with your agent, lender or partner.

Dossier is a decision aid, not a lender, appraiser or licensed real estate professional. Listing data must be verified on the MLS before you act.

**Keywords (100 chars):**
home,condo,buyer,report,HOA,inspection,mortgage,affordability,Florida,real estate,flood,deal finder

**Support URL:** https://github.com/frizzyfrizwan/Story/issues
**Marketing URL:** https://frizzyfrizwan.github.io/Story/dossier/
**Privacy policy URL:** https://frizzyfrizwan.github.io/Story/dossier/privacy.html (published by the Pages workflow)

**What's new (1.0.0):** First release.

## App privacy questionnaire

- Data collection: **No, we do not collect data from this app.** (No account, analytics, ads or servers. Profile, pool and saved reports stay on device.)
- Third-party code: none.

## Screenshots

CI attaches simulator screenshots to every run of the Dossier iOS workflow and commits them to `Dossier/ios/Screenshots` on PR branches: `01-report`, `02-find-deals`, `03-saved`, `04-about`. App Store Connect needs the 6.9-inch iPhone set (1320×2868 or 1290×2796); the workflow picks the newest iPhone simulator, which produces that size. Upload at least three. iPad screenshots are optional unless you keep iPad support on (the project targets iPhone and iPad; drop `2` from `TARGETED_DEVICE_FAMILY` to go iPhone-only).

## Review notes (paste into "Notes" for the reviewer)

Dossier runs entirely on the device: the report engine is bundled, so no login or network is needed. On launch it shows a researched sample report (3204 Colony Club Rd Apt 6, Pompano Beach). Tap Find deals in the toolbar, enter any income (for example 110000), cash (80000) and a workplace from the list, then Show my deals. The bookmark saves a report to the Saved tab; the share icon opens the system share sheet.

## Why this should pass review

- Guideline 4.2 (minimum functionality): not a wrapped website. The engine runs offline from the bundle; the app adds native saved reports, sharing, tabs and toolbar. There is no web content that the app simply loads.
- Guideline 5.1.1 (data collection): none.
- Guideline 1.4.3 (physical harm / financial): the app states it is a decision aid and not a lender or licensed professional, and labels estimates.
- Export compliance: `ITSAppUsesNonExemptEncryption` is false.

## After approval

Each later push to `master` that touches `Dossier/ios/**` uploads a new TestFlight build automatically. Bump `MARKETING_VERSION` in `Dossier/ios/Dossier.xcodeproj/project.pbxproj` for a new store version and create the version in App Store Connect.
