import type { PostcardMotif } from "@/components/art";
import { getAirport } from "@/data/airports";
import { HOTEL_CITIES, hotelsInCity } from "@/data/hotels";
import type { AwardRegion } from "@/lib/types";
import { hash32 } from "@/lib/utils";

export interface PostcardSpec {
  name: string;
  subtitle: string;
  motif: PostcardMotif;
  from: string;
  to: string;
}

/** Airports whose scenery is unmistakable regardless of what the hotel data says. */
const MOTIF_BY_AIRPORT: Record<string, PostcardMotif> = {
  MLE: "island",
  BOB: "island",
  DPS: "island",
  OGG: "island",
  LIH: "island",
  HNL: "island",
  ZNZ: "island",
  NAN: "island",
  PPT: "island",
  DXB: "desert",
  DOH: "desert",
  AUH: "desert",
  CAI: "desert",
  LAS: "desert",
  PHX: "desert",
  TUS: "desert",
  SJD: "desert",
  MCT: "desert",
  RUH: "desert",
  EGE: "mountain",
  RNO: "mountain",
  ZRH: "mountain",
  GVA: "mountain",
  DEN: "mountain",
  SLC: "mountain",
  INN: "mountain",
  KTM: "mountain",
  BDL: "forest",
  MRY: "forest",
  SEA: "forest",
  PDX: "forest",
  YVR: "forest",
  HEL: "forest",
  OSL: "forest",
  CUN: "coast",
  MIA: "coast",
  SAN: "coast",
  SNA: "coast",
  LIR: "coast",
  GIG: "coast",
  SYD: "coast",
  LIS: "coast",
  BCN: "coast",
  CPT: "coast",
  DAD: "coast",
  NCE: "coast",
  ATH: "coast",
  DUB: "coast",
  AKL: "coast",
  HKG: "coast",
  SIN: "coast",
};

/** Dusk palettes per region: [sky top, sky bottom]. Artwork colours live in data, not CSS tokens. */
const REGION_ART: Record<AwardRegion, { motif: PostcardMotif; from: string; to: string }> = {
  "north-america": { motif: "skyline", from: "#141a33", to: "#d96b8a" },
  hawaii: { motif: "island", from: "#0b3954", to: "#ff9f6b" },
  "central-america": { motif: "coast", from: "#10303a", to: "#5fc9b0" },
  caribbean: { motif: "island", from: "#0f2d4a", to: "#48c9c0" },
  "south-america": { motif: "mountain", from: "#1c1333", to: "#e07a5f" },
  europe: { motif: "skyline", from: "#1b2140", to: "#c48ba6" },
  "middle-east": { motif: "desert", from: "#2a1538", to: "#f0a35c" },
  "north-africa": { motif: "desert", from: "#2b1a2e", to: "#e8b07a" },
  "sub-saharan-africa": { motif: "desert", from: "#1f1a2d", to: "#d9823b" },
  "central-asia": { motif: "mountain", from: "#17213a", to: "#9bb7d4" },
  "north-asia": { motif: "skyline", from: "#121a35", to: "#e58aa4" },
  "south-asia": { motif: "coast", from: "#2a1a3a", to: "#f2a65a" },
  "southeast-asia": { motif: "island", from: "#0f2d3a", to: "#5ec8a8" },
  oceania: { motif: "coast", from: "#102a44", to: "#67c3e8" },
};

const CITY_BY_AIRPORT = new Map(HOTEL_CITIES.map((c) => [c.airport, c] as const));

/** Pick art for a destination: curated hotel palettes when we have them, otherwise a regional dusk. */
export function postcardFor(iata: string): PostcardSpec {
  const code = iata.toUpperCase();
  const airport = getAirport(code);
  const city = CITY_BY_AIRPORT.get(code);
  const name = city?.name ?? airport?.city ?? code;
  const subtitle = airport?.country ?? city?.countryCode ?? code;
  const region = airport?.region ?? "europe";
  const base = REGION_ART[region];

  const hotels = city ? hotelsInCity(city.name) : [];
  const pick = hotels.length ? hotels[hash32(code) % hotels.length] : undefined;
  const motif = MOTIF_BY_AIRPORT[code] ?? (city?.resort ? (pick?.art.motif ?? "coast") : (pick?.art.motif ?? base.motif));

  return {
    name,
    subtitle,
    motif,
    from: pick?.art.from ?? base.from,
    to: pick?.art.to ?? base.to,
  };
}
