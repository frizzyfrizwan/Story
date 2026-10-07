"use client";

import { Children, useState, type ComponentProps, type ReactNode } from "react";
import { cn, hash32 } from "@/lib/utils";

const SIZE = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-base",
  xl: "size-20 text-2xl",
} as const;

export type AvatarSize = keyof typeof SIZE;

/** Two-hue gradient derived deterministically from a seed. Stable across sessions. */
export function avatarGradient(seed: string): { background: string; color: string } {
  const h = hash32(seed);
  const hue1 = h % 360;
  const hue2 = (hue1 + 42 + ((h >>> 9) % 70)) % 360;
  return {
    background: `linear-gradient(135deg, oklch(0.68 0.17 ${hue1}) 0%, oklch(0.5 0.2 ${hue2}) 100%)`,
    color: `oklch(0.985 0.012 ${hue1})`,
  };
}

export function initialsOf(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export interface AvatarProps extends Omit<ComponentProps<"span">, "children"> {
  /** Deterministic seed for the gradient — a user id or handle. Falls back to `name`. */
  seed?: string;
  name?: string | null;
  src?: string | null;
  size?: AvatarSize;
  /** Squircle instead of a circle. */
  square?: boolean;
  /** Small status ring/dot. */
  status?: "online" | "pro";
}

/** Procedural avatar: initials over a seeded gradient, or an image when `src` loads. */
export function Avatar({ seed, name, src, size = "md", square, status, className, style, ...props }: AvatarProps) {
  const [broken, setBroken] = useState(false);
  const palette = avatarGradient(seed ?? name ?? "kestrel");
  const showImage = Boolean(src) && !broken;

  return (
    <span
      role="img"
      aria-label={name ?? "Avatar"}
      className={cn(
        "relative inline-grid shrink-0 select-none place-items-center overflow-visible font-semibold tracking-wide",
        SIZE[size],
        status === "pro" && "ring-2 ring-gold ring-offset-2 ring-offset-bg",
        className,
      )}
      style={style}
      {...props}
    >
      <span
        className={cn("grid size-full place-items-center overflow-hidden", square ? "rounded-[28%]" : "rounded-full")}
        style={showImage ? undefined : palette}
      >
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from an auth provider; not a static asset
          <img
            src={src as string}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        ) : (
          <span aria-hidden="true">{initialsOf(name)}</span>
        )}
      </span>
      {status === "online" && (
        <span
          aria-hidden="true"
          className="absolute bottom-0 right-0 size-[28%] min-h-2 min-w-2 rounded-full bg-aurora ring-2 ring-bg"
        />
      )}
    </span>
  );
}

export interface AvatarGroupProps extends ComponentProps<"span"> {
  max?: number;
  size?: AvatarSize;
}

/** Overlapping stack of avatars with a "+N" tail. */
export function AvatarGroup({ children, max = 4, size = "sm", className, ...props }: AvatarGroupProps) {
  const items = Children.toArray(children) as ReactNode[];
  const visible = items.slice(0, max);
  const rest = items.length - visible.length;
  return (
    <span className={cn("inline-flex items-center -space-x-2", className)} {...props}>
      {visible.map((child, i) => (
        <span key={i} className="rounded-full ring-2 ring-bg">
          {child}
        </span>
      ))}
      {rest > 0 && (
        <span
          className={cn(
            "inline-grid place-items-center rounded-full bg-bg-elev-3 font-mono font-medium text-fg-muted ring-2 ring-bg",
            SIZE[size],
          )}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
