import { z } from "zod";
import { clientKey, fail, handler, ok, parseBody, rateLimit } from "@/lib/api";
import { intentToQuery, parseTravelIntent } from "@/lib/ai/intent";
import { intentChips } from "@/lib/ai/intent-heuristics";
import { todayISO } from "@/lib/utils";

export const runtime = "nodejs";

const Body = z.object({
  text: z.string().trim().min(1).max(500),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  homeAirport: z.string().trim().length(3).optional(),
});

/** POST /api/ai/parse { text } → { intent, query, chips } */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(`ai:parse:${clientKey(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests — try again in a minute", 429);

  const body = await parseBody(req, Body);
  const today = body.today ?? todayISO();
  const intent = await parseTravelIntent(body.text, { today, homeAirport: body.homeAirport, signal: req.signal });
  const query = intentToQuery(intent, today);
  return ok({ intent, query, chips: intentChips(intent) });
});
