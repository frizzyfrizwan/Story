import { handler, ok } from "@/lib/api";
import { AI_FAST_MODEL, AI_MODEL, isAiEnabled } from "@/lib/ai/client";

export const runtime = "nodejs";

/** GET /api/ai/status → { enabled, model, fastModel } */
export const GET = handler(async () => {
  const enabled = isAiEnabled();
  return ok({
    enabled,
    model: AI_MODEL,
    fastModel: AI_FAST_MODEL,
    /** What still works when disabled: heuristic parsing, template explanations, offline concierge search. */
    fallback: !enabled,
  });
});
