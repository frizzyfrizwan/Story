"use client";

import {
  ArrowLeftRight,
  BedDouble,
  Calendar,
  ChevronRight,
  CircleAlert,
  RotateCcw,
  Search,
  Sparkles,
  Tag,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ConciergeChatMessage, ConciergeToolEvent } from "@/lib/ai/client-hooks";
import { cn } from "@/lib/utils";
import { KestrelMark } from "@/components/brand/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { focusRing } from "@/components/ui/tokens";
import { ConciergeMarkdown } from "./markdown";

// ─── Tool chips ─────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: LucideIcon; label: string }> = {
  search_awards: { icon: Search, label: "Award search" },
  route_availability: { icon: Calendar, label: "Availability" },
  get_program: { icon: Tag, label: "Program" },
  transfer_options: { icon: ArrowLeftRight, label: "Transfers" },
  search_hotels: { icon: BedDouble, label: "Hotels" },
  get_deals: { icon: Sparkles, label: "Deals" },
  wallet_balances: { icon: Wallet, label: "Wallet" },
};

function toolMeta(name: string) {
  return TOOL_META[name] ?? { icon: Wrench, label: name.replace(/_/g, " ") };
}

function formatInputValue(value: unknown): string {
  if (value == null) return "—";
  if (Array.isArray(value)) return value.map((v) => formatInputValue(v)).join(" / ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function inputEntries(input: unknown): [string, string][] {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  return Object.entries(input as Record<string, unknown>).map(([k, v]) => [k, formatInputValue(v)]);
}

function ToolStep({ event, last }: { event: ConciergeToolEvent; last: boolean }) {
  const [open, setOpen] = useState(false);
  const { icon: Icon, label } = toolMeta(event.name);
  const entries = inputEntries(event.input);
  const failed = Boolean(event.error);
  const summary = failed ? event.summary.replace(/^Failed:\s*/i, "") : event.summary;

  return (
    <li className="relative pl-8">
      <span
        aria-hidden="true"
        className={cn(
          "absolute left-0 top-1 grid size-6 place-items-center rounded-full border bg-bg-elev-2 [&_svg]:size-3.5",
          failed ? "border-rose/40 text-rose" : "border-violet/35 text-violet",
        )}
      >
        {failed ? <CircleAlert /> : <Icon />}
      </span>
      {!last && <span aria-hidden="true" className="absolute -bottom-1.5 left-3 top-7 w-px bg-panel-border" />}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        disabled={entries.length === 0}
        title={event.name}
        className={cn(
          "group flex w-full items-start gap-2 rounded-[8px] py-1 pr-1 text-left text-[13px] leading-6 transition-colors",
          failed ? "text-rose" : "text-fg-muted enabled:hover:text-fg",
          "disabled:cursor-default",
          focusRing,
        )}
      >
        <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
          <span className={cn("font-medium", failed ? "text-rose" : "text-fg")}>{failed ? "Failed" : label}</span>
          <span className="text-fg-subtle" aria-hidden="true">
            {" · "}
          </span>
          {summary}
        </span>
        {entries.length > 0 && (
          <ChevronRight
            className="mt-[5px] size-3.5 shrink-0 text-fg-subtle transition-transform duration-200 group-aria-expanded:rotate-90"
            aria-hidden="true"
          />
        )}
      </button>
      {open && entries.length > 0 && (
        <dl className="mb-1.5 mt-0.5 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-0.5 rounded-[8px] border border-panel-border bg-bg-elev-1/70 px-3 py-2 font-mono text-[11.5px]">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-faint">{k}</dt>
              <dd className="text-fg-muted [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

export function ToolTimeline({ events, className }: { events: ConciergeToolEvent[]; className?: string }) {
  if (!events.length) return null;
  return (
    <ol className={cn("my-2 flex flex-col gap-1.5", className)} aria-label="Tools the concierge ran">
      {events.map((e, i) => (
        <ToolStep key={e.id} event={e} last={i === events.length - 1} />
      ))}
    </ol>
  );
}

// ─── Status rows ────────────────────────────────────────────────

function WorkingRow({ label }: { label: string }) {
  return (
    <div role="status" className="mt-2 flex items-center gap-2 text-[13px]">
      <Spinner size="xs" label="" className="text-fg-subtle" />
      <span className="bg-[linear-gradient(90deg,var(--fg-subtle)_0%,var(--fg)_50%,var(--fg-subtle)_100%)] bg-[length:200%_100%] bg-clip-text text-transparent motion-safe:animate-shimmer">
        {label}
      </span>
    </div>
  );
}

export function ErrorNotice({ message, onRetry, className }: { message: string; onRetry?: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[var(--radius)] border border-rose/25 bg-rose-soft px-3.5 py-2.5 text-[13px] text-fg",
        className,
      )}
    >
      <CircleAlert className="size-4 shrink-0 text-rose" aria-hidden="true" />
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{message}</span>
      {onRetry && (
        <Button type="button" size="sm" variant="secondary" onClick={onRetry} leading={<RotateCcw aria-hidden="true" />}>
          Retry
        </Button>
      )}
    </div>
  );
}

/** True once `content` has stopped changing for `delay` ms while `pending`. */
function useIdle(content: string, pending: boolean, delay = 700): boolean {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    if (!pending) {
      setIdle(false);
      return;
    }
    setIdle(false);
    const t = setTimeout(() => setIdle(true), delay);
    return () => clearTimeout(t);
  }, [content, pending, delay]);
  return idle;
}

// ─── Messages ───────────────────────────────────────────────────

function UserMessage({ message }: { message: ConciergeChatMessage }) {
  return (
    <div className="flex justify-end animate-rise">
      <div className="max-w-[min(85%,38rem)] whitespace-pre-wrap rounded-[20px] rounded-br-[6px] bg-fg/8 px-4 py-2.5 text-[15px] leading-relaxed text-fg [overflow-wrap:anywhere]">
        {message.content}
      </div>
    </div>
  );
}

interface AssistantMessageProps {
  message: ConciergeChatMessage;
  events: ConciergeToolEvent[];
  offline: boolean;
  model: string | null;
  showOfflineNote: boolean;
  onRetry?: () => void;
}

function AssistantMessage({ message, events, offline, model, showOfflineNote, onRetry }: AssistantMessageProps) {
  const pending = Boolean(message.pending);
  const empty = message.content.trim().length === 0;
  const idle = useIdle(message.content, pending);

  return (
    <article className="flex gap-3 animate-rise sm:gap-4" aria-busy={pending || undefined}>
      <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full border border-panel-border bg-bg-elev-2 shadow-panel">
        <KestrelMark size={18} tone="gradient" dot={false} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex h-8 items-center gap-2">
          <span className="text-[13px] font-semibold tracking-[-0.01em] text-fg">Kestrel</span>
          {offline ? (
            <Badge variant="gold" size="sm" caps title="No ANTHROPIC_API_KEY — rule-based answers only">
              Heuristic
            </Badge>
          ) : (
            model && <span className="font-mono text-[10.5px] text-fg-subtle">{model}</span>
          )}
        </div>
        <ToolTimeline events={events} />
        {!empty && <ConciergeMarkdown content={message.content} caret={pending} />}
        {pending && (empty || idle) && <WorkingRow label={empty ? "Thinking…" : "Working…"} />}
        {message.error && <ErrorNotice className="mt-3" message={message.error} onRetry={onRetry} />}
        {showOfflineNote && !pending && (
          <p className="mt-3 text-xs text-fg-subtle">Heuristic mode — a rule-based search answered this. Add an Anthropic key for Claude.</p>
        )}
      </div>
    </article>
  );
}

export interface MessageListProps {
  messages: ConciergeChatMessage[];
  toolEvents: ConciergeToolEvent[];
  streaming: boolean;
  /** `true` once the server has said it is running without an API key. */
  offline: boolean;
  /** Model name shown on assistant turns when AI is live. */
  model: string | null;
  /** Stream-level error from the hook (rate limit, API failure). */
  error: string | null;
  onRetry: () => void;
  className?: string;
}

/** The conversation: user bubbles on the right, Kestrel's answers with their tool timeline on the left. */
export function MessageList({ messages, toolEvents, streaming, offline, model, error, onRetry, className }: MessageListProps) {
  const eventsByMessage = useMemo(() => {
    const map = new Map<string, ConciergeToolEvent[]>();
    for (const e of toolEvents) {
      const list = map.get(e.messageId);
      if (list) list.push(e);
      else map.set(e.messageId, [e]);
    }
    return map;
  }, [toolEvents]);

  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const lastHasInlineError = Boolean(lastAssistant?.error);

  return (
    <div className={cn("flex flex-col gap-7", className)} aria-live="polite" aria-relevant="additions text">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserMessage key={m.id} message={m} />
        ) : (
          <AssistantMessage
            key={m.id}
            message={m}
            events={eventsByMessage.get(m.id) ?? []}
            offline={offline}
            model={model}
            showOfflineNote={offline && m.id === lastAssistant?.id && !streaming}
            onRetry={m.error ? onRetry : undefined}
          />
        ),
      )}
      {error && !streaming && !lastHasInlineError && <ErrorNotice message={error} onRetry={onRetry} className="ml-11 sm:ml-12" />}
    </div>
  );
}
