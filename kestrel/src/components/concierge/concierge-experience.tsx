"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowDown, MessageSquarePlus, PanelRightClose, PanelRightOpen } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import { useConcierge } from "@/lib/ai/client-hooks";
import type { TripIdea } from "@/lib/ai/explain";
import { ApiError, apiGet, apiPost } from "@/lib/client/api";
import type { Balance } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { Composer } from "./composer";
import { ContextPanel, type AiStatus } from "./context-panel";
import { ConciergeEmptyState } from "./empty-state";
import { MessageList } from "./message-list";
import {
  CONVERSATION_KEY,
  ORIGIN_KEY,
  RAIL_KEY,
  RECENT_KEY,
  parseConversation,
  parseRecent,
  pushRecent,
  readStored,
  serializeConversation,
  useStoredString,
  writeStored,
  type StoredMessage,
} from "./storage";

export interface ConciergeExperienceProps {
  /** From the server session — avoids a 401 round-trip for signed-out visitors. */
  signedIn: boolean;
  /** `?q=` from the URL; sent once on mount, then stripped from the address bar. */
  initialPrompt?: string;
}

// ─── Restore the per-tab conversation before the chat mounts ────

const noopSubscribe = () => () => {};
const readConversationSnapshot = () => readStored("session", CONVERSATION_KEY);
const serverSnapshot = () => undefined;

/**
 * Reads sessionStorage once (post-hydration, before paint) and mounts the chat
 * with those messages. The decision is frozen so later writes never remount.
 */
export function ConciergeExperience(props: ConciergeExperienceProps) {
  const raw = useSyncExternalStore(noopSubscribe, readConversationSnapshot, serverSnapshot);
  const frozen = useRef<{ decided: boolean; messages: StoredMessage[] }>({ decided: false, messages: [] });
  if (!frozen.current.decided && raw !== undefined) {
    frozen.current = { decided: true, messages: parseConversation(raw) ?? [] };
  }
  const initial = frozen.current.messages;
  return <ConciergeChat key={initial.length ? "restored" : "fresh"} initialMessages={initial} {...props} />;
}

// ─── Scroll follow ──────────────────────────────────────────────

const STICK_PX = 80;
const AWAY_PX = 240;

/** Keep the page pinned to the end of the conversation while streaming unless the reader scrolls up. */
function useFollowOutput(columnRef: RefObject<HTMLDivElement | null>, active: boolean) {
  const stickRef = useRef(true);
  const ignoreUntil = useRef(0);
  const [away, setAway] = useState(false);

  const measure = useCallback(() => {
    const el = columnRef.current;
    if (!el) return;
    const distance = el.getBoundingClientRect().bottom - window.innerHeight;
    const atBottom = distance <= STICK_PX;
    // A smooth scroll we started passes through "not at bottom" — do not treat that as the reader leaving.
    if (!atBottom && Date.now() < ignoreUntil.current) return;
    stickRef.current = atBottom;
    setAway(distance > AWAY_PX);
  }, [columnRef]);

  const scrollToLatest = useCallback(
    (behavior: ScrollBehavior = "smooth") => {
      const el = columnRef.current;
      if (!el) return;
      const top = el.getBoundingClientRect().bottom + window.scrollY - window.innerHeight;
      stickRef.current = true;
      setAway(false);
      if (behavior === "smooth") ignoreUntil.current = Date.now() + 900;
      window.scrollTo({ top: Math.max(0, Math.round(top)), behavior });
    },
    [columnRef],
  );

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        measure();
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [measure]);

  useEffect(() => {
    const el = columnRef.current;
    if (!el || !active) return;
    const ro = new ResizeObserver(() => {
      if (stickRef.current) scrollToLatest("instant");
      else measure();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [active, columnRef, scrollToLatest, measure]);

  return { away, measure, scrollToLatest };
}

// ─── Status pill ────────────────────────────────────────────────

function StatusPill({ isOffline, model, loading }: { isOffline: boolean | null; model: string | null; loading: boolean }) {
  if (isOffline === null) return loading ? <Skeleton className="h-5 w-16 rounded-full" /> : null;
  return isOffline ? (
    <Badge variant="gold" size="sm" dot caps title="No ANTHROPIC_API_KEY configured — answers come from the rule-based fallback">
      Heuristic
    </Badge>
  ) : (
    <Badge variant="aurora" size="sm" dot pulse caps title={model ? `Answered by ${model}` : "Claude is live"}>
      Claude
    </Badge>
  );
}

// ─── Chat ───────────────────────────────────────────────────────

interface ConciergeChatProps extends ConciergeExperienceProps {
  initialMessages: StoredMessage[];
}

function ConciergeChat({ signedIn, initialPrompt, initialMessages }: ConciergeChatProps) {
  const router = useRouter();
  const columnRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // Preferences (localStorage) — undefined until hydrated.
  const [railStored, setRailStored] = useStoredString("local", RAIL_KEY);
  const railOpen = railStored !== "0";
  const [originStored, setOriginStored] = useStoredString("local", ORIGIN_KEY);
  const [recentRaw, setRecentRaw] = useStoredString("local", RECENT_KEY);
  const recent = useMemo(() => parseRecent(recentRaw), [recentRaw]);

  // Context data.
  const statusQ = useQuery({
    queryKey: ["concierge", "ai-status"],
    queryFn: () => apiGet<AiStatus>("/api/ai/status"),
    staleTime: 5 * 60_000,
  });
  const walletQ = useQuery({
    queryKey: ["concierge", "wallet"],
    queryFn: () => apiGet<{ balances: Balance[] }>("/api/wallet"),
    enabled: signedIn,
    retry: false,
    staleTime: 60_000,
  });
  const profileQ = useQuery({
    queryKey: ["concierge", "profile"],
    queryFn: () => apiGet<{ profile: { homeAirport: string | null } }>("/api/profile"),
    enabled: signedIn,
    retry: false,
    staleTime: 5 * 60_000,
  });
  const walletUnauthorized = walletQ.error instanceof ApiError && walletQ.error.unauthenticated;
  const effectiveSignedIn = signedIn && !walletUnauthorized;
  const balances = walletQ.data?.balances;
  const homeAirport = profileQ.data?.profile?.homeAirport ?? undefined;
  const origin = (originStored ?? homeAirport ?? "JFK").toUpperCase();
  const validOrigin = /^[A-Z]{3}$/.test(origin);
  const points = useMemo(() => (balances ?? []).map((b) => ({ programId: b.programId, amount: b.amount })), [balances]);
  const walletSettled = !signedIn || walletQ.isSuccess || walletQ.isError;
  const ideasQ = useQuery({
    queryKey: ["concierge", "ideas", origin, points],
    queryFn: () => apiPost<{ ideas: TripIdea[] }>("/api/ai/ideas", { origin, points }),
    enabled: validOrigin && walletSettled,
    staleTime: 10 * 60_000,
  });

  // The conversation.
  const { messages, send, streaming, toolEvents, stop, reset, error, offline } = useConcierge({
    initialMessages,
    context: validOrigin ? { homeAirport: origin } : undefined,
  });
  const isEmpty = messages.length === 0;
  const isOffline = offline ?? (statusQ.data ? !statusQ.data.enabled : null);
  const model = statusQ.data?.enabled ? statusQ.data.model : null;
  const lastUser = useMemo(() => [...messages].reverse().find((m) => m.role === "user"), [messages]);

  // Persist (messages only) whenever a turn settles.
  useEffect(() => {
    if (streaming) return;
    const toStore: StoredMessage[] = messages
      .filter((m) => !m.pending && m.content.trim().length > 0)
      .map(({ id, role, content }) => ({ id, role, content }));
    writeStored("session", CONVERSATION_KEY, toStore.length ? serializeConversation(toStore) : null);
  }, [messages, streaming]);

  // Scroll management.
  const { away, measure, scrollToLatest } = useFollowOutput(columnRef, streaming);
  useEffect(() => {
    if (lastUser) scrollToLatest("smooth");
  }, [lastUser, scrollToLatest]);
  useEffect(() => {
    measure();
  }, [messages.length, streaming, measure]);

  const handleSend = useCallback(
    (text?: string) => {
      const content = (text ?? draft).trim();
      if (!content || streaming) return;
      setDraft("");
      pushRecent(content);
      void send(content);
    },
    [draft, streaming, send],
  );

  const handleRetry = useCallback(() => {
    if (lastUser && !streaming) void send(lastUser.content);
  }, [lastUser, streaming, send]);

  const handleNew = useCallback(() => {
    reset();
    setDraft("");
    writeStored("session", CONVERSATION_KEY, null);
    textareaRef.current?.focus();
  }, [reset]);

  const insertPrompt = useCallback((text: string) => {
    setDraft(text);
    setSheetOpen(false);
    window.setTimeout(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(text.length, text.length);
    }, 60);
  }, []);

  // `?q=` from the landing page: send once, then clean the URL.
  const sentInitial = useRef(false);
  useEffect(() => {
    if (!initialPrompt || sentInitial.current) return;
    sentInitial.current = true;
    pushRecent(initialPrompt);
    void send(initialPrompt);
    router.replace("/concierge", { scroll: false });
  }, [initialPrompt, send, router]);

  const panel = (
    <ContextPanel
      signedIn={effectiveSignedIn}
      status={statusQ.data}
      statusLoading={statusQ.isLoading}
      offline={offline}
      balances={balances}
      walletLoading={signedIn && walletQ.isLoading}
      walletError={signedIn && walletQ.isError && !walletUnauthorized}
      ideas={ideasQ.data?.ideas}
      ideasLoading={ideasQ.isLoading || (validOrigin && !walletSettled)}
      ideasError={ideasQ.isError}
      origin={origin}
      onOriginChange={(code) => setOriginStored(code)}
      recent={recent}
      onClearRecent={() => setRecentRaw(null)}
      onInsert={insertPrompt}
    />
  );

  const showJump = away && !isEmpty;

  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] aurora-bg opacity-70 [mask-image:linear-gradient(to_bottom,black,transparent)]"
      />
      <div
        className={cn(
          "relative mx-auto max-w-7xl px-4 sm:px-6 lg:grid lg:gap-10",
          railOpen ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "lg:grid-cols-[minmax(0,1fr)_auto]",
        )}
      >
        {/* ── Conversation ─────────────────────────────────── */}
        <div ref={columnRef} className="mx-auto w-full min-w-0 max-w-3xl pb-14 lg:pb-0">
          <header className="flex items-center justify-between gap-3 pb-2 pt-5 sm:pt-6">
            <div className="flex min-w-0 items-center gap-2.5">
              {isEmpty ? (
                <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Concierge</p>
              ) : (
                <h1 className="font-mono text-[11px] uppercase tracking-[0.2em] text-signal">Concierge</h1>
              )}
              <StatusPill isOffline={isOffline} model={model} loading={statusQ.isLoading} />
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleNew}
                disabled={isEmpty && draft.length === 0}
                leading={<MessageSquarePlus aria-hidden="true" />}
              >
                New chat
              </Button>
              <IconButton label="Open context panel" size="sm" className="lg:hidden" onClick={() => setSheetOpen(true)}>
                <PanelRightOpen />
              </IconButton>
            </div>
          </header>

          <div className="min-h-[40dvh] pt-2">
            {isEmpty ? (
              <ConciergeEmptyState onPick={(prompt) => handleSend(prompt)} />
            ) : (
              <MessageList
                messages={messages}
                toolEvents={toolEvents}
                streaming={streaming}
                offline={isOffline === true}
                model={model}
                error={error}
                onRetry={handleRetry}
                className="py-3"
              />
            )}
          </div>

          <div className="sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 pb-3 pt-4 lg:bottom-0 lg:pb-6">
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-b from-transparent to-bg" />
            <div aria-hidden="true" className="absolute inset-x-0 bottom-0 top-0 -z-10 bg-bg" />
            <AnimatePresence>
              {showJump && (
                <motion.button
                  type="button"
                  key="jump"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                  onClick={() => scrollToLatest("smooth")}
                  className="absolute left-1/2 top-0 inline-flex h-9 -translate-x-1/2 -translate-y-[calc(100%+0.25rem)] items-center gap-1.5 rounded-full border border-panel-border-strong bg-bg-elev-2 px-3.5 text-[13px] font-medium text-fg shadow-panel transition-colors hover:bg-bg-elev-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                >
                  <ArrowDown className="size-3.5" aria-hidden="true" />
                  Jump to latest
                </motion.button>
              )}
            </AnimatePresence>
            <Composer
              value={draft}
              onChange={setDraft}
              onSend={() => handleSend()}
              onStop={stop}
              streaming={streaming}
              textareaRef={textareaRef}
              autoFocus={isEmpty && !initialPrompt}
            />
          </div>
        </div>

        {/* ── Context rail (desktop) ───────────────────────── */}
        <aside className="hidden lg:block" aria-label="Context">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain pb-6 pt-5 scrollbar-thin sm:pt-6">
            {railOpen ? (
              <div className="panel grain p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-sm font-semibold tracking-[-0.01em] text-fg">Context</h2>
                  <Tooltip content="Hide context" side="left">
                    <IconButton label="Hide context panel" size="sm" onClick={() => setRailStored("0")}>
                      <PanelRightClose />
                    </IconButton>
                  </Tooltip>
                </div>
                {panel}
              </div>
            ) : (
              <Tooltip content="Show context" side="left">
                <IconButton label="Show context panel" size="sm" variant="secondary" onClick={() => setRailStored("1")}>
                  <PanelRightOpen />
                </IconButton>
              </Tooltip>
            )}
          </div>
        </aside>
      </div>

      {/* ── Context sheet (phones & tablets) ─────────────── */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent title="Context" eyebrow="Concierge" onCloseAutoFocus={(e) => e.preventDefault()}>
          {panel}
        </SheetContent>
      </Sheet>
    </div>
  );
}
