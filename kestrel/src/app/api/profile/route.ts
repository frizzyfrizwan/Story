import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { ensureProfile, updateProfile } from "@/lib/repo/profiles";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const profile = await ensureProfile(session.user.id);
  return ok({ profile, user: session.user });
});

const patchSchema = z.object({
  displayName: z.string().trim().min(2).max(60).optional(),
  handle: z.string().trim().min(3).max(24).optional(),
  bio: z.string().trim().max(280).optional(),
  homeAirport: z.string().trim().toUpperCase().length(3).nullable().optional(),
  preferences: z
    .object({
      theme: z.enum(["dark", "light"]).optional(),
      defaultCabin: z.string().optional(),
      currency: z.string().length(3).optional(),
      emailDigest: z.boolean().optional(),
      pushAlerts: z.boolean().optional(),
    })
    .optional(),
});

export const PATCH = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const patch = await parseBody(req, patchSchema);
  try {
    const profile = await updateProfile(session.user.id, {
      ...patch,
      homeAirport: patch.homeAirport === undefined ? undefined : patch.homeAirport,
    });
    return ok({ profile });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not update profile", 400);
  }
});
