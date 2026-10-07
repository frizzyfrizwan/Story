import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type TripRecord = typeof schema.trips.$inferSelect;

/** Items saved into a trip: award results, hotel quotes, notes. Kept loose on purpose. */
export interface TripItem {
  id: string;
  kind: "flight" | "hotel" | "note";
  addedAt: string;
  payload: Record<string, unknown>;
}

export async function listTrips(userId: string): Promise<TripRecord[]> {
  const db = await getDb();
  return db.query.trips.findMany({ where: eq(schema.trips.userId, userId), orderBy: desc(schema.trips.updatedAt) });
}

export async function getTrip(userId: string, id: string): Promise<TripRecord | null> {
  const db = await getDb();
  return (await db.query.trips.findFirst({ where: and(eq(schema.trips.id, id), eq(schema.trips.userId, userId)) })) ?? null;
}

export async function createTrip(userId: string, title: string, notes = ""): Promise<TripRecord> {
  const db = await getDb();
  const [row] = await db.insert(schema.trips).values({ userId, title: title.trim().slice(0, 120), notes }).returning();
  return row;
}

export async function addTripItem(userId: string, tripId: string, item: Omit<TripItem, "id" | "addedAt">): Promise<TripRecord | null> {
  const db = await getDb();
  const trip = await getTrip(userId, tripId);
  if (!trip) return null;
  const items = [...((trip.items as TripItem[]) ?? []), { ...item, id: crypto.randomUUID(), addedAt: new Date().toISOString() }];
  const [row] = await db
    .update(schema.trips)
    .set({ items, updatedAt: new Date().toISOString() })
    .where(eq(schema.trips.id, tripId))
    .returning();
  return row;
}

export async function removeTripItem(userId: string, tripId: string, itemId: string): Promise<TripRecord | null> {
  const db = await getDb();
  const trip = await getTrip(userId, tripId);
  if (!trip) return null;
  const items = ((trip.items as TripItem[]) ?? []).filter((i) => i.id !== itemId);
  const [row] = await db
    .update(schema.trips)
    .set({ items, updatedAt: new Date().toISOString() })
    .where(eq(schema.trips.id, tripId))
    .returning();
  return row;
}

export async function deleteTrip(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.trips).where(and(eq(schema.trips.id, id), eq(schema.trips.userId, userId)));
}
