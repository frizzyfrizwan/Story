import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { getAlert, updateAlert, deleteAlert, listHits, runAlert } from "@/lib/repo/alerts";
import { CABINS } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  const alert = await getAlert(session.user.id, id);
  if (!alert) return fail("Not found", 404);
  const hits = await listHits(session.user.id, id, 100);
  return ok({ alert, hits });
});

const patchSchema = z.object({
  name: z.string().max(80).optional(),
  origins: z.array(z.string().trim().toUpperCase().length(3)).min(1).max(6).optional(),
  destinations: z.array(z.string().trim().toUpperCase().length(3)).min(1).max(6).optional(),
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  cabin: z.enum(CABINS as [string, ...string[]]).optional(),
  passengers: z.number().int().min(1).max(9).optional(),
  maxMiles: z.number().int().min(1000).max(1_000_000).nullable().optional(),
  programs: z.array(z.string()).max(20).optional(),
  channels: z.array(z.enum(["email", "push", "inapp"])).min(1).optional(),
  active: z.boolean().optional(),
});

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  const patch = await parseBody(req, patchSchema);
  const alert = await updateAlert(session.user.id, id, {
    ...patch,
    cabin: patch.cabin as (typeof CABINS)[number] | undefined,
    maxMiles: patch.maxMiles === null ? undefined : patch.maxMiles,
  });
  if (!alert) return fail("Not found", 404);
  return ok({ alert });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  await deleteAlert(session.user.id, id);
  return ok({ deleted: true });
});

/** POST = "check now" */
export const POST = handler(async (_req: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  const alert = await getAlert(session.user.id, id);
  if (!alert) return fail("Not found", 404);
  const newHits = await runAlert(alert);
  const hits = await listHits(session.user.id, id, 100);
  return ok({ newHits: newHits.length, hits, alert: await getAlert(session.user.id, id) });
});
