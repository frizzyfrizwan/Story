// Free public data layers. Each adapter returns { source, status: "live"|"unavailable", data?, error? }.
// All of these are US-government or open services with no API key.
import { getJSON, postText } from "./http.js";

export async function geocode(address) {
  const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  const r = await getJSON(url);
  const m = r.ok && r.data?.result?.addressMatches?.[0];
  if (!m) return { source: "US Census Geocoder", status: "unavailable", error: r.error || "no match" };
  return {
    source: "US Census Geocoder",
    status: "live",
    data: { lat: m.coordinates.y, lon: m.coordinates.x, matched: m.matchedAddress, zip: m.addressComponents?.zip, city: m.addressComponents?.city, state: m.addressComponents?.state },
  };
}

// FEMA National Flood Hazard Layer, layer 28 = flood hazard areas.
export async function floodZone(lat, lon) {
  const geom = encodeURIComponent(JSON.stringify({ x: lon, y: lat, spatialReference: { wkid: 4326 } }));
  const url = `https://hazards.fema.gov/arcgis/rest/services/public/NFHL/MapServer/28/query?geometry=${geom}&geometryType=esriGeometryPoint&inSR=4326&spatialRel=esriSpatialRelIntersects&outFields=FLD_ZONE,ZONE_SUBTY,STATIC_BFE,SFHA_TF,DFIRM_ID&returnGeometry=false&f=json`;
  const r = await getJSON(url, { timeoutMs: 12000 });
  const f = r.ok && r.data?.features?.[0]?.attributes;
  if (!f) return { source: "FEMA NFHL", status: "unavailable", error: r.error || "no feature" };
  return {
    source: "FEMA NFHL",
    status: "live",
    data: { floodZone: f.FLD_ZONE, subtype: f.ZONE_SUBTY, baseFloodElevationFt: f.STATIC_BFE > -9000 ? f.STATIC_BFE : null, sfha: f.SFHA_TF === "T", firm: f.DFIRM_ID },
  };
}

// USGS Elevation Point Query Service (ground elevation, NAVD88 feet).
export async function elevation(lat, lon) {
  const url = `https://epqs.nationalmap.gov/v1/json?x=${lon}&y=${lat}&units=Feet&wkid=4326&includeDate=false`;
  const r = await getJSON(url);
  const v = r.ok && r.data?.value;
  if (v === undefined || v === null) return { source: "USGS EPQS", status: "unavailable", error: r.error || "no value" };
  return { source: "USGS EPQS", status: "live", data: { groundElevationFt: Math.round(Number(v) * 10) / 10 } };
}

// Census ACS 5-year profile for the ZIP Code Tabulation Area.
export async function acsProfile(zip, year = 2023) {
  const vars = ["DP05_0018E", "DP03_0062E", "DP04_0046PE", "DP04_0003PE", "DP05_0001E"].join(",");
  const url = `https://api.census.gov/data/${year}/acs/acs5/profile?get=${vars}&for=zip%20code%20tabulation%20area:${zip}`;
  const r = await getJSON(url);
  const row = r.ok && Array.isArray(r.data) && r.data[1];
  if (!row) return { source: "US Census ACS 5-year", status: "unavailable", error: r.error || "no row" };
  const [medianAge, income, ownerPct, vacantPct, pop] = row.map(Number);
  return { source: `US Census ACS ${year} 5-year`, status: "live", data: { medianAge, medianHouseholdIncome: income, ownerOccupiedPct: ownerPct, vacantPct, population: pop } };
}

// OpenStreetMap Overpass: what is within walking distance.
export async function nearby(lat, lon, radiusM = 1600) {
  const q = `[out:json][timeout:20];(
    nwr(around:${radiusM},${lat},${lon})["shop"="supermarket"];
    nwr(around:${radiusM},${lat},${lon})["amenity"~"^(hospital|pharmacy|school|fire_station|police)$"];
    nwr(around:${radiusM},${lat},${lon})["natural"="beach"];
    nwr(around:${radiusM},${lat},${lon})["leisure"~"^(park|marina)$"];
    nwr(around:${radiusM},${lat},${lon})["public_transport"="stop_position"];
  );out center 60;`;
  const r = await postText("https://overpass-api.de/api/interpreter", `data=${encodeURIComponent(q)}`);
  if (!r.ok) return { source: "OpenStreetMap Overpass", status: "unavailable", error: r.error };
  const items = (r.data.elements || []).map((e) => {
    const la = e.lat ?? e.center?.lat, lo = e.lon ?? e.center?.lon;
    return { name: e.tags?.name || e.tags?.amenity || e.tags?.shop || e.tags?.natural || e.tags?.leisure || "stop", kind: e.tags?.shop || e.tags?.amenity || e.tags?.natural || e.tags?.leisure || e.tags?.public_transport, distanceFt: Math.round(haversineM(lat, lon, la, lo) * 3.281) };
  });
  items.sort((a, b) => a.distanceFt - b.distanceFt);
  return { source: "OpenStreetMap Overpass", status: "live", data: items.slice(0, 40) };
}

export function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// NOAA CO-OPS tide stations with long-term sea level trends near Southeast Florida (mm/yr, NOAA Sea Level Trends).
// Kept local because the trend table changes rarely and the API needs a station id anyway.
export const NOAA_TREND_STATIONS = [
  { id: "8723170", name: "Miami Beach / Virginia Key", lat: 25.7314, lon: -80.1618, mmPerYear: 3.95, since: 1931 },
  { id: "8722670", name: "Lake Worth Pier", lat: 26.6128, lon: -80.0339, mmPerYear: 4.84, since: 1970 },
  { id: "8724580", name: "Key West", lat: 24.5557, lon: -81.8079, mmPerYear: 2.59, since: 1913 },
];

export function nearestTrendStation(lat, lon) {
  let best = null;
  for (const s of NOAA_TREND_STATIONS) {
    const d = haversineM(lat, lon, s.lat, s.lon);
    if (!best || d < best.distanceM) best = { ...s, distanceM: Math.round(d) };
  }
  return best;
}
