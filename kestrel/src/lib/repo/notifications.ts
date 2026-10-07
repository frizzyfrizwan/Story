import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type NotificationRecord = typeof schema.notifications.$inferSelect;

export async function createNotification(
  userId: string,
  input: { kind: string; title: string; body: string; href?: string },
): Promise<NotificationRecord> {
  const db = await getDb();
  const [row] = await db.insert(schema.notifications).values({ userId, ...input, href: input.href ?? null }).returning();
  return row;
}

export async function listNotifications(userId: string, limit = 30): Promise<NotificationRecord[]> {
  const db = await getDb();
  return db.query.notifications.findMany({
    where: eq(schema.notifications.userId, userId),
    orderBy: desc(schema.notifications.createdAt),
    limit,
  });
}

export async function unreadCount(userId: string): Promise<number> {
  const db = await getDb();
  const rows = await db.query.notifications.findMany({
    where: and(eq(schema.notifications.userId, userId), eq(schema.notifications.read, false)),
    columns: { id: true },
  });
  return rows.length;
}

export async function markRead(userId: string, ids?: string[]): Promise<void> {
  const db = await getDb();
  if (!ids?.length) {
    await db.update(schema.notifications).set({ read: true }).where(eq(schema.notifications.userId, userId));
    return;
  }
  for (const id of ids) {
    await db
      .update(schema.notifications)
      .set({ read: true })
      .where(and(eq(schema.notifications.userId, userId), eq(schema.notifications.id, id)));
  }
}
