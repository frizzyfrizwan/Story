"use client";

import { ArrowUpRight, Clock, KeyRound, Lightbulb, LogIn, Wallet as WalletIcon, X } from "lucide-react";
import type { ReactNode } from "react";
import type { TripIdea } from "@/lib/ai/explain";
import { CABIN_LABEL, type Balance } from "@/lib/types";
import { cn, fmtInt } from "@/lib/utils";
import { loginHref } from "@/lib/client/api";
import { getProgram } from "@/data/programs";
import { ProgramLogo } from "@/components/art/program-logo";
import { Badge, CabinBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { focusRing } from "@/components/ui/tokens";

export interface AiStatus {
  enabled: boolean;
  model: string;
  fastModel: string;
  fallback: boolean;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Prompt inserted into the composer when a trip idea is picked. */
export function ideaPrompt(idea: TripIdea, origin: string): string {
  const program = getProgram(idea.programId)?.shortName ?? idea.programId;
  const months = idea.bestMonths.slice(0, 3).map((m) => MONTHS[m - 1]).filter(Boolean);
  return `${CABIN_LABEL[idea.cabin]} class from ${origin} to ${idea.destination} with ${program} — around ${fmtInt(idea.miles)} miles${months.length ? `, ideally in ${months.join("/")}` : ""}. Which dates have space, and which points should I transfer?`;
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">{children}</h3>
      {action}
    </div>
  );
}

// ─── AI status ──────────────────────────────────────────────────

function StatusSection({ status, loading, offline }: { status: AiStatus | undefined; loading: boolean; offline: boolean | null }) {
  const enabled = offline === null ? status?.enabled : !offline;
  return (
    <section aria-labelledby="ctx-status">
      <SectionLabel>
        <span id="ctx-status">AI status</span>
      </SectionLabel>
      {loading && !status ? (
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-3 w-28" />
        </div>
      ) : enabled ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="aurora" size="sm" dot pulse caps title="Claude is answering with live tools">
            Claude
          </Badge>
          {status?.model && <span className="font-mono text-[11.5px] text-fg-muted">{status.model}</span>}
        </div>
      ) : (
        <div className="rounded-[var(--radius)] border border-gold/25 bg-gold-soft/70 p-3">
          <div className="flex items-center gap-2">
            <Badge variant="gold" size="sm" dot caps>
              Heuristic mode
            </Badge>
          </div>
          <p className="mt-2 flex items-start gap-2 text-[13px] leading-snug text-fg">
            <KeyRound className="mt-0.5 size-3.5 shrink-0 text-gold" aria-hidden="true" />
            <span>
              Add <code className="rounded-[4px] bg-fg/8 px-1 font-mono text-[12px]">ANTHROPIC_API_KEY</code> to enable Claude — heuristic mode is on.
            </span>
          </p>
          <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">Award searches still run; answers are rule-based and skip reasoning, program lookups and transfers.</p>
        </div>
      )}
    </section>
  );
}

// ─── Wallet ─────────────────────────────────────────────────────

interface WalletSectionProps {
  signedIn: boolean;
  balances: Balance[] | undefined;
  loading: boolean;
  error: boolean;
}

function WalletSection({ signedIn, balances, loading, error }: WalletSectionProps) {
  const top = (balances ?? []).slice(0, 4);
  const rest = Math.max(0, (balances?.length ?? 0) - top.length);
  return (
    <section aria-labelledby="ctx-wallet">
      <SectionLabel
        action={
          signedIn && (
            <a href="/wallet" className={cn("inline-flex items-center gap-0.5 rounded-[4px] text-[11.5px] text-fg-subtle hover:text-fg", focusRing)}>
              Manage <ArrowUpRight className="size-3" aria-hidden="true" />
            </a>
          )
        }
      >
        <span id="ctx-wallet">Wallet</span>
      </SectionLabel>
      {!signedIn ? (
        <div className="rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/60 p-3">
          <p className="flex items-start gap-2 text-[13px] leading-snug text-fg-muted">
            <WalletIcon className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
            Sign in to let the concierge use your points.
          </p>
          <Button href={loginHref("/concierge")} size="sm" variant="secondary" className="mt-3" leading={<LogIn aria-hidden="true" />}>
            Sign in
          </Button>
        </div>
      ) : loading ? (
        <ul className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <li key={i} className="flex items-center gap-2.5">
              <Skeleton className="size-7 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-14" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <p className="text-[13px] text-fg-muted">Couldn&rsquo;t load your wallet right now.</p>
      ) : top.length === 0 ? (
        <p className="text-[13px] leading-snug text-fg-muted">
          No balances yet —{" "}
          <a href="/wallet" className="text-sky underline decoration-sky/35 underline-offset-[3px] hover:decoration-sky">
            add them
          </a>{" "}
          so answers are tailored to what you hold.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {top.map((b) => {
            const p = getProgram(b.programId);
            return (
              <li key={b.programId} className="flex items-center gap-2.5 py-0.5">
                <ProgramLogo id={b.programId} name={p?.name ?? b.programId} color={p?.color} size={26} />
                <span className="min-w-0 flex-1 truncate text-[13px] text-fg">{p?.shortName ?? b.programId}</span>
                <span className="font-mono text-[12.5px] tnum text-fg-muted">{fmtInt(b.amount)}</span>
              </li>
            );
          })}
          {rest > 0 && (
            <li className="pt-1 text-xs text-fg-subtle">
              +{rest} more in <a href="/wallet" className="underline underline-offset-[3px] hover:text-fg">your wallet</a>
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

// ─── Trip ideas ─────────────────────────────────────────────────

interface IdeasSectionProps {
  ideas: TripIdea[] | undefined;
  loading: boolean;
  error: boolean;
  origin: string;
  onOriginChange: (code: string) => void;
  onInsert: (prompt: string) => void;
}

function IdeasSection({ ideas, loading, error, origin, onOriginChange, onInsert }: IdeasSectionProps) {
  const validOrigin = /^[A-Z]{3}$/.test(origin);
  return (
    <section aria-labelledby="ctx-ideas">
      <SectionLabel
        action={
          <label className="flex items-center gap-1.5 text-[11px] text-fg-subtle">
            <span>From</span>
            <input
              value={origin}
              onChange={(e) => onOriginChange(e.target.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3))}
              maxLength={3}
              aria-label="Home airport for trip ideas"
              spellCheck={false}
              autoComplete="off"
              className={cn(
                "h-6 w-11 rounded-[6px] border border-panel-border bg-bg-elev-1 text-center font-mono text-[11.5px] uppercase tracking-[0.1em] text-fg outline-none transition-colors hover:border-panel-border-strong focus-visible:border-signal/60",
                !validOrigin && "border-rose/50",
              )}
            />
          </label>
        }
      >
        <span id="ctx-ideas">Trip ideas</span>
      </SectionLabel>
      {!validOrigin ? (
        <p className="text-[13px] text-fg-muted">Enter a three-letter airport code to get ideas.</p>
      ) : loading && !ideas ? (
        <ul className="flex flex-col gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/60 p-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
              <Skeleton className="mt-2.5 h-3.5 w-3/4" />
              <Skeleton className="mt-2 h-3 w-full" />
            </li>
          ))}
        </ul>
      ) : error ? (
        <p className="text-[13px] text-fg-muted">Ideas are unavailable right now.</p>
      ) : !ideas?.length ? (
        <p className="text-[13px] text-fg-muted">No ideas for {origin} yet — try a bigger hub.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {ideas.map((idea) => {
            const p = getProgram(idea.programId);
            return (
              <li key={`${idea.destination}-${idea.programId}-${idea.cabin}`}>
                <div className="group relative rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/60 transition-colors hover:border-panel-border-strong hover:bg-bg-elev-2/60">
                  <button
                    type="button"
                    onClick={() => onInsert(ideaPrompt(idea, origin))}
                    title="Insert this idea into the composer"
                    className={cn("block w-full rounded-[inherit] p-3 text-left", focusRing)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] tracking-[0.12em] text-fg-subtle">
                        {origin}
                        <span className="text-fg-faint"> → </span>
                        <span className="text-fg">{idea.destination}</span>
                      </span>
                      <CabinBadge cabin={idea.cabin} short size="sm" />
                      <span className="ml-auto font-mono text-[12px] tnum text-fg">
                        {fmtInt(idea.miles)}
                        <span className="text-fg-subtle"> pts</span>
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-1 text-[13px] font-medium text-fg">{idea.title}</p>
                    <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-fg-muted">{idea.why}</p>
                    <div className="mt-2 flex items-center gap-2 text-[11px]">
                      {p && (
                        <span className="inline-flex items-center gap-1.5 text-fg-muted">
                          <ProgramLogo id={p.id} name={p.name} color={p.color} size={16} />
                          {p.shortName}
                        </span>
                      )}
                      <span className={cn("ml-auto inline-flex items-center gap-1", idea.affordable ? "text-aurora" : "text-fg-subtle")}>
                        <span className={cn("size-1.5 rounded-full", idea.affordable ? "bg-aurora" : "bg-fg-faint")} aria-hidden="true" />
                        {idea.affordable ? (idea.via ? `Covered via ${getProgram(idea.via)?.shortName ?? idea.via}` : "Covered") : "Not covered yet"}
                      </span>
                    </div>
                  </button>
                  <a
                    href={idea.href}
                    aria-label={`Search ${origin} to ${idea.destination} in ${CABIN_LABEL[idea.cabin]}`}
                    title="Open in Search"
                    className={cn(
                      "absolute right-2 top-2 grid size-7 place-items-center rounded-full text-fg-subtle opacity-0 transition-opacity hover:bg-fg/8 hover:text-fg group-hover:opacity-100 focus-visible:opacity-100",
                      focusRing,
                    )}
                  >
                    <ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ─── Recent ─────────────────────────────────────────────────────

function RecentSection({ recent, onInsert, onClear }: { recent: string[]; onInsert: (prompt: string) => void; onClear: () => void }) {
  return (
    <section aria-labelledby="ctx-recent">
      <SectionLabel
        action={
          recent.length > 0 && (
            <button type="button" onClick={onClear} className={cn("inline-flex items-center gap-1 rounded-[4px] text-[11.5px] text-fg-subtle hover:text-fg", focusRing)}>
              <X className="size-3" aria-hidden="true" /> Clear
            </button>
          )
        }
      >
        <span id="ctx-recent">Recent searches</span>
      </SectionLabel>
      {recent.length === 0 ? (
        <p className="flex items-start gap-2 text-[13px] leading-snug text-fg-muted">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-fg-subtle" aria-hidden="true" />
          Prompts you send show up here for quick reuse.
        </p>
      ) : (
        <ul className="flex flex-col">
          {recent.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onInsert(prompt)}
                className={cn(
                  "flex w-full items-start gap-2 rounded-[8px] px-2 py-1.5 -mx-2 text-left text-[13px] text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg",
                  focusRing,
                )}
              >
                <Clock className="mt-[3px] size-3.5 shrink-0 text-fg-faint" aria-hidden="true" />
                <span className="line-clamp-2 min-w-0">{prompt}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── Panel ──────────────────────────────────────────────────────

export interface ContextPanelProps {
  signedIn: boolean;
  status: AiStatus | undefined;
  statusLoading: boolean;
  /** Runtime truth from the last concierge turn; `null` until a turn completes. */
  offline: boolean | null;
  balances: Balance[] | undefined;
  walletLoading: boolean;
  walletError: boolean;
  ideas: TripIdea[] | undefined;
  ideasLoading: boolean;
  ideasError: boolean;
  origin: string;
  onOriginChange: (code: string) => void;
  recent: string[];
  onClearRecent: () => void;
  onInsert: (prompt: string) => void;
  className?: string;
}

/** The "Context" rail: AI status, wallet, trip ideas and recent prompts. */
export function ContextPanel(props: ContextPanelProps) {
  return (
    <div className={cn("flex flex-col gap-6", props.className)}>
      <StatusSection status={props.status} loading={props.statusLoading} offline={props.offline} />
      <div className="hairline" aria-hidden="true" />
      <WalletSection signedIn={props.signedIn} balances={props.balances} loading={props.walletLoading} error={props.walletError} />
      <div className="hairline" aria-hidden="true" />
      <IdeasSection
        ideas={props.ideas}
        loading={props.ideasLoading}
        error={props.ideasError}
        origin={props.origin}
        onOriginChange={props.onOriginChange}
        onInsert={props.onInsert}
      />
      <div className="hairline" aria-hidden="true" />
      <RecentSection recent={props.recent} onInsert={props.onInsert} onClear={props.onClearRecent} />
    </div>
  );
}
