import { z } from "zod";
import { handler, ok, parseSearchParams } from "@/lib/api";
import { getDeals } from "@/lib/providers";
import { CABINS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const schema = z.object({
  origin: z.string().trim().toUpperCase().length(3).optional(),
  cabin: z.enum(CABINS as [string, ...string[]]).optional(),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});

export const GET = handler(async (req: Request) => {
  const q = parseSearchParams(req.url, schema);
  const deals = await getDeals({ origin: q.origin, cabin: q.cabin as (typeof CABINS)[number] | undefined, limit: q.limit });
  return ok({ deals, generatedAt: new Date().toISOString() }, { headers: { "cache-control": "public, max-age=300, stale-while-revalidate=600" } });
});
