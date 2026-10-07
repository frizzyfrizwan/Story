"use client";

import { apiGet } from "@/lib/client/api";
import type { Airport } from "@/lib/types";

/** Fetcher for `AirportCombobox` — hits /api/airports so the combobox never bundles the airport table. */
export const fetchAirports = (q: string): Promise<Airport[]> => apiGet<Airport[]>("/api/airports", { q, limit: 8 });

/** Hubs offered while the query is empty. */
export const POPULAR_ORIGINS = ["JFK", "LAX", "SFO", "ORD", "BOS", "YYZ", "LHR"];

/** Curated city pairs shown when the calendar has no route yet. */
export const SUGGESTED_ROUTES: readonly (readonly [string, string])[] = [
  ["JFK", "LHR"],
  ["JFK", "NRT"],
  ["LAX", "SYD"],
  ["SFO", "HKG"],
  ["ORD", "FRA"],
  ["BOS", "LIS"],
];
