"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Controlled/uncontrolled state in one hook. Pass `value` to control, otherwise
 * the component owns its state and reports changes through `onChange`.
 */
export function useControllableState<T>({
  value,
  defaultValue,
  onChange,
}: {
  value?: T;
  defaultValue: T;
  onChange?: (value: T) => void;
}): [T, (next: T | ((prev: T) => T)) => void] {
  const [internal, setInternal] = useState<T>(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? (value as T) : internal;

  const latest = useRef({ current, isControlled, onChange });
  latest.current = { current, isControlled, onChange };

  const set = useCallback((next: T | ((prev: T) => T)) => {
    const { current: prev, isControlled: controlled, onChange: emit } = latest.current;
    const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
    if (!controlled) setInternal(resolved);
    emit?.(resolved);
  }, []);

  return [current, set];
}
