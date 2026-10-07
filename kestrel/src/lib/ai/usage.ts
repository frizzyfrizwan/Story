import "server-only";

export interface AiUsageEntry {
  userId?: string | null;
  feature: "concierge" | "intent" | "explain" | "digest" | "ideas";
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Best-effort usage accounting into the `ai_usage` table. The DB module is
 * imported lazily so AI helpers stay usable in environments without a
 * database (unit tests, edge previews). Never throws.
 */
export async function recordAiUsage(entry: AiUsageEntry): Promise<void> {
  try {
    const { getDb, schema } = await import("@/db");
    const db = await getDb();
    await db.insert(schema.aiUsage).values({
      userId: entry.userId ?? null,
      feature: entry.feature,
      model: entry.model,
      inputTokens: Math.max(0, Math.round(entry.inputTokens || 0)),
      outputTokens: Math.max(0, Math.round(entry.outputTokens || 0)),
    });
  } catch (err) {
    console.warn("[ai] usage not recorded:", err instanceof Error ? err.message : err);
  }
}
