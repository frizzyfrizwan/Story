import { handler, ok } from "@/lib/api";
import { PROGRAMS } from "@/data/programs";
import { TRANSFER_LINKS } from "@/data/transfers";
import { getDb } from "@/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Programs + transfer matrix, with any admin-maintained bonuses from the DB merged in. */
export const GET = handler(async () => {
  const today = new Date().toISOString().slice(0, 10);
  let links = TRANSFER_LINKS;
  try {
    const db = await getDb();
    const rows = await db.query.transferBonuses.findMany();
    const live = rows.filter((r) => r.startsAt <= today && r.endsAt >= today);
    if (live.length) {
      links = TRANSFER_LINKS.map((l) => {
        const b = live.find((r) => r.fromProgramId === l.from && r.toProgramId === l.to);
        return b
          ? { ...l, bonus: { percent: b.percent, startsAt: b.startsAt, endsAt: b.endsAt, verifiedAt: b.verifiedAt, note: b.note ?? undefined } }
          : l;
      });
    }
  } catch {
    // DB unavailable → static data is still correct.
  }
  return ok({ programs: PROGRAMS, transfers: links }, { headers: { "cache-control": "public, max-age=600" } });
});
