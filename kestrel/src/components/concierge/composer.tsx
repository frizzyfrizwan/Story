"use client";

import { ArrowUp, Square } from "lucide-react";
import { useId, useLayoutEffect, type KeyboardEvent, type RefObject } from "react";
import { cn, fmtInt } from "@/lib/utils";
import { Button, IconButton } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

export const MAX_PROMPT_CHARS = 4000;
const COUNTER_THRESHOLD = 3500;
const MAX_HEIGHT_PX = 192;

/** Starter prompts shown while the conversation is empty. */
export const SUGGESTED_PROMPTS = [
  "Where can 100k Amex points take me in business?",
  "Cheapest way to fly JFK→LHR in J next spring",
  "Explain Aeroplan stopovers",
  "Best Hyatt in Tokyo under 25k/night",
  "Is 72.5k Virgin for ANA First a good deal?",
] as const;

export interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  className?: string;
}

/**
 * Sticky prompt box: auto-growing textarea (Enter sends, Shift+Enter breaks a
 * line), a primary send button, Stop while streaming and a counter near the
 * 4,000-character limit.
 */
export function Composer({ value, onChange, onSend, onStop, streaming, textareaRef, className }: ComposerProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const length = value.length;
  const showCounter = length >= COUNTER_THRESHOLD;
  const over = length >= MAX_PROMPT_CHARS;
  const canSend = value.trim().length > 0 && !streaming && !over;

  // Grow with content, capped; the textarea scrolls past the cap.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`;
  }, [value, textareaRef]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (canSend) onSend();
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSend) onSend();
      }}
      className={cn(
        "relative rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 shadow-panel transition-[border-color,box-shadow] duration-200",
        "focus-within:border-signal/50 focus-within:ring-[3px] focus-within:ring-signal/15",
        streaming && "border-panel-border-strong",
        className,
      )}
    >
      <label htmlFor={id} className="sr-only">
        Message the concierge
      </label>
      <textarea
        id={id}
        ref={textareaRef}
        name="prompt"
        rows={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={streaming}
        maxLength={MAX_PROMPT_CHARS}
        autoComplete="off"
        spellCheck
        enterKeyHint="send"
        placeholder={streaming ? "Kestrel is answering…" : "Ask about award seats, transfers, hotels…"}
        aria-describedby={hintId}
        className="block max-h-48 w-full resize-none bg-transparent px-4 pb-1 pt-3.5 text-[15px] leading-relaxed text-fg outline-none scrollbar-thin placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:text-fg-muted"
      />
      <div className="flex items-center justify-between gap-3 pb-2.5 pl-4 pr-2.5">
        <p id={hintId} className="hidden min-w-0 items-center gap-1.5 text-xs text-fg-subtle sm:flex" aria-live="polite">
          {streaming ? (
            <span>Answering — press Stop to interrupt.</span>
          ) : (
            <>
              <Kbd keys={["enter"]} /> <span>to send</span>
              <span className="text-fg-faint" aria-hidden="true">
                ·
              </span>
              <Kbd keys={["shift", "enter"]} /> <span>for a new line</span>
            </>
          )}
        </p>
        <p className="min-w-0 text-xs text-fg-subtle sm:hidden" aria-hidden="true">
          {streaming ? "Answering…" : ""}
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {showCounter && (
            <span className={cn("font-mono text-[11px] tnum", over ? "text-rose" : "text-fg-subtle")} aria-live="polite">
              {fmtInt(length)} / {fmtInt(MAX_PROMPT_CHARS)}
            </span>
          )}
          {streaming ? (
            <Button type="button" variant="secondary" size="sm" onClick={onStop} leading={<Square className="size-3! fill-current" aria-hidden="true" />}>
              Stop
            </Button>
          ) : (
            <IconButton type="submit" label="Send" variant="primary" size="sm" disabled={!canSend}>
              <ArrowUp />
            </IconButton>
          )}
        </div>
      </div>
    </form>
  );
}
