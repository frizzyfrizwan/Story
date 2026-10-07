import { describe, expect, it } from "vitest";
import { createSseParser, createSseStream, formatSseEvent, SSE_HEADERS } from "./sse";

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

describe("formatSseEvent", () => {
  it("frames an event with JSON data", () => {
    expect(formatSseEvent("text", "hi")).toBe('event: text\ndata: "hi"\n\n');
    expect(formatSseEvent("tool", { name: "search_awards", input: { a: 1 } })).toBe('event: tool\ndata: {"name":"search_awards","input":{"a":1}}\n\n');
  });

  it("keeps multi-line strings on a single data line", () => {
    expect(formatSseEvent("text", "a\nb")).toBe('event: text\ndata: "a\\nb"\n\n');
  });

  it("sanitises the event name and serialises undefined as null", () => {
    expect(formatSseEvent("bad\nname", undefined)).toBe("event: bad name\ndata: null\n\n");
  });
});

describe("createSseStream", () => {
  it("streams frames in order and ignores sends after close", async () => {
    const sse = createSseStream();
    expect(sse.closed).toBe(false);
    sse.send("text", "a");
    sse.send("done", { ok: true });
    sse.close();
    sse.send("text", "late");
    sse.close();
    expect(sse.closed).toBe(true);
    expect(await readAll(sse.stream)).toBe('event: text\ndata: "a"\n\nevent: done\ndata: {"ok":true}\n\n');
  });

  it("survives consumer cancellation", async () => {
    const sse = createSseStream();
    sse.send("text", "a");
    await sse.stream.cancel();
    expect(() => sse.send("text", "b")).not.toThrow();
    expect(() => sse.close()).not.toThrow();
    expect(sse.closed).toBe(true);
  });
});

describe("createSseParser", () => {
  it("parses frames across arbitrary chunk boundaries and CRLF", () => {
    const raw = 'event: text\ndata: "hel"\n\nevent: text\r\ndata: "lo"\r\n\r\n: keep-alive comment\n\nevent: done\ndata: {"usage":{"inputTokens":1,"outputTokens":2}}\n\n';
    const parser = createSseParser();
    const out = [];
    for (let i = 0; i < raw.length; i += 7) out.push(...parser.push(raw.slice(i, i + 7)));
    out.push(...parser.flush());
    expect(out.map((m) => m.event)).toEqual(["text", "text", "done"]);
    expect(out[0].data).toBe("hel");
    expect(out[1].data).toBe("lo");
    expect(out[2].data).toEqual({ usage: { inputTokens: 1, outputTokens: 2 } });
  });

  it("round-trips the stream helper", async () => {
    const sse = createSseStream();
    sse.send("text", "Tokyo in May");
    sse.send("tool", { name: "search_awards", input: { origin: ["JFK"] }, summary: "3 options" });
    sse.send("done", { usage: { inputTokens: 0, outputTokens: 0 } });
    sse.close();
    const parser = createSseParser();
    const events = [...parser.push(await readAll(sse.stream)), ...parser.flush()];
    expect(events.map((e) => e.event)).toEqual(["text", "tool", "done"]);
    expect(events[1].data).toMatchObject({ name: "search_awards", summary: "3 options" });
  });

  it("flush returns a trailing frame without a terminator and leaves raw strings alone", () => {
    const parser = createSseParser();
    expect(parser.push("event: text\ndata: not json")).toEqual([]);
    const tail = parser.flush();
    expect(tail).toHaveLength(1);
    expect(tail[0]).toMatchObject({ event: "text", data: "not json", raw: "not json" });
    expect(parser.flush()).toEqual([]);
  });

  it("defaults to the message event when none is given", () => {
    const parser = createSseParser();
    expect(parser.push('data: "x"\n\n')).toEqual([{ event: "message", data: "x", raw: '"x"' }]);
  });
});

describe("SSE_HEADERS", () => {
  it("disables buffering and caching", () => {
    expect(SSE_HEADERS["content-type"]).toContain("text/event-stream");
    expect(SSE_HEADERS["cache-control"]).toContain("no-cache");
    expect(SSE_HEADERS["x-accel-buffering"]).toBe("no");
  });
});
