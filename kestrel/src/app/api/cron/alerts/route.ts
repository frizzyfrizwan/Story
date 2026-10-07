import { eq } from "drizzle-orm";
import { env } from "@/env";
import { ok, fail } from "@/lib/api";
import { runAllAlerts } from "@/lib/repo/alerts";
import { sendAlertEmail } from "@/lib/email";
import { getDb, schema } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Checks every active alert. Schedule with Vercel Cron (see vercel.json) or any
 * scheduler that can send `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(req: Request) {
  const authz = req.headers.get("authorization");
  if (env.CRON_SECRET && authz !== `Bearer ${env.CRON_SECRET}`) return fail("Unauthorized", 401);
  if (!env.CRON_SECRET && env.NODE_ENV === "production") return fail("CRON_SECRET not configured", 503);

  const started = Date.now();
  const summary = await runAllAlerts();
  let emailed = 0;
  const db = await getDb();
  for (const n of summary.notified) {
    const user = await db.query.users.findFirst({ where: eq(schema.users.id, n.userId) });
    const alert = await db.query.alerts.findFirst({ where: eq(schema.alerts.id, n.alertId) });
    if (!user?.email || !alert || !(alert.channels as string[]).includes("email")) continue;
    const sent = await sendAlertEmail(
      user.email,
      {
        id: alert.id,
        userId: alert.userId,
        name: alert.name,
        origins: alert.origins,
        destinations: alert.destinations,
        dateFrom: alert.dateFrom,
        dateTo: alert.dateTo,
        cabin: alert.cabin as never,
        passengers: alert.passengers,
        channels: alert.channels as never,
        active: alert.active,
        createdAt: alert.createdAt,
        hitCount: alert.hitCount,
      },
      n.hits,
    );
    if (sent) emailed++;
  }
  return ok({ checked: summary.checked, hits: summary.hits, emailed, ms: Date.now() - started });
}
