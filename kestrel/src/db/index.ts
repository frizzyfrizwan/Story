import "server-only";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import fs from "node:fs";
import { env, integrationStatus } from "@/env";
import * as schema from "./schema";
import { seedDemoContent } from "./seed";

export type Db = LibSQLDatabase<typeof schema>;

declare global {
  var __kestrelDb: { client: Client; db: Db; ready: Promise<void> } | undefined;
}

function ensureLocalDir(url: string) {
  if (!url.startsWith("file:")) return;
  const file = url.slice("file:".length);
  const dir = path.dirname(path.resolve(process.cwd(), file));
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function create() {
  ensureLocalDir(env.DATABASE_URL);
  const client = createClient({ url: env.DATABASE_URL, authToken: env.DATABASE_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const ready = (async () => {
    if (fs.existsSync(migrationsFolder)) {
      await migrate(db, { migrationsFolder });
    }
    if (env.DATABASE_URL.startsWith("file:")) {
      await client.execute("PRAGMA journal_mode = WAL;");
      await client.execute("PRAGMA foreign_keys = ON;");
    }
    // Demo deployments get community content out of the box.
    if (integrationStatus().demoMode) {
      await seedDemoContent(db).catch((err) => console.warn("[db] demo seed skipped:", err?.message ?? err));
    }
  })().catch((err) => {
    console.error("[db] migration failed", err);
    throw err;
  });
  return { client, db, ready };
}

/**
 * Lazily-initialised database. Safe to call from any server module;
 * migrations run once per process before the first query resolves.
 */
export async function getDb(): Promise<Db> {
  if (!globalThis.__kestrelDb) globalThis.__kestrelDb = create();
  await globalThis.__kestrelDb.ready;
  return globalThis.__kestrelDb.db;
}

/** Synchronous accessor for modules that know migrations already ran (adapter wiring). */
export function dbSync(): Db {
  if (!globalThis.__kestrelDb) globalThis.__kestrelDb = create();
  return globalThis.__kestrelDb.db;
}

export { schema };
