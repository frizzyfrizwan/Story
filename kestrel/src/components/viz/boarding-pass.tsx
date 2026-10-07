"use client";

/**
 * <BoardingPass> — the result-card frame: carrier-colour header strip, perforated tear line with
 * real notches (CSS mask), and a stub (right on ≥sm, bottom on mobile) carrying a procedural
 * barcode seeded from `id`. Content goes in the `main`, `stub` and `footer` slots.
 *
 * <RouteLine> — origin/destination codes joined by an arc with a plane glyph and stop dots.
 * <Barcode> — the seeded bar pattern on its own.
 */

import { useMemo, type CSSProperties, type ReactNode } from "react";
import { cn, fmtDuration, hash32, seededRandom } from "@/lib/utils";
import { PLANE_PATH } from "./geo";

const CSS = `
.kbp{--kbp-stub:13rem;--kbp-stub-h:6.25rem;--kbp-notch:10px}
@media (min-width:640px){
  .kbp{
    -webkit-mask:radial-gradient(circle var(--kbp-notch) at calc(100% - var(--kbp-stub)) 0,transparent 98%,#000 100%) top/100% 50.5% no-repeat,
                 radial-gradient(circle var(--kbp-notch) at calc(100% - var(--kbp-stub)) 100%,transparent 98%,#000 100%) bottom/100% 50.5% no-repeat;
            mask:radial-gradient(circle var(--kbp-notch) at calc(100% - var(--kbp-stub)) 0,transparent 98%,#000 100%) top/100% 50.5% no-repeat,
                 radial-gradient(circle var(--kbp-notch) at calc(100% - var(--kbp-stub)) 100%,transparent 98%,#000 100%) bottom/100% 50.5% no-repeat;
  }
}
@media (max-width:639.98px){
  .kbp{
    -webkit-mask:radial-gradient(circle var(--kbp-notch) at 0 calc(100% - var(--kbp-stub-h)),transparent 98%,#000 100%) left/50.5% 100% no-repeat,
                 radial-gradient(circle var(--kbp-notch) at 100% calc(100% - var(--kbp-stub-h)),transparent 98%,#000 100%) right/50.5% 100% no-repeat;
            mask:radial-gradient(circle var(--kbp-notch) at 0 calc(100% - var(--kbp-stub-h)),transparent 98%,#000 100%) left/50.5% 100% no-repeat,
                 radial-gradient(circle var(--kbp-notch) at 100% calc(100% - var(--kbp-stub-h)),transparent 98%,#000 100%) right/50.5% 100% no-repeat;
  }
}
`;

function PassStyles() {
  return (
    <style href="kestrel-boarding-pass" precedence="default">
      {CSS}
    </style>
  );
}

// ─── Barcode ───────────────────────────────────────────────────

export interface BarcodeProps {
  /** Any string — the same seed always draws the same bars */
  seed: string;
  /** Number of bars (default 48) */
  bars?: number;
  /** "horizontal": bars stand vertically and read left→right (default). "vertical": stacked. */
  orientation?: "horizontal" | "vertical";
  className?: string;
  /** Optional human-readable text under the bars */
  text?: string;
}

export function Barcode({ seed, bars = 48, orientation = "horizontal", className, text }: BarcodeProps) {
  const rects = useMemo(() => {
    const rng = seededRandom(hash32(seed));
    const out: { pos: number; size: number }[] = [];
    let pos = 0;
    for (let i = 0; i < bars; i++) {
      const size = 1 + Math.floor(rng() * 3);
      out.push({ pos, size });
      pos += size + 1 + Math.floor(rng() * 2);
    }
    return { rects: out, total: pos };
  }, [seed, bars]);

  const horizontal = orientation === "horizontal";
  const vb = horizontal ? `0 0 ${rects.total} 40` : `0 0 40 ${rects.total}`;

  return (
    <div className={cn("flex flex-col items-center gap-1 text-fg", className)} aria-hidden>
      <svg viewBox={vb} preserveAspectRatio="none" className="h-full w-full" fill="currentColor">
        {rects.rects.map((r, i) =>
          horizontal ? (
            <rect key={i} x={r.pos} y={0} width={r.size} height={40} />
          ) : (
            <rect key={i} x={0} y={r.pos} width={40} height={r.size} />
          ),
        )}
      </svg>
      {text && <span className="font-mono text-[10px] tracking-[0.3em] text-fg-subtle">{text}</span>}
    </div>
  );
}

// ─── Boarding pass frame ───────────────────────────────────────

export interface BoardingPassProps {
  /** Stable id — seeds the barcode */
  id: string;
  /** Carrier brand colour for the header strip (any CSS colour). Defaults to the signal token. */
  carrierColor?: string;
  /** Header left content — typically carrier tail + name + flight number */
  carrier?: ReactNode;
  /** Header right content (default "Boarding pass") */
  label?: ReactNode;
  main: ReactNode;
  /** Compact content for the stub: a few mono lines. The stub is a fixed-size region. */
  stub?: ReactNode;
  footer?: ReactNode;
  /** Text printed under the barcode (e.g. a PNR) */
  barcodeText?: string;
  /** Lift on hover */
  interactive?: boolean;
  as?: "article" | "div" | "li";
  className?: string;
}

export function BoardingPass({
  id,
  carrierColor,
  carrier,
  label = "Boarding pass",
  main,
  stub,
  footer,
  barcodeText,
  interactive = false,
  as: Tag = "article",
  className,
}: BoardingPassProps) {
  const style = { "--kbp-carrier": carrierColor ?? "var(--signal)" } as CSSProperties;
  return (
    <>
      <PassStyles />
      <Tag
        className={cn(
          "kbp relative isolate overflow-hidden rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 text-fg",
          interactive && "transition-transform duration-300 ease-out hover:-translate-y-0.5",
          className,
        )}
        style={style}
      >
        <div className="h-1.5 w-full" style={{ background: "var(--kbp-carrier)" }} aria-hidden />
        <div className="flex flex-col sm:flex-row">
          <div className="min-w-0 flex-1">
            <div
              className="flex items-center justify-between gap-3 px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.18em] text-fg-muted sm:px-5"
              style={{ background: "color-mix(in srgb, var(--kbp-carrier) 10%, transparent)" }}
            >
              <div className="flex min-w-0 items-center gap-2 truncate">{carrier}</div>
              <div className="shrink-0">{label}</div>
            </div>
            <div className="px-4 py-4 sm:px-5">{main}</div>
            {footer && <div className="border-t border-panel-border px-4 py-3 text-sm text-fg-muted sm:px-5">{footer}</div>}
          </div>

          <aside
            className={cn(
              "relative flex h-[var(--kbp-stub-h)] shrink-0 flex-row items-center gap-4 border-t border-dashed border-panel-border-strong bg-bg-elev-2/50 px-4",
              "sm:h-auto sm:w-[var(--kbp-stub)] sm:flex-col sm:items-stretch sm:justify-between sm:border-l sm:border-t-0 sm:px-4 sm:py-4",
            )}
          >
            <div className="min-w-0 flex-1 sm:flex-none">{stub}</div>
            <Barcode seed={id} className="h-12 w-28 shrink-0 sm:mt-4 sm:w-full" text={barcodeText} />
          </aside>
        </div>
      </Tag>
    </>
  );
}

// ─── Route line ────────────────────────────────────────────────

export interface RouteLineProps {
  origin: string;
  destination: string;
  /** Intermediate airport codes, drawn as dots along the arc */
  stops?: string[];
  durationMin?: number;
  carrierColor?: string;
  /** 0–1 position of the plane along the arc (default: apex). Also draws the flown portion solid. */
  progress?: number;
  /** Extra caption under the arc (replaces the duration/stops line when given) */
  caption?: string;
  className?: string;
}

const P0: [number, number] = [56, 70];
const P1: [number, number] = [160, 4];
const P2: [number, number] = [264, 70];

function bez(t: number): [number, number] {
  const u = 1 - t;
  return [u * u * P0[0] + 2 * u * t * P1[0] + t * t * P2[0], u * u * P0[1] + 2 * u * t * P1[1] + t * t * P2[1]];
}

function bezTangent(t: number): number {
  const dx = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
  const dy = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function RouteLine({ origin, destination, stops = [], durationMin, carrierColor, progress, caption, className }: RouteLineProps) {
  const color = carrierColor ?? "var(--signal)";
  const t = progress == null ? 0.5 : Math.max(0, Math.min(1, progress));
  const [px, py] = bez(t);
  const angle = bezTangent(t) + 90;
  const d = `M${P0[0]} ${P0[1]} Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`;
  const line =
    caption ??
    [durationMin != null ? fmtDuration(durationMin) : null, stops.length === 0 ? "Nonstop" : `${stops.length} stop${stops.length > 1 ? "s" : ""}`]
      .filter(Boolean)
      .join(" · ");

  return (
    <svg
      viewBox="0 0 320 100"
      className={cn("block h-auto w-full max-w-[22rem] text-fg", className)}
      role="img"
      aria-label={`${origin} to ${destination}${stops.length ? ` via ${stops.join(", ")}` : ""}${line ? `, ${line}` : ""}`}
    >
      <path d={d} fill="none" stroke="var(--panel-border-strong)" strokeWidth={1.5} strokeDasharray="3 5" />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={progress == null ? undefined : `${t} 1`}
        opacity={progress == null ? 0.9 : 1}
      />

      <circle cx={P0[0]} cy={P0[1]} r={4} fill={color} stroke="var(--bg-elev-1)" strokeWidth={1.5} />
      <circle cx={P2[0]} cy={P2[1]} r={4} fill={color} stroke="var(--bg-elev-1)" strokeWidth={1.5} />

      {stops.map((code, i) => {
        const st = (i + 1) / (stops.length + 1);
        const [sx, sy] = bez(st);
        return (
          <g key={`${code}-${i}`}>
            <circle cx={sx} cy={sy} r={3.5} fill="var(--bg-elev-1)" stroke={color} strokeWidth={1.5} />
            <text x={sx} y={sy + 16} textAnchor="middle" fontSize={10} fill="var(--fg-subtle)" style={{ fontFamily: "var(--font-mono)" }}>
              {code}
            </text>
          </g>
        );
      })}

      <g transform={`translate(${px} ${py})`}>
        <circle r={9} fill="var(--bg-elev-1)" />
        <g transform={`rotate(${angle}) scale(1.25)`}>
          <path d={PLANE_PATH} fill={color} />
        </g>
      </g>

      <text x={46} y={76} textAnchor="end" fontSize={22} fontWeight={600} fill="currentColor" style={{ fontFamily: "var(--font-mono)" }}>
        {origin}
      </text>
      <text x={274} y={76} textAnchor="start" fontSize={22} fontWeight={600} fill="currentColor" style={{ fontFamily: "var(--font-mono)" }}>
        {destination}
      </text>
      {line && (
        <text x={160} y={94} textAnchor="middle" fontSize={11} fill="var(--fg-muted)" style={{ fontFamily: "var(--font-mono)" }}>
          {line}
        </text>
      )}
    </svg>
  );
}
