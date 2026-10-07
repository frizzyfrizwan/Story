import { z } from "zod";
import { auth } from "@/auth";
import { handler, ok, fail, parseBody } from "@/lib/api";
import { listBalances, upsertBalance, deleteBalance, parseBalanceCsv } from "@/lib/repo/wallet";
import { PROGRAMS } from "@/data/programs";

export const runtime = "nodejs";

export const GET = handler(async () => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  return ok({ balances: await listBalances(session.user.id) });
});

const upsert = z.object({
  programId: z.string().min(2),
  amount: z.number().min(0).max(100_000_000),
  status: z.string().max(40).optional(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const PUT = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const body = await parseBody(req, z.union([upsert, z.object({ csv: z.string().max(20_000) })]));
  if ("csv" in body) {
    const rows = parseBalanceCsv(body.csv);
    const results = [];
    for (const r of rows) {
      const program = PROGRAMS.find(
        (p) => p.id === r.program.toLowerCase() || p.name.toLowerCase() === r.program.toLowerCase() || p.shortName.toLowerCase() === r.program.toLowerCase(),
      );
      if (!program) continue;
      results.push(await upsertBalance(session.user.id, { programId: program.id, amount: r.amount, status: r.status, expiresAt: r.expiresAt, source: "import" }));
    }
    return ok({ imported: results.length, balances: await listBalances(session.user.id) });
  }
  const balance = await upsertBalance(session.user.id, body);
  return ok({ balance });
});

export const DELETE = handler(async (req: Request) => {
  const session = await auth();
  if (!session?.user?.id) return fail("Sign in required", 401);
  const { programId } = await parseBody(req, z.object({ programId: z.string().min(2) }));
  await deleteBalance(session.user.id, programId);
  return ok({ deleted: true });
});
