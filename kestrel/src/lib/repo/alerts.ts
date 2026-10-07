import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { AlertRule, AlertHit, Cabin } from "@/lib/types";
import { getRouteAvailability } from "@/lib/providers";
import { createNotification } from "./notifications";

type AlertRow = typeof schema.alerts.$inferSelect;
type HitRow = typeof schema.alertHits.$inferSelect;

export function rowToAlert(r: AlertRow): AlertRule {
  return {
    id: r.id,
    userId: r.userId,
    name: r.name,
    origins: r.origins,
    destinations: r.destinations,
    dateFrom: r.dateFrom,
    dateTo: r.dateTo,
    cabin: r.cabin as Cabin,
    passengers: r.passengers,
    maxMiles: r.maxMiles ?? undefined,
    programs: r.programs ?? undefined,
    channels: r.channels as AlertRule["channels"],
    active: r.active,
    createdAt: r.createdAt,
    lastCheckedAt: r.lastCheckedAt ?? undefined,
    lastHitAt: r.lastHitAt ?? undefined,
    hitCount: r.hitCount,
  };
}

function rowToHit(r: HitRow): AlertHit {
  return {
    id: r.id,
    alertId: r.alertId,
    date: r.date,
    origin: r.origin,
    destination: r.destination,
    carrier: r.carrier,
    programId: r.programId,
    cabin: r.cabin as Cabin,
    miles: r.miles,
    taxesUsd: r.taxesUsd,
    seats: r.seats,
    foundAt: r.foundAt,
  };
}

export async function listAlerts(userId: string): Promise<AlertRule[]> {
  const db = await getDb();
  const rows = await db.query.alerts.findMany({ where: eq(schema.alerts.userId, userId), orderBy: desc(schema.alerts.createdAt) });
  return rows.map(rowToAlert);
}

export async function getAlert(userId: string, id: string): Promise<AlertRule | null> {
  const db = await getDb();
  const row = await db.query.alerts.findFirst({ where: and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId)) });
  return row ? rowToAlert(row) : null;
}

export interface AlertInput {
  name?: string;
  origins: string[];
  destinations: string[];
  dateFrom: string;
  dateTo: string;
  cabin: Cabin;
  passengers?: number;
  maxMiles?: number;
  programs?: string[];
  channels?: AlertRule["channels"];
}

export async function createAlert(userId: string, input: AlertInput): Promise<AlertRule> {
  const db = await getDb();
  const name = input.name?.trim() || `${input.origins.join("/")} → ${input.destinations.join("/")} · ${input.cabin}`;
  const [row] = await db
    .insert(schema.alerts)
    .values({
      userId,
      name,
      origins: input.origins.map((s) => s.toUpperCase()),
      destinations: input.destinations.map((s) => s.toUpperCase()),
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      cabin: input.cabin,
      passengers: input.passengers ?? 1,
      maxMiles: input.maxMiles ?? null,
      programs: input.programs?.length ? input.programs : null,
      channels: input.channels?.length ? input.channels : ["inapp", "email"],
    })
    .returning();
  return rowToAlert(row);
}

export async function updateAlert(userId: string, id: string, patch: Partial<AlertInput> & { active?: boolean }): Promise<AlertRule | null> {
  const db = await getDb();
  const [row] = await db
    .update(schema.alerts)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.origins ? { origins: patch.origins.map((s) => s.toUpperCase()) } : {}),
      ...(patch.destinations ? { destinations: patch.destinations.map((s) => s.toUpperCase()) } : {}),
      ...(patch.dateFrom ? { dateFrom: patch.dateFrom } : {}),
      ...(patch.dateTo ? { dateTo: patch.dateTo } : {}),
      ...(patch.cabin ? { cabin: patch.cabin } : {}),
      ...(patch.passengers !== undefined ? { passengers: patch.passengers } : {}),
      ...(patch.maxMiles !== undefined ? { maxMiles: patch.maxMiles ?? null } : {}),
      ...(patch.programs !== undefined ? { programs: patch.programs?.length ? patch.programs : null } : {}),
      ...(patch.channels ? { channels: patch.channels } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
    })
    .where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId)))
    .returning();
  return row ? rowToAlert(row) : null;
}

export async function deleteAlert(userId: string, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.alerts).where(and(eq(schema.alerts.id, id), eq(schema.alerts.userId, userId)));
}

export async function listHits(userId: string, alertId?: string, limit = 50): Promise<AlertHit[]> {
  const db = await getDb();
  const mine = await db.query.alerts.findMany({ where: eq(schema.alerts.userId, userId), columns: { id: true } });
  const ids = new Set(mine.map((a) => a.id));
  if (alertId && !ids.has(alertId)) return [];
  const rows = await db.query.alertHits.findMany({
    where: alertId ? eq(schema.alertHits.alertId, alertId) : undefined,
    orderBy: desc(schema.alertHits.foundAt),
    limit: alertId ? limit : limit * 4,
  });
  return rows.filter((r) => ids.has(r.alertId)).slice(0, limit).map(rowToHit);
}

/**
 * Check one alert against current availability. Returns new hits (deduped).
 * Called by the cron route and by "Check now" in the UI.
 */
export async function runAlert(alert: AlertRule): Promise<AlertHit[]> {
  const db = await getDb();
  const newHits: AlertHit[] = [];
  for (const origin of alert.origins) {
    for (const destination of alert.destinations) {
      const avail = await getRouteAvailability(origin, destination, alert.cabin, alert.dateFrom, alert.dateTo).catch(() => null);
      if (!avail) continue;
      for (const day of avail.days) {
        if (day.seats < alert.passengers) continue;
        if (alert.maxMiles && day.miles > alert.maxMiles) continue;
        if (alert.programs?.length && !alert.programs.includes(day.programId)) continue;
        const [row] = await db
          .insert(schema.alertHits)
          .values({
            alertId: alert.id,
            date: day.date,
            origin: day.carrier ? avail.origin : origin,
            destination: avail.destination,
            carrier: day.carrier,
            programId: day.programId,
            cabin: day.cabin,
            miles: day.miles,
            taxesUsd: day.taxesUsd,
            seats: day.seats,
          })
          .onConflictDoNothing()
          .returning();
        if (row) newHits.push(rowToHit(row));
      }
    }
  }
  await db
    .update(schema.alerts)
    .set({
      lastCheckedAt: new Date().toISOString(),
      ...(newHits.length ? { lastHitAt: new Date().toISOString(), hitCount: alert.hitCount + newHits.length } : {}),
    })
    .where(eq(schema.alerts.id, alert.id));

  if (newHits.length && alert.channels.includes("inapp")) {
    const best = [...newHits].sort((a, b) => a.miles - b.miles)[0];
    await createNotification(alert.userId, {
      kind: "alert",
      title: `${newHits.length} new award seat${newHits.length > 1 ? "s" : ""}: ${alert.name}`,
      body: `${best.origin}→${best.destination} ${best.date} · ${best.miles.toLocaleString()} miles + $${Math.round(best.taxesUsd)} (${best.seats} seats)`,
      href: `/alerts/${alert.id}`,
    });
  }
  return newHits;
}

/** Run every active alert whose window hasn't passed. Returns a summary for the cron log. */
export async function runAllAlerts(limit = 200): Promise<{ checked: number; hits: number; notified: { userId: string; alertId: string; hits: AlertHit[] }[] }> {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db.query.alerts.findMany({ where: eq(schema.alerts.active, true), limit });
  let checked = 0;
  let hits = 0;
  const notified: { userId: string; alertId: string; hits: AlertHit[] }[] = [];
  for (const row of rows) {
    if (row.dateTo < today) {
      await db.update(schema.alerts).set({ active: false }).where(eq(schema.alerts.id, row.id));
      continue;
    }
    const alert = rowToAlert(row);
    const found = await runAlert(alert);
    checked++;
    hits += found.length;
    if (found.length) notified.push({ userId: alert.userId, alertId: alert.id, hits: found });
  }
  return { checked, hits, notified };
}
