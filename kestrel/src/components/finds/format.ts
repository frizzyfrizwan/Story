/**
 * Small, dependency-free formatting helpers for the Finds feature. Safe in server and client code.
 */

import { getAirport } from "@/data/airports";
import type { Find } from "@/lib/types";

const RTF = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "just now" · "4h ago" · "yesterday" · "3w ago" · "Mar 2026" */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.round((t - now) / 1000);
  const abs = Math.abs(diff);
  if (abs < 45) return "just now";
  if (abs < 3600) return `${Math.round(abs / 60)}m ago`;
  if (abs < 86_400) return `${Math.round(abs / 3600)}h ago`;
  if (abs < 86_400 * 7) {
    const days = Math.round(diff / 86_400);
    return days === -1 ? "yesterday" : `${Math.abs(days)}d ago`;
  }
  if (abs < 86_400 * 30) return `${Math.round(abs / (86_400 * 7))}w ago`;
  if (abs < 86_400 * 365) return RTF.format(Math.round(diff / (86_400 * 30)), "month");
  return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(t));
}

/** Absolute, for `title` attributes and `<time dateTime>` readers. */
export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

/** "May 2026" from an ISO timestamp — for "member since". */
export function fmtMonthYear(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(d);
}

/** Markdown → plain-ish text for previews and meta descriptions. */
export function plainText(md: string, max = 220): string {
  const text = md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
}

/** Cents-per-point from a cash price: (cash − taxes) / miles × 100. */
export function computeCpp(cashUsd: number, miles: number, taxesUsd = 0): number | null {
  if (!(miles > 0) || !(cashUsd > 0)) return null;
  const cpp = ((cashUsd - taxesUsd) / miles) * 100;
  if (!Number.isFinite(cpp) || cpp <= 0) return null;
  return Math.round(cpp * 10) / 10;
}

/** Tone for the cpp badge: gold ≥ 4¢, aurora ≥ 2¢, otherwise neutral. */
export function cppTone(cpp: number): "gold" | "aurora" | "neutral" {
  if (cpp >= 4) return "gold";
  if (cpp >= 2) return "aurora";
  return "neutral";
}

export function hasRoute(find: Pick<Find, "origin" | "destination">): find is Find & { origin: string; destination: string } {
  return Boolean(find.origin && find.destination);
}

/** `/search?from=JFK&to=HND&cabin=first` */
export function routeSearchHref(find: Pick<Find, "origin" | "destination" | "cabin">): string | null {
  if (!hasRoute(find)) return null;
  const p = new URLSearchParams({ from: find.origin, to: find.destination });
  if (find.cabin) p.set("cabin", find.cabin);
  return `/search?${p.toString()}`;
}

/** "Tokyo Haneda" for a code, or the code itself when unknown. */
export function airportLabel(iata: string): string {
  const a = getAirport(iata);
  return a ? `${a.city} · ${a.name}` : iata;
}

/** Tag → URL-safe slug (same rules the API applies). */
export function slugTag(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export const MAX_TAGS = 8;
