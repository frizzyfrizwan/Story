import { z } from "zod";
import { handler, ok, parseSearchParams } from "@/lib/api";
import { searchHotelCities } from "@/data/hotels";
import { citySuggestion, popularCities } from "@/components/hotels/server";

export const runtime = "nodejs";

const schema = z.object({
  q: z.string().trim().max(60).optional().default(""),
  limit: z.coerce.number().int().min(1).max(20).default(8),
});

/**
 * GET /api/hotels/cities?q=tok → cities with award hotels, each with its hotel count and the
 * artwork of its signature property. An empty query returns the curated popular list.
 */
export const GET = handler(async (req: Request) => {
  const { q, limit } = parseSearchParams(req.url, schema);
  const cities = q ? searchHotelCities(q, limit).map((c) => citySuggestion(c)) : popularCities(limit);
  return ok(cities, { headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" } });
});
