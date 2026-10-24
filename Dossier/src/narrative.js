// Optional analyst narrative written by Claude. Enabled only when @anthropic-ai/sdk is installed and
// credentials resolve (ANTHROPIC_API_KEY or an `ant auth login` profile). Everything else in Dossier
// is deterministic and runs without it.

let AnthropicCtor = null;
async function sdk() {
  if (AnthropicCtor) return AnthropicCtor;
  try {
    const mod = await import("@anthropic-ai/sdk");
    AnthropicCtor = mod.default;
    return AnthropicCtor;
  } catch {
    return null;
  }
}

export async function narrativeAvailable() {
  return Boolean(await sdk()) && Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_PROFILE || process.env.HOME);
}

const SYSTEM = `You are a buyer's analyst writing the opening of a property dossier. You get the structured report as JSON: facts, graded dimensions, a watch list on a time horizon, and a cost model. Write for a buyer who will read this on a phone.

Write 4 short paragraphs, plain prose, no headings, no bullet points, no markdown:
1. What this is and who it suits (primary home, snowbird, rental), in two sentences.
2. The three things that decide whether to buy, in order of importance, each with the number or document that settles it.
3. What will cost money in the next five years and roughly how much, using only figures present in the JSON.
4. One sentence on the long-term bet (land, location, climate) and one on negotiating position.

Use only facts in the JSON. Where a fact is unknown, say what to ask for rather than guessing. No em-dashes.`;

export async function writeNarrative(report) {
  const Anthropic = await sdk();
  if (!Anthropic) return null;
  const client = new Anthropic();
  const slim = {
    verdict: report.verdict,
    grades: report.grades,
    facts: { property: report.facts.property, building: report.facts.building, association: report.facts.association, location: report.facts.location, market: report.facts.market, rents: report.facts.rents },
    costs: { homestead: report.costs.homestead, rental: report.costs.rental, specialAssessmentScenario: report.costs.specialAssessmentScenario },
    watch: report.watch.map(({ id, horizon, severity, title, why, action }) => ({ id, horizon, severity, title, why, action })),
  };
  const stream = client.beta.messages.stream({
    model: "claude-opus-5-5",
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: JSON.stringify(slim) }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return null;
  return msg.content.filter((b) => b.type === "text").map((b) => b.text).join("\n").trim();
}
