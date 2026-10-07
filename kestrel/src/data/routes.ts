import type { RouteDef } from "@/lib/types";

/** STUB — replaced by the geography agent. Keep these exports. */
export const ROUTES: RouteDef[] = [];

export function routesFrom(origin: string): RouteDef[] {
  const o = origin.toUpperCase();
  return ROUTES.filter((r) => r.origin === o);
}

export function routesBetween(origin: string, destination: string): RouteDef[] {
  const o = origin.toUpperCase();
  const d = destination.toUpperCase();
  return ROUTES.filter((r) => (r.origin === o && r.destination === d) || (r.origin === d && r.destination === o));
}

/** Distinct destination codes reachable nonstop from an origin. */
export function destinationsFrom(origin: string): string[] {
  return Array.from(new Set(routesFrom(origin).map((r) => r.destination)));
}
