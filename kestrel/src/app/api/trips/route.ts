import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { listTrips, createTrip, addTripItem, removeTripItem, deleteTrip } from "@/lib/repo/trips";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  return ok({ trips: await listTrips(session.user.id) });
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), title: z.string().trim().min(1).max(120), notes: z.string().max(2000).optional() }),
  z.object({
    action: z.literal("add"),
    tripId: z.string(),
    kind: z.enum(["flight", "hotel", "note"]),
    payload: z.record(z.string(), z.unknown()),
  }),
  z.object({ action: z.literal("remove"), tripId: z.string(), itemId: z.string() }),
  z.object({ action: z.literal("delete"), tripId: z.string() }),
]);

export const POST = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const body = await parseBody(req, bodySchema);
  switch (body.action) {
    case "create":
      return ok({ trip: await createTrip(session.user.id, body.title, body.notes) }, { status: 201 });
    case "add": {
      const trip = await addTripItem(session.user.id, body.tripId, { kind: body.kind, payload: body.payload });
      return trip ? ok({ trip }) : fail("Trip not found", 404);
    }
    case "remove": {
      const trip = await removeTripItem(session.user.id, body.tripId, body.itemId);
      return trip ? ok({ trip }) : fail("Trip not found", 404);
    }
    case "delete":
      await deleteTrip(session.user.id, body.tripId);
      return ok({ deleted: true });
  }
});
