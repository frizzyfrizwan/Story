import { z } from "zod";
import { handler, ok, parseSearchParams } from "@/lib/api";
import { searchAirports, getAirport } from "@/data/airports";

export const runtime = "nodejs";

const schema = z.object({ q: z.string().trim().max(60).default(""), limit: z.coerce.number().int().min(1).max(20).default(8), code: z.string().optional() });

export const GET = handler(async (req: Request) => {
  const { q, limit, code } = parseSearchParams(req.url, schema);
  if (code) return ok(getAirport(code) ?? null);
  return ok(searchAirports(q, limit), { headers: { "cache-control": "public, max-age=3600" } });
});
