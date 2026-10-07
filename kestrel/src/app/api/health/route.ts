import { integrationStatus } from "@/env";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const started = Date.now();
  let db = "ok";
  try {
    await getDb();
  } catch (err) {
    db = `error: ${err instanceof Error ? err.message : String(err)}`;
  }
  const status = integrationStatus();
  return Response.json(
    { ok: db === "ok", db, integrations: status, uptimeMs: Math.round(process.uptime() * 1000), latencyMs: Date.now() - started },
    { status: db === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
