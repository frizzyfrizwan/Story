"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/button";

const KEY = "kestrel.demoBanner.dismissed";
const listeners = new Set<() => void>();

function readDismissed(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
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
 * Slim strip under the header while the app runs on simulated data.
 * Dismissal is remembered in localStorage. Rendered only after hydration so
 * the server never guesses the viewer's choice.
 */
export function DemoBanner({ className }: { className?: string }) {
  // Server snapshot = "dismissed" → nothing is rendered until the client knows better.
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* private mode: the banner simply returns next load */
    }
    listeners.forEach((l) => l());
  }, []);

  return (
    <AnimatePresence initial={false}>
      {!dismissed && (
        <motion.div
          role="status"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className={cn(
            "relative z-30 overflow-hidden border-b border-gold/20 bg-gold-soft text-[12.5px] text-fg",
            className,
          )}
        >
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-1.5 sm:px-6">
            <Badge variant="gold" size="sm" dot caps className="shrink-0">
              Demo
            </Badge>
            <p className="min-w-0 flex-1 truncate">
              Demo data — add API keys in{" "}
              <Link
                href="/settings/integrations"
                className="font-medium underline decoration-gold/50 underline-offset-2 transition-colors hover:text-gold"
              >
                Settings → Integrations
              </Link>{" "}
              to go live.
            </p>
            <IconButton label="Dismiss demo notice" size="sm" onClick={dismiss} className="-mr-2 size-8 shrink-0">
              <X />
            </IconButton>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
