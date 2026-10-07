"use client";

import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { KestrelMark } from "@/components/brand/logo";
import { focusRing } from "@/components/ui/tokens";
import { SUGGESTED_PROMPTS } from "./composer";

interface Capability {
  title: string;
  line: string;
  tone: string;
  glyph: React.ReactNode;
}

const GLYPH = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" } as const;

const CAPABILITIES: Capability[] = [
  {
    title: "Search live award seats",
    line: "Any route, cabin and date — miles, taxes, seats and ¢/pt across 40+ programs.",
    tone: "text-aurora",
    glyph: (
      <svg viewBox="0 0 48 48" {...GLYPH} aria-hidden="true">
        <circle cx="21" cy="21" r="12.5" />
        <path d="M30.5 30.5 40 40" />
        <path d="M15.5 16.5v7.5a2 2 0 0 0 2 2H25a2.5 2.5 0 0 0 2.5-2.5V22" />
        <path d="M18.5 26v2.5M24.5 26v2.5" />
        <circle cx="40" cy="40" r="2.2" fill="var(--signal)" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Compare transfer options",
    line: "Which bank points to move, at what ratio, with live bonuses and posting times.",
    tone: "text-violet",
    glyph: (
      <svg viewBox="0 0 48 48" {...GLYPH} aria-hidden="true">
        <circle cx="13" cy="24" r="8" />
        <circle cx="35" cy="24" r="8" strokeDasharray="3 2.5" />
        <path d="M20 19.5h8m-2.5-2.5 2.5 2.5-2.5 2.5" />
        <path d="M28 28.5h-8m2.5 2.5L20 28.5l2.5-2.5" />
        <circle cx="13" cy="24" r="2" fill="currentColor" stroke="none" />
        <circle cx="35" cy="24" r="2" fill="var(--signal)" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Plan hotels + flights",
    line: "Award stays priced per night against cash, paired with the flight that gets you there.",
    tone: "text-gold",
    glyph: (
      <svg viewBox="0 0 48 48" {...GLYPH} aria-hidden="true">
        <path d="M7 36V22h22a7 7 0 0 1 7 7v7" />
        <path d="M7 30h29" />
        <path d="M11 22v-4.5h8V22" />
        <path d="M24 12c4.5-4.5 10.5-5.5 15-3.5-1.5 3-4.5 6-8 8.5" strokeDasharray="2.5 2.5" />
        <circle cx="39" cy="8.5" r="2.2" fill="var(--signal)" stroke="none" />
      </svg>
    ),
  },
];

export interface ConciergeEmptyStateProps {
  /** Called with a suggested prompt; the experience sends it straight away. */
  onPick: (prompt: string) => void;
  className?: string;
}

/** Hero for an empty conversation: headline, three capability cards, starter prompts. */
export function ConciergeEmptyState({ onPick, className }: ConciergeEmptyStateProps) {
  return (
    <div className={cn("animate-rise py-4 sm:py-8", className)}>
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-panel-border bg-bg-elev-2 shadow-panel">
          <KestrelMark size={30} tone="gradient" />
        </div>
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-signal">AI concierge</p>
        <h1 className="font-display text-4xl leading-[1.02] tracking-tight text-fg balance-text sm:text-5xl">Ask anything about points</h1>
        <p className="mx-auto mt-4 max-w-lg text-[15px] leading-relaxed text-fg-muted pretty-text">
          Kestrel searches live award space, works out which bank points to move and plans the stay — and shows every tool it runs along the way.
        </p>
      </div>

      <ul className="mt-9 grid gap-3 sm:grid-cols-3" aria-label="What the concierge can do">
        {CAPABILITIES.map((c) => (
          <li key={c.title} className="rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/70 p-4 backdrop-blur-sm">
            <div className={cn("size-10 [&_svg]:size-10", c.tone)}>{c.glyph}</div>
            <h2 className="mt-3 text-[14px] font-semibold tracking-[-0.01em] text-fg">{c.title}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-fg-muted pretty-text">{c.line}</p>
          </li>
        ))}
      </ul>

      <div className="mt-9">
        <p className="mb-3 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">Try asking</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {SUGGESTED_PROMPTS.map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onPick(prompt)}
                className={cn(
                  "group inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border border-panel-border bg-bg-elev-1 px-3.5 text-[13px] text-fg-muted transition-colors hover:border-panel-border-strong hover:bg-bg-elev-2 hover:text-fg",
                  focusRing,
                )}
              >
                <span className="truncate">{prompt}</span>
                <ArrowUpRight className="size-3.5 shrink-0 text-fg-faint transition-colors group-hover:text-signal" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
