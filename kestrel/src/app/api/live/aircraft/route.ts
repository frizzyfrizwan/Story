import { z } from "zod";
import { handler, ok, fail, parseSearchParams, rateLimit, clientKey } from "@/lib/api";
import { getLiveAircraft } from "@/lib/providers";

export const runtime = "nodejs";
export const maxDuration = 20;

const schema = z.object({
  lamin: z.coerce.number().min(-90).max(90).default(-60),
  lomin: z.coerce.number().min(-180).max(180).default(-180),
  lamax: z.coerce.number().min(-90).max(90).default(75),
  lomax: z.coerce.number().min(-180).max(180).default(180),
});

export const GET = handler(async (req: Request) => {
  const rl = rateLimit(`live:${clientKey(req)}`, { limit: 30, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests", 429);
  const bbox = parseSearchParams(req.url, schema);
  if (bbox.lamin >= bbox.lamax || bbox.lomin >= bbox.lomax) return fail("Invalid bounding box", 400);
  const res = await getLiveAircraft(bbox);
  return ok(res, { headers: { "cache-control": "public, max-age=10" } });
});
