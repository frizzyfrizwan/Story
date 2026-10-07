/**
 * build-airports.ts — generates src/data/generated/airports.json from OpenFlights airports.dat.
 *
 *   pnpm tsx scripts/build-airports.ts [path/to/airports.dat]
 *
 * The raw OpenFlights file is untrusted input: it is parsed as CSV only, never evaluated.
 * Only airports on the curated list below are emitted. Region / hub / metro are assigned here,
 * and a small set of overrides patch gaps in the upstream data (BER is missing, a few rows have
 * no timezone, some city names are stale or oddly cased).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Airport, AwardRegion } from "../src/lib/types";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_SOURCE =
  "/tmp/claude-0/-home-user-Story/f6072409-3da4-5b14-aa7e-1678ce02904b/scratchpad/openflights/airports.dat";
const OUT = resolve(__dirname, "../src/data/generated/airports.json");

// ─── Curated airport list ─────────────────────────────────────
// Space-separated IATA codes; a trailing "*" marks a major hub.

const CURATED = `
  # United States
  JFK* EWR* LGA BOS* PHL* IAD* DCA BWI ORD* MDW DTW* MSP* ATL* MIA* FLL MCO TPA CLT* RDU IAH* HOU DFW* DAL AUS SAT
  DEN* PHX* LAS* LAX* SFO* SAN SEA* PDX SLC* SJC OAK SMF BUR ONT SNA PSP MSY BNA MEM STL MCI CVG CMH CLE PIT IND MKE
  BUF BDL PVD MHT RIC ORF JAX SAV CHS RSW PBI SRQ OKC ABQ ELP TUS RNO BOI GEG ANC OMA GRR SDF BHM XNA TYS
  SJU STT STX GUM SPN
  # Hawaii
  HNL* OGG KOA LIH ITO
  # Canada
  YVR* YYZ* YUL* YYC* YOW YEG YHZ YWG YQB YYJ YXE YQR YLW YYT
  # Mexico & Central America
  MEX* CUN GDL MTY SJD PVR TIJ BJX QRO OAX MID SJO LIR PTY* GUA SAL TGU SAP MGA BZE
  # Caribbean
  NAS PLS MBJ KIN PUJ SDQ STI HAV AUA CUR SXM BGI POS GCM PAP ANU UVF SKB GND BDA FDF PTP
  # South America
  BOG* LIM* UIO GYE GRU* GIG* CGH VCP SDU BSB CNF SSA REC FOR POA CWB FLN MAO BEL EZE* AEP COR MDZ SCL* MVD ASU LPB VVI
  CCS MDE CLO CTG BAQ GEO PBM CUZ IPC
  # Europe
  LHR* LGW LCY STN LTN MAN EDI GLA BHX BRS NCL BFS DUB* SNN ORK CDG* ORY NCE LYS MRS TLS BOD NTE AMS* BRU* LUX
  FRA* MUC* DUS HAM BER STR CGN ZRH* GVA BSL VIE* INN PRG WAW* KRK GDN BUD CPH* ARN* GOT OSL* BGO HEL* LIS* OPO FAO FNC
  MAD* BCN* PMI AGP SVQ VLC BIO IBZ LPA TFS TFN FCO* CIA MXP* LIN BGY VCE NAP FLR PSA BLQ CTA PMO TRN ATH* SKG HER JTR
  CFU RHO IST* SAW ADB AYT ESB KEF* DBV ZAG SPU LJU BEG SOF OTP TIA SKP TGD PRN RIX TLL VNO KIV SVO* DME LED MLA LCA
  TBS EVN GYD
  # Middle East
  DXB* DWC AUH* DOH* BAH MCT RUH* JED* DMM MED KWI AMM TLV* BEY BGW IKA
  # North Africa
  CAI* HRG SSH LXR CMN* RAK AGA TNG TUN ALG
  # Sub-Saharan Africa
  NBO* MBA ADD* JNB* CPT DUR LOS* ABV ACC DKR DSS ABJ KGL EBB DAR ZNZ JRO LUN LVI HRE VFA WDH MRU SEZ TNR MPM LAD FIH
  DLA RUN
  # Central Asia
  ALA NQZ TAS FRU
  # North Asia
  NRT* HND* KIX* ITM NGO FUK CTS OKA ICN* GMP PUS CJU PEK* PKX PVG* SHA CAN* SZX CTU TFU XIY HGH NKG CKG KMG WUH XMN
  TPE* KHH TSA HKG* MFM ULN
  # South Asia
  DEL* BOM* BLR* HYD MAA CCU COK GOI AMD PNQ TRV CMB MLE KTM DAC KHI LHE ISB
  # Southeast Asia
  BKK* DMK HKT CNX USM KBV SIN* KUL* PEN LGK BKI KCH CGK* DPS SUB MNL* CEB SGN* HAN DAD PQC PNH REP VTE LPQ RGN BWN
  # Oceania
  SYD* MEL* BNE* PER* ADL CBR OOL CNS DRW HBA AKL* CHC WLG ZQN NAN SUV PPT BOB RAR APW TBU NOU VLI POM
`;

const METROS: Record<string, string[]> = {
  NYC: ["JFK", "EWR", "LGA"],
  LON: ["LHR", "LGW", "LCY", "STN"],
  PAR: ["CDG", "ORY"],
  TYO: ["NRT", "HND"],
  CHI: ["ORD", "MDW"],
  WAS: ["IAD", "DCA", "BWI"],
  MIL: ["MXP", "LIN"],
  ROM: ["FCO", "CIA"],
  SEL: ["ICN", "GMP"],
  OSA: ["KIX", "ITM"],
  BUE: ["EZE", "AEP"],
  SAO: ["GRU", "CGH"],
  BKK: ["BKK", "DMK"],
  JKT: ["CGK"],
  MOW: ["SVO", "DME"],
  STO: ["ARN"],
};

// ─── Country → ISO 3166-1 alpha-2 (OpenFlights spelling) ─────

const COUNTRY_ISO: Record<string, string> = {
  "United States": "US", "Puerto Rico": "PR", "Virgin Islands": "VI", Guam: "GU", "Northern Mariana Islands": "MP",
  Canada: "CA", Mexico: "MX", "Costa Rica": "CR", Panama: "PA", Guatemala: "GT", "El Salvador": "SV", Honduras: "HN",
  Nicaragua: "NI", Belize: "BZ", Bahamas: "BS", "Turks and Caicos Islands": "TC", Jamaica: "JM",
  "Dominican Republic": "DO", Cuba: "CU", Aruba: "AW", "Netherlands Antilles": "AN", Barbados: "BB",
  "Trinidad and Tobago": "TT", "Cayman Islands": "KY", Haiti: "HT", "Antigua and Barbuda": "AG", "Saint Lucia": "LC",
  "Saint Kitts and Nevis": "KN", Grenada: "GD", Bermuda: "BM", Martinique: "MQ", Guadeloupe: "GP",
  Colombia: "CO", Peru: "PE", Ecuador: "EC", Brazil: "BR", Argentina: "AR", Chile: "CL", Uruguay: "UY", Paraguay: "PY",
  Bolivia: "BO", Venezuela: "VE", Guyana: "GY", Suriname: "SR",
  "United Kingdom": "GB", Ireland: "IE", France: "FR", Netherlands: "NL", Belgium: "BE", Luxembourg: "LU", Germany: "DE",
  Switzerland: "CH", Austria: "AT", "Czech Republic": "CZ", Poland: "PL", Hungary: "HU", Denmark: "DK", Sweden: "SE",
  Norway: "NO", Finland: "FI", Portugal: "PT", Spain: "ES", Italy: "IT", Greece: "GR", Turkey: "TR", Iceland: "IS",
  Croatia: "HR", Slovenia: "SI", Serbia: "RS", Bulgaria: "BG", Romania: "RO", Albania: "AL", Macedonia: "MK",
  Montenegro: "ME", Latvia: "LV", Estonia: "EE", Lithuania: "LT", Moldova: "MD", Russia: "RU", Malta: "MT", Cyprus: "CY",
  Slovakia: "SK", Georgia: "GE", Armenia: "AM", Azerbaijan: "AZ",
  "United Arab Emirates": "AE", Qatar: "QA", Bahrain: "BH", Oman: "OM", "Saudi Arabia": "SA", Kuwait: "KW", Jordan: "JO",
  Israel: "IL", Lebanon: "LB", Iraq: "IQ", Iran: "IR",
  Egypt: "EG", Morocco: "MA", Tunisia: "TN", Algeria: "DZ", Libya: "LY",
  Kenya: "KE", Ethiopia: "ET", "South Africa": "ZA", Nigeria: "NG", Ghana: "GH", Senegal: "SN", "Cote d'Ivoire": "CI",
  Rwanda: "RW", Uganda: "UG", Tanzania: "TZ", Zambia: "ZM", Zimbabwe: "ZW", Namibia: "NA", Mauritius: "MU",
  Seychelles: "SC", Madagascar: "MG", Mozambique: "MZ", Angola: "AO", "Congo (Kinshasa)": "CD", Cameroon: "CM",
  Togo: "TG", Benin: "BJ", Guinea: "GN", "Sierra Leone": "SL", Liberia: "LR", "Burkina Faso": "BF", Mali: "ML",
  Niger: "NE", Chad: "TD", Burundi: "BI", Reunion: "RE", Botswana: "BW",
  Kazakhstan: "KZ", Uzbekistan: "UZ", Kyrgyzstan: "KG", Tajikistan: "TJ", Turkmenistan: "TM", Afghanistan: "AF",
  Japan: "JP", "South Korea": "KR", China: "CN", Taiwan: "TW", "Hong Kong": "HK", Macau: "MO", Mongolia: "MN",
  India: "IN", "Sri Lanka": "LK", Maldives: "MV", Nepal: "NP", Bangladesh: "BD", Pakistan: "PK", Bhutan: "BT",
  Thailand: "TH", Singapore: "SG", Malaysia: "MY", Indonesia: "ID", Philippines: "PH", Vietnam: "VN", Cambodia: "KH",
  Laos: "LA", Burma: "MM", Brunei: "BN",
  Australia: "AU", "New Zealand": "NZ", Fiji: "FJ", "French Polynesia": "PF", "Cook Islands": "CK", Samoa: "WS",
  Tonga: "TO", "New Caledonia": "NC", Vanuatu: "VU", "Papua New Guinea": "PG", Palau: "PW", "Marshall Islands": "MH",
};

/** Display names where the OpenFlights spelling is dated. */
const COUNTRY_NAME: Record<string, string> = {
  MM: "Myanmar", MK: "North Macedonia", CD: "DR Congo", CI: "Côte d'Ivoire", RE: "Réunion", VI: "U.S. Virgin Islands",
  CW: "Curaçao", SX: "Sint Maarten", XK: "Kosovo", TR: "Türkiye", KR: "South Korea",
};

// ─── Region assignment ────────────────────────────────────────

const REGION_BY_ISO: Record<string, AwardRegion> = {};
const assign = (region: AwardRegion, codes: string) => {
  for (const c of codes.split(/\s+/).filter(Boolean)) REGION_BY_ISO[c] = region;
};
assign("north-america", "US CA");
assign("central-america", "MX GT BZ SV HN NI CR PA");
assign(
  "caribbean",
  "PR VI BS TC JM DO CU AW AN CW SX BB TT KY HT AG LC KN GD BM MQ GP VG AI DM VC MS BQ",
);
assign("south-america", "CO PE EC BR AR CL UY PY BO VE GY SR GF FK");
assign(
  "europe",
  "GB IE FR NL BE LU DE CH AT CZ PL HU DK SE NO FI PT ES IT GR TR IS HR SI RS BG RO AL MK ME XK LV EE LT MD RU MT CY SK " +
    "BA UA BY GE AM AZ LI MC SM AD VA GI FO GL IM JE GG",
);
assign("middle-east", "AE QA BH OM SA KW JO IL LB IQ IR SY YE PS");
assign("north-africa", "EG MA TN DZ LY SD");
assign(
  "sub-saharan-africa",
  "KE ET ZA NG GH SN CI RW UG TZ ZM ZW NA MU SC MG MZ AO CD CM TG BJ GN SL LR BF ML NE TD BI RE BW CG GA GQ GM GW " +
    "CV ST SS ER DJ SO MW LS SZ KM YT CF MR",
);
assign("central-asia", "KZ UZ KG TJ TM AF");
assign("north-asia", "JP KR CN TW HK MO MN KP");
assign("south-asia", "IN PK BD LK NP MV BT");
assign("southeast-asia", "TH SG MY ID PH VN KH LA MM BN TL");
assign(
  "oceania",
  "AU NZ FJ PF CK WS TO NC VU PG PW MH GU MP FM KI NR NU SB TV AS WF NF CX CC",
);

// ─── Overrides ────────────────────────────────────────────────

/** Airports missing from (or wrongly coded in) the OpenFlights snapshot. */
const MANUAL: Record<string, Omit<Airport, "region" | "hub" | "metro">> = {
  BER: {
    iata: "BER", icao: "EDDB", name: "Berlin Brandenburg Airport", city: "Berlin", country: "Germany",
    countryCode: "DE", lat: 52.3667, lon: 13.5033, tz: "Europe/Berlin",
  },
  NQZ: {
    iata: "NQZ", icao: "UACC", name: "Nursultan Nazarbayev International Airport", city: "Astana",
    country: "Kazakhstan", countryCode: "KZ", lat: 51.0222, lon: 71.4669, tz: "Asia/Almaty",
  },
  TFU: {
    iata: "TFU", icao: "ZUTF", name: "Chengdu Tianfu International Airport", city: "Chengdu", country: "China",
    countryCode: "CN", lat: 30.3125, lon: 104.4417, tz: "Asia/Shanghai",
  },
};

/** Per-airport field patches applied after parsing. */
const PATCH: Record<string, Partial<Airport>> = {
  // Timezones missing upstream
  IST: { tz: "Europe/Istanbul" },
  DOH: { tz: "Asia/Qatar" },
  DSS: { tz: "Africa/Dakar", city: "Dakar" },
  PKX: { tz: "Asia/Shanghai" },
  HYD: { tz: "Asia/Kolkata" },
  ISB: { tz: "Asia/Karachi" },
  // Timezones that are wrong or stale upstream
  ALA: { tz: "Asia/Almaty", city: "Almaty" },
  GVA: { tz: "Europe/Zurich" },
  MEL: { tz: "Australia/Melbourne" },
  // Country splits not reflected upstream
  CUR: { countryCode: "CW", country: "Curaçao" },
  SXM: { countryCode: "SX", country: "Sint Maarten" },
  PRN: { countryCode: "XK", country: "Kosovo" },
  // Names
  LGA: { name: "LaGuardia Airport" },
  BOS: { name: "Boston Logan International Airport" },
  MSP: { name: "Minneapolis–Saint Paul International Airport" },
  ATL: { name: "Hartsfield–Jackson Atlanta International Airport" },
  TLL: { name: "Tallinn Airport", city: "Tallinn" },
  UVF: { name: "Hewanorra International Airport", city: "Vieux Fort" },
  // Cities (stale, hyphenated or lower-cased upstream)
  RDU: { city: "Raleigh/Durham" },
  BDL: { city: "Hartford" },
  MHT: { city: "Manchester" },
  XNA: { city: "Bentonville/Fayetteville" },
  STX: { city: "St. Croix" },
  GUM: { city: "Guam" },
  SJD: { city: "Los Cabos" },
  BJX: { city: "León" },
  POS: { city: "Port of Spain" },
  PAP: { city: "Port-au-Prince" },
  FDF: { city: "Fort-de-France" },
  PTP: { city: "Pointe-à-Pitre" },
  SKB: { city: "Basseterre" },
  GND: { city: "St. George's" },
  ANU: { city: "St. John's" },
  VCP: { city: "São Paulo (Campinas)" },
  GIG: { city: "Rio de Janeiro" },
  SDU: { city: "Rio de Janeiro" },
  MDE: { city: "Medellín" },
  PBM: { city: "Paramaribo" },
  CUZ: { city: "Cusco" },
  MXP: { city: "Milan" },
  LUX: { city: "Luxembourg" },
  DUS: { city: "Düsseldorf" },
  GOT: { city: "Gothenburg" },
  BSL: { city: "Basel/Mulhouse" },
  CFU: { city: "Corfu" },
  RHO: { city: "Rhodes" },
  JTR: { city: "Santorini" },
  TLV: { city: "Tel Aviv" },
  RUN: { city: "Saint-Denis" },
  ALG: { city: "Algiers" },
  TNG: { city: "Tangier" },
  DAR: { city: "Dar es Salaam" },
  MRU: { city: "Mauritius" },
  SEZ: { city: "Mahé" },
  MAA: { city: "Chennai" },
  TRV: { city: "Thiruvananthapuram" },
  CJU: { city: "Jeju" },
  ULN: { city: "Ulaanbaatar" },
  PNH: { city: "Phnom Penh" },
  REP: { city: "Siem Reap" },
  DAD: { city: "Da Nang" },
  PQC: { city: "Phu Quoc" },
  OOL: { city: "Gold Coast" },
  ZQN: { city: "Queenstown" },
  NAN: { city: "Nadi" },
  SUV: { city: "Suva" },
  APW: { city: "Apia" },
  TBU: { city: "Nuku'alofa" },
  VLI: { city: "Port Vila" },
  RAR: { city: "Rarotonga" },
};

/** Legacy IANA zone names → canonical. */
const TZ_CANON: Record<string, string> = {
  "Asia/Calcutta": "Asia/Kolkata",
  "Asia/Katmandu": "Asia/Kathmandu",
  "Asia/Saigon": "Asia/Ho_Chi_Minh",
  "Asia/Rangoon": "Asia/Yangon",
  "America/Buenos_Aires": "America/Argentina/Buenos_Aires",
  "America/Cordoba": "America/Argentina/Cordoba",
  "America/Mendoza": "America/Argentina/Mendoza",
};

// ─── CSV parsing (RFC-4180-ish; OpenFlights quotes strings, uses \N for null) ──

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const nul = (s: string | undefined) => (s === undefined || s === "\\N" || s === "" ? undefined : s);

/** OpenFlights city names are sometimes lower-cased after a hyphen ("Raleigh-durham"). */
function titleCase(s: string): string {
  return s.replace(/(^|[\s\-/'])([a-z])/g, (_, pre: string, ch: string) => pre + ch.toUpperCase());
}

// ─── Build ────────────────────────────────────────────────────

function main() {
  const source = process.argv[2] ? resolve(process.argv[2]) : DEFAULT_SOURCE;
  const rows = parseCsv(readFileSync(source, "utf8"));

  const wanted = new Map<string, boolean>(); // iata → hub
  for (const line of CURATED.split("\n")) {
    const body = line.replace(/#.*$/, "").trim();
    if (!body) continue;
    for (const tok of body.split(/\s+/)) {
      const hub = tok.endsWith("*");
      const code = hub ? tok.slice(0, -1) : tok;
      if (!/^[A-Z]{3}$/.test(code)) throw new Error(`Bad curated token: ${tok}`);
      if (wanted.has(code)) throw new Error(`Duplicate curated code: ${code}`);
      wanted.set(code, hub);
    }
  }

  const metroOf = new Map<string, string>();
  for (const [metro, members] of Object.entries(METROS)) {
    for (const m of members) {
      if (!wanted.has(m)) throw new Error(`Metro ${metro} member ${m} is not on the curated list`);
      metroOf.set(m, metro);
    }
  }

  // Index candidate rows by IATA, preferring type === "airport" and rows with an ICAO code.
  const byIata = new Map<string, string[]>();
  for (const r of rows) {
    const iata = nul(r[4]);
    if (!iata || !wanted.has(iata)) continue;
    const prev = byIata.get(iata);
    const score = (x: string[]) => (x[12] === "airport" ? 2 : 0) + (nul(x[5]) ? 1 : 0);
    if (!prev || score(r) > score(prev)) byIata.set(iata, r);
  }

  const problems: string[] = [];
  const airports: Airport[] = [];

  for (const [iata, hub] of wanted) {
    let base: Omit<Airport, "region" | "hub" | "metro"> | undefined = MANUAL[iata];
    const r = byIata.get(iata);
    if (!base) {
      if (!r) {
        problems.push(`${iata}: not found in airports.dat and no MANUAL entry`);
        continue;
      }
      const countryName = r[3];
      const iso = COUNTRY_ISO[countryName];
      if (!iso) {
        problems.push(`${iata}: unmapped country "${countryName}"`);
        continue;
      }
      const lat = Number(r[6]);
      const lon = Number(r[7]);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        problems.push(`${iata}: bad coordinates`);
        continue;
      }
      base = {
        iata,
        icao: nul(r[5]),
        name: r[1].trim(),
        city: titleCase(r[2].trim()),
        country: COUNTRY_NAME[iso] ?? countryName,
        countryCode: iso,
        lat: Math.round(lat * 10_000) / 10_000,
        lon: Math.round(lon * 10_000) / 10_000,
        tz: nul(r[11]) ?? "",
      };
    }

    const patched: Omit<Airport, "region"> = { ...base, ...PATCH[iata] };
    if (PATCH[iata]?.countryCode && !PATCH[iata]?.country) patched.country = COUNTRY_NAME[patched.countryCode] ?? patched.country;
    patched.tz = TZ_CANON[patched.tz] ?? patched.tz;
    if (!patched.tz) {
      problems.push(`${iata}: missing timezone`);
      continue;
    }

    let region: AwardRegion | undefined = REGION_BY_ISO[patched.countryCode];
    if (patched.countryCode === "US" && patched.tz === "Pacific/Honolulu") region = "hawaii";
    if (!region) {
      problems.push(`${iata}: no region for country ${patched.countryCode}`);
      continue;
    }

    const airport: Airport = { ...patched, region };
    if (hub) airport.hub = true;
    const metro = metroOf.get(iata);
    if (metro) airport.metro = metro;
    if (!airport.icao) delete airport.icao;
    airports.push(airport);
  }

  if (problems.length) {
    console.error("build-airports: unresolved problems:\n  " + problems.join("\n  "));
    process.exit(1);
  }

  airports.sort((a, b) => a.iata.localeCompare(b.iata));

  // Canonical key order for stable diffs; one airport per line.
  const order: (keyof Airport)[] = ["iata", "icao", "name", "city", "country", "countryCode", "lat", "lon", "tz", "region", "hub", "metro"];
  const lines = airports.map((a) => {
    const o: Record<string, unknown> = {};
    for (const k of order) if (a[k] !== undefined) o[k] = a[k];
    return "  " + JSON.stringify(o);
  });
  const json = "[\n" + lines.join(",\n") + "\n]\n";

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, json);

  const byRegion = new Map<AwardRegion, number>();
  for (const a of airports) byRegion.set(a.region, (byRegion.get(a.region) ?? 0) + 1);
  console.log(`build-airports: wrote ${airports.length} airports (${airports.filter((a) => a.hub).length} hubs, ${Math.round(json.length / 1024)} KB) → ${OUT}`);
  for (const [region, n] of [...byRegion.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${region.padEnd(20)} ${n}`);
}

main();
