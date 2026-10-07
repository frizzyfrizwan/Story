"use client";

/**
 * Share controls for a find: copy the link, or open an X / Reddit intent in a new tab.
 */

import { ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/ui/tokens";
import { CopyLinkButton } from "./find-card";

function absolute(path: string): string {
  if (typeof window === "undefined") return path;
  return new URL(path, window.location.origin).toString();
}

export function ShareButtons({ path, title, className }: { path: string; title: string; className?: string }) {
  // Absolute URLs need `window`; compute after mount so SSR and hydration agree.
  const [url, setUrl] = useState(path);
  useEffect(() => setUrl(absolute(path)), [path]);

  const text = `${title} — via Kestrel`;
  const xHref = `https://twitter.com/intent/tweet?${new URLSearchParams({ text, url }).toString()}`;
  const redditHref = `https://www.reddit.com/submit?${new URLSearchParams({ url, title }).toString()}`;

  return (
    <div className={cn("flex flex-wrap items-center gap-1", className)}>
      <CopyLinkButton path={path} label="Copy link" />
      <ShareLink href={xHref} label="Post on X" />
      <ShareLink href={redditHref} label="Share on Reddit" />
    </div>
  );
}

function ShareLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg",
        focusRing,
      )}
    >
      {label}
      <ArrowUpRight className="size-3.5 opacity-70" aria-hidden="true" />
    </a>
  );
}
