/**
 * Ambient backdrops. All CSS/SVG, GPU-friendly (transforms and opacity only), token colours,
 * and still under prefers-reduced-motion. Drop one inside any `relative` container.
 *
 * <AuroraBackdrop/> animated gradient blobs · <RadarRings/> pulsing rings (+ optional sweep)
 * <Contrails/> faint drifting diagonal lines · <Starfield density/> seeded twinkling stars
 */

import type { CSSProperties } from "react";
import { cn, hash32, seededRandom } from "@/lib/utils";

const CSS = `
@keyframes ka-a{0%{transform:translate3d(0,0,0) scale(1)}50%{transform:translate3d(9%,-7%,0) scale(1.18)}100%{transform:translate3d(-5%,6%,0) scale(.94)}}
@keyframes ka-b{0%{transform:translate3d(0,0,0) scale(1.05)}50%{transform:translate3d(-10%,8%,0) scale(.9)}100%{transform:translate3d(6%,-5%,0) scale(1.12)}}
@keyframes ka-c{0%{transform:translate3d(0,0,0) scale(.95)}50%{transform:translate3d(7%,9%,0) scale(1.1)}100%{transform:translate3d(-8%,-4%,0) scale(1)}}
.ka-blob{position:absolute;border-radius:9999px;will-change:transform;animation-timing-function:ease-in-out;animation-iteration-count:infinite;animation-direction:alternate}
@keyframes kr-sweep{to{transform:rotate(360deg)}}
@keyframes kc-drift{to{background-position:var(--kc-shift) 0}}
@keyframes kc-streak{0%{transform:translateX(-40%) rotate(var(--kc-angle));opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(140%) rotate(var(--kc-angle));opacity:0}}
@media (prefers-reduced-motion:reduce){.ka-blob,.kr-sweep,.kc-lines,.kc-streak{animation:none!important}}
`;

function PatternStyles() {
  return (
    <style href="kestrel-patterns" precedence="default">
      {CSS}
    </style>
  );
}

// ─── Aurora ────────────────────────────────────────────────────

export interface AuroraBackdropProps {
  /** 0–2, scales the colour alpha (default 1) */
  intensity?: number;
  animated?: boolean;
  className?: string;
}

export function AuroraBackdrop({ intensity = 1, animated = true, className }: AuroraBackdropProps) {
  const a = Math.round(Math.max(0, Math.min(2, intensity)) * 30);
  const blobs = [
    { tok: "--aurora", kf: "ka-a", dur: 26, w: "70%", left: "-15%", top: "-25%" },
    { tok: "--violet", kf: "ka-b", dur: 32, w: "60%", left: "55%", top: "-10%" },
    { tok: "--signal", kf: "ka-c", dur: 29, w: "55%", left: "25%", top: "45%" },
  ];
  return (
    <>
      <PatternStyles />
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
        {blobs.map((b) => (
          <div
            key={b.tok}
            className="ka-blob aspect-square"
            style={{
              width: b.w,
              left: b.left,
              top: b.top,
              background: `radial-gradient(closest-side, color-mix(in srgb, var(${b.tok}) ${a}%, transparent), transparent)`,
              animationName: animated ? b.kf : "none",
              animationDuration: `${b.dur}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

// ─── Radar ─────────────────────────────────────────────────────

export interface RadarRingsProps {
  size?: number;
  /** Number of travelling rings (default 3) */
  rings?: number;
  /** Token name: aurora | signal | violet | sky | rose | gold */
  tone?: "aurora" | "signal" | "violet" | "sky" | "rose" | "gold";
  /** Seconds per pulse (default 2.8, matching animate-radar) */
  period?: number;
  /** Rotating sweep wedge */
  sweep?: boolean;
  className?: string;
}

export function RadarRings({
  size = 240,
  rings = 3,
  tone = "aurora",
  period = 2.8,
  sweep = true,
  className,
}: RadarRingsProps) {
  const color = `var(--${tone})`;
  return (
    <>
      <PatternStyles />
      <div
        aria-hidden
        className={cn("pointer-events-none relative shrink-0", className)}
        style={{ width: size, height: size }}
      >
        {[1, 0.66, 0.33].map((s) => (
          <div
            key={s}
            className="absolute rounded-full border"
            style={{
              inset: `${((1 - s) / 2) * 100}%`,
              borderColor: `color-mix(in srgb, ${color} 22%, transparent)`,
            }}
          />
        ))}
        {sweep && (
          <div
            className="kr-sweep absolute inset-0 rounded-full"
            style={{
              background: `conic-gradient(from 0deg, transparent 72%, color-mix(in srgb, ${color} 28%, transparent) 100%)`,
              animation: `kr-sweep ${period * 1.6}s linear infinite`,
            }}
          />
        )}
        {Array.from({ length: rings }, (_, i) => (
          <div
            key={i}
            className="absolute inset-[30%] animate-radar rounded-full border-2"
            style={{ borderColor: color, animationDuration: `${period}s`, animationDelay: `${(period / rings) * i}s` }}
          />
        ))}
        <div
          className="absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 12px ${color}` }}
        />
      </div>
    </>
  );
}

// ─── Contrails ─────────────────────────────────────────────────

export interface ContrailsProps {
  /** Line angle in degrees (default -24) */
  angle?: number;
  /** Distance between lines in px (default 160) */
  spacing?: number;
  /** Seconds for one drift cycle (default 40) */
  speed?: number;
  /** Line alpha 0–1 (default 0.08) */
  opacity?: number;
  /** Bright streaks that cross the field (default 3) */
  streaks?: number;
  className?: string;
}

export function Contrails({
  angle = -24,
  spacing = 160,
  speed = 40,
  opacity = 0.08,
  streaks = 3,
  className,
}: ContrailsProps) {
  const pct = Math.round(opacity * 100);
  const lineStyle = (sp: number, dur: number, alpha: number): CSSProperties =>
    ({
      backgroundImage: `repeating-linear-gradient(${angle + 90}deg, transparent 0 ${sp - 1}px, color-mix(in srgb, var(--fg) ${alpha}%, transparent) ${sp - 1}px ${sp}px)`,
      animation: `kc-drift ${dur}s linear infinite`,
      "--kc-shift": `${sp}px`,
    }) as CSSProperties;
  return (
    <>
      <PatternStyles />
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
        style={{
          maskImage: "radial-gradient(ellipse at center, #000 35%, transparent 80%)",
          WebkitMaskImage: "radial-gradient(ellipse at center, #000 35%, transparent 80%)",
        }}
      >
        <div className="kc-lines absolute inset-[-20%]" style={lineStyle(spacing, speed, pct)} />
        <div
          className="kc-lines absolute inset-[-20%]"
          style={lineStyle(spacing * 0.6, speed * 1.7, Math.max(2, pct / 2))}
        />
        {Array.from({ length: streaks }, (_, i) => (
          <div
            key={i}
            className="kc-streak absolute h-px w-[55%]"
            style={
              {
                top: `${15 + ((i * 37) % 70)}%`,
                left: 0,
                "--kc-angle": `${angle}deg`,
                background:
                  "linear-gradient(90deg, transparent, color-mix(in srgb, var(--fg) 35%, transparent) 50%, transparent)",
                animation: `kc-streak ${speed * (0.9 + i * 0.25)}s linear ${i * (speed / 3)}s infinite`,
                transformOrigin: "left center",
              } as CSSProperties
            }
          />
        ))}
      </div>
    </>
  );
}

// ─── Starfield ─────────────────────────────────────────────────

export interface StarfieldProps {
  /** 0.25–3; 1 ≈ 140 stars per 1000×600 (default 1) */
  density?: number;
  seed?: string;
  twinkle?: boolean;
  className?: string;
}

export function Starfield({ density = 1, seed = "kestrel", twinkle = true, className }: StarfieldProps) {
  const rng = seededRandom(hash32(seed));
  const n = Math.round(140 * Math.max(0.25, Math.min(3, density)));
  const stars = Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rng() * 1000,
    y: rng() * 600,
    r: 0.4 + rng() * 1.2,
    o: 0.25 + rng() * 0.7,
    tw: rng() < 0.3,
    dur: 2 + rng() * 3,
    delay: rng() * 4,
  }));
  const bright = Array.from({ length: 3 }, (_, i) => ({ id: i, x: rng() * 1000, y: rng() * 500, s: 5 + rng() * 5 }));
  return (
    <svg
      aria-hidden
      viewBox="0 0 1000 600"
      preserveAspectRatio="xMidYMid slice"
      className={cn("pointer-events-none absolute inset-0 h-full w-full text-fg", className)}
      fill="currentColor"
    >
      {stars.map((s) => (
        <circle
          key={s.id}
          cx={s.x}
          cy={s.y}
          r={s.r}
          opacity={s.o}
          className={twinkle && s.tw ? "animate-pulse-soft" : undefined}
          style={twinkle && s.tw ? { animationDuration: `${s.dur}s`, animationDelay: `${s.delay}s` } : undefined}
        />
      ))}
      {bright.map((b) => (
        <g key={b.id} opacity={0.7}>
          <circle cx={b.x} cy={b.y} r={1.4} />
          <line x1={b.x - b.s} y1={b.y} x2={b.x + b.s} y2={b.y} stroke="currentColor" strokeWidth={0.5} opacity={0.6} />
          <line x1={b.x} y1={b.y - b.s} x2={b.x} y2={b.y + b.s} stroke="currentColor" strokeWidth={0.5} opacity={0.6} />
        </g>
      ))}
    </svg>
  );
}
