import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { FindAuthor } from "@/lib/types";

export type ProfileRecord = typeof schema.profiles.$inferSelect;

function handleFrom(nameOrEmail: string): string {
  const base = nameOrEmail.split("@")[0].toLowerCase().replace(/[^a-z0-9]+/g, "");
  return base || "traveler";
}

/** Get a profile, creating a default one for users that pre-date the profile table. */
export async function ensureProfile(userId: string): Promise<ProfileRecord> {
  const db = await getDb();
  const existing = await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, userId) });
  if (existing) return existing;
  const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
  const base = handleFrom(user?.name ?? user?.email ?? "traveler");
  let handle = base;
  for (let i = 0; i < 6; i++) {
    const clash = await db.query.profiles.findFirst({ where: eq(schema.profiles.handle, handle) });
    if (!clash) break;
    handle = `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
  }
  const [created] = await db
    .insert(schema.profiles)
    .values({ userId, handle, displayName: user?.name ?? handle, avatarSeed: userId })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, userId) }))!;
}

export async function getProfile(userId: string): Promise<ProfileRecord | null> {
  const db = await getDb();
  return (await db.query.profiles.findFirst({ where: eq(schema.profiles.userId, userId) })) ?? null;
}

export async function getProfileByHandle(handle: string): Promise<ProfileRecord | null> {
  const db = await getDb();
  return (await db.query.profiles.findFirst({ where: eq(schema.profiles.handle, handle.toLowerCase()) })) ?? null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<ProfileRecord, "displayName" | "bio" | "homeAirport" | "handle" | "preferences">>,
): Promise<ProfileRecord> {
  const db = await getDb();
  await ensureProfile(userId);
  if (patch.handle) {
    const h = patch.handle.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24);
    if (h.length < 3) throw new Error("Handle must be at least 3 characters");
    const clash = await db.query.profiles.findFirst({ where: eq(schema.profiles.handle, h) });
    if (clash && clash.userId !== userId) throw new Error("That handle is taken");
    patch.handle = h;
  }
  const [updated] = await db
    .update(schema.profiles)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.profiles.userId, userId))
    .returning();
  return updated;
}

export function toAuthor(p: ProfileRecord): FindAuthor {
  return { id: p.userId, handle: p.handle, name: p.displayName, avatarSeed: p.avatarSeed, plan: p.plan };
}

export async function setPlan(
  userId: string,
  plan: "free" | "pro",
  stripe?: { customerId?: string; subscriptionId?: string; renewsAt?: string },
) {
  const db = await getDb();
  await ensureProfile(userId);
  await db
    .update(schema.profiles)
    .set({
      plan,
      stripeCustomerId: stripe?.customerId,
      stripeSubscriptionId: stripe?.subscriptionId,
      planRenewsAt: stripe?.renewsAt,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.profiles.userId, userId));
}

export async function findUserIdByStripeCustomer(customerId: string): Promise<string | null> {
  const db = await getDb();
  const p = await db.query.profiles.findFirst({ where: eq(schema.profiles.stripeCustomerId, customerId) });
  return p?.userId ?? null;
}
