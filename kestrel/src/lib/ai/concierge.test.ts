import { describe, expect, it } from "vitest";
import type { AwardFare, AwardSearchQuery, AwardSearchResponse, Balance, LoyaltyProgram } from "@/lib/types";
import { buildConciergeSystemPrompt, MAX_TOOL_ROUNDS, normalizeMessages, OFFLINE_INTRO, streamConcierge } from "./concierge";
import { CONCIERGE_TOOLS, runConciergeTool, type ConciergeDeps, type ToolContext } from "./tools";
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

// ─── Fixtures (tests never depend on the curated datasets) ──────

function prog(id: string, name: string, shortName: string, kind: LoyaltyProgram["kind"], valuationCpp: number): LoyaltyProgram {
  return {
    id,
    name,
    shortName,
    kind,
    currency: `${shortName} points`,
    valuationCpp,
    chartType: "zone",
    surcharges: "low",
    typicalTaxesUsd: { economy: 50, premium: 80, business: 120, first: 150 },
    changeFeeUsd: 0,
    cancelFeeUsd: 0,
    expirationPolicy: "n/a",
    bookingUrl: `https://${id}.example`,
    color: "#000",
    summary: "Fixture program.",
    sweetSpots: [{ title: "Test spot", description: "A sweet spot.", cabin: "business", miles: 60000 }],
    bookableCarriers: ["AC", "NH"],
    oneWay: true,
    routingRules: "One stopover allowed.",
  };
}
const PROGRAMS: Record<string, LoyaltyProgram> = {
  aeroplan: prog("aeroplan", "Air Canada Aeroplan", "Aeroplan", "airline", 1.5),
  "amex-mr": prog("amex-mr", "American Express Membership Rewards", "Amex MR", "bank", 2.0),
};
const fixtureDeps: Partial<ConciergeDeps> = {
  getProgram: (id) => PROGRAMS[id],
  listPrograms: () => Object.values(PROGRAMS),
  transfersTo: () => [],
};

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
        deps: { ...fixtureDeps, searchAwards: fakeSearch },
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

    expect(names).not.toContain("error");
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
        deps: { ...fixtureDeps, searchAwards: fakeSearch },
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
  const ctx: ToolContext = { today: TODAY, deps: fixtureDeps };
  const withDeps = (deps: Partial<ConciergeDeps>, extra: Partial<ToolContext> = {}): ToolContext => ({ ...ctx, ...extra, deps: { ...fixtureDeps, ...deps } });

  it("search_awards renders a compact table with a search link", async () => {
    const r = await runConciergeTool("search_awards", { origin: ["jfk"], destination: ["NRT"], date: "2027-05-14", cabin: "business", passengers: 2, flexDays: 3 }, withDeps({ searchAwards: fakeSearch }));
    expect(r.summary).toBe("1 option for JFK → NRT · J · 2027-05-14 ±3d");
    expect(r.content).toContain("| Route | Carrier | Program | Miles | Taxes | Seats | ¢/pt | Score |");
    expect(r.content).toContain("| JFK→NRT (nonstop, 14h) | NH | Aeroplan | 75,000 | $110 | 3 | 5.4¢ | 84 · Sweet spot |");
    expect(r.content).toContain("Cash comparison ≈ $4,200");
    expect(r.content).toContain("/search?from=JFK&to=NRT&date=2027-05-14&cabin=business&pax=2&flex=3");
    expect(r.content).toContain("simulated demo results");
  });

  it("search_awards reports empty results with suggestions", async () => {
    const r = await runConciergeTool(
      "search_awards",
      { origin: ["BOS"], destination: ["LON"], date: "2027-06-01", cabin: "first", passengers: 1, flexDays: 0 },
      withDeps({ searchAwards: async (query) => ({ query, source: "live", providers: [], generatedAt: "", results: [] }) }),
    );
    expect(r.summary).toBe("No award space: BOS → LON · F · 2027-06-01");
    expect(r.content).toContain("widen the date window");
    expect(r.content).not.toContain("simulated");
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
    expect(w.summary).toBe("2 balances ≈ $2,150");
    expect(w.content).toContain("American Express Membership Rewards (amex-mr): 100,000 ≈ $2,000");
    expect(w.content).toContain("Air Canada Aeroplan (aeroplan): 10,000 ≈ $150 · 25K");

    const t = await runConciergeTool(
      "transfer_options",
      { programId: "Aeroplan", miles: 75000 },
      withDeps({ transfersTo: () => [{ from: "amex-mr", to: "aeroplan", ratio: [1, 1], transferTime: "instant", minimum: 1000 }] }, { wallet }),
    );
    expect(t.summary).toBe("1 transfer route into Aeroplan for 75,000");
    expect(t.content).toContain("User already holds 10,000 Aeroplan directly; needs 65,000 more.");
    expect(t.content).toContain("Amex MR: 75,000 points (1:1, posts instant) ✓ user holds 100,000");

    const none = await runConciergeTool("transfer_options", { programId: "aeroplan", miles: 75000 }, ctx);
    expect(none.content).toContain("No bank currencies transfer into Aeroplan");
  });

  it("get_program summarises a program and reports unknown ids", async () => {
    const p = await runConciergeTool("get_program", { id: "Aeroplan" }, ctx);
    expect(p.summary).toBe("Looked up Air Canada Aeroplan");
    expect(p.content).toContain("**Air Canada Aeroplan** (aeroplan)");
    expect(p.content).toContain("- Test spot — 60,000 J: A sweet spot.");
    expect(p.content).toContain("/programs/aeroplan");

    const unknown = await runConciergeTool("get_program", { id: "zzz-points" }, ctx);
    expect(unknown.summary).toContain("Unknown program");
    expect(unknown.content).toContain("Known ids: aeroplan, amex-mr");
  });

  it("get_deals handles empty results", async () => {
    const d = await runConciergeTool("get_deals", { origin: null, cabin: null }, withDeps({ getDeals: async () => [] }));
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
