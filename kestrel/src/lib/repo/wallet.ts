import "server-only";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { Balance } from "@/lib/types";

function rowToBalance(r: typeof schema.balances.$inferSelect): Balance {
  return {
    programId: r.programId,
    amount: r.amount,
    updatedAt: r.updatedAt,
    source: r.source,
    status: r.status ?? undefined,
    expiresAt: r.expiresAt ?? undefined,
  };
}

export async function listBalances(userId: string): Promise<Balance[]> {
  const db = await getDb();
  const rows = await db.query.balances.findMany({ where: eq(schema.balances.userId, userId) });
  return rows.map(rowToBalance).sort((a, b) => b.amount - a.amount);
}

export async function upsertBalance(
  userId: string,
  input: { programId: string; amount: number; status?: string; expiresAt?: string; source?: Balance["source"] },
): Promise<Balance> {
  const db = await getDb();
  const amount = Math.max(0, Math.round(input.amount));
  const [row] = await db
    .insert(schema.balances)
    .values({
      userId,
      programId: input.programId,
      amount,
      status: input.status ?? null,
      expiresAt: input.expiresAt ?? null,
      source: input.source ?? "manual",
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [schema.balances.userId, schema.balances.programId],
      set: {
        amount,
        status: input.status ?? null,
        expiresAt: input.expiresAt ?? null,
        source: input.source ?? "manual",
        updatedAt: new Date().toISOString(),
      },
    })
    .returning();
  return rowToBalance(row);
}

export async function deleteBalance(userId: string, programId: string): Promise<void> {
  const db = await getDb();
  await db.delete(schema.balances).where(and(eq(schema.balances.userId, userId), eq(schema.balances.programId, programId)));
}

/**
 * Import balances from CSV text: `program,amount[,status][,expires]`.
 * Program may be a canonical id or a loose name; the caller resolves names.
 */
export function parseBalanceCsv(csv: string): { program: string; amount: number; status?: string; expiresAt?: string }[] {
  return csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !/^program/i.test(l))
    .map((line) => {
      const [program, amount, status, expiresAt] = line.split(",").map((s) => s.trim());
      const n = Number(String(amount ?? "").replace(/[^0-9.-]/g, ""));
      return { program, amount: Number.isFinite(n) ? n : 0, status: status || undefined, expiresAt: expiresAt || undefined };
    })
    .filter((r) => r.program);
}
