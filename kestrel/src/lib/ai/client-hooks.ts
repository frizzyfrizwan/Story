"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AwardSearchQuery, Balance, ParsedTravelIntent } from "@/lib/types";
import type { IntentChip } from "./intent-heuristics";
import { createSseParser, type SseMessage } from "./sse";

// ─── useConcierge ───────────────────────────────────────────────

export interface ConciergeChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True while the assistant turn is still streaming. */
  pending?: boolean;
  error?: string;
}

export interface ConciergeToolEvent {
  id: string;
  /** The assistant message this tool call belongs to. */
  messageId: string;
  name: string;
  input: unknown;
  summary: string;
  error?: boolean;
  at: number;
}

export interface ConciergeUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface ConciergeDoneEvent {
  usage: ConciergeUsage;
  rounds: number;
  model: string | null;
  stopReason?: string;
  offline?: boolean;
}

export interface UseConciergeOptions {
  /** Defaults to /api/ai/concierge */
  endpoint?: string;
  context?: { wallet?: Balance[]; homeAirport?: string; today?: string };
  initialMessages?: ConciergeChatMessage[];
  onDone?: (done: ConciergeDoneEvent) => void;
}

let counter = 0;
function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function isAbort(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

/**
 * Chat state for the AI concierge. Streams `/api/ai/concierge` SSE into
 * `messages` (text deltas) and `toolEvents` (tool calls as they complete).
 */
export function useConcierge(opts: UseConciergeOptions = {}) {
  const endpoint = opts.endpoint ?? "/api/ai/concierge";
  const [messages, setMessages] = useState<ConciergeChatMessage[]>(opts.initialMessages ?? []);
  const [toolEvents, setToolEvents] = useState<ConciergeToolEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDone, setLastDone] = useState<ConciergeDoneEvent | null>(null);
  const [offline, setOffline] = useState<boolean | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<ConciergeChatMessage[]>(messages);
  const optsRef = useRef(opts);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  useEffect(() => {
    optsRef.current = opts;
  });
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (text: string): Promise<void> => {
      const content = text.trim();
      if (!content || abortRef.current) return;
      setError(null);

      const userMsg: ConciergeChatMessage = { id: uid("u"), role: "user", content };
      const assistantId = uid("a");
      const history = [...messagesRef.current.filter((m) => !m.pending && m.content.trim().length > 0), userMsg].map(({ role, content: c }) => ({ role, content: c }));

      setMessages((prev) => [...prev, userMsg, { id: assistantId, role: "assistant", content: "", pending: true }]);
      const controller = new AbortController();
      abortRef.current = controller;
      setStreaming(true);

      const patchAssistant = (patch: (m: ConciergeChatMessage) => ConciergeChatMessage) =>
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? patch(m) : m)));

      const handle = (ev: SseMessage) => {
        switch (ev.event) {
          case "text":
            if (typeof ev.data === "string") patchAssistant((m) => ({ ...m, content: m.content + ev.data }));
            break;
          case "tool": {
            const d = (ev.data ?? {}) as { name?: string; input?: unknown; summary?: string; error?: boolean };
            setToolEvents((prev) => [...prev, { id: uid("t"), messageId: assistantId, name: d.name ?? "tool", input: d.input, summary: d.summary ?? "", error: d.error, at: Date.now() }]);
            break;
          }
          case "error": {
            const d = (ev.data ?? {}) as { message?: string };
            setError(d.message ?? "Something went wrong");
            break;
          }
          case "done": {
            const d = ev.data as ConciergeDoneEvent;
            setLastDone(d);
            setOffline(Boolean(d?.offline));
            optsRef.current.onDone?.(d);
            break;
          }
          default:
            break; // "thinking" and anything newer are safe to ignore
        }
      };

      try {
        const ctx = optsRef.current.context ?? {};
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: history, context: { ...ctx, today: ctx.today ?? todayIso() } }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          let msg = `Request failed (${res.status})`;
          try {
            const j = (await res.json()) as { error?: string };
            if (j?.error) msg = j.error;
          } catch {
            /* non-JSON error body */
          }
          throw new Error(msg);
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = createSseParser();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const ev of parser.push(decoder.decode(value, { stream: true }))) handle(ev);
        }
        for (const ev of parser.push(decoder.decode())) handle(ev);
        for (const ev of parser.flush()) handle(ev);
        patchAssistant((m) => ({ ...m, pending: false }));
      } catch (err) {
        if (isAbort(err)) {
          patchAssistant((m) => ({ ...m, pending: false }));
        } else {
          const msg = err instanceof Error ? err.message : "Something went wrong";
          setError(msg);
          patchAssistant((m) => ({ ...m, pending: false, error: msg }));
        }
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [endpoint],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setToolEvents([]);
    setError(null);
    setLastDone(null);
  }, [stop]);

  return { messages, send, streaming, toolEvents, stop, reset, error, usage: lastDone?.usage ?? null, lastDone, offline };
}

// ─── useIntentParser ────────────────────────────────────────────

export interface UseIntentParserOptions {
  /** Debounce in ms (default 350). */
  delayMs?: number;
  /** Minimum characters before parsing (default 3). */
  minLength?: number;
  /** Defaults to /api/ai/parse */
  endpoint?: string;
  enabled?: boolean;
  homeAirport?: string;
}

export interface IntentParserState {
  intent: ParsedTravelIntent | null;
  query: AwardSearchQuery | null;
  chips: IntentChip[];
  loading: boolean;
  error: string | null;
  /** The text the current result was parsed from. */
  parsedText: string;
}

const EMPTY: IntentParserState = { intent: null, query: null, chips: [], loading: false, error: null, parsedText: "" };

/**
 * Debounced "as you type" parser for the search box. Returns the parsed intent,
 * a ready-to-run query and display chips ("JFK → NRT", "Business", "2 pax").
 */
export function useIntentParser(text: string, opts: UseIntentParserOptions = {}): IntentParserState {
  const { delayMs = 350, minLength = 3, endpoint = "/api/ai/parse", enabled = true, homeAirport } = opts;
  const [state, setState] = useState<IntentParserState>(EMPTY);

  useEffect(() => {
    const trimmed = text.trim();
    if (!enabled || trimmed.length < minLength) {
      setState(EMPTY);
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: trimmed, homeAirport }),
          signal: controller.signal,
        });
        const json = (await res.json()) as { ok: boolean; error?: string; data?: { intent: ParsedTravelIntent; query: AwardSearchQuery; chips?: IntentChip[] } };
        if (!res.ok || !json?.ok || !json.data) throw new Error(json?.error ?? `Request failed (${res.status})`);
        setState({ intent: json.data.intent, query: json.data.query, chips: json.data.chips ?? [], loading: false, error: null, parsedText: trimmed });
      } catch (err) {
        if (isAbort(err)) return;
        setState((s) => ({ ...s, loading: false, error: err instanceof Error ? err.message : "Could not parse" }));
      }
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, enabled, minLength, delayMs, endpoint, homeAirport]);

  return state;
}
