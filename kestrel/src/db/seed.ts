import { eq, sql } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";
import { SEED_PERSONAS, SEED_FINDS, SEED_TRANSFER_BONUSES, SEED_BALANCES, SEED_ALERTS } from "./seed-data";
import { airportDistanceMiles } from "@/data/airports";
import { estimateCashFare, cpp as cppOf } from "@/lib/awards";

/** Cents per point for a seeded flight redemption, using the cash-fare model for the route. */
function seedCpp(f: { origin?: string; destination?: string; cabin?: "economy" | "premium" | "business" | "first"; miles?: number; taxesUsd?: number; travelDate?: string }): number | null {
  if (!f.origin || !f.destination || !f.cabin || !f.miles) return null;
  const distance = airportDistanceMiles(f.origin, f.destination);
  if (!distance) return null;
  const cash = estimateCashFare(distance, f.cabin, f.travelDate);
  const value = cppOf(f.miles, f.taxesUsd ?? 0, cash);
  return value > 0 ? Math.round(value * 10) / 10 : null;
}

type Db = LibSQLDatabase<typeof schema>;

/** Seeds demo content when the finds table is empty. Idempotent. */
export async function seedDemoContent(db: Db, opts: { force?: boolean } = {}): Promise<{ seeded: boolean; finds: number }> {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(schema.finds);
  if (Number(n) > 0 && !opts.force) return { seeded: false, finds: Number(n) };

  // Several server processes can boot at once (build workers, serverless cold starts).
  // The first one to claim the lock row seeds; the others skip.
  if (opts.force) await db.delete(schema.appMeta).where(eq(schema.appMeta.key, "demo-seeded"));
  const claimed = await db
    .insert(schema.appMeta)
    .values({ key: "demo-seeded", value: new Date().toISOString() })
    .onConflictDoNothing()
    .returning({ key: schema.appMeta.key });
  if (!claimed.length) return { seeded: false, finds: Number(n) };

  const userIdByHandle = new Map<string, string>();
  for (const p of SEED_PERSONAS) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, p.email) });
    let userId = existing?.id;
    if (!userId) {
      const [u] = await db.insert(schema.users).values({ email: p.email, name: p.name, emailVerified: new Date() }).returning();
      userId = u.id;
    }
    await db
      .insert(schema.profiles)
      .values({ userId, handle: p.handle, displayName: p.name, bio: p.bio, homeAirport: p.homeAirport, avatarSeed: p.handle, plan: p.plan })
      .onConflictDoUpdate({
        target: schema.profiles.userId,
        set: { handle: p.handle, displayName: p.name, bio: p.bio, homeAirport: p.homeAirport, plan: p.plan },
      });
    userIdByHandle.set(p.handle, userId);
  }

  const now = Date.now();
  let count = 0;
  for (const f of SEED_FINDS) {
    const userId = userIdByHandle.get(f.handle);
    if (!userId) continue;
    const createdAt = new Date(now - f.daysAgo * 86_400_000 - (f.title.length % 7) * 3_600_000).toISOString();
    const cpp = seedCpp(f);
    await db.insert(schema.finds).values({
      userId,
      title: f.title,
      body: f.body,
      origin: f.origin ?? null,
      destination: f.destination ?? null,
      carrier: f.carrier ?? null,
      cabin: f.cabin ?? null,
      programId: f.programId ?? null,
      miles: f.miles ?? null,
      taxesUsd: f.taxesUsd ?? null,
      cpp: cpp ?? null,
      travelDate: f.travelDate ?? null,
      tags: f.tags,
      likeCount: f.likes,
      commentCount: 0,
      createdAt,
    });
    count++;
  }

  for (const b of SEED_TRANSFER_BONUSES) {
    await db.insert(schema.transferBonuses).values({
      fromProgramId: b.from,
      toProgramId: b.to,
      percent: b.percent,
      startsAt: b.startsAt,
      endsAt: b.endsAt,
      verifiedAt: "2026-10-01T00:00:00.000Z",
      note: b.note,
    });
  }

  for (const [handle, balances] of Object.entries(SEED_BALANCES)) {
    const userId = userIdByHandle.get(handle);
    if (!userId) continue;
    for (const b of balances) {
      await db
        .insert(schema.balances)
        .values({ userId, programId: b.programId, amount: b.amount, status: b.status ?? null, expiresAt: b.expiresAt ?? null, source: "manual" })
        .onConflictDoUpdate({ target: [schema.balances.userId, schema.balances.programId], set: { amount: b.amount } });
    }
  }

  for (const [handle, alerts] of Object.entries(SEED_ALERTS)) {
    const userId = userIdByHandle.get(handle);
    if (!userId) continue;
    for (const a of alerts) {
      await db.insert(schema.alerts).values({
        userId,
        name: a.name,
        origins: a.origins,
        destinations: a.destinations,
        dateFrom: a.dateFrom,
        dateTo: a.dateTo,
        cabin: a.cabin,
        passengers: a.passengers,
        maxMiles: a.maxMiles ?? null,
        programs: a.programs ?? null,
        channels: ["inapp", "email"],
      });
    }
  }

  return { seeded: true, finds: count };
}
