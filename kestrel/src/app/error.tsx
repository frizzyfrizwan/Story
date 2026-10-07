"use client";

import { useEffect } from "react";
import { House, LifeBuoy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="px-4 py-12 sm:px-6 sm:py-20">
      <Panel
        strong
        grain
        rise
        padding="lg"
        className="mx-auto max-w-xl"
        eyebrow={<span className="text-rose">Turbulence</span>}
        title="Something went wrong at altitude"
        description="An unexpected error interrupted this page. Your searches, wallet and alerts are safe — try again, or head back to the deck."
      >
        {error.digest && (
          <p className="font-mono text-xs text-fg-subtle">
            Reference <span className="select-all text-fg-muted">{error.digest}</span>
          </p>
        )}
        {process.env.NODE_ENV !== "production" && error.message && (
          <pre className="mt-3 max-h-40 overflow-auto rounded-[var(--radius-sm)] border border-rose/20 bg-rose-soft p-3 font-mono text-xs leading-relaxed text-rose scrollbar-thin">
            {error.message}
          </pre>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={reset} leading={<RotateCcw />}>
            Try again
          </Button>
          <Button href="/" variant="secondary" leading={<House />}>
            Home
          </Button>
          <Button href="/concierge" variant="ghost" leading={<LifeBuoy />}>
            Get help
          </Button>
        </div>
      </Panel>
    </section>
  );
}
