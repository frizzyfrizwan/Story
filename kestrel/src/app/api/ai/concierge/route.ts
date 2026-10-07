import { z } from "zod";
import { clientKey, fail, handler, parseBody, rateLimit } from "@/lib/api";
import { currentUserId } from "@/auth";
import { streamConcierge } from "@/lib/ai/concierge";
import { SSE_HEADERS } from "@/lib/ai/sse";
import { todayISO } from "@/lib/utils";
import type { Balance } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const BalanceSchema = z.object({
  programId: z.string().trim().min(1).max(60),
  amount: z.number().min(0).max(100_000_000),
  updatedAt: z.string().default(() => new Date().toISOString()),
  source: z.enum(["manual", "import", "connected"]).default("manual"),
  status: z.string().max(60).optional(),
  expiresAt: z.string().max(40).optional(),
});

const Body = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .min(1)
    .max(30),
  context: z
    .object({
      wallet: z.array(BalanceSchema).max(50).optional(),
      homeAirport: z.string().trim().length(3).optional(),
      today: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
    })
    .optional(),
});

/** Best-effort wallet + home airport from the DB for signed-in users. Never throws. */
async function loadUserContext(userId: string): Promise<{ wallet: Balance[]; homeAirport?: string }> {
  try {
    const [{ getDb, schema }, { eq }] = await Promise.all([import("@/db"), import("drizzle-orm")]);
    const db = await getDb();
    const [rows, profile] = await Promise.all([
      db.query.balances.findMany({ where: eq(schema.balances.userId, userId) }),
      db.query.profiles.findFirst({ where: eq(schema.profiles.userId, userId) }),
    ]);
    return {
      wallet: rows.map((r) => ({
        programId: r.programId,
        amount: r.amount,
        updatedAt: r.updatedAt,
        source: r.source,
        status: r.status ?? undefined,
        expiresAt: r.expiresAt ?? undefined,
      })),
      homeAirport: profile?.homeAirport ?? undefined,
    };
  } catch (err) {
    console.warn("[ai] concierge: could not load user context", err instanceof Error ? err.message : err);
    return { wallet: [] };
  }
}

/** POST /api/ai/concierge { messages, context? } → text/event-stream (see src/lib/ai/concierge.ts for the event contract) */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(`ai:concierge:${clientKey(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests — the concierge allows 10 messages a minute", 429);

  const body = await parseBody(req, Body);

  let userId: string | null = null;
  try {
    userId = await currentUserId();
  } catch {
    userId = null;
  }

  let wallet = body.context?.wallet;
  let homeAirport = body.context?.homeAirport;
  if (userId && (!wallet || !homeAirport)) {
    const loaded = await loadUserContext(userId);
    wallet = wallet ?? (loaded.wallet.length ? loaded.wallet : undefined);
    homeAirport = homeAirport ?? loaded.homeAirport;
  }

  const stream = streamConcierge({
    messages: body.messages,
    userId,
    context: { wallet, homeAirport, today: body.context?.today ?? todayISO() },
    signal: req.signal,
  });
  return new Response(stream, { status: 200, headers: SSE_HEADERS });
});
