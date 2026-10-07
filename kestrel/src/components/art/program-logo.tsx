/**
 * <ProgramLogo> — procedural monogram roundel for a loyalty program: 2–3 initials inside a ring in
 * the program colour, with concentric detail chosen by hash so every program feels distinct.
 * <AirlineTail> — stylised tailfin glyph in the carrier colour with the IATA code.
 * Pure SVG, no hooks — usable from server components.
 */

import { cn, hash32 } from "@/lib/utils";
import { shade, tint } from "./color";

const STOP = new Set(["of", "the", "and", "&", "club", "plan", "rewards", "miles", "mileage", "program", "programme", "privilege", "frequent", "flyer", "go", "more", "bank", "points"]);

/** "World of Hyatt" → "WH", "Aeroplan" → "AE", "British Airways Club" → "BA" */
export function monogram(name: string): string {
  const words = name
    .replace(/[^A-Za-z0-9 &-]/g, " ")
    .split(/[\s-]+/)
    .filter(Boolean);
  const kept = words.filter((w) => !STOP.has(w.toLowerCase()));
  const src = kept.length ? kept : words;
  if (src.length === 0) return "??";
  if (src.length === 1) {
    const w = src[0];
    // CamelCase like "MileagePlus" or "KrisFlyer" → "MP", "KF"
    const caps = w.match(/[A-Z]/g);
    if (caps && caps.length >= 2) return caps.slice(0, 3).join("");
    return w.slice(0, 2).toUpperCase();
  }
  return src
    .slice(0, 3)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export interface ProgramLogoProps {
  id: string;
  name: string;
  /** Brand colour (hex). Defaults to the signal token. */
  color?: string;
  size?: number;
  /** Override the derived letters */
  letters?: string;
  className?: string;
}

export function ProgramLogo({ id, name, color, size = 40, letters, className }: ProgramLogoProps) {
  const h = hash32(id);
  const style = h % 5;
  const ticks = 12 + (h >> 4) % 12;
  const accentAngle = ((h >> 8) % 360) * (Math.PI / 180);
  const text = (letters ?? monogram(name)).slice(0, 3);
  const ring = color ?? "var(--signal)";
  const fontSize = text.length >= 3 ? 19 : 24;
  const dash = style === 1 ? `${4 + (h % 4)} ${2 + ((h >> 2) % 3)}` : undefined;

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role="img"
      aria-label={`${name} logo`}
    >
      <circle cx={32} cy={32} r={31} fill="var(--bg-elev-2)" />
      <circle cx={32} cy={32} r={29.5} fill="none" stroke={ring} strokeWidth={style === 2 ? 1.5 : 2.5} strokeDasharray={dash} />
      {style === 2 && <circle cx={32} cy={32} r={25.5} fill="none" stroke={ring} strokeWidth={1} opacity={0.7} />}
      {style === 3 &&
        Array.from({ length: ticks }, (_, i) => (
          <line
            key={i}
            x1={32}
            y1={4.5}
            x2={32}
            y2={i % 3 === 0 ? 9 : 7}
            stroke={ring}
            strokeWidth={1.2}
            opacity={0.8}
            transform={`rotate(${(360 / ticks) * i} 32 32)`}
          />
        ))}
      {style === 4 &&
        Array.from({ length: 24 }, (_, i) => (
          <circle key={i} cx={32} cy={6} r={1} fill={ring} opacity={0.75} transform={`rotate(${15 * i} 32 32)`} />
        ))}
      <circle cx={32 + Math.cos(accentAngle) * 29.5} cy={32 + Math.sin(accentAngle) * 29.5} r={2.6} fill={ring} stroke="var(--bg-elev-2)" strokeWidth={1.2} />
      <text
        x={32}
        y={32}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={fontSize}
        fontWeight={700}
        fill={ring}
        style={{ fontFamily: "var(--font-mono)", letterSpacing: text.length >= 3 ? "-0.02em" : "0.02em" }}
      >
        {text}
      </text>
    </svg>
  );
}

export interface AirlineTailProps {
  /** IATA code, e.g. "SQ" */
  code: string;
  /** Carrier colour (hex). Defaults to the signal token. */
  color?: string;
  size?: number;
  /** Render the code beside the fin (default true) */
  showCode?: boolean;
  className?: string;
}

export function AirlineTail({ code, color, size = 32, showCode = true, className }: AirlineTailProps) {
  const h = hash32(code);
  const fin = color ?? "var(--signal)";
  const isHex = !!color && color.startsWith("#");
  const stripe = isHex ? (h % 2 ? tint(color, 0.45) : shade(color, 0.4)) : "var(--bg-elev-1)";
  const variant = (h >> 3) % 3;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <svg viewBox="0 0 48 48" width={size} height={size} role="img" aria-label={`${code} tail`} className="shrink-0">
        <rect x={2} y={37} width={44} height={7} rx={3.5} fill="var(--fg-faint)" opacity={0.7} />
        <path d="M10 38 L22 8 Q24 4 28 4 L41 4 L30 38 Z" fill={fin} />
        {variant === 0 && <path d="M27 38 L36 11 L40 11 L31 38 Z" fill={stripe} opacity={0.9} />}
        {variant === 1 && <path d="M22 8 Q24 4 28 4 L41 4 L38 12 L19 12 Z" fill={stripe} opacity={0.9} />}
        {variant === 2 && <circle cx={30} cy={20} r={5} fill={stripe} opacity={0.9} />}
      </svg>
      {showCode && <span className="font-mono text-xs font-semibold tracking-wider text-fg">{code.toUpperCase()}</span>}
    </span>
  );
}
