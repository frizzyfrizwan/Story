"use client";

import { StatTile } from "@/components/ui/stat";

export interface CoverageStatsProps {
  programs: number;
  hotels: number;
  cities: number;
  /** Nonstop routes modelled; 0 falls back to the airport index */
  routes: number;
  airports: number;
  finds: number;
}

/**
 * The four coverage KPIs. Lives on the client so StatTile's animated NumberTicker
 * (which takes a formatter function) never has to cross the server boundary.
 */
export function CoverageStats({ programs, hotels, cities, routes, airports, finds }: CoverageStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Programs searched" value={programs} animate tone="aurora" hint="airline, hotel and bank" />
      <StatTile label="Hotels with charts" value={hotels} animate tone="gold" hint={`across ${cities} cities`} />
      {routes > 0 ? (
        <StatTile label="Nonstop routes" value={routes} animate tone="sky" hint="modelled with real schedules" />
      ) : (
        <StatTile label="Airports indexed" value={airports} animate tone="sky" hint="with metro groups" />
      )}
      <StatTile label="Community finds" value={finds} animate tone="signal" hint="posted by members" />
    </div>
  );
}
