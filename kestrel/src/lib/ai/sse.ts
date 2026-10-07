/**
 * Tiny Server-Sent Events helpers. Client-safe (no server-only import) so the
 * same framing/parsing code runs in route handlers and in the browser hook.
 *
 * Wire format (one frame per `send`):
 *
 *   event: <name>\n
 *   data: <JSON>\n
 *   \n
 */

export const SSE_HEADERS: Record<string, string> = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
  "x-accel-buffering": "no",
};

/** Format a single SSE frame. Multi-line JSON is kept on one `data:` line. */
export function formatSseEvent(event: string, data: unknown): string {
  const name = event.replace(/[\r\n]/g, " ").trim() || "message";
  const payload = JSON.stringify(data === undefined ? null : data).replace(/\r?\n/g, "\\n");
  return `event: ${name}\ndata: ${payload}\n\n`;
}

export interface SseStream {
  stream: ReadableStream<Uint8Array>;
  /** Enqueue one frame. No-op once closed. */
  send(event: string, data: unknown): void;
  /** Close the stream. Idempotent. */
  close(): void;
  readonly closed: boolean;
}

/**
 * Create a ReadableStream of SSE frames with an imperative sender. Safe to call
 * `send` after the consumer cancelled — frames are dropped, nothing throws.
 */
export function createSseStream(): SseStream {
  const encoder = new TextEncoder();
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null;
  let closed = false;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
    cancel() {
      closed = true;
      controller = null;
    },
  });

  return {
    stream,
    send(event, data) {
      if (closed || !controller) return;
      try {
        controller.enqueue(encoder.encode(formatSseEvent(event, data)));
      } catch {
        closed = true;
      }
    },
    close() {
      if (closed) return;
      closed = true;
      try {
        controller?.close();
      } catch {
        /* already closed by the consumer */
      }
      controller = null;
    },
    get closed() {
      return closed;
    },
  };
}

export interface SseMessage {
  event: string;
  /** Parsed JSON when the data line is JSON, otherwise the raw string. */
  data: unknown;
  raw: string;
}

/**
 * Incremental SSE parser for the browser. Feed it decoded text chunks (any
 * boundary) and it yields complete frames. Call `flush()` at end of stream.
 */
export function createSseParser(): { push(chunk: string): SseMessage[]; flush(): SseMessage[] } {
  let buffer = "";

  function parseFrame(frame: string): SseMessage | null {
    let event = "message";
    const dataLines: string[] = [];
    for (const line of frame.split(/\r?\n/)) {
      if (!line || line.startsWith(":")) continue;
      const idx = line.indexOf(":");
      const field = idx === -1 ? line : line.slice(0, idx);
      let value = idx === -1 ? "" : line.slice(idx + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "event") event = value;
      else if (field === "data") dataLines.push(value);
    }
    if (dataLines.length === 0) return null;
    const raw = dataLines.join("\n");
    let data: unknown = raw;
    try {
      data = JSON.parse(raw);
    } catch {
      /* not JSON — leave as string */
    }
    return { event, data, raw };
  }

  return {
    push(chunk) {
      buffer += chunk;
      const out: SseMessage[] = [];
      let idx: number;
      // Frames end with a blank line (\n\n or \r\n\r\n).
      while ((idx = buffer.search(/\r?\n\r?\n/)) !== -1) {
        const match = /\r?\n\r?\n/.exec(buffer.slice(idx));
        const sepLen = match ? match[0].length : 2;
        const frame = buffer.slice(0, idx);
        buffer = buffer.slice(idx + sepLen);
        const msg = parseFrame(frame);
        if (msg) out.push(msg);
      }
      return out;
    },
    flush() {
      const rest = buffer;
      buffer = "";
      const msg = rest.trim() ? parseFrame(rest) : null;
      return msg ? [msg] : [];
    },
  };
}
