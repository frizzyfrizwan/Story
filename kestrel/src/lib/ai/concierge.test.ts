import { describe, expect, it } from "vitest";
import type { AwardFare, AwardSearchQuery, AwardSearchResponse, Balance } from "@/lib/types";
import { buildConciergeSystemPrompt, MAX_TOOL_ROUNDS, normalizeMessages, OFFLINE_INTRO, streamConcierge } from "./concierge";
import { CONCIERGE_TOOLS, runConciergeTool, type ToolContext } from "./tools";
import { createSseParser, type SseMessage } from "./sse";

async function collect(stream: ReadableStream<Uint8Array>): Promise<SseMessage[]> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const parser = createSseParser();
  const out: SseMessage[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out.push(...parser.push(decoder.decode(value, { stream: true })));
  }
  out.push(...parser.push(decoder.decode()), ...parser.flush());
  return out;
}

const bestFare: AwardFare = {
  programId: "aeroplan",
  cabin: "business",
  miles: 75000,
  taxesUsd: 110,
  seats: 3,
  transferOptions: [],
  cpp: 5.4,
  valueScore: 84,
  badges: ["Sweet spot"],
  source: "simulated",
  fetchedAt: "2026-10-07T00:00:00Z",
};

const fakeSearch = async (query: AwardSearchQuery): Promise<AwardSearchResponse> => ({
  query,
  source: "simulated",
  providers: [{ id: "simulator", ms: 3, count: 1 }],
  generatedAt: "2026-10-07T00:00:00Z",
  results: [
    {
      itinerary: {
        id: "i1",
        segments: [{ carrier: "NH", flightNumber: "NH9", origin: "JFK", destination: "NRT", departure: "2027-05-14T13:00", arrival: "2027-05-15T16:00", durationMin: 840, cabin: "business" }],
        totalDurationMin: 840,
        stops: 0,
        distanceMiles: 6740,
      },
      fares: [bestFare],
      bestFare,
      cashPriceUsd: 4200,
    },
  ],
});

const TODAY = "2026-10-07";

describe("streamConcierge (offline fallback)", () => {
  it("explains how to enable AI, runs a heuristic award search and ends with done", async () => {
    const events = await collect(
      streamConcierge({
        client: null,
        messages: [{ role: "user", content: "JFK to NRT May 14 business for 2" }],
        context: { today: TODAY },
        deps: { searchAwards: fakeSearch },
      }),
    );
    const names = events.map((e) => e.event);
    expect(names[0]).toBe("text");
    expect(events[0].data).toBe(OFFLINE_INTRO);
    expect(String(events[0].data)).toContain("ANTHROPIC_API_KEY");

    const tool = events.find((e) => e.event === "tool");
    expect(tool).toBeDefined();
    expect(tool?.data).toMatchObject({ name: "search_awards", input: { origin: ["JFK"], destination: ["NRT"], date: "2027-05-14", cabin: "business", passengers: 2 } });

    const text = events.filter((e) => e.event === "text").map((e) => String(e.data)).join("");
    expect(text).toContain("JFK → NRT");
    expect(text).toContain("JFK→NRT");
    expect(text).toContain("75,000");
    expect(text).toContain("/search?from=JFK&to=NRT&date=2027-05-14&cabin=business&pax=2");
    expect(text).toContain("demo results");

    expect(names[names.length - 1]).toBe("done");
    expect(events[events.length - 1].data).toMatchObject({ offline: true, usage: { inputTokens: 0, outputTokens: 0 } });
  });

  it("asks for details when the last message is not a travel request", async () => {
    const events = await collect(streamConcierge({ client: null, messages: [{ role: "user", content: "hello there" }], context: { today: TODAY } }));
    expect(events.map((e) => e.event)).toEqual(["text", "text", "done"]);
    expect(String(events[1].data)).toContain("Tell me where you're flying from");
  });

  it("asks for an origin when none is known", async () => {
    const events = await collect(streamConcierge({ client: null, messages: [{ role: "user", content: "business class to Tokyo in May for 2" }], context: { today: TODAY } }));
    const text = events.filter((e) => e.event === "text").map((e) => String(e.data)).join("");
    expect(text).toContain("Which airport are you flying from");
    expect(events.some((e) => e.event === "tool")).toBe(false);
    expect(events[events.length - 1].event).toBe("done");
  });

  it("uses the home airport from context", async () => {
    const events = await collect(
      streamConcierge({
        client: null,
        messages: [{ role: "user", content: "business class to Tokyo in May for 2" }],
        context: { today: TODAY, homeAirport: "BOS" },
        deps: { searchAwards: fakeSearch },
      }),
    );
    expect(events.find((e) => e.event === "tool")?.data).toMatchObject({ input: { origin: ["BOS"], destination: ["TYO"] } });
  });
});

describe("tool definitions", () => {
  it("every tool uses a strict schema with all properties required", () => {
    expect(CONCIERGE_TOOLS.map((t) => t.name)).toEqual(["search_awards", "route_availability", "get_program", "transfer_options", "search_hotels", "get_deals", "wallet_balances"]);
    for (const t of CONCIERGE_TOOLS) {
      expect(t.strict).toBe(true);
      const schema = t.input_schema as { additionalProperties?: boolean; required?: string[]; properties?: Record<string, unknown> };
      expect(schema.additionalProperties).toBe(false);
      expect(schema.required).toEqual(Object.keys(schema.properties ?? {}));
    }
    expect(MAX_TOOL_ROUNDS).toBe(6);
  });
});

describe("runConciergeTool", () => {
  const ctx: ToolContext = { today: TODAY };

  it("search_awards renders a compact table with a search link", async () => {
    const r = await runConciergeTool("search_awards", { origin: ["jfk"], destination: ["NRT"], date: "2027-05-14", cabin: "business", passengers: 2, flexDays: 3 }, { ...ctx, deps: { searchAwards: fakeSearch } });
    expect(r.summary).toBe("1 option for JFK → NRT · J · 2027-05-14 ±3d");
    expect(r.content).toContain("| Route | Carrier | Program | Miles | Taxes | Seats | ¢/pt | Score |");
    expect(r.content).toContain("| JFK→NRT (nonstop, 14h) | NH | aeroplan | 75,000 | $110 | 3 | 5.4¢ | 84 · Sweet spot |");
    expect(r.content).toContain("Cash comparison ≈ $4,200");
    expect(r.content).toContain("/search?from=JFK&to=NRT&date=2027-05-14&cabin=business&pax=2&flex=3");
    expect(r.content).toContain("simulated demo results");
  });

  it("rejects invalid input and unknown tools", async () => {
    await expect(runConciergeTool("search_awards", { origin: [], destination: ["NRT"] }, ctx)).rejects.toThrow(/Invalid input for search_awards/);
    await expect(runConciergeTool("search_hotels", { city: "Tokyo", checkIn: "2027-05-20", checkOut: "2027-05-18", guests: 2 }, ctx)).rejects.toThrow(/checkOut/);
    await expect(runConciergeTool("nope", {}, ctx)).rejects.toThrow(/Unknown tool/);
  });

  it("wallet_balances and transfer_options use the context wallet", async () => {
    const wallet: Balance[] = [
      { programId: "amex-mr", amount: 100000, updatedAt: TODAY, source: "manual" },
      { programId: "aeroplan", amount: 10000, updatedAt: TODAY, source: "manual", status: "25K" },
    ];
    const empty = await runConciergeTool("wallet_balances", {}, ctx);
    expect(empty.content).toContain("no balances");

    const w = await runConciergeTool("wallet_balances", {}, { ...ctx, wallet });
    expect(w.summary).toBe("2 balances");
    expect(w.content).toContain("amex-mr (amex-mr): 100,000");
    expect(w.content).toContain("· 25K");

    const t = await runConciergeTool(
      "transfer_options",
      { programId: "Aeroplan", miles: 75000 },
      { ...ctx, wallet, deps: { transfersTo: () => [{ from: "amex-mr", to: "aeroplan", ratio: [1, 1], transferTime: "instant", minimum: 1000 }] } },
    );
    expect(t.summary).toBe("1 transfer route into aeroplan for 75,000");
    expect(t.content).toContain("User already holds 10,000 aeroplan directly; needs 65,000 more.");
    expect(t.content).toContain("amex-mr: 75,000 points (1:1, posts instant) ✓ user holds 100,000");

    const none = await runConciergeTool("transfer_options", { programId: "aeroplan", miles: 75000 }, { ...ctx, deps: { transfersTo: () => [] } });
    expect(none.content).toContain("No bank currencies transfer into aeroplan");
  });

  it("get_program reports unknown ids and get_deals handles empty results", async () => {
    const p = await runConciergeTool("get_program", { id: "aeroplan" }, { ...ctx, deps: { getProgram: () => undefined, listPrograms: () => [] } });
    expect(p.summary).toContain("Unknown program");
    const d = await runConciergeTool("get_deals", { origin: null, cabin: null }, { ...ctx, deps: { getDeals: async () => [] } });
    expect(d.content).toContain("No current deals anywhere");
  });
});

describe("normalizeMessages / system prompt", () => {
  it("drops empty, leading-assistant and trailing-assistant turns and caps length", () => {
    const msgs = normalizeMessages([
      { role: "assistant", content: "hi" },
      { role: "user", content: "  " },
      { role: "user", content: "a".repeat(5000) },
      { role: "assistant", content: "ok" },
      { role: "user", content: "next" },
      { role: "assistant", content: "pending…" },
    ]);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(msgs[0].content).toHaveLength(4000);
  });

  it("includes today, home airport and the wallet in the system prompt", () => {
    const prompt = buildConciergeSystemPrompt({ today: TODAY, homeAirport: "sea", wallet: [{ programId: "chase-ur", amount: 85000, updatedAt: TODAY, source: "manual" }] });
    expect(prompt).toContain("Today is 2026-10-07");
    expect(prompt).toContain("home airport is SEA");
    expect(prompt).toContain("- chase-ur: 85,000");
    expect(prompt).toContain("search_awards");
  });
});
