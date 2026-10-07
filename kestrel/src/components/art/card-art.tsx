"use client";

/**
 * <CardArt> — procedural credit-card artwork at the ISO 85.6 × 54 ratio: gradient face from the
 * card's `art` colours, a seeded pattern, chip, contactless glyph, issuer / name / network set in
 * the right faces, a holographic sheen that follows the pointer and a 3D tilt on hover (motion).
 */

import { useRef, type PointerEvent as ReactPointerEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring } from "motion/react";
import { cn, hash32 } from "@/lib/utils";
import { inkFor, withAlphaHex } from "./color";

export interface CardArtProps {
  name: string;
  issuer: string;
  from: string;
  to: string;
  accent: string;
  network?: "visa" | "mastercard" | "amex" | string;
  /** Masked number suffix, e.g. "4821" */
  last4?: string;
  /** Cardholder line (defaults to nothing) */
  holder?: string;
  /** Enable pointer tilt (default true; disabled under reduced motion) */
  tilt?: boolean;
  className?: string;
}

const NETWORK_LABEL: Record<string, string> = { visa: "VISA", mastercard: "mastercard", amex: "AMEX" };

function Pattern({ seed, color }: { seed: number; color: string }) {
  const kind = seed % 4;
  if (kind === 0) {
    return (
      <g fill="none" stroke={color} strokeWidth={0.6}>
        {Array.from({ length: 9 }, (_, i) => (
          <circle key={i} cx={300} cy={-20} r={40 + i * 26} />
        ))}
      </g>
    );
  }
  if (kind === 1) {
    return (
      <g stroke={color} strokeWidth={0.7}>
        {Array.from({ length: 14 }, (_, i) => (
          <line key={i} x1={-40 + i * 36} y1={220} x2={120 + i * 36} y2={-20} />
        ))}
      </g>
    );
  }
  if (kind === 2) {
    return (
      <g fill={color}>
        {Array.from({ length: 10 }, (_, r) =>
          Array.from({ length: 18 }, (_, c) => <circle key={`${r}-${c}`} cx={20 + c * 20} cy={20 + r * 20} r={0.9} opacity={((r + c) % 3) / 3 + 0.2} />),
        )}
      </g>
    );
  }
  return (
    <g fill="none" stroke={color} strokeWidth={0.7}>
      {Array.from({ length: 6 }, (_, i) => (
        <path key={i} d={`M-10 ${60 + i * 28} C 90 ${20 + i * 28}, 230 ${110 + i * 28}, 340 ${50 + i * 28}`} />
      ))}
    </g>
  );
}

export function CardArt({ name, issuer, from, to, accent, network, last4, holder, tilt = true, className }: CardArtProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const seed = hash32(name);
  const { ink, muted } = inkFor(from, to);

  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const sx = useMotionValue(50);
  const sy = useMotionValue(30);
  const spring = { stiffness: 220, damping: 22, mass: 0.6 };
  const rotateX = useSpring(rx, spring);
  const rotateY = useSpring(ry, spring);
  const sheenX = useSpring(sx, spring);
  const sheenY = useSpring(sy, spring);
  const sheen = useMotionTemplate`radial-gradient(60% 50% at ${sheenX}% ${sheenY}%, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 45%, transparent 70%)`;
  const holo = useMotionTemplate`linear-gradient(${sheenX}deg, transparent 35%, rgba(255,255,255,0.16) 48%, rgba(255,255,255,0.02) 52%, transparent 65%)`;

  const enabled = tilt && !reduced;

  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * 18);
    rx.set(-(py - 0.5) * 14);
    sx.set(px * 100);
    sy.set(py * 100);
  };
  const onLeave = () => {
    rx.set(0);
    ry.set(0);
    sx.set(50);
    sy.set(30);
  };

  return (
    <div className={cn("relative w-full max-w-[26rem]", className)} style={{ perspective: 1000 }}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative aspect-[856/540] w-full overflow-hidden rounded-2xl shadow-[0_24px_50px_-24px_rgba(0,0,0,0.6)]"
        role="img"
        aria-label={`${issuer} ${name}`}
      >
        <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }} />
        <div className="absolute inset-0" style={{ background: `radial-gradient(70% 90% at 85% 15%, ${withAlphaHex(accent, 0.55)}, transparent 60%)` }} />
        <svg viewBox="0 0 340 215" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
          <Pattern seed={seed} color={withAlphaHex(accent, 0.35)} />
        </svg>
        <motion.div className="absolute inset-0" style={{ background: holo, mixBlendMode: "screen" }} aria-hidden />
        <motion.div className="absolute inset-0" style={{ background: sheen }} aria-hidden />

        <div className="absolute inset-0 flex flex-col justify-between p-[6%]" style={{ color: ink }}>
          <div className="flex items-start justify-between">
            <div className="font-mono text-[0.62rem] font-semibold uppercase tracking-[0.3em] sm:text-[0.7rem]" style={{ color: muted }}>
              {issuer}
            </div>
            <svg viewBox="0 0 24 24" className="h-[9%] w-auto min-h-5" aria-hidden fill="none" stroke={muted} strokeWidth={1.8} strokeLinecap="round">
              <path d="M6 8.5a6 6 0 0 1 0 7" />
              <path d="M9.5 6a9.5 9.5 0 0 1 0 12" />
              <path d="M13 3.5a13 13 0 0 1 0 17" />
              <path d="M16.5 1a17 17 0 0 1 0 22" opacity={0.6} />
            </svg>
          </div>

          <div className="flex items-end gap-[6%]">
            <svg viewBox="0 0 40 30" className="h-auto w-[13%]" aria-hidden>
              <defs>
                <linearGradient id={`chip-${seed}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#f3dc9a" />
                  <stop offset="100%" stopColor="#b9892f" />
                </linearGradient>
              </defs>
              <rect x={0.5} y={0.5} width={39} height={29} rx={5} fill={`url(#chip-${seed})`} stroke="rgba(0,0,0,0.25)" />
              <g fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={1}>
                <path d="M0.5 10 H12 V20 H0.5 M39.5 10 H28 V20 H39.5 M12 10 V0.5 M12 20 V29.5 M28 10 V0.5 M28 20 V29.5 M12 15 H28" />
              </g>
            </svg>
            {last4 && (
              <div className="font-mono text-[0.85rem] tracking-[0.25em] sm:text-base" style={{ color: muted }}>
                •••• {last4}
              </div>
            )}
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate font-display text-[1.05rem] leading-tight tracking-tight sm:text-[1.3rem]" style={{ fontVariationSettings: '"SOFT" 60, "WONK" 1' }}>
                {name}
              </div>
              {holder && (
                <div className="mt-0.5 truncate font-mono text-[0.6rem] uppercase tracking-[0.2em] sm:text-[0.68rem]" style={{ color: muted }}>
                  {holder}
                </div>
              )}
            </div>
            {network && (
              <div className="shrink-0 font-display text-[0.95rem] font-semibold italic leading-none tracking-tight sm:text-[1.15rem]" style={{ color: ink }}>
                {NETWORK_LABEL[network] ?? network}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
