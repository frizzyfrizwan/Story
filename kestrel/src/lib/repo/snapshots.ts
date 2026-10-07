import "server-only";
import { and, desc, eq, gte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AvailabilityDay, Cabin } from "@/lib/types";

export async function recentSnapshots(origin: string, destination: string, cabin: Cabin, sinceIso: string): Promise<AvailabilityDay[]> {
  const db = await getDb();
  const rows = await db.query.availabilitySnapshots.findMany({
    where: and(
      eq(schema.availabilitySnapshots.origin, origin.toUpperCase()),
      eq(schema.availabilitySnapshots.destination, destination.toUpperCase()),
      eq(schema.availabilitySnapshots.cabin, cabin),
      gte(schema.availabilitySnapshots.fetchedAt, sinceIso),
    ),
    orderBy: desc(schema.availabilitySnapshots.fetchedAt),
    limit: 2000,
  });
  const seen = new Set<string>();
  const out: AvailabilityDay[] = [];
  for (const r of rows) {
    const key = `${r.date}|${r.programId}|${r.carrier}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      date: r.date,
      cabin: r.cabin as Cabin,
      programId: r.programId,
      miles: r.miles,
      taxesUsd: r.taxesUsd,
      seats: r.seats,
      carrier: r.carrier,
      source: "cached",
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export async function snapshotCount(): Promise<number> {
  const db = await getDb();
  const rows = await db.query.availabilitySnapshots.findMany({ columns: { id: true }, limit: 100000 });
  return rows.length;
}
