import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Find, FindComment, Cabin } from "@/lib/types";
import { ensureProfile, toAuthor, type ProfileRecord } from "./profiles";

type FindRow = typeof schema.finds.$inferSelect;

async function authorsFor(userIds: string[]): Promise<Map<string, ProfileRecord>> {
  const db = await getDb();
  const ids = Array.from(new Set(userIds));
  if (!ids.length) return new Map();
  const rows = await db.query.profiles.findMany({ where: inArray(schema.profiles.userId, ids) });
  return new Map(rows.map((r) => [r.userId, r]));
}

function toFind(row: FindRow, author: ProfileRecord | undefined, likedByMe: boolean): Find {
  return {
    id: row.id,
    author: author
      ? toAuthor(author)
      : { id: row.userId, handle: "traveler", name: "Traveler", avatarSeed: row.userId, plan: "free" },
    title: row.title,
    body: row.body,
    origin: row.origin ?? undefined,
    destination: row.destination ?? undefined,
    carrier: row.carrier ?? undefined,
    cabin: (row.cabin as Cabin | null) ?? undefined,
    programId: row.programId ?? undefined,
    miles: row.miles ?? undefined,
    taxesUsd: row.taxesUsd ?? undefined,
    cpp: row.cpp ?? undefined,
    travelDate: row.travelDate ?? undefined,
    tags: row.tags ?? [],
    likes: row.likeCount,
    comments: row.commentCount,
    likedByMe,
    createdAt: row.createdAt,
  };
}

export interface FeedOptions {
  cursor?: string; // createdAt of last item
  limit?: number;
  sort?: "new" | "top";
  tag?: string;
  cabin?: Cabin;
  programId?: string;
  userId?: string; // filter by author
  viewerId?: string | null;
}

export async function listFinds(opts: FeedOptions = {}): Promise<{ items: Find[]; nextCursor: string | null }> {
  const db = await getDb();
  const limit = Math.min(opts.limit ?? 20, 50);
  const where = and(
    opts.cursor && opts.sort !== "top" ? lt(schema.finds.createdAt, opts.cursor) : undefined,
    opts.cabin ? eq(schema.finds.cabin, opts.cabin) : undefined,
    opts.programId ? eq(schema.finds.programId, opts.programId) : undefined,
    opts.userId ? eq(schema.finds.userId, opts.userId) : undefined,
    opts.tag ? sql`${schema.finds.tags} LIKE ${"%\"" + opts.tag + "\"%"}` : undefined,
  );
  const rows = await db.query.finds.findMany({
    where,
    orderBy: opts.sort === "top" ? [desc(schema.finds.likeCount), desc(schema.finds.createdAt)] : desc(schema.finds.createdAt),
    limit: limit + 1,
  });
  const page = rows.slice(0, limit);
  const authors = await authorsFor(page.map((r) => r.userId));
  const liked = new Set<string>();
  if (opts.viewerId && page.length) {
    const likes = await db.query.findLikes.findMany({
      where: and(eq(schema.findLikes.userId, opts.viewerId), inArray(schema.findLikes.findId, page.map((r) => r.id))),
    });
    likes.forEach((l) => liked.add(l.findId));
  }
  return {
    items: page.map((r) => toFind(r, authors.get(r.userId), liked.has(r.id))),
    nextCursor: rows.length > limit && opts.sort !== "top" ? page[page.length - 1].createdAt : null,
  };
}

export async function getFind(id: string, viewerId?: string | null): Promise<Find | null> {
  const db = await getDb();
  const row = await db.query.finds.findFirst({ where: eq(schema.finds.id, id) });
  if (!row) return null;
  const authors = await authorsFor([row.userId]);
  let likedByMe = false;
  if (viewerId) {
    const like = await db.query.findLikes.findFirst({
      where: and(eq(schema.findLikes.findId, id), eq(schema.findLikes.userId, viewerId)),
    });
    likedByMe = Boolean(like);
  }
  return toFind(row, authors.get(row.userId), likedByMe);
}

export interface FindInput {
  title: string;
  body: string;
  origin?: string;
  destination?: string;
  carrier?: string;
  cabin?: Cabin;
  programId?: string;
  miles?: number;
  taxesUsd?: number;
  cpp?: number;
  travelDate?: string;
  tags?: string[];
}

export async function createFind(userId: string, input: FindInput): Promise<Find> {
  const db = await getDb();
  await ensureProfile(userId);
  const [row] = await db
    .insert(schema.finds)
    .values({
      userId,
      title: input.title.trim().slice(0, 140),
      body: input.body.trim().slice(0, 4000),
      origin: input.origin?.toUpperCase() ?? null,
      destination: input.destination?.toUpperCase() ?? null,
      carrier: input.carrier?.toUpperCase() ?? null,
      cabin: input.cabin ?? null,
      programId: input.programId ?? null,
      miles: input.miles ?? null,
      taxesUsd: input.taxesUsd ?? null,
      cpp: input.cpp ?? null,
      travelDate: input.travelDate ?? null,
      tags: (input.tags ?? []).map((t) => t.toLowerCase().replace(/[^a-z0-9-]/g, "")).filter(Boolean).slice(0, 8),
    })
    .returning();
  const authors = await authorsFor([userId]);
  return toFind(row, authors.get(userId), false);
}

export async function deleteFind(userId: string, id: string): Promise<boolean> {
  const db = await getDb();
  const res = await db.delete(schema.finds).where(and(eq(schema.finds.id, id), eq(schema.finds.userId, userId))).returning({ id: schema.finds.id });
  return res.length > 0;
}

export async function toggleLike(userId: string, findId: string): Promise<{ liked: boolean; likes: number }> {
  const db = await getDb();
  const existing = await db.query.findLikes.findFirst({
    where: and(eq(schema.findLikes.findId, findId), eq(schema.findLikes.userId, userId)),
  });
  if (existing) {
    await db.delete(schema.findLikes).where(and(eq(schema.findLikes.findId, findId), eq(schema.findLikes.userId, userId)));
    const [row] = await db
      .update(schema.finds)
      .set({ likeCount: sql`MAX(0, ${schema.finds.likeCount} - 1)` })
      .where(eq(schema.finds.id, findId))
      .returning({ likes: schema.finds.likeCount });
    return { liked: false, likes: row?.likes ?? 0 };
  }
  await db.insert(schema.findLikes).values({ findId, userId }).onConflictDoNothing();
  const [row] = await db
    .update(schema.finds)
    .set({ likeCount: sql`${schema.finds.likeCount} + 1` })
    .where(eq(schema.finds.id, findId))
    .returning({ likes: schema.finds.likeCount });
  return { liked: true, likes: row?.likes ?? 1 };
}

export async function listComments(findId: string): Promise<FindComment[]> {
  const db = await getDb();
  const rows = await db.query.findComments.findMany({ where: eq(schema.findComments.findId, findId), orderBy: schema.findComments.createdAt });
  const authors = await authorsFor(rows.map((r) => r.userId));
  return rows.map((r) => ({
    id: r.id,
    findId: r.findId,
    author: authors.get(r.userId)
      ? toAuthor(authors.get(r.userId)!)
      : { id: r.userId, handle: "traveler", name: "Traveler", avatarSeed: r.userId, plan: "free" },
    body: r.body,
    createdAt: r.createdAt,
  }));
}

export async function addComment(userId: string, findId: string, body: string): Promise<FindComment> {
  const db = await getDb();
  await ensureProfile(userId);
  const [row] = await db.insert(schema.findComments).values({ userId, findId, body: body.trim().slice(0, 2000) }).returning();
  await db
    .update(schema.finds)
    .set({ commentCount: sql`${schema.finds.commentCount} + 1` })
    .where(eq(schema.finds.id, findId));
  const authors = await authorsFor([userId]);
  const a = authors.get(userId)!;
  return { id: row.id, findId, author: toAuthor(a), body: row.body, createdAt: row.createdAt };
}

export async function trendingTags(limit = 12): Promise<{ tag: string; count: number }[]> {
  const db = await getDb();
  const rows = await db.query.finds.findMany({ columns: { tags: true }, orderBy: desc(schema.finds.createdAt), limit: 300 });
  const counts = new Map<string, number>();
  rows.forEach((r) => (r.tags ?? []).forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1)));
  return Array.from(counts, ([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export async function countFinds(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select({ n: sql<number>`count(*)` }).from(schema.finds);
  return Number(row?.n ?? 0);
}
