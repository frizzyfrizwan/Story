import type { Airline, Alliance } from "@/lib/types";

/**
 * Hand-curated airlines: every alliance member that matters for award travel plus the major
 * non-alliance carriers. `programId` uses the canonical ids from docs/ARCHITECTURE.md; carriers
 * whose program Kestrel does not model (yet) leave it undefined.
 */
type AirlineRow = [
  iata: string,
  icao: string,
  name: string,
  alliance: Alliance,
  programId: string | undefined,
  countryCode: string,
  color: string,
  hubs: string,
];

const ROWS: AirlineRow[] = [
  // ─── Star Alliance ──────────────────────────────────────────
  ["AC", "ACA", "Air Canada", "star", "aeroplan", "CA", "#F01428", "YYZ YUL YVR YYC"],
  ["UA", "UAL", "United Airlines", "star", "united-mileageplus", "US", "#1414D2", "ORD EWR IAH DEN SFO IAD LAX"],
  ["NH", "ANA", "ANA All Nippon Airways", "star", "ana-mileage-club", "JP", "#1A3C8E", "HND NRT"],
  ["SQ", "SIA", "Singapore Airlines", "star", "singapore-krisflyer", "SG", "#F3A61C", "SIN"],
  ["AV", "AVA", "Avianca", "star", "avianca-lifemiles", "CO", "#E0202B", "BOG MDE SAL"],
  ["TK", "THY", "Turkish Airlines", "star", "turkish-miles-smiles", "TR", "#C90019", "IST"],
  ["BR", "EVA", "EVA Air", "star", "eva-infinity", "TW", "#0B7A5E", "TPE"],
  ["TG", "THA", "Thai Airways", "star", "thai-royal-orchid", "TH", "#6F2C91", "BKK"],
  ["OZ", "AAR", "Asiana Airlines", "star", "asiana-club", "KR", "#B52B31", "ICN"],
  ["LH", "DLH", "Lufthansa", "star", "lufthansa-miles-more", "DE", "#F9BA00", "FRA MUC"],
  ["LX", "SWR", "SWISS", "star", "lufthansa-miles-more", "CH", "#E2001A", "ZRH GVA"],
  ["OS", "AUA", "Austrian Airlines", "star", "lufthansa-miles-more", "AT", "#D81E05", "VIE"],
  ["SN", "BEL", "Brussels Airlines", "star", "lufthansa-miles-more", "BE", "#0B2A5B", "BRU"],
  ["LO", "LOT", "LOT Polish Airlines", "star", undefined, "PL", "#0A2D63", "WAW"],
  ["TP", "TAP", "TAP Air Portugal", "star", "tap-miles-go", "PT", "#00A550", "LIS OPO"],
  ["A3", "AEE", "Aegean Airlines", "star", undefined, "GR", "#00338D", "ATH"],
  ["ET", "ETH", "Ethiopian Airlines", "star", undefined, "ET", "#2E8B3D", "ADD"],
  ["SA", "SAA", "South African Airways", "star", undefined, "ZA", "#0C2340", "JNB"],
  ["MS", "MSR", "EgyptAir", "star", undefined, "EG", "#0D3B80", "CAI"],
  ["AI", "AIC", "Air India", "star", "air-india-maharaja", "IN", "#C8102E", "DEL BOM"],
  ["NZ", "ANZ", "Air New Zealand", "star", "air-new-zealand-airpoints", "NZ", "#1A1A1A", "AKL"],
  ["CM", "CMP", "Copa Airlines", "star", "copa-connectmiles", "PA", "#0053A0", "PTY"],
  ["CA", "CCA", "Air China", "star", undefined, "CN", "#C8102E", "PEK CTU PVG"],
  ["ZH", "CSZ", "Shenzhen Airlines", "star", undefined, "CN", "#B5121B", "SZX"],
  // ─── oneworld ───────────────────────────────────────────────
  ["AA", "AAL", "American Airlines", "oneworld", "american-aadvantage", "US", "#0078D2", "DFW CLT ORD MIA PHX PHL LAX JFK DCA"],
  ["BA", "BAW", "British Airways", "oneworld", "british-airways-club", "GB", "#1E4B87", "LHR LGW LCY"],
  ["QR", "QTR", "Qatar Airways", "oneworld", "qatar-privilege-club", "QA", "#5C0632", "DOH"],
  ["CX", "CPA", "Cathay Pacific", "oneworld", "cathay-asia-miles", "HK", "#006564", "HKG"],
  ["JL", "JAL", "Japan Airlines", "oneworld", "jal-mileage-bank", "JP", "#C8102E", "HND NRT"],
  ["AS", "ASA", "Alaska Airlines", "oneworld", "alaska-mileage-plan", "US", "#01426A", "SEA PDX SFO LAX ANC"],
  ["QF", "QFA", "Qantas", "oneworld", "qantas-frequent-flyer", "AU", "#E0001B", "SYD MEL BNE"],
  ["IB", "IBE", "Iberia", "oneworld", "iberia-plus", "ES", "#D7192D", "MAD"],
  ["AY", "FIN", "Finnair", "oneworld", "finnair-plus", "FI", "#0B1560", "HEL"],
  ["MH", "MAS", "Malaysia Airlines", "oneworld", undefined, "MY", "#006DB7", "KUL"],
  ["RJ", "RJA", "Royal Jordanian", "oneworld", undefined, "JO", "#5C2E3E", "AMM"],
  ["UL", "ALK", "SriLankan Airlines", "oneworld", undefined, "LK", "#0B3A6A", "CMB"],
  ["WY", "OMA", "Oman Air", "oneworld", undefined, "OM", "#0F7B8B", "MCT"],
  ["AT", "RAM", "Royal Air Maroc", "oneworld", undefined, "MA", "#C60C30", "CMN"],
  ["FJ", "FJI", "Fiji Airways", "oneworld", undefined, "FJ", "#00A6CE", "NAN"],
  // ─── SkyTeam ────────────────────────────────────────────────
  ["DL", "DAL", "Delta Air Lines", "skyteam", "delta-skymiles", "US", "#E31837", "ATL DTW MSP SLC JFK LAX SEA BOS"],
  ["AF", "AFR", "Air France", "skyteam", "flying-blue", "FR", "#002157", "CDG ORY"],
  ["KL", "KLM", "KLM Royal Dutch Airlines", "skyteam", "flying-blue", "NL", "#00A1DE", "AMS"],
  ["KE", "KAL", "Korean Air", "skyteam", "korean-air-skypass", "KR", "#0F4C81", "ICN GMP"],
  ["AM", "AMX", "Aeroméxico", "skyteam", "aeromexico-rewards", "MX", "#0B2343", "MEX"],
  ["VS", "VIR", "Virgin Atlantic", "skyteam", "virgin-atlantic-flying-club", "GB", "#E10A0A", "LHR MAN"],
  ["VN", "HVN", "Vietnam Airlines", "skyteam", undefined, "VN", "#0C5C4A", "SGN HAN"],
  ["CI", "CAL", "China Airlines", "skyteam", undefined, "TW", "#5F2C81", "TPE"],
  ["MU", "CES", "China Eastern", "skyteam", undefined, "CN", "#002A8C", "PVG SHA"],
  ["GA", "GIA", "Garuda Indonesia", "skyteam", undefined, "ID", "#0A4D8C", "CGK DPS"],
  ["SV", "SVA", "Saudia", "skyteam", undefined, "SA", "#006341", "JED RUH"],
  ["AR", "ARG", "Aerolíneas Argentinas", "skyteam", undefined, "AR", "#00A0DF", "EZE AEP"],
  ["AZ", "ITY", "ITA Airways", "skyteam", undefined, "IT", "#1A2F6B", "FCO LIN"],
  ["KQ", "KQA", "Kenya Airways", "skyteam", undefined, "KE", "#C8102E", "NBO"],
  ["UX", "AEA", "Air Europa", "skyteam", undefined, "ES", "#0E3A6A", "MAD"],
  ["ME", "MEA", "Middle East Airlines", "skyteam", undefined, "LB", "#0B3C5D", "BEY"],
  // SAS left Star Alliance for SkyTeam on 1 Sep 2024.
  ["SK", "SAS", "SAS Scandinavian Airlines", "skyteam", "sas-eurobonus", "SE", "#0F0F6E", "CPH ARN OSL"],
  // ─── Non-alliance ───────────────────────────────────────────
  ["EK", "UAE", "Emirates", "none", "emirates-skywards", "AE", "#D71920", "DXB"],
  ["EY", "ETD", "Etihad Airways", "none", "etihad-guest", "AE", "#BD8B13", "AUH"],
  ["B6", "JBU", "JetBlue", "none", "jetblue-trueblue", "US", "#003876", "JFK BOS FLL"],
  ["WN", "SWA", "Southwest Airlines", "none", "southwest-rapid-rewards", "US", "#304CB2", "DAL MDW DEN LAS BWI PHX"],
  ["VA", "VOZ", "Virgin Australia", "none", "virgin-australia-velocity", "AU", "#E4002B", "SYD MEL BNE"],
  ["EI", "EIN", "Aer Lingus", "none", "aer-lingus-aerclub", "IE", "#006272", "DUB"],
  ["LA", "LAN", "LATAM Airlines", "none", "latam-pass", "CL", "#ED1651", "SCL GRU LIM"],
  ["HA", "HAL", "Hawaiian Airlines", "none", "alaska-mileage-plan", "US", "#8B2F8B", "HNL"],
  ["WS", "WJA", "WestJet", "none", undefined, "CA", "#0F4D8F", "YYC YVR YYZ"],
  ["AD", "AZU", "Azul", "none", undefined, "BR", "#0F4FA5", "VCP CNF REC"],
  ["LY", "ELY", "El Al", "none", undefined, "IL", "#0B2F7E", "TLV"],
  ["6E", "IGO", "IndiGo", "none", undefined, "IN", "#001B94", "DEL BOM BLR HYD"],
  ["CZ", "CSN", "China Southern", "none", undefined, "CN", "#0C4DA2", "CAN PEK"],
  ["HU", "CHH", "Hainan Airlines", "none", undefined, "CN", "#D2122E", "PEK"],
  ["PR", "PAL", "Philippine Airlines", "none", undefined, "PH", "#0B3D91", "MNL CEB"],
  ["GF", "GFA", "Gulf Air", "none", undefined, "BH", "#B8860B", "BAH"],
  ["BI", "RBA", "Royal Brunei Airlines", "none", undefined, "BN", "#F5B800", "BWN"],
  ["MK", "MAU", "Air Mauritius", "none", undefined, "MU", "#C8102E", "MRU"],
  ["SU", "AFL", "Aeroflot", "none", undefined, "RU", "#00256A", "SVO"],
];

export const AIRLINES: Airline[] = ROWS.map(([iata, icao, name, alliance, programId, countryCode, color, hubs]) => ({
  iata,
  icao,
  name,
  alliance,
  ...(programId ? { programId } : {}),
  countryCode,
  color,
  hubs: hubs.split(" "),
}));

export const AIRLINE_BY_IATA: Record<string, Airline> = Object.fromEntries(AIRLINES.map((a) => [a.iata, a]));

const AIRLINE_BY_ICAO: Record<string, Airline> = Object.fromEntries(
  AIRLINES.filter((a) => a.icao).map((a) => [a.icao as string, a]),
);

export function getAirline(iata: string): Airline | undefined {
  return AIRLINE_BY_IATA[iata.toUpperCase()];
}

/** Map an ICAO callsign prefix (e.g. "SIA") to an IATA code ("SQ"). */
export function carrierFromCallsign(callsign: string | null | undefined): string | undefined {
  if (!callsign) return undefined;
  const prefix = callsign.trim().slice(0, 3).toUpperCase();
  return AIRLINE_BY_ICAO[prefix]?.iata;
}

/** Airlines in an alliance, in curated order. */
export function airlinesInAlliance(alliance: Alliance): Airline[] {
  return AIRLINES.filter((a) => a.alliance === alliance);
}

/** Airlines bookable through a given loyalty program (the program's own carriers). */
export function airlinesForProgram(programId: string): Airline[] {
  return AIRLINES.filter((a) => a.programId === programId);
}
