import { z } from "zod";
import { handler, ok, fail, parseBody, rateLimit, clientKey } from "@/lib/api";
import { searchAwards } from "@/lib/providers";
import { CABINS } from "@/lib/types";
import { getProgram } from "@/data/programs";
import { transfersFrom } from "@/data/transfers";

export const runtime = "nodejs";
export const maxDuration = 30;

const codes = z
  .union([z.string(), z.array(z.string())])
  .transform((v) => (Array.isArray(v) ? v : v.split(",")))
  .pipe(z.array(z.string().trim().toUpperCase().min(3).max(3)).min(1).max(6));

const querySchema = z.object({
  origin: codes,
  destination: codes,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  flexDays: z.coerce.number().int().min(0).max(7).default(0),
  cabin: z.enum(CABINS as [string, ...string[]]).default("business"),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  programs: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v == null ? undefined : Array.isArray(v) ? v : v.split(",").filter(Boolean))),
  maxStops: z.coerce.number().int().min(0).max(2).optional(),
});

async function run(input: unknown, req: Request) {
  const rl = rateLimit(`awards:${clientKey(req)}`, { limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many searches — try again in a minute", 429);
  const q = querySchema.parse(input);
  // Bank currencies (amex-mr, chase-ur…) expand to the airline programs they transfer into.
  const programs = q.programs?.length
    ? Array.from(
        new Set(
          q.programs.flatMap((id) => {
            const program = getProgram(id);
            if (program?.kind === "bank") return transfersFrom(id).map((l) => l.to);
            return [id];
          }),
        ),
      )
    : undefined;
  const res = await searchAwards({ ...q, programs, cabin: q.cabin as (typeof CABINS)[number] });
  return ok(res, { headers: { "cache-control": "private, max-age=30" } });
}

export const GET = handler(async (req: Request) => {
  const url = new URL(req.url);
  const obj: Record<string, string | string[]> = {};
  url.searchParams.forEach((v, k) => {
    obj[k] = obj[k] === undefined ? v : ([] as string[]).concat(obj[k], v);
  });
  return run(obj, req);
});

export const POST = handler(async (req: Request) => run(await parseBody(req, z.unknown()), req));
