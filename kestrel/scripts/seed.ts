/* Seed demo content: `pnpm db:seed` (add --force to re-seed). */
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "../src/db/schema";
import { seedDemoContent } from "../src/db/seed";

async function main() {
  const url = process.env.DATABASE_URL ?? "file:./data/kestrel.db";
  if (url.startsWith("file:")) {
    const dir = path.dirname(path.resolve(process.cwd(), url.slice(5)));
    fs.mkdirSync(dir, { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(process.cwd(), "drizzle") });
  const result = await seedDemoContent(db, { force: process.argv.includes("--force") });
  console.log(result.seeded ? `Seeded ${result.finds} finds + personas, bonuses, balances, alerts.` : `Already seeded (${result.finds} finds). Use --force to add again.`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
