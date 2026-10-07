import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { listNotifications, unreadCount, markRead } from "@/lib/repo/notifications";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const session = await auth();
  if (!session?.user?.id) return ok({ notifications: [], unread: 0 });
  const [notifications, unread] = await Promise.all([listNotifications(session.user.id), unreadCount(session.user.id)]);
  return ok({ notifications, unread });
});

export const POST = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { ids } = await parseBody(req, z.object({ ids: z.array(z.string()).optional() }));
  await markRead(session.user.id, ids);
  return ok({ unread: await unreadCount(session.user.id) });
});
