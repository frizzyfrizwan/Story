/**
 * <CityPostcard> — procedural SVG artwork for a city or hotel: gradient sky, seeded stars and
 * sun/moon, layered silhouettes per motif, film grain, and the name set in the display face.
 * Deterministic for a given name + motif, so the same card always draws the same scene.
 * No hooks, no images — safe in server and client components.
 */

import type { ReactNode } from "react";
import { cn, hash32, seededRandom } from "@/lib/utils";
import { luminance, shade, tint, withAlphaHex } from "./color";

export type PostcardMotif = "skyline" | "coast" | "mountain" | "desert" | "island" | "forest";

export interface CityPostcardProps {
  name: string;
  motif: PostcardMotif;
  /** Sky gradient top */
  from: string;
  /** Sky gradient bottom */
  to: string;
  size?: "sm" | "md" | "lg";
  /** Small caps line under the name (defaults to the motif) */
  subtitle?: string;
  showName?: boolean;
  grain?: boolean;
  className?: string;
  /** Extra content layered over the art (badges etc.) */
  children?: ReactNode;
}

const W = 320;
const H = 200;
const WARM = "#ffd49a";
const SNOW = "#ffffff";

type Rng = () => number;
const between = (rng: Rng, a: number, b: number) => a + rng() * (b - a);

function polyline(points: [number, number][]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
}

/** Smooth closed hill shape from control points along the top, filled to the bottom. */
function hillPath(points: [number, number][]): string {
  let d = `M-10 ${H + 10} L${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx} ${y0} ${cx} ${y1} ${x1} ${y1}`;
  }
  return `${d} L${W + 10} ${H + 10} Z`;
}

function ridge(rng: Rng, base: number, amp: number, step: [number, number]): [number, number][] {
  const pts: [number, number][] = [];
  let x = -10;
  while (x < W + 20) {
    pts.push([x, base + between(rng, -amp, amp)]);
    x += between(rng, step[0], step[1]);
  }
  return pts;
}

// ─── Motif layers ──────────────────────────────────────────────

function Skyline({ rng, c }: { rng: Rng; c: string[] }) {
  const layers = [
    { fill: c[0], op: 0.55, h: [26, 70], w: [10, 30], windows: 0 },
    { fill: c[1], op: 0.85, h: [40, 104], w: [12, 32], windows: 0.12 },
    { fill: c[2], op: 1, h: [48, 136], w: [14, 36], windows: 0.3 },
  ];
  return (
    <g>
      {layers.map((L, li) => {
        const items: ReactNode[] = [];
        let x = -6;
        let tallest: { x: number; w: number; h: number } | null = null;
        while (x < W + 6) {
          const w = between(rng, L.w[0], L.w[1]);
          const h = between(rng, L.h[0], L.h[1]);
          const y = H - h;
          items.push(<rect key={`b${x}`} x={x} y={y} width={w} height={h + 2} />);
          if (rng() < 0.3) items.push(<rect key={`c${x}`} x={x + w * 0.3} y={y - between(rng, 4, 12)} width={w * 0.4} height={14} />);
          if (!tallest || h > tallest.h) tallest = { x, w, h };
          if (L.windows > 0) {
            for (let wy = y + 6; wy < H - 6; wy += 7) {
              for (let wx = x + 3; wx < x + w - 4; wx += 6) {
                if (rng() < L.windows) items.push(<rect key={`w${wx}-${wy}`} x={wx} y={wy} width={2.4} height={3.2} fill={WARM} opacity={between(rng, 0.5, 0.95)} />);
              }
            }
          }
          x += w + between(rng, 1, 5);
        }
        return (
          <g key={li} fill={L.fill} opacity={L.op}>
            {items}
            {li === 2 && tallest && (
              <g>
                <line x1={tallest.x + tallest.w / 2} y1={H - tallest.h} x2={tallest.x + tallest.w / 2} y2={H - tallest.h - 18} stroke={L.fill} strokeWidth={1.2} />
                <circle cx={tallest.x + tallest.w / 2} cy={H - tallest.h - 19} r={1.6} fill={WARM} />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}

function Waves({ rng, y0, color, rows = 3 }: { rng: Rng; y0: number; color: string; rows?: number }) {
  return (
    <g fill="none" stroke={color} strokeWidth={1.2} strokeLinecap="round">
      {Array.from({ length: rows }, (_, i) => {
        const y = y0 + i * 14 + between(rng, -2, 2);
        const amp = between(rng, 2, 4);
        const len = between(rng, 26, 44);
        let d = `M-10 ${y}`;
        for (let x = -10; x < W + 20; x += len) d += ` q${len / 4} ${-amp} ${len / 2} 0 t${len / 2} 0`;
        return <path key={i} d={d} opacity={0.45 - i * 0.1} />;
      })}
    </g>
  );
}

function Coast({ rng, c, sea }: { rng: Rng; c: string[]; sea: string }) {
  const head = ridge(rng, 128, 10, [18, 30]).map(([x, y]) => [x * 0.55 - 10, y] as [number, number]);
  return (
    <g>
      <rect x={0} y={138} width={W} height={H - 138} fill={sea} />
      <path d={hillPath(head)} fill={c[0]} opacity={0.7} />
      <Waves rng={rng} y0={150} color={tint(sea, 0.35)} />
      <path d={hillPath(ridge(rng, 184, 4, [30, 50]))} fill={c[2]} />
      {Array.from({ length: 5 }, (_, i) => (
        <rect key={i} x={between(rng, 120, 190)} y={142 + i * 8} width={between(rng, 10, 40)} height={1.2} fill={WARM} opacity={0.5 - i * 0.08} />
      ))}
    </g>
  );
}

function Mountain({ rng, c }: { rng: Rng; c: string[] }) {
  const far = ridge(rng, 92, 26, [18, 34]);
  const mid = ridge(rng, 122, 20, [20, 40]);
  const near = ridge(rng, 156, 14, [26, 48]);
  const caps = far.filter((p, i) => i > 0 && i < far.length - 1 && p[1] < far[i - 1][1] && p[1] < far[i + 1][1]);
  return (
    <g>
      <path d={`${polyline(far)} L${W + 10} ${H + 10} L-10 ${H + 10} Z`} fill={c[0]} opacity={0.6} />
      {caps.map(([x, y], i) => (
        <path key={i} d={`M${x - 7} ${y + 7} L${x} ${y} L${x + 7} ${y + 7} Z`} fill={SNOW} opacity={0.55} />
      ))}
      <rect x={0} y={100} width={W} height={40} fill={`url(#mist)`} />
      <path d={`${polyline(mid)} L${W + 10} ${H + 10} L-10 ${H + 10} Z`} fill={c[1]} opacity={0.9} />
      <path d={`${polyline(near)} L${W + 10} ${H + 10} L-10 ${H + 10} Z`} fill={c[2]} />
    </g>
  );
}

function Desert({ rng, c }: { rng: Rng; c: string[] }) {
  return (
    <g>
      {Array.from({ length: 4 }, (_, i) => (
        <line key={i} x1={0} x2={W} y1={112 + i * 3} y2={112 + i * 3} stroke={WARM} strokeWidth={0.6} opacity={0.25 - i * 0.05} />
      ))}
      <path d={hillPath(ridge(rng, 128, 10, [60, 110]))} fill={c[0]} opacity={0.7} />
      <path d={hillPath(ridge(rng, 150, 12, [50, 90]))} fill={c[1]} opacity={0.9} />
      <path d={hillPath(ridge(rng, 172, 10, [60, 120]))} fill={c[2]} />
    </g>
  );
}

function Palm({ x, y, lean, scale, color }: { x: number; y: number; lean: number; scale: number; color: string }) {
  const top: [number, number] = [x + lean * 16 * scale, y - 46 * scale];
  return (
    <g fill="none" stroke={color} strokeLinecap="round">
      <path d={`M${x} ${y} Q${x + lean * 4 * scale} ${y - 24 * scale} ${top[0]} ${top[1]}`} strokeWidth={2.4 * scale} />
      {[-150, -110, -70, -30, 10, 40].map((a, i) => {
        const r = (a * Math.PI) / 180;
        const ex = top[0] + Math.cos(r) * 20 * scale;
        const ey = top[1] + Math.sin(r) * 12 * scale + 8 * scale;
        return <path key={i} d={`M${top[0]} ${top[1]} Q${(top[0] + ex) / 2 + Math.cos(r) * 4} ${top[1] - 10 * scale} ${ex} ${ey}`} strokeWidth={1.8 * scale} />;
      })}
    </g>
  );
}

function Island({ rng, c, sea }: { rng: Rng; c: string[]; sea: string }) {
  const ix = between(rng, 110, 190);
  return (
    <g>
      <rect x={0} y={134} width={W} height={H - 134} fill={sea} />
      <Waves rng={rng} y0={146} color={tint(sea, 0.35)} rows={4} />
      <path d={`M${ix - 70} 150 Q${ix - 30} 128 ${ix} 132 Q${ix + 40} 126 ${ix + 74} 150 Z`} fill={c[1]} />
      <Palm x={ix - 8} y={140} lean={-1} scale={1} color={c[2]} />
      <Palm x={ix + 18} y={142} lean={1} scale={0.75} color={c[2]} />
      <path d={hillPath(ridge(rng, 186, 3, [40, 70]))} fill={c[2]} />
    </g>
  );
}

function Forest({ rng, c }: { rng: Rng; c: string[] }) {
  const layers = [
    { fill: c[0], op: 0.6, h: [26, 56], base: 150 },
    { fill: c[1], op: 0.9, h: [40, 80], base: 176 },
    { fill: c[2], op: 1, h: [50, 100], base: 204 },
  ];
  return (
    <g>
      {layers.map((L, li) => {
        const trees: ReactNode[] = [];
        let x = -8;
        while (x < W + 10) {
          const h = between(rng, L.h[0], L.h[1]);
          const w = h * between(rng, 0.42, 0.55);
          const y = L.base - h;
          const tiers = 3;
          let d = "";
          for (let t = 0; t < tiers; t++) {
            const ty = y + (h * 0.72 * t) / tiers;
            const tw = w * (0.45 + (0.55 * (t + 1)) / tiers);
            const th = h * 0.42;
            d += `M${x} ${ty} L${x - tw / 2} ${ty + th} L${x + tw / 2} ${ty + th} Z `;
          }
          trees.push(<path key={x} d={d} />);
          trees.push(<rect key={`t${x}`} x={x - 1.2} y={L.base - h * 0.3} width={2.4} height={h * 0.3} />);
          x += between(rng, 9, 20);
        }
        return (
          <g key={li}>
            {li > 0 && <rect x={0} y={L.base - 70} width={W} height={60} fill="url(#mist)" opacity={0.8} />}
            <g fill={L.fill} opacity={L.op}>
              {trees}
            </g>
          </g>
        );
      })}
    </g>
  );
}

// ─── Component ─────────────────────────────────────────────────

const SIZE_CLASS = {
  sm: { box: "w-40", name: "text-sm", sub: "text-[8px]", pad: "p-2" },
  md: { box: "w-80", name: "text-xl", sub: "text-[10px]", pad: "p-3" },
  lg: { box: "w-[40rem]", name: "text-3xl", sub: "text-[11px]", pad: "p-5" },
} as const;

export function CityPostcard({ name, motif, from, to, size = "md", subtitle, showName = true, grain = true, className, children }: CityPostcardProps) {
  const seed = hash32(`${name}|${motif}`);
  const rng = seededRandom(seed);
  const uid = `pc${seed.toString(36)}`;
  const night = luminance(from) < 0.3;
  const sil = [shade(to, 0.35), shade(to, 0.58), shade(to, 0.8)];
  const sea = shade(to, 0.45);
  const sunX = between(rng, 70, 250);
  const sunY = motif === "desert" || motif === "coast" ? between(rng, 96, 118) : between(rng, 34, 80);
  const sunR = motif === "desert" ? 24 : between(rng, 12, 20);
  const sunColor = night ? tint(to, 0.75) : tint(from, 0.7);
  const stars = night
    ? Array.from({ length: 48 }, (_, i) => ({ id: i, x: rng() * W, y: rng() * 110, r: between(rng, 0.4, 1.3), o: between(rng, 0.3, 0.95) }))
    : [];
  const ink = tint(to, 0.92);
  const sz = SIZE_CLASS[size];

  return (
    <div
      className={cn("relative aspect-[16/10] max-w-full overflow-hidden rounded-[var(--radius)] bg-bg-elev-2", sz.box, className)}
      role="img"
      aria-label={`${name} — ${motif} artwork`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={from} />
            <stop offset="100%" stopColor={to} />
          </linearGradient>
          <linearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={to} stopOpacity={0} />
            <stop offset="100%" stopColor={to} stopOpacity={0.7} />
          </linearGradient>
          <radialGradient id={`${uid}-glow`}>
            <stop offset="0%" stopColor={sunColor} stopOpacity={0.55} />
            <stop offset="100%" stopColor={sunColor} stopOpacity={0} />
          </radialGradient>
          <linearGradient id={`${uid}-scrim`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={shade(to, 0.85)} stopOpacity={0} />
            <stop offset="100%" stopColor={shade(to, 0.85)} stopOpacity={0.75} />
          </linearGradient>
          <radialGradient id={`${uid}-vig`} cx="50%" cy="45%" r="70%">
            <stop offset="60%" stopColor="#000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000" stopOpacity={0.35} />
          </radialGradient>
          {grain && (
            <filter id={`${uid}-grain`}>
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
              <feColorMatrix type="saturate" values="0" />
            </filter>
          )}
        </defs>

        <rect width={W} height={H} fill={`url(#${uid}-sky)`} />
        {stars.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill={SNOW} opacity={s.o} />
        ))}
        <circle cx={sunX} cy={sunY} r={sunR * 3.2} fill={`url(#${uid}-glow)`} />
        <circle cx={sunX} cy={sunY} r={sunR} fill={sunColor} opacity={0.95} />

        {motif === "skyline" && <Skyline rng={rng} c={sil} />}
        {motif === "coast" && <Coast rng={rng} c={sil} sea={sea} />}
        {motif === "mountain" && <Mountain rng={rng} c={sil} />}
        {motif === "desert" && <Desert rng={rng} c={sil} />}
        {motif === "island" && <Island rng={rng} c={sil} sea={sea} />}
        {motif === "forest" && <Forest rng={rng} c={sil} />}

        <rect width={W} height={H} fill={`url(#${uid}-vig)`} />
        {showName && <rect x={0} y={H * 0.55} width={W} height={H * 0.45} fill={`url(#${uid}-scrim)`} />}
        {grain && <rect width={W} height={H} filter={`url(#${uid}-grain)`} opacity={0.07} style={{ mixBlendMode: "overlay" }} />}
      </svg>

      {showName && (
        <div className={cn("absolute inset-x-0 bottom-0 flex flex-col", sz.pad)} style={{ color: ink }}>
          <div className={cn("font-display italic leading-none tracking-tight", sz.name)} style={{ fontVariationSettings: '"SOFT" 80, "WONK" 1' }}>
            {name}
          </div>
          <div className={cn("mt-1 font-mono uppercase tracking-[0.28em]", sz.sub)} style={{ color: withAlphaHex(ink, 0.7) }}>
            {subtitle ?? motif}
          </div>
        </div>
      )}
      {children && <div className="absolute inset-0">{children}</div>}
    </div>
  );
}
