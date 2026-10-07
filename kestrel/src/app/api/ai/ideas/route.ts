import { z } from "zod";
import { clientKey, fail, handler, ok, parseBody, rateLimit } from "@/lib/api";
import { tripIdeas } from "@/lib/ai/explain";

export const runtime = "nodejs";

const Body = z.object({
  origin: z.string().trim().length(3),
  points: z
    .array(
      z.object({
        programId: z.string().trim().min(1).max(60),
        amount: z.number().min(0).max(100_000_000),
      }),
    )
    .max(30)
    .default([]),
  month: z.union([z.number().int().min(1).max(12), z.string().trim().max(12)]).optional(),
});

/** POST /api/ai/ideas { origin, points, month? } → { ideas } */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(`ai:ideas:${clientKey(req)}`, { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests — try again in a minute", 429);

  const body = await parseBody(req, Body);
  const ideas = await tripIdeas({ origin: body.origin.toUpperCase(), points: body.points, month: body.month }, { signal: req.signal });
  return ok({ ideas });
});
