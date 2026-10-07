"use client";

import { useEffect, useState } from "react";

/** A clock that ticks every `interval` ms so relative times ("checked 4m ago") stay honest. */
export function useNow(interval = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), interval);
    return () => clearInterval(t);
  }, [interval]);
  return now;
}
