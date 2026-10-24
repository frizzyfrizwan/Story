// South Florida employment hubs for the commute model when no geocoder is reachable. Coordinates are approximate (within about half a mile).
export const HUBS = [
  { id: "ftl-downtown", name: "Downtown Fort Lauderdale (Las Olas / Brickell Ave)", lat: 26.1224, lon: -80.1373 },
  { id: "fll", name: "Fort Lauderdale-Hollywood Airport (FLL) / Port Everglades", lat: 26.0726, lon: -80.1527 },
  { id: "broward-health", name: "Broward Health Medical Center", lat: 26.1030, lon: -80.1430 },
  { id: "holy-cross", name: "Holy Cross Health (Fort Lauderdale)", lat: 26.1880, lon: -80.1200 },
  { id: "cypress-creek", name: "Cypress Creek office district (Fort Lauderdale)", lat: 26.2030, lon: -80.1430 },
  { id: "pompano-downtown", name: "Downtown Pompano Beach (Atlantic Blvd)", lat: 26.2379, lon: -80.1248 },
  { id: "pompano-industrial", name: "Pompano Beach industrial / Copans Rd", lat: 26.2550, lon: -80.1500 },
  { id: "broward-health-north", name: "Broward Health North (Deerfield Beach)", lat: 26.2890, lon: -80.1120 },
  { id: "deerfield-office", name: "Deerfield Beach Hillsboro Blvd offices (I-95)", lat: 26.3180, lon: -80.1300 },
  { id: "boca-downtown", name: "Downtown Boca Raton / Mizner Park", lat: 26.3500, lon: -80.0840 },
  { id: "boca-fau", name: "Boca Raton Town Center / FAU / Office Depot campus", lat: 26.3660, lon: -80.1300 },
  { id: "coral-springs", name: "Coral Springs (University Dr / Sample Rd)", lat: 26.2710, lon: -80.2706 },
  { id: "sawgrass", name: "Sunrise / Sawgrass corporate park", lat: 26.1510, lon: -80.3260 },
  { id: "plantation-midtown", name: "Plantation Midtown (Broward Blvd / University)", lat: 26.1200, lon: -80.2530 },
  { id: "nova-davie", name: "Davie (Nova Southeastern / Broward College)", lat: 26.0790, lon: -80.2420 },
  { id: "weston", name: "Weston Town Center", lat: 26.1000, lon: -80.4000 },
  { id: "memorial-hollywood", name: "Memorial Regional Hospital (Hollywood)", lat: 26.0150, lon: -80.1550 },
  { id: "aventura", name: "Aventura", lat: 25.9560, lon: -80.1390 },
  { id: "miami-brickell", name: "Downtown Miami / Brickell", lat: 25.7650, lon: -80.1930 },
  { id: "mia", name: "Miami International Airport / Doral", lat: 25.7950, lon: -80.2870 },
  { id: "wpb", name: "Downtown West Palm Beach", lat: 26.7150, lon: -80.0530 },
];

export function haversineMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8, toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Drive-time estimate for Broward and neighbors: road distance about 1.35x straight line, 26 mph average door to door in peak, plus 5 minutes to park.
export function commute(from, to) {
  if (!from?.lat || !to?.lat) return null;
  const straight = haversineMiles(from.lat, from.lon, to.lat, to.lon);
  const road = straight * 1.35;
  const peakMin = Math.round((road / 26) * 60 + 5);
  const offPeakMin = Math.round((road / 34) * 60 + 4);
  return { miles: Math.round(road * 10) / 10, peakMin, offPeakMin };
}
