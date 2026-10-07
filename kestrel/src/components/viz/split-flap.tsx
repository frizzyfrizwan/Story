"use client";

/**
 * Split-flap (Solari) display.
 *
 * <SplitFlap text /> renders one tile per character. Each tile is two static halves plus two
 * animated flaps (top falls, bottom rises) so the flip reads as a physical card, not a fade.
 * Tiles spin through the charset toward their target with a seeded number of steps and a
 * per-tile stagger. When `text` changes, only the tiles whose character changed flip again.
 *
 * <DepartureBoard rows /> composes it into the landing-hero / 404 board with a header,
 * row-by-row entrance and live updates.
 */

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { cn, fmtCompact } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-viz";

export const FLAP_CHARSET = " ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789:-./+&'";

export type FlapSize = "xs" | "sm" | "md" | "lg";
export type FlapTone = "default" | "muted" | "signal" | "aurora" | "rose" | "gold" | "violet" | "sky";

const TONE_VAR: Record<FlapTone, string> = {
  default: "var(--fg)",
  muted: "var(--fg-muted)",
  signal: "var(--signal)",
  aurora: "var(--aurora)",
  rose: "var(--rose)",
  violet: "var(--violet)",
  gold: "var(--gold)",
  sky: "var(--sky)",
};

const CSS = `
.kf-xs{--kf-w:.8rem;--kf-h:1.2rem;--kf-fs:.62rem;--kf-r:2px}
.kf-sm{--kf-w:1rem;--kf-h:1.5rem;--kf-fs:.8rem;--kf-r:3px}
.kf-md{--kf-w:1.15rem;--kf-h:1.7rem;--kf-fs:.85rem;--kf-r:3px}
.kf-lg{--kf-w:1.55rem;--kf-h:2.4rem;--kf-fs:1.25rem;--kf-r:4px}
@media (min-width:640px){
  .kf-md{--kf-w:1.7rem;--kf-h:2.25rem;--kf-fs:1.1rem}
  .kf-lg{--kf-w:2.7rem;--kf-h:3.5rem;--kf-fs:1.9rem;--kf-r:5px}
}
.kf-tile{position:relative;display:inline-block;width:var(--kf-w);height:var(--kf-h);font-size:var(--kf-fs);border-radius:var(--kf-r);
  perspective:320px;background:var(--bg-elev-1);box-shadow:inset 0 0 0 1px var(--panel-border),0 1px 0 var(--panel-border);
  font-family:var(--font-mono);font-weight:600;font-variant-numeric:tabular-nums;overflow:hidden;transform:translateZ(0)}
.kf-tile::after{content:"";position:absolute;left:0;right:0;top:50%;height:1px;margin-top:-.5px;background:var(--panel-border-strong);z-index:4;pointer-events:none}
.kf-half{position:absolute;left:0;right:0;height:50%;overflow:hidden}
.kf-half>span{position:absolute;left:0;right:0;height:200%;display:flex;align-items:center;justify-content:center;line-height:1}
.kf-top{top:0;background:linear-gradient(var(--bg-elev-3),var(--bg-elev-2));border-radius:var(--kf-r) var(--kf-r) 0 0}
.kf-top>span{top:0}
.kf-bottom{bottom:0;background:linear-gradient(var(--bg-elev-2),var(--bg-elev-1));border-radius:0 0 var(--kf-r) var(--kf-r)}
.kf-bottom>span{top:-100%}
.kf-flap{z-index:2;backface-visibility:hidden;-webkit-backface-visibility:hidden;will-change:transform}
.kf-flap.kf-top{transform-origin:50% 100%;animation:kf-flip-top var(--kf-step,80ms) ease-in both}
.kf-flap.kf-bottom{transform-origin:50% 0%;animation:kf-flip-bottom var(--kf-step,80ms) ease-out both}
@keyframes kf-flip-top{0%{transform:rotateX(0)}50%,100%{transform:rotateX(-90deg)}}
@keyframes kf-flip-bottom{0%,50%{transform:rotateX(90deg)}100%{transform:rotateX(0)}}
@media (prefers-reduced-motion:reduce){.kf-flap{display:none}}
`;

function FlapStyles() {
  return (
    <style href="kestrel-split-flap" precedence="default">
      {CSS}
    </style>
  );
}

function nextChar(cur: string, target: string, charset: string, spin: number): string {
  const ti = charset.indexOf(target);
  if (ti < 0) return target;
  const n = charset.length;
  const ci = charset.indexOf(cur);
  const dist = ci < 0 ? n : (ti - ci + n) % n;
  if (dist > spin) return charset[(((ti - spin) % n) + n) % n];
  return charset[(ci + 1) % n];
}

interface FlapTileProps {
  target: string;
  delay: number;
  stepMs: number;
  spin: number;
  charset: string;
  tone: FlapTone;
  reduced: boolean;
}

function FlapTile({ target, delay, stepMs, spin, charset, tone, reduced }: FlapTileProps) {
  const [view, setView] = useState<{ cur: string; next: string | null; step: number }>({ cur: " ", next: null, step: 0 });
  const curRef = useRef(" ");

  useEffect(() => {
    if (reduced) {
      curRef.current = target;
      setView((v) => (v.cur === target && v.next === null ? v : { cur: target, next: null, step: v.step }));
      return;
    }
    let timer = 0;
    const step = () => {
      const cur = curRef.current;
      if (cur === target) {
        setView((v) => (v.cur === cur && v.next === null ? v : { cur, next: null, step: v.step }));
        return;
      }
      const nxt = nextChar(cur, target, charset, spin);
      curRef.current = nxt;
      setView((v) => ({ cur, next: nxt, step: v.step + 1 }));
      timer = window.setTimeout(step, stepMs);
    };
    timer = window.setTimeout(step, curRef.current === target ? 0 : delay);
    return () => window.clearTimeout(timer);
  }, [target, delay, stepMs, spin, charset, reduced]);

  const style = { color: TONE_VAR[tone], "--kf-step": `${stepMs}ms` } as CSSProperties;

  return (
    <span className="kf-tile" style={style} aria-hidden>
      <span className="kf-half kf-top">
        <span>{view.next ?? view.cur}</span>
      </span>
      <span className="kf-half kf-bottom">
        <span>{view.cur}</span>
      </span>
      {view.next !== null && (
        <>
          <span key={`t${view.step}`} className="kf-half kf-top kf-flap">
            <span>{view.cur}</span>
          </span>
          <span key={`b${view.step}`} className="kf-half kf-bottom kf-flap">
            <span>{view.next}</span>
          </span>
        </>
      )}
    </span>
  );
}

function normalise(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

function padLine(line: string, cols: number, align: "left" | "center" | "right"): string {
  const s = line.length > cols ? line.slice(0, cols) : line;
  const pad = cols - s.length;
  if (align === "right") return " ".repeat(pad) + s;
  if (align === "center") {
    const l = Math.floor(pad / 2);
    return " ".repeat(l) + s + " ".repeat(pad - l);
  }
  return s + " ".repeat(pad);
}

export interface SplitFlapProps {
  text: string;
  size?: FlapSize;
  /** Fixed number of lines (pads with blank rows / truncates) */
  rows?: number;
  /** Fixed tiles per line (pads / truncates). Default: longest line. */
  cols?: number;
  align?: "left" | "center" | "right";
  tone?: FlapTone;
  /** ms between successive tiles starting their flip (default 24) */
  stagger?: number;
  /** ms per flip step (default 75) */
  stepMs?: number;
  /** ms before the first tile starts */
  delay?: number;
  charset?: string;
  className?: string;
  /** Accessible label (defaults to the text) */
  label?: string;
}

export function SplitFlap({
  text,
  size = "md",
  rows,
  cols,
  align = "left",
  tone = "default",
  stagger = 24,
  stepMs = 75,
  delay = 0,
  charset = FLAP_CHARSET,
  className,
  label,
}: SplitFlapProps) {
  const reduced = usePrefersReducedMotion();

  const lines = useMemo(() => {
    let ls = normalise(text).split("\n");
    if (rows != null) {
      ls = ls.slice(0, rows);
      while (ls.length < rows) ls.push("");
    }
    const width = cols ?? Math.max(1, ...ls.map((l) => l.length));
    return ls.map((l) => padLine(l, width, align).split(""));
  }, [text, rows, cols, align]);

  return (
    <>
      <FlapStyles />
      <div className={cn("inline-flex flex-col gap-1", `kf-${size}`, className)} role="img" aria-label={label ?? text}>
        {lines.map((line, r) => (
          <div key={r} className="flex gap-[2px]">
            {line.map((ch, c) => (
              <FlapTile
                key={c}
                target={ch}
                delay={delay + (r * line.length + c) * stagger}
                stepMs={stepMs}
                spin={4 + ((r * 31 + c * 7) % 5)}
                charset={charset}
                tone={tone}
                reduced={reduced}
              />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

// ─── Departure board ───────────────────────────────────────────

export interface BoardRow {
  id?: string;
  time: string;
  flight: string;
  destination: string;
  /** Cabin code or name, e.g. "J", "F", "BUSINESS" */
  cabin?: string;
  /** Number (formatted compactly) or preformatted string */
  miles?: number | string;
  status?: string;
}

export type BoardColumn = keyof Omit<BoardRow, "id">;

interface ColumnDef {
  label: string;
  width: number;
  align: "left" | "right" | "center";
  hide?: string;
}

const COLUMNS: Record<BoardColumn, ColumnDef> = {
  time: { label: "Time", width: 5, align: "left" },
  flight: { label: "Flight", width: 6, align: "left" },
  destination: { label: "Destination", width: 12, align: "left" },
  cabin: { label: "Cabin", width: 3, align: "center", hide: "hidden md:flex" },
  miles: { label: "Miles", width: 6, align: "right", hide: "hidden sm:flex" },
  status: { label: "Status", width: 9, align: "left", hide: "hidden sm:flex" },
};

const DEFAULT_COLUMNS: BoardColumn[] = ["time", "flight", "destination", "cabin", "miles", "status"];

export function statusTone(status: string): FlapTone {
  const u = status.toUpperCase();
  if (/SOLD|CANCEL|CLOSED|FULL|NO SEATS|GONE/.test(u)) return "rose";
  if (/WAIT|LIMITED|FEW|BOARDING|LAST|DELAY|FINAL/.test(u)) return "signal";
  if (/AVAIL|OPEN|ON TIME|WIDE|CONFIRM|DEPART|FOUND/.test(u)) return "aurora";
  return "default";
}

export function cabinTone(cabin: string): FlapTone {
  const u = cabin.toUpperCase();
  if (u.startsWith("F")) return "gold";
  if (u.startsWith("J") || u.startsWith("C") || u.startsWith("BUS")) return "aurora";
  if (u.startsWith("W") || u.startsWith("PREM")) return "violet";
  if (u.startsWith("Y") || u.startsWith("ECO")) return "sky";
  return "default";
}

export interface DepartureBoardProps {
  rows: BoardRow[];
  title?: string;
  subtitle?: string;
  columns?: BoardColumn[];
  size?: FlapSize;
  /** ms between rows starting to flip (default 110) */
  rowStagger?: number;
  /** Pad with blank rows up to this count so the board keeps its shape */
  minRows?: number;
  /** Show the pulsing "live" dot (default true) */
  live?: boolean;
  className?: string;
}

function cellText(row: BoardRow, col: BoardColumn): string {
  const v = row[col];
  if (v == null) return "";
  if (col === "miles" && typeof v === "number") return fmtCompact(v).toUpperCase();
  return String(v);
}

function cellTone(row: BoardRow, col: BoardColumn): FlapTone {
  if (col === "status" && row.status) return statusTone(row.status);
  if (col === "cabin" && row.cabin) return cabinTone(row.cabin);
  if (col === "time") return "muted";
  if (col === "miles") return "gold";
  return "default";
}

export function DepartureBoard({
  rows,
  title = "Departures",
  subtitle,
  columns = DEFAULT_COLUMNS,
  size = "md",
  rowStagger = 110,
  minRows,
  live = true,
  className,
}: DepartureBoardProps) {
  const padded = useMemo(() => {
    const out = [...rows];
    if (minRows != null) while (out.length < minRows) out.push({ time: "", flight: "", destination: "" });
    return out;
  }, [rows, minRows]);

  const cellWidth = (w: number) => `calc(${w} * var(--kf-w) + ${w - 1} * 2px)`;

  return (
    <section
      className={cn(
        "grain rounded-[var(--radius-lg)] border border-panel-border bg-bg-elev-1 p-3 shadow-panel sm:p-5",
        `kf-${size}`,
        className,
      )}
      aria-label={title}
    >
      <FlapStyles />
      <header className="mb-3 flex items-end justify-between gap-3 sm:mb-4">
        <div className="flex items-center gap-2.5">
          {live && (
            <span className="relative flex h-2 w-2" aria-hidden>
              <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-aurora" />
            </span>
          )}
          <h3 className="font-display text-lg leading-none tracking-tight sm:text-xl">{title}</h3>
        </div>
        {subtitle && <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle sm:text-[11px]">{subtitle}</div>}
      </header>

      <div className="scrollbar-none overflow-x-auto">
        <div className="min-w-max">
          <div className="mb-2 flex items-center gap-3 border-b border-panel-border pb-2 sm:gap-5" role="row">
            {columns.map((col) => {
              const def = COLUMNS[col];
              return (
                <div
                  key={col}
                  role="columnheader"
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.2em] text-fg-subtle",
                    def.hide,
                    def.align === "right" && "justify-end text-right",
                    def.align === "center" && "justify-center text-center",
                    !def.hide && "flex",
                  )}
                  style={{ width: cellWidth(def.width) }}
                >
                  {def.label}
                </div>
              );
            })}
          </div>

          <div className="flex flex-col gap-1.5" role="rowgroup">
            {padded.map((row, r) => (
              <div
                key={r}
                role="row"
                className="flex animate-rise items-center gap-3 sm:gap-5"
                style={{ animationDelay: `${r * rowStagger}ms` }}
              >
                {columns.map((col) => {
                  const def = COLUMNS[col];
                  return (
                    <div key={col} role="cell" className={cn(def.hide ?? "flex")}>
                      <SplitFlap
                        text={cellText(row, col)}
                        cols={def.width}
                        align={def.align}
                        tone={cellTone(row, col)}
                        size={size}
                        delay={r * rowStagger}
                        stagger={18}
                        label={`${def.label}: ${cellText(row, col) || "—"}`}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
