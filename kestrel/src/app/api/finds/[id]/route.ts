import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { getFind, deleteFind, toggleLike, listComments, addComment } from "@/lib/repo/finds";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const session = await auth();
  const { id } = await ctx.params;
  const find = await getFind(id, session?.user?.id ?? null);
  if (!find) return fail("Not found", 404);
  const comments = await listComments(id);
  return ok({ find, comments });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  const deleted = await deleteFind(session.user.id, id);
  return deleted ? ok({ deleted: true }) : fail("Not found", 404);
});

/** POST {action:"like"} toggles a like; POST {action:"comment", body} adds a comment. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { id } = await ctx.params;
  const body = await parseBody(
    req,
    z.discriminatedUnion("action", [
      z.object({ action: z.literal("like") }),
      z.object({ action: z.literal("comment"), body: z.string().trim().min(1).max(2000) }),
    ]),
  );
  const exists = await getFind(id, session.user.id);
  if (!exists) return fail("Not found", 404);
  if (body.action === "like") return ok(await toggleLike(session.user.id, id));
  const comment = await addComment(session.user.id, id, body.body);
  return ok({ comment }, { status: 201 });
});
