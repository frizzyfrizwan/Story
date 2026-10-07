"use client";

import { Fragment, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const isMacSnapshot = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent);
const noop = () => () => {};

/** True on Apple platforms after hydration (server renders the non-Mac form). */
export function useIsMac(): boolean {
  return useSyncExternalStore(noop, isMacSnapshot, () => false);
}

const GLYPHS: Record<string, { mac: string; other: string }> = {
  mod: { mac: "⌘", other: "Ctrl" },
  meta: { mac: "⌘", other: "Win" },
  alt: { mac: "⌥", other: "Alt" },
  shift: { mac: "⇧", other: "Shift" },
  ctrl: { mac: "⌃", other: "Ctrl" },
  enter: { mac: "↵", other: "Enter" },
  esc: { mac: "Esc", other: "Esc" },
  backspace: { mac: "⌫", other: "Backspace" },
  tab: { mac: "⇥", other: "Tab" },
  up: { mac: "↑", other: "↑" },
  down: { mac: "↓", other: "↓" },
  left: { mac: "←", other: "←" },
  right: { mac: "→", other: "→" },
};

export interface KbdProps {
  /** Key tokens, e.g. ["mod", "K"]. "mod" renders ⌘ on Apple and Ctrl elsewhere. */
  keys?: string[];
  children?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}

/** Keyboard key cap. Pass `keys` for a chord or `children` for a literal. */
export function Kbd({ keys, children, size = "sm", className }: KbdProps) {
  const mac = useIsMac();
  const cap = cn(
    "inline-flex items-center justify-center rounded-[5px] border border-panel-border-strong bg-bg-elev-2 font-mono font-medium text-fg-muted shadow-[0_1px_0_var(--panel-border-strong)]",
    size === "sm" ? "h-5 min-w-5 px-1.5 text-[10.5px]" : "h-6 min-w-6 px-2 text-xs",
  );

  if (!keys?.length) {
    return <kbd className={cn(cap, className)}>{children}</kbd>;
  }

  return (
    <kbd className={cn("inline-flex items-center gap-1 font-mono", className)}>
      {keys.map((k, i) => {
        const glyph = GLYPHS[k.toLowerCase()];
        const text = glyph ? (mac ? glyph.mac : glyph.other) : k.length === 1 ? k.toUpperCase() : k;
        return (
          <Fragment key={`${k}-${i}`}>
            <kbd className={cap}>{text}</kbd>
          </Fragment>
        );
      })}
    </kbd>
  );
}
