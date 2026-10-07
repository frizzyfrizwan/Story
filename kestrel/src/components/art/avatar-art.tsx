/**
 * <ProceduralAvatar> — geometric "kestrel feather" identicon from a seed: a fanned set of
 * feathers in two token colours over a tinted disc, with a seeded count, spread and spots.
 * Deterministic, theme-aware (token colours via CSS variables), no hooks.
 */

import { cn, hash32, seededRandom } from "@/lib/utils";

const PALETTE = ["var(--signal)", "var(--aurora)", "var(--violet)", "var(--gold)", "var(--sky)", "var(--rose)"];

export interface ProceduralAvatarProps {
  seed: string;
  size?: number;
  /** Square instead of circle */
  square?: boolean;
  /** Accessible name (defaults to "Avatar") */
  alt?: string;
  className?: string;
}

export function ProceduralAvatar({ seed, size = 40, square = false, alt, className }: ProceduralAvatarProps) {
  const h = hash32(seed);
  const rng = seededRandom(h);
  const ai = h % PALETTE.length;
  const bi = (ai + 1 + ((h >> 3) % (PALETTE.length - 1))) % PALETTE.length; // always a different token
  const a = PALETTE[ai];
  const b = PALETTE[bi];
  const count = 5 + (h % 4);
  const spread = 110 + ((h >> 5) % 60);
  const length = 22 + rng() * 8;
  const width = 5 + rng() * 4;
  const cx = 32;
  const cy = 42;
  const uid = `av${h.toString(36)}`;
  const spots = Array.from({ length: 2 + (h % 3) }, (_, i) => ({ id: i, x: 8 + rng() * 48, y: 8 + rng() * 48, r: 1 + rng() * 1.6 }));

  const feathers = Array.from({ length: count }, (_, i) => {
    const angle = -spread / 2 + (spread * i) / (count - 1);
    const l = length * (0.78 + 0.22 * Math.cos(((i - (count - 1) / 2) / count) * Math.PI));
    return { angle, l, fill: i % 2 === 0 ? a : b, op: i % 2 === 0 ? 0.95 : 0.75 };
  });

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", square ? "rounded-[var(--radius-sm)]" : "rounded-full", className)}
      role="img"
      aria-label={alt ?? "Avatar"}
    >
      <defs>
        <clipPath id={`${uid}-clip`}>{square ? <rect width={64} height={64} rx={8} /> : <circle cx={32} cy={32} r={32} />}</clipPath>
      </defs>
      <g clipPath={`url(#${uid}-clip)`}>
        <rect width={64} height={64} fill="var(--bg-elev-3)" />
        <rect width={64} height={64} fill={a} opacity={0.22} />
        {spots.map((s) => (
          <circle key={s.id} cx={s.x} cy={s.y} r={s.r} fill={b} opacity={0.5} />
        ))}
        {feathers.map((f, i) => (
          <g key={i} transform={`translate(${cx} ${cy}) rotate(${f.angle})`}>
            <path d={`M0 0 Q ${width} ${-f.l / 2} 0 ${-f.l} Q ${-width} ${-f.l / 2} 0 0 Z`} fill={f.fill} opacity={f.op} />
            <line x1={0} y1={-2} x2={0} y2={-f.l + 3} stroke="var(--bg-elev-1)" strokeWidth={0.9} opacity={0.7} />
          </g>
        ))}
        <circle cx={cx} cy={cy} r={5} fill="var(--fg)" />
        <circle cx={cx + 1.6} cy={cy - 1.2} r={1.3} fill="var(--bg)" />
      </g>
    </svg>
  );
}
