/**
 * Serialisable view models for the trips UI. The server pages build these from
 * `TripRecord` + reference data (airports, programs, hotels) so the client never
 * imports the big data tables.
 */

export type TripItemKind = "flight" | "hotel" | "note";

export interface TripSummary {
  id: string;
  title: string;
  notes: string;
  counts: Record<TripItemKind, number>;
  createdAt: string;
  updatedAt: string;
}

export interface TripItemMeta {
  originCity?: string;
  destinationCity?: string;
  carrierName?: string;
  carrierColor?: string;
  programId?: string;
  programName?: string;
  programColor?: string;
  hotelName?: string;
  hotelCity?: string;
}

export interface TripItemView {
  id: string;
  kind: TripItemKind;
  addedAt: string;
  /** The raw saved payload — rendered defensively. */
  payload: Record<string, unknown>;
  meta: TripItemMeta;
}

export interface ProgramTotal {
  programId: string;
  name: string;
  color: string;
  points: number;
}

export interface TripTotals {
  byProgram: ProgramTotal[];
  /** Flight taxes & fees (USD). */
  taxesUsd: number;
  /** Cash alternative for hotel stays (USD). */
  hotelCashUsd: number;
  nights: number;
}

export interface TripView {
  id: string;
  title: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  items: TripItemView[];
  totals: TripTotals;
}

// ─── Payload readers (shared by server enrichment and client rendering) ───

export function str(v: unknown): string | undefined {
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export function num(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

export function isoDate(v: unknown): string | undefined {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : undefined;
}
