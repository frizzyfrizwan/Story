import { z } from "zod";
import { handler, ok, fail, parseSearchParams, rateLimit, clientKey } from "@/lib/api";
import { getRouteAvailability } from "@/lib/providers";
import { CABINS } from "@/lib/types";
import { addDays, todayISO } from "@/lib/utils";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  origin: z.string().trim().toUpperCase().length(3),
  destination: z.string().trim().toUpperCase().length(3),
  cabin: z.enum(CABINS as [string, ...string[]]).default("business"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.coerce.number().int().min(7).max(330).default(60),
});

export const GET = handler(async (req: Request) => {
  const rl = rateLimit(`avail:${clientKey(req)}`, { limit: 120, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests", 429);
  const q = parseSearchParams(req.url, schema);
  const from = q.from ?? todayISO();
  const to = q.to ?? addDays(from, q.days);
  const res = await getRouteAvailability(q.origin, q.destination, q.cabin as (typeof CABINS)[number], from, to);
  return ok(res, { headers: { "cache-control": "private, max-age=60" } });
});
