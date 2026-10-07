"use client";

/**
 * <FindCard> — one redemption in the feed. The "ticket" strip (route · cabin · program · miles)
 * is the hero; everything else is quiet. The pieces are exported so the detail page can compose
 * the same look at a larger size.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ArrowRight, Check, Heart, Link2, MessageCircle, Search } from "lucide-react";
import { cn, fmtCpp, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";
import type { Find, FindAuthor } from "@/lib/types";
import { getProgram } from "@/data/programs";
import { getAirline } from "@/data/airlines";
import { loginHref } from "@/lib/client/api";
import { Avatar } from "@/components/ui/avatar";
import { Badge, CabinBadge, ProgramChip } from "@/components/ui/badge";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { focusRing } from "@/components/ui/tokens";
import { AirlineTail } from "@/components/art/program-logo";
import { NumberRoll } from "@/components/viz/number-roll";
import { airportLabel, cppTone, fmtDateTime, hasRoute, plainText, routeSearchHref, timeAgo } from "./format";
import { useLike } from "./use-finds";
import { useViewer } from "./viewer";

// ─── Author row ───────────────────────────────────────────────

export function AuthorRow({
  author,
  createdAt,
  size = "sm",
  trailing,
  className,
}: {
  author: FindAuthor;
  createdAt?: string;
  size?: "sm" | "md";
  trailing?: ReactNode;
  className?: string;
}) {
  const href = `/u/${author.handle}`;
  return (
    <div className={cn("flex min-w-0 items-center gap-3", className)}>
      <Link href={href} className={cn("shrink-0 rounded-full", focusRing)} aria-label={`${author.name}'s profile`}>
        <Avatar seed={author.avatarSeed} name={author.name} size={size} status={author.plan === "pro" ? "pro" : undefined} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col leading-tight">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={href}
            className={cn("truncate rounded-[4px] text-sm font-medium text-fg hover:underline underline-offset-4", focusRing)}
          >
            {author.name}
          </Link>
          {author.plan === "pro" && (
            <Badge variant="gold" size="sm" caps>
              Pro
            </Badge>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-1.5 text-xs text-fg-subtle">
          <Link href={href} className={cn("truncate font-mono rounded-[4px] hover:text-fg", focusRing)}>
            @{author.handle}
          </Link>
          {createdAt && (
            <>
              <span aria-hidden="true">·</span>
              <RelativeTime iso={createdAt} />
            </>
          )}
        </div>
      </div>
      {trailing}
    </div>
  );
}

/** Relative time that re-renders after hydration so SSR and client never disagree visibly. */
export function RelativeTime({ iso, className }: { iso: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  return (
    <time dateTime={iso} title={fmtDateTime(iso)} className={cn("whitespace-nowrap", className)} suppressHydrationWarning>
      {timeAgo(iso, now ?? Date.now())}
    </time>
  );
}

// ─── Redemption strip (the ticket) ────────────────────────────

export function RedemptionStrip({ find, size = "md", className }: { find: Find; size?: "md" | "lg"; className?: string }) {
  const route = hasRoute(find);
  const program = find.programId ? getProgram(find.programId) : undefined;
  const airline = find.carrier ? getAirline(find.carrier) : undefined;
  const hasNumbers = find.miles != null || find.taxesUsd != null || find.cpp != null;
  if (!route && !program && !find.cabin && !hasNumbers) return null;

  const lg = size === "lg";

  return (
    <div
      className={cn(
        "perforated relative grid gap-x-5 gap-y-3 rounded-[12px] border border-panel-border bg-bg-elev-1/70 px-6 py-3.5",
        "sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center",
        lg && "sm:px-7 sm:py-5",
        className,
      )}
    >
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2.5">
        {find.carrier && (
          <Tooltip content={airline?.name ?? find.carrier}>
            <span className="inline-flex" tabIndex={-1}>
              <AirlineTail code={find.carrier} color={airline?.color} size={lg ? 34 : 28} />
            </span>
          </Tooltip>
        )}
        {route && (
          <span
            className={cn(
              "inline-flex items-center gap-2 font-mono font-semibold tracking-[0.06em] text-fg tnum",
              lg ? "text-2xl sm:text-3xl" : "text-lg sm:text-xl",
            )}
            aria-label={`${airportLabel(find.origin)} to ${airportLabel(find.destination)}`}
          >
            <span title={airportLabel(find.origin)}>{find.origin}</span>
            <ArrowRight className={cn("shrink-0 text-signal", lg ? "size-5" : "size-4")} aria-hidden="true" />
            <span title={airportLabel(find.destination)}>{find.destination}</span>
          </span>
        )}
        <span className="inline-flex flex-wrap items-center gap-2">
          {find.cabin && <CabinBadge cabin={find.cabin} size={lg ? "md" : "sm"} />}
          {program && <ProgramChip id={program.id} name={program.shortName} color={program.color} size="sm" />}
          {find.travelDate && lg && (
            <Badge variant="outline" size="sm" className="font-mono tnum">
              {fmtDate(find.travelDate, { year: "numeric" })}
            </Badge>
          )}
        </span>
      </div>

      {hasNumbers && (
        <div className="flex items-end gap-4 sm:justify-end sm:border-l sm:border-dashed sm:border-panel-border-strong sm:pl-5">
          {find.miles != null && (
            <div className="flex flex-col items-start leading-none">
              <NumberRoll value={find.miles} format="int" className={cn("font-semibold text-fg", lg ? "text-3xl" : "text-xl sm:text-2xl")} />
              <span className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">
                {program?.currency ?? "miles"}
              </span>
            </div>
          )}
          {find.taxesUsd != null && (
            <div className="flex flex-col items-start leading-none">
              <span className={cn("font-mono font-medium text-fg-muted tnum", lg ? "text-xl" : "text-base")}>
                +{fmtUsd(find.taxesUsd)}
              </span>
              <span className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">taxes</span>
            </div>
          )}
          {find.cpp != null && <CppBadge cpp={find.cpp} size={lg ? "lg" : "md"} />}
        </div>
      )}
    </div>
  );
}

export function CppBadge({ cpp, size = "md" }: { cpp: number; size?: "sm" | "md" | "lg" }) {
  const tone = cppTone(cpp);
  return (
    <Badge
      variant={tone}
      size={size}
      className="font-mono tnum"
      title={`${fmtCpp(cpp)} per point versus the cash fare`}
    >
      {fmtCpp(cpp)}
      <span className="font-sans font-normal opacity-80">/pt</span>
    </Badge>
  );
}

// ─── Tags ─────────────────────────────────────────────────────

export function TagChips({ tags, active, className, size = "sm" }: { tags: string[]; active?: string; className?: string; size?: "sm" | "md" }) {
  if (!tags.length) return null;
  return (
    <ul className={cn("flex flex-wrap items-center gap-1.5", className)} aria-label="Tags">
      {tags.map((t) => (
        <li key={t}>
          <TagChip tag={t} active={active === t} size={size} />
        </li>
      ))}
    </ul>
  );
}

export function TagChip({
  tag,
  active,
  size = "sm",
  count,
  href,
  ...props
}: { tag: string; active?: boolean; size?: "sm" | "md"; count?: number; href?: string } & Omit<ComponentProps<typeof Link>, "href">) {
  return (
    <Link
      href={href ?? `/finds?tag=${encodeURIComponent(tag)}`}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-mono transition-colors",
        size === "sm" ? "h-6 px-2 text-[11px]" : "h-8 px-3 text-xs",
        active
          ? "border-signal/40 bg-signal-soft text-signal"
          : "border-panel-border bg-bg-elev-1 text-fg-muted hover:border-panel-border-strong hover:text-fg",
        focusRing,
      )}
      {...props}
    >
      <span className="opacity-60">#</span>
      {tag}
      {count != null && <span className="ml-0.5 text-fg-subtle tnum">{fmtInt(count)}</span>}
    </Link>
  );
}

// ─── Like button ──────────────────────────────────────────────

export function LikeButton({ find, size = "sm", className }: { find: Pick<Find, "id" | "likes" | "likedByMe">; size?: "sm" | "md"; className?: string }) {
  const { signedIn } = useViewer();
  const router = useRouter();
  const like = useLike(find.id);
  // Local mirror so cards rendered outside a query (e.g. server lists) still feel instant.
  const [local, setLocal] = useState({ liked: Boolean(find.likedByMe), likes: find.likes });
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    setLocal({ liked: Boolean(find.likedByMe), likes: find.likes });
  }, [find.likedByMe, find.likes]);

  const onClick = () => {
    if (!signedIn) {
      toast.info("Sign in to like finds", { description: "Likes help the best redemptions float up." });
      router.push(loginHref());
      return;
    }
    const next = { liked: !local.liked, likes: Math.max(0, local.likes + (local.liked ? -1 : 1)) };
    setLocal(next);
    if (next.liked) {
      setPulse(true);
      setTimeout(() => setPulse(false), 500);
    }
    like.mutate(undefined, {
      onError: () => setLocal({ liked: Boolean(find.likedByMe), likes: find.likes }),
      onSuccess: (d) => setLocal({ liked: d.liked, likes: d.likes }),
    });
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={local.liked}
      aria-label={local.liked ? `Unlike (${local.likes} likes)` : `Like (${local.likes} likes)`}
      className={cn(
        "group/like inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
        size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-sm",
        local.liked ? "text-rose" : "text-fg-muted hover:bg-fg/6 hover:text-fg",
        focusRing,
        className,
      )}
    >
      <span className="relative grid place-items-center">
        {pulse && <span className="absolute inset-0 rounded-full bg-rose/50 motion-safe:animate-radar" aria-hidden="true" />}
        <Heart
          className={cn(
            "relative transition-transform duration-200",
            size === "sm" ? "size-4" : "size-5",
            local.liked ? "fill-current scale-110" : "group-hover/like:scale-110",
          )}
          aria-hidden="true"
        />
      </span>
      <span className="font-mono tnum">{fmtInt(local.likes)}</span>
    </button>
  );
}

// ─── Share (copy link) ────────────────────────────────────────

export function CopyLinkButton({ path, size = "sm", label = "Share", className }: { path: string; size?: "sm" | "md"; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = typeof window !== "undefined" ? new URL(path, window.location.origin).toString() : path;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Couldn't copy the link", { description: url });
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg",
        size === "sm" ? "h-9 px-3 text-[13px] [&_svg]:size-4" : "h-11 px-4 text-sm [&_svg]:size-5",
        focusRing,
        className,
      )}
    >
      {copied ? <Check className="text-aurora" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
      <span>{copied ? "Copied" : label}</span>
    </button>
  );
}

// ─── The card ─────────────────────────────────────────────────

export interface FindCardProps {
  find: Find;
  /** Highlight this tag chip (the feed's active filter). */
  activeTag?: string;
  /** Skip the entrance animation (long lists). */
  still?: boolean;
  className?: string;
}

export function FindCard({ find, activeTag, still, className }: FindCardProps) {
  const href = `/finds/${find.id}`;
  const preview = plainText(find.body, 260);
  const searchHref = routeSearchHref(find);

  return (
    <article
      className={cn(
        "panel grain overflow-hidden rounded-[var(--radius-lg)] transition-[border-color,box-shadow] duration-200 hover:border-panel-border-strong",
        !still && "animate-rise",
        className,
      )}
      aria-labelledby={`find-${find.id}-title`}
    >
      <div className="px-5 pt-5 sm:px-6">
        <AuthorRow author={find.author} createdAt={find.createdAt} />
        <h2 id={`find-${find.id}-title`} className="mt-3.5 font-display text-[22px] leading-[1.15] tracking-tight text-fg sm:text-2xl balance-text">
          <Link href={href} className={cn("rounded-[4px] decoration-signal/60 underline-offset-4 hover:underline", focusRing)}>
            {find.title}
          </Link>
        </h2>
      </div>

      <RedemptionStrip find={find} className="mx-5 mt-4 sm:mx-6" />

      <div className="px-5 pt-4 sm:px-6">
        <p className="line-clamp-3 text-[15px] leading-relaxed text-fg-muted pretty-text">
          {preview}{" "}
          <Link href={href} className={cn("whitespace-nowrap font-medium text-sky hover:underline underline-offset-4", focusRing)}>
            Read more
          </Link>
        </p>
        <TagChips tags={find.tags} active={activeTag} className="mt-3.5" />
      </div>

      <footer className="mt-4 flex items-center gap-0.5 border-t border-panel-border px-3 py-2 sm:px-4">
        <LikeButton find={find} />
        <Link
          href={`${href}#comments`}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-fg-muted transition-colors hover:bg-fg/6 hover:text-fg",
            focusRing,
          )}
          aria-label={`${find.comments} comments`}
        >
          <MessageCircle className="size-4" aria-hidden="true" />
          <span className="font-mono tnum">{fmtInt(find.comments)}</span>
        </Link>
        <CopyLinkButton path={href} />
        {searchHref && (
          <Link
            href={searchHref}
            className={cn(
              "ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-aurora transition-colors hover:bg-aurora-soft",
              focusRing,
            )}
          >
            <Search className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Search this route</span>
            <span className="sm:hidden">Search</span>
          </Link>
        )}
      </footer>
    </article>
  );
}

/** Compact row used in "More from @handle" and the profile rail. */
export function FindRow({ find, className }: { find: Find; className?: string }) {
  const program = find.programId ? getProgram(find.programId) : undefined;
  return (
    <Link
      href={`/finds/${find.id}`}
      className={cn(
        "group flex items-start gap-3 rounded-[var(--radius)] border border-transparent px-3 py-2.5 transition-colors hover:border-panel-border hover:bg-fg/4",
        focusRing,
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-medium leading-snug text-fg group-hover:underline underline-offset-4 decoration-signal/60">
          {find.title}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-subtle">
          {hasRoute(find) && (
            <span className="font-mono tracking-wider text-fg-muted">
              {find.origin}→{find.destination}
            </span>
          )}
          {find.cabin && <CabinBadge cabin={find.cabin} short size="sm" />}
          {program && <span>{program.shortName}</span>}
          {find.miles != null && <span className="font-mono tnum">{fmtInt(find.miles)}</span>}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1 pt-0.5 font-mono text-xs text-fg-subtle tnum">
        <Heart className="size-3" aria-hidden="true" />
        {fmtInt(find.likes)}
      </span>
    </Link>
  );
}
