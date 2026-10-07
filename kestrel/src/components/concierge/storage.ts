"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Browser storage for the concierge. Conversation lives in sessionStorage
 * (per tab, cleared on close); preferences and recent prompts in localStorage.
 * Every read/write is wrapped so private mode and blocked storage never throw.
 */

export const CONVERSATION_KEY = "kestrel.concierge.conversation.v1";
export const RECENT_KEY = "kestrel.concierge.recent.v1";
export const RAIL_KEY = "kestrel.concierge.rail.v1";
export const ORIGIN_KEY = "kestrel.concierge.origin.v1";

export type StorageArea = "local" | "session";

const listeners = new Set<() => void>();

function area(kind: StorageArea): Storage | null {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

export function readStored(kind: StorageArea, key: string): string | null {
  try {
    return area(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function writeStored(kind: StorageArea, key: string, value: string | null): void {
  try {
    const s = area(kind);
    if (s) {
      if (value === null) s.removeItem(key);
      else s.setItem(key, value);
    }
  } catch {
    /* quota or private mode — the UI keeps working without persistence */
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

/**
 * A storage-backed string. `undefined` on the server and during hydration,
 * then the stored value (or `null` when nothing is stored).
 */
export function useStoredString(kind: StorageArea, key: string): [string | null | undefined, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(kind, key),
    () => undefined,
  );
  const set = useCallback((v: string | null) => writeStored(kind, key, v), [kind, key]);
  return [value, set];
}

// ─── Conversation ───────────────────────────────────────────────

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const MAX_STORED_MESSAGES = 30;

export function parseConversation(raw: string | null | undefined): StoredMessage[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { v?: number; messages?: unknown };
    if (parsed?.v !== 1 || !Array.isArray(parsed.messages)) return null;
    const messages = parsed.messages.filter(
      (m): m is StoredMessage =>
        typeof m === "object" &&
        m !== null &&
        typeof (m as StoredMessage).id === "string" &&
        ((m as StoredMessage).role === "user" || (m as StoredMessage).role === "assistant") &&
        typeof (m as StoredMessage).content === "string",
    );
    return messages.slice(-MAX_STORED_MESSAGES);
  } catch {
    return null;
  }
}

export function serializeConversation(messages: StoredMessage[]): string {
  return JSON.stringify({ v: 1, messages: messages.slice(-MAX_STORED_MESSAGES) });
}

// ─── Recent prompts ─────────────────────────────────────────────

const MAX_RECENT = 8;

export function parseRecent(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string" && p.trim().length > 0).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function pushRecent(prompt: string): void {
  const text = prompt.trim().slice(0, 200);
  if (!text) return;
  const next = [text, ...parseRecent(readStored("local", RECENT_KEY)).filter((p) => p !== text)].slice(0, MAX_RECENT);
  writeStored("local", RECENT_KEY, JSON.stringify(next));
}
