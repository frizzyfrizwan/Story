import "server-only";
import type { Balance } from "@/lib/types";
import { fmtInt } from "@/lib/utils";
import { AI_BETAS, AI_MODEL, Anthropic, getAnthropic, KESTREL_SYSTEM_PROMPT } from "./client";
import { createSseStream, type SseStream } from "./sse";
import { CONCIERGE_TOOLS, runConciergeTool, type ConciergeDeps, type ToolContext } from "./tools";
import { intentToQuery, parseIntentHeuristic, summarizeIntent } from "./intent-heuristics";
import { recordAiUsage } from "./usage";

/*
 * SSE event contract (see docs in the final report):
 *   event: text      data: "<delta>"                                 — assistant prose, append in order
 *   event: thinking  data: "<delta>"                                 — summarized reasoning (optional, UI may ignore)
 *   event: tool      data: { name, input, summary, error? }          — a tool ran (after it finished)
 *   event: error     data: { message, code? }                        — recoverable failure; stream still ends with done
 *   event: done      data: { usage: { inputTokens, outputTokens }, rounds, model, stopReason?, offline? }
 */

export interface ConciergeMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ConciergeContext {
  wallet?: Balance[];
  homeAirport?: string;
  /** YYYY-MM-DD */
  today: string;
}

export interface StreamConciergeArgs {
  messages: ConciergeMessage[];
  userId?: string | null;
  context: ConciergeContext;
  signal?: AbortSignal;
  /** Override the Anthropic client (tests). `null` forces the offline fallback. */
  client?: Anthropic | null;
  /** Override tool dependencies (tests). */
  deps?: Partial<ConciergeDeps>;
}

export const MAX_TOOL_ROUNDS = 6;
const MAX_MESSAGES = 30;
const MAX_CHARS = 4000;

const REFUSAL_TEXT = "\n\nI can't help with that particular request, but I'm happy to keep working on your award travel plans.";

// ─── Prompt ─────────────────────────────────────────────────────

export function buildConciergeSystemPrompt(ctx: ConciergeContext): string {
  const lines: string[] = [KESTREL_SYSTEM_PROMPT.trim(), "", `Today is ${ctx.today}.`];
  if (ctx.homeAirport) lines.push(`The user's home airport is ${ctx.homeAirport.toUpperCase()}; assume it as the origin when none is given.`);
  if (ctx.wallet?.length) {
    lines.push("", "The user's points wallet:");
    for (const b of ctx.wallet) lines.push(`- ${b.programId}: ${fmtInt(b.amount)}${b.status ? ` (${b.status})` : ""}${b.expiresAt ? `, expires ${b.expiresAt}` : ""}`);
  } else {
    lines.push("", "The user has not added any points balances yet. Suggest /wallet when it would change the advice.");
  }
  lines.push(
    "",
    "Tools: call search_awards for any question about availability, price in miles, or options on a route — never guess inventory. Use route_availability for calendar-style questions, get_program for rules and sweet spots, transfer_options to decide which bank points to move, search_hotels for stays, get_deals for inspiration and wallet_balances to confirm what the user holds. You may call several tools in one turn when they are independent.",
    "If a tool result says the data is simulated, tell the user it is demo data. After tool results, answer with the best two or three options, concrete numbers, and a /search link. If a request is missing the origin, destination, rough dates or cabin, ask one short question rather than guessing.",
  );
  return lines.join("\n");
}

// ─── Message hygiene ────────────────────────────────────────────

/** Trim, cap and reorder so the API sees a user-first, user-last transcript (no prefill). */
export function normalizeMessages(messages: ConciergeMessage[]): ConciergeMessage[] {
  const cleaned = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, MAX_CHARS) }))
    .slice(-MAX_MESSAGES);
  while (cleaned.length && cleaned[0].role !== "user") cleaned.shift();
  while (cleaned.length && cleaned[cleaned.length - 1].role !== "user") cleaned.pop();
  return cleaned;
}

// ─── Entry point ────────────────────────────────────────────────

export function streamConcierge(args: StreamConciergeArgs): ReadableStream<Uint8Array> {
  const client = args.client === undefined ? getAnthropic() : args.client;
  const messages = normalizeMessages(args.messages);
  const sse = createSseStream();
  const toolCtx: ToolContext = {
    today: args.context.today,
    wallet: args.context.wallet,
    homeAirport: args.context.homeAirport,
    signal: args.signal,
    deps: args.deps,
  };

  if (!client) {
    void runOffline(sse, messages, args.context, toolCtx);
    return sse.stream;
  }
  if (!messages.length) {
    sse.send("error", { message: "Send a message to get started.", code: "empty" });
    sse.send("done", { usage: { inputTokens: 0, outputTokens: 0 }, rounds: 0, model: AI_MODEL });
    sse.close();
    return sse.stream;
  }
  void runLive(client, sse, messages, args, toolCtx);
  return sse.stream;
}

// ─── Live loop ──────────────────────────────────────────────────

async function runLive(client: Anthropic, sse: SseStream, messages: ConciergeMessage[], args: StreamConciergeArgs, toolCtx: ToolContext): Promise<void> {
  const history: Anthropic.Beta.BetaMessageParam[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const system = buildConciergeSystemPrompt(args.context);
  const usage = { inputTokens: 0, outputTokens: 0 };
  let rounds = 0;
  let stopReason: string | undefined;

  try {
    for (;;) {
      if (args.signal?.aborted) break;
      const stream = client.beta.messages.stream(
        {
          model: AI_MODEL,
          max_tokens: 8000,
          system,
          messages: history,
          tools: CONCIERGE_TOOLS,
          tool_choice: { type: "auto" },
          thinking: { type: "adaptive", display: "summarized" },
          output_config: { effort: "medium" },
          betas: [...AI_BETAS],
          fallbacks: "default",
        },
        { signal: args.signal },
      );

      for await (const event of stream) {
        if (event.type !== "content_block_delta") continue;
        if (event.delta.type === "text_delta") sse.send("text", event.delta.text);
        else if (event.delta.type === "thinking_delta" && event.delta.thinking) sse.send("thinking", event.delta.thinking);
      }

      const message = await stream.finalMessage();
      usage.inputTokens += message.usage.input_tokens;
      usage.outputTokens += message.usage.output_tokens;
      stopReason = message.stop_reason ?? undefined;

      if (message.stop_reason === "refusal") {
        sse.send("text", REFUSAL_TEXT);
        break;
      }
      if (message.stop_reason === "pause_turn") {
        history.push({ role: "assistant", content: message.content });
        continue;
      }

      const toolUses = message.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
      if (message.stop_reason === "max_tokens") break;
      if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;

      if (rounds >= MAX_TOOL_ROUNDS) {
        sse.send("text", "\n\nI've hit my tool-call limit for this turn — ask me to continue and I'll pick up from here.");
        break;
      }
      rounds++;
      history.push({ role: "assistant", content: message.content });

      const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
      for (const tu of toolUses) {
        try {
          const outcome = await runConciergeTool(tu.name, tu.input, toolCtx);
          sse.send("tool", { name: tu.name, input: tu.input, summary: outcome.summary });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: outcome.content });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          sse.send("tool", { name: tu.name, input: tu.input, summary: `Failed: ${msg}`, error: true });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: msg, is_error: true });
        }
      }
      // One user message carrying every tool_result (keeps parallel tool use working).
      history.push({ role: "user", content: results });
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      sse.send("error", { message: "The concierge is busy right now — please try again in a moment.", code: "rate_limited" });
    } else if (err instanceof Anthropic.AuthenticationError) {
      sse.send("error", { message: "AI is misconfigured (invalid API key).", code: "auth" });
    } else if (err instanceof Anthropic.APIError) {
      sse.send("error", { message: `AI request failed (${err.status ?? "network"}). Please try again.`, code: "api" });
      console.error("[ai] concierge API error", err.status, err.message);
    } else if (err instanceof Error && err.name === "AbortError") {
      // client disconnected — nothing to report
    } else {
      sse.send("error", { message: "Something went wrong while answering.", code: "unknown" });
      console.error("[ai] concierge failed", err);
    }
  } finally {
    if (usage.inputTokens || usage.outputTokens) {
      void recordAiUsage({ userId: args.userId, feature: "concierge", model: AI_MODEL, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens });
    }
    sse.send("done", { usage, rounds, model: AI_MODEL, stopReason });
    sse.close();
  }
}

// ─── Offline fallback (no API key) ──────────────────────────────

export const OFFLINE_INTRO =
  "Kestrel's AI concierge is offline because no `ANTHROPIC_API_KEY` is configured. Add one to `.env` (`ANTHROPIC_API_KEY=sk-ant-…`) and restart to enable Claude.\n\n";

async function runOffline(sse: SseStream, messages: ConciergeMessage[], ctx: ConciergeContext, toolCtx: ToolContext): Promise<void> {
  try {
    sse.send("text", OFFLINE_INTRO);
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (!last) {
      sse.send("text", "Tell me where you want to go and I'll run the award search for you.");
      return;
    }
    const intent = parseIntentHeuristic(last.content, { today: ctx.today, homeAirport: ctx.homeAirport });
    if (intent.confidence < 0.5 || !intent.destination.length) {
      sse.send(
        "text",
        "I can still run award searches without AI. Tell me where you're flying from and to, roughly when, and which cabin — for example _“JFK to Tokyo in May, business, 2 people”_.",
      );
      return;
    }
    const query = intentToQuery(intent, ctx.today);
    sse.send("text", `Reading that as **${summarizeIntent(intent)}**.\n\n`);
    if (!query.origin.length) {
      sse.send("text", "Which airport are you flying from? Add it to your message (or set a home airport in Settings) and I'll run the search.");
      return;
    }
    const input = {
      origin: query.origin,
      destination: query.destination,
      date: query.date,
      cabin: query.cabin,
      passengers: query.passengers,
      flexDays: query.flexDays ?? 0,
    };
    const outcome = await runConciergeTool("search_awards", input, toolCtx);
    sse.send("tool", { name: "search_awards", input, summary: outcome.summary });
    sse.send("text", outcome.content.replace(/\n\n_Note: these are simulated demo results[^_]*_/, "\n\n_These are demo results — connect a live award provider for real inventory._"));
  } catch (err) {
    sse.send("error", { message: err instanceof Error ? err.message : "Search failed", code: "offline_search" });
  } finally {
    sse.send("done", { usage: { inputTokens: 0, outputTokens: 0 }, rounds: 0, model: null, offline: true });
    sse.close();
  }
}
