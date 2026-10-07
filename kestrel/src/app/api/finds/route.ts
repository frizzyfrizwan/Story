import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody, parseSearchParams, rateLimit, clientKey } from "@/lib/api";
import { listFinds, createFind, trendingTags } from "@/lib/repo/finds";
import { CABINS } from "@/lib/types";

export const runtime = "nodejs";

const listSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  sort: z.enum(["new", "top"]).default("new"),
  tag: z.string().max(40).optional(),
  cabin: z.enum(CABINS as [string, ...string[]]).optional(),
  programId: z.string().optional(),
  userId: z.string().optional(),
});

export const GET = handler(async (req: Request) => {
  const session = await auth();
  const q = parseSearchParams(req.url, listSchema);
  const [page, tags] = await Promise.all([
    listFinds({ ...q, cabin: q.cabin as (typeof CABINS)[number] | undefined, viewerId: session?.user?.id ?? null }),
    trendingTags(),
  ]);
  return ok({ ...page, tags });
});

export const createSchema = z.object({
  title: z.string().trim().min(8).max(140),
  body: z.string().trim().min(20).max(4000),
  origin: z.string().trim().toUpperCase().length(3).optional(),
  destination: z.string().trim().toUpperCase().length(3).optional(),
  carrier: z.string().trim().toUpperCase().length(2).optional(),
  cabin: z.enum(CABINS as [string, ...string[]]).optional(),
  programId: z.string().optional(),
  miles: z.number().int().min(0).max(5_000_000).optional(),
  taxesUsd: z.number().min(0).max(20_000).optional(),
  cpp: z.number().min(0).max(100).optional(),
  travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tags: z.array(z.string().max(30)).max(8).default([]),
});

export const POST = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const rl = rateLimit(`finds:${session.user.id}`, { limit: 10, windowMs: 3_600_000 });
  if (!rl.allowed) return fail("You're posting fast — try again later", 429);
  const input = await parseBody(req, createSchema);
  const find = await createFind(session.user.id, { ...input, cabin: input.cabin as (typeof CABINS)[number] | undefined });
  return ok({ find }, { status: 201 });
});
