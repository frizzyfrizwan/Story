import type { AwardRegion, Cabin } from "@/lib/types";

/*
 * Plain (no "use client") module: constants and helpers shared by the server page and the client
 * tabs. Anything exported from a client module would arrive on the server as a client reference.
 */

export type ExploreView = "deals" | "calendar" | "reach";
export const EXPLORE_VIEWS: readonly ExploreView[] = ["deals", "calendar", "reach"] as const;

export type DealSort = "value" | "miles" | "savings";
export const DEAL_SORTS: readonly DealSort[] = ["value", "miles", "savings"] as const;

/** "just now" · "4m ago" · "2h ago" · "3d ago" · "Mar 4" — for "checked 4m ago" style captions. */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const diff = Math.max(0, now - t);
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(t));
}

export const REGION_LABEL: Record<AwardRegion, string> = {
  "north-america": "North America",
  hawaii: "Hawaii",
  "central-america": "Central America",
  caribbean: "Caribbean",
  "south-america": "South America",
  europe: "Europe",
  "middle-east": "Middle East",
  "north-africa": "North Africa",
  "sub-saharan-africa": "Sub-Saharan Africa",
  "central-asia": "Central Asia",
  "north-asia": "North Asia",
  "south-asia": "South Asia",
  "southeast-asia": "Southeast Asia",
  oceania: "Oceania",
};

export const ALL_REGIONS = Object.keys(REGION_LABEL) as AwardRegion[];

/** Cabin colour token names for inline styles and canvas layers. */
export const CABIN_VAR: Record<Cabin, string> = {
  economy: "--cabin-economy",
  premium: "--cabin-premium",
  business: "--cabin-business",
  first: "--cabin-first",
};

/** Build a /search href from a route + date + cabin. */
export function searchHref(params: { from: string; to: string; date?: string; cabin?: Cabin; passengers?: number }): string {
  const sp = new URLSearchParams();
  sp.set("from", params.from);
  sp.set("to", params.to);
  if (params.date) sp.set("date", params.date);
  if (params.cabin) sp.set("cabin", params.cabin);
  if (params.passengers && params.passengers > 1) sp.set("pax", String(params.passengers));
  return `/search?${sp.toString()}`;
}

/** Build an /explore href that opens a tab with the given route. */
export function exploreHref(params: { view?: "deals" | "calendar" | "reach"; from?: string; to?: string; cabin?: Cabin }): string {
  const sp = new URLSearchParams();
  if (params.view) sp.set("view", params.view);
  if (params.from) sp.set("from", params.from);
  if (params.to) sp.set("to", params.to);
  if (params.cabin) sp.set("cabin", params.cabin);
  const s = sp.toString();
  return s ? `/explore?${s}` : "/explore";
}

/** "Mar 20 – Apr 10, 2027" */
export function fmtWindow(from: string, to: string): string {
  const f = new Date(from.slice(0, 10) + "T00:00:00");
  const t = new Date(to.slice(0, 10) + "T00:00:00");
  const sameYear = f.getFullYear() === t.getFullYear();
  const a = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) }).format(f);
  const b = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(t);
  return `${a} – ${b}`;
}
