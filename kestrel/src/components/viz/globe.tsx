"use client";

/**
 * <Globe> — procedural orthographic globe on canvas (d3-geo + world-atlas).
 *
 * - Slowly auto-rotates; pauses on hover; drag to rotate with inertia.
 * - Land + graticule + glowing atmosphere, great-circle arcs with animated "flight" dashes and a
 *   moving dot, pulsing markers with labels, and tiny plane glyphs for live aircraft.
 * - Redraws only while something moves (rotation, inertia, focus tween, arc/pulse animation);
 *   back-hemisphere points are culled with geoDistance so 400+ aircraft stay at 60 fps.
 * - Theme-aware: palette is read from CSS variables and refreshed when `data-theme` flips.
 */

import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { geoDistance, geoGraticule10, geoInterpolate, geoOrthographic, geoPath, type GeoProjection } from "d3-geo";
import type { LineString } from "geojson";
import { cn, clamp } from "@/lib/utils";
import { getLand, SPHERE, drawPlane, screenHeading, drawLabel } from "./geo";
import {
  HALF_PI,
  TAU,
  easeInOutSine,
  easeOutCubic,
  prepareCanvas,
  useElementSize,
  usePrefersReducedMotion,
  useThemeColors,
  withAlpha,
  type ThemeColors,
} from "./use-viz";

// ─── Public types ──────────────────────────────────────────────

export interface GlobeArc {
  from: [number, number];
  to: [number, number];
  /** Any CSS colour; defaults to the signal token */
  color?: string;
  /** 0–1: draws the flown portion solid with the dot at the tip; omit for a looping "flight" */
  progress?: number;
  id?: string;
}

export interface GlobeMarker {
  lon: number;
  lat: number;
  label?: string;
  color?: string;
  pulse?: boolean;
  /** Dot radius in px (default 4) */
  size?: number;
  id?: string;
}

export interface GlobeAircraft {
  lon: number;
  lat: number;
  /** Degrees clockwise from north */
  heading: number;
  color?: string;
  id?: string;
}

export interface GlobeProps {
  arcs?: GlobeArc[];
  markers?: GlobeMarker[];
  aircraft?: GlobeAircraft[];
  /** Rotate toward this [lon, lat] (tweened). While set, auto-rotation holds until the user drags. */
  focus?: [number, number] | null;
  /** Default true. Ignored when the user prefers reduced motion. */
  autoRotate?: boolean;
  /** Degrees per second (default 3) */
  rotateSpeed?: number;
  /** Initial d3 rotation [λ, φ]; the visible centre is [-λ, -φ]. Default shows the Atlantic. */
  initialRotation?: [number, number];
  graticule?: boolean;
  atmosphere?: "none" | "soft" | "aurora";
  /** Padding between the sphere and the container edge, px (default 12) */
  inset?: number;
  /** Disable pointer interaction (purely decorative globes) */
  interactive?: boolean;
  /** Aircraft glyph height in px (default 9) */
  aircraftSize?: number;
  landColor?: string;
  oceanColor?: string;
  className?: string;
  ariaLabel?: string;
  onMarkerClick?: (marker: GlobeMarker, index: number) => void;
  /** Fires at most once per frame while rotating */
  onRotate?: (rotation: [number, number]) => void;
}

// ─── Internals ─────────────────────────────────────────────────

interface Tween {
  from: [number, number];
  to: [number, number];
  start: number;
  dur: number;
}

interface GlobeState {
  rot: [number, number];
  vel: [number, number];
  dragging: boolean;
  hovered: boolean;
  holdFocus: boolean;
  tween: Tween | null;
  lastT: number;
  raf: number;
  dirty: boolean;
  markerHits: { x: number; y: number; i: number }[];
  pointer: { id: number; x: number; y: number; t: number; moved: number } | null;
  cursorMarker: number;
}

const GRATICULE = geoGraticule10();

function shortestDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function makeLine(a: [number, number], b: [number, number]): LineString {
  return { type: "LineString", coordinates: [a, b] };
}

export function Globe({
  arcs,
  markers,
  aircraft,
  focus,
  autoRotate = true,
  rotateSpeed = 3,
  initialRotation = [30, -22],
  graticule = true,
  atmosphere = "soft",
  inset = 12,
  interactive = true,
  aircraftSize = 9,
  landColor,
  oceanColor,
  className,
  ariaLabel = "Interactive globe",
  onMarkerClick,
  onRotate,
}: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const size = useElementSize(containerRef);
  const colors = useThemeColors(containerRef);
  const reduced = usePrefersReducedMotion();

  const projectionRef = useRef<GeoProjection | null>(null);
  const pathRef = useRef<ReturnType<typeof geoPath> | null>(null);
  const landRef = useRef(getLand());

  const state = useRef<GlobeState>({
    rot: [initialRotation[0], initialRotation[1]],
    vel: [0, 0],
    dragging: false,
    hovered: false,
    holdFocus: false,
    tween: null,
    lastT: 0,
    raf: 0,
    dirty: true,
    markerHits: [],
    pointer: null,
    cursorMarker: -1,
  });

  // Latest props for the frame loop, without re-creating the loop.
  const propsRef = useRef({
    arcs: arcs ?? [],
    markers: markers ?? [],
    aircraft: aircraft ?? [],
    autoRotate,
    rotateSpeed,
    graticule,
    atmosphere,
    inset,
    aircraftSize,
    landColor,
    oceanColor,
    colors,
    reduced,
    size,
    onMarkerClick,
    onRotate,
  });

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    const projection = projectionRef.current;
    const path = pathRef.current;
    const p = propsRef.current;
    const s = state.current;
    if (!canvas || !projection || !path) return;
    const { width: w, height: h } = p.size;
    if (w < 2 || h < 2) return;
    const ctx = prepareCanvas(canvas, w, h);
    if (!ctx) return;
    path.context(ctx);

    const c: ThemeColors = p.colors;
    const cx = w / 2;
    const cy = h / 2;
    const r = Math.max(10, Math.min(w, h) / 2 - p.inset);
    const rm = p.reduced;

    projection.rotate([s.rot[0], s.rot[1], 0]);
    const center: [number, number] = [-s.rot[0], -s.rot[1]];

    ctx.clearRect(0, 0, w, h);

    // Atmosphere halo
    if (p.atmosphere !== "none") {
      const strong = p.atmosphere === "aurora";
      const g = ctx.createRadialGradient(cx, cy, r * 0.94, cx, cy, r * (strong ? 1.28 : 1.18));
      g.addColorStop(0, withAlpha(c.aurora, strong ? 0.5 : 0.3));
      g.addColorStop(0.3, withAlpha(strong ? c.violet : c.aurora, strong ? 0.18 : 0.1));
      g.addColorStop(1, withAlpha(c.aurora, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, r * 1.3, 0, TAU);
      ctx.fillStyle = g;
      ctx.fill();
    }

    // Ocean
    const ocean = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.05, cx, cy, r);
    ocean.addColorStop(0, p.oceanColor ?? c.bgElev3);
    ocean.addColorStop(1, p.oceanColor ? withAlpha(p.oceanColor, 0.8) : c.bgElev1);
    ctx.beginPath();
    path(SPHERE);
    ctx.fillStyle = ocean;
    ctx.fill();

    // Graticule
    if (p.graticule) {
      ctx.beginPath();
      path(GRATICULE);
      ctx.strokeStyle = withAlpha(c.fg, 0.07);
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Land
    ctx.beginPath();
    path(landRef.current);
    ctx.fillStyle = p.landColor ?? c.fgFaint;
    ctx.fill();
    ctx.strokeStyle = withAlpha(c.fgSubtle, 0.45);
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Limb shading — darkens the edge for a lit-sphere look
    const limb = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
    limb.addColorStop(0, withAlpha(c.bg, 0));
    limb.addColorStop(1, withAlpha(c.bg, 0.55));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = limb;
    ctx.fill();

    // Route arcs
    const arcsList = p.arcs;
    for (let i = 0; i < arcsList.length; i++) {
      const a = arcsList[i];
      const color = a.color ?? c.signal;
      const interp = geoInterpolate(a.from, a.to);
      const full = makeLine(a.from, a.to);
      ctx.setLineDash([]);

      // glow track
      ctx.beginPath();
      path(full);
      ctx.strokeStyle = withAlpha(color, 0.22);
      ctx.lineWidth = 3.5;
      ctx.stroke();

      let dot: [number, number];
      if (typeof a.progress === "number") {
        const pr = clamp(a.progress, 0, 1);
        if (pr > 0.001) {
          ctx.beginPath();
          path(makeLine(a.from, interp(pr)));
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
        dot = interp(pr);
      } else {
        ctx.beginPath();
        path(full);
        ctx.strokeStyle = withAlpha(color, 0.9);
        ctx.lineWidth = 1.3;
        if (!rm) {
          ctx.setLineDash([3, 8]);
          ctx.lineDashOffset = -((t / 28) % 11);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        const phase = rm ? 0.5 : ((t / 4200 + i * 0.29) % 1);
        dot = interp(easeInOutSine(phase));
      }

      if (geoDistance(dot, center) < HALF_PI - 0.01) {
        const pt = projection(dot);
        if (pt) {
          const g = ctx.createRadialGradient(pt[0], pt[1], 0, pt[0], pt[1], 9);
          g.addColorStop(0, withAlpha(color, 0.6));
          g.addColorStop(1, withAlpha(color, 0));
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 9, 0, TAU);
          ctx.fillStyle = g;
          ctx.fill();
          ctx.beginPath();
          ctx.arc(pt[0], pt[1], 2.6, 0, TAU);
          ctx.fillStyle = c.fg;
          ctx.fill();
        }
      }
    }

    // Aircraft (culled to the visible hemisphere, faded near the limb)
    const ac = p.aircraft;
    const project = (pt: [number, number]) => projection(pt) as [number, number] | null;
    for (let i = 0; i < ac.length; i++) {
      const a = ac[i];
      const d = geoDistance([a.lon, a.lat], center);
      if (d > HALF_PI - 0.03) continue;
      const pt = projection([a.lon, a.lat]);
      if (!pt) continue;
      const ang = screenHeading(project, a.lon, a.lat, a.heading);
      if (ang == null) continue;
      const fade = Math.min(1, (HALF_PI - d) / 0.35);
      drawPlane(ctx, pt[0], pt[1], ang, p.aircraftSize, a.color ?? c.sky, 0.95 * fade);
    }

    // Markers
    s.markerHits = [];
    const mk = p.markers;
    const labelFont = `500 11px ${c.fontMono}`;
    for (let i = 0; i < mk.length; i++) {
      const m = mk[i];
      const d = geoDistance([m.lon, m.lat], center);
      if (d > HALF_PI - 0.02) continue;
      const pt = projection([m.lon, m.lat]);
      if (!pt) continue;
      const [x, y] = pt;
      const color = m.color ?? c.signal;
      const radius = m.size ?? 4;
      const fade = Math.min(1, (HALF_PI - d) / 0.3);
      s.markerHits.push({ x, y, i });
      ctx.globalAlpha = fade;
      if (m.pulse && !rm) {
        const ph = (t / 1800 + i * 0.37) % 1;
        ctx.beginPath();
        ctx.arc(x, y, radius + ph * 16, 0, TAU);
        ctx.strokeStyle = withAlpha(color, (1 - ph) * 0.75);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(x, y, radius + 3, 0, TAU);
      ctx.fillStyle = withAlpha(color, 0.28);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = c.bg;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (m.label && fade > 0.4) {
        drawLabel(ctx, m.label, x + radius + 5, y, { font: labelFont, fg: c.fg, bg: withAlpha(c.bg, 0.72) });
      }
      ctx.globalAlpha = 1;
    }

    // Rim
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.strokeStyle = withAlpha(c.fg, 0.14);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Specular highlight
    const spec = ctx.createRadialGradient(cx - r * 0.42, cy - r * 0.46, 0, cx - r * 0.42, cy - r * 0.46, r * 0.6);
    spec.addColorStop(0, withAlpha(c.fg, 0.08));
    spec.addColorStop(1, withAlpha(c.fg, 0));
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TAU);
    ctx.fillStyle = spec;
    ctx.fill();
  }, []);

  const needsFrame = useCallback(() => {
    const s = state.current;
    const p = propsRef.current;
    if (s.dirty || s.dragging || s.tween) return true;
    if (Math.abs(s.vel[0]) > 0.0004 || Math.abs(s.vel[1]) > 0.0004) return true;
    if (p.reduced) return false;
    if (p.autoRotate && !s.hovered && !s.holdFocus) return true;
    if (p.arcs.length > 0) return true;
    if (p.markers.some((m) => m.pulse)) return true;
    return false;
  }, []);

  const schedule = useCallback(() => {
    const s = state.current;
    if (s.raf) return;
    const tick = (t: number) => {
      const st = state.current;
      const p = propsRef.current;
      st.raf = 0;
      const dt = st.lastT ? Math.min(64, t - st.lastT) : 16;
      st.lastT = t;

      if (st.tween) {
        const k = Math.min(1, (t - st.tween.start) / st.tween.dur);
        const e = easeOutCubic(k);
        st.rot = [
          st.tween.from[0] + shortestDelta(st.tween.from[0], st.tween.to[0]) * e,
          st.tween.from[1] + (st.tween.to[1] - st.tween.from[1]) * e,
        ];
        if (k >= 1) st.tween = null;
      } else if (!st.dragging) {
        if (Math.abs(st.vel[0]) > 0.0004 || Math.abs(st.vel[1]) > 0.0004) {
          st.rot[0] += st.vel[0] * dt;
          st.rot[1] = clamp(st.rot[1] + st.vel[1] * dt, -90, 90);
          const decay = Math.exp(-dt / 160);
          st.vel[0] *= decay;
          st.vel[1] *= decay;
        } else if (p.autoRotate && !st.hovered && !st.holdFocus && !p.reduced) {
          st.rot[0] = (st.rot[0] + (p.rotateSpeed * dt) / 1000) % 360;
        }
      }

      draw(t);
      st.dirty = false;
      p.onRotate?.([st.rot[0], st.rot[1]]);

      if (needsFrame()) st.raf = requestAnimationFrame(tick);
      else st.lastT = 0;
    };
    s.raf = requestAnimationFrame(tick);
  }, [draw, needsFrame]);

  const invalidate = useCallback(() => {
    state.current.dirty = true;
    schedule();
  }, [schedule]);

  // Keep the loop's view of props fresh.
  useEffect(() => {
    propsRef.current = {
      arcs: arcs ?? [],
      markers: markers ?? [],
      aircraft: aircraft ?? [],
      autoRotate,
      rotateSpeed,
      graticule,
      atmosphere,
      inset,
      aircraftSize,
      landColor,
      oceanColor,
      colors,
      reduced,
      size,
      onMarkerClick,
      onRotate,
    };
    invalidate();
  }, [
    arcs,
    markers,
    aircraft,
    autoRotate,
    rotateSpeed,
    graticule,
    atmosphere,
    inset,
    aircraftSize,
    landColor,
    oceanColor,
    colors,
    reduced,
    size,
    onMarkerClick,
    onRotate,
    invalidate,
  ]);

  // Projection lives for the component's lifetime; only translate/scale change on resize.
  useEffect(() => {
    if (!projectionRef.current) {
      projectionRef.current = geoOrthographic().clipAngle(90).precision(0.5);
      pathRef.current = geoPath(projectionRef.current);
    }
    const r = Math.max(10, Math.min(size.width, size.height) / 2 - inset);
    projectionRef.current.translate([size.width / 2, size.height / 2]).scale(r);
    invalidate();
  }, [size, inset, invalidate]);

  // Focus tween
  useEffect(() => {
    const s = state.current;
    if (!focus) {
      s.holdFocus = false;
      invalidate();
      return;
    }
    const to: [number, number] = [-focus[0], -focus[1]];
    s.holdFocus = true;
    s.vel = [0, 0];
    if (reduced) {
      s.rot = to;
      s.tween = null;
    } else {
      s.tween = { from: [s.rot[0], s.rot[1]], to, start: performance.now(), dur: 1200 };
    }
    invalidate();
  }, [focus, reduced, invalidate]);

  // Stop the loop on unmount.
  useEffect(() => {
    const s = state.current;
    return () => {
      if (s.raf) cancelAnimationFrame(s.raf);
      s.raf = 0;
    };
  }, []);

  // ─── Pointer interaction ───────────────────────────────────

  const hitMarker = (x: number, y: number): number => {
    const hits = state.current.markerHits;
    let best = -1;
    let bestD = 144; // 12px radius
    for (const h of hits) {
      const d = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = h.i;
      }
    }
    return best;
  };

  const localPoint = (e: ReactPointerEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const s = state.current;
    const { x, y } = localPoint(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    s.pointer = { id: e.pointerId, x, y, t: performance.now(), moved: 0 };
    s.dragging = true;
    s.tween = null;
    s.vel = [0, 0];
    invalidate();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    const s = state.current;
    const { x, y } = localPoint(e);
    if (s.dragging && s.pointer && s.pointer.id === e.pointerId) {
      const now = performance.now();
      const dt = Math.max(1, now - s.pointer.t);
      const dx = x - s.pointer.x;
      const dy = y - s.pointer.y;
      const r = projectionRef.current?.scale() ?? 200;
      const k = 75 / r; // degrees per pixel (d3's classic sensitivity)
      s.rot[0] += dx * k;
      s.rot[1] = clamp(s.rot[1] - dy * k, -90, 90);
      const vx = (dx * k) / dt;
      const vy = (-dy * k) / dt;
      s.vel = [s.vel[0] * 0.5 + vx * 0.5, s.vel[1] * 0.5 + vy * 0.5];
      s.pointer = { id: e.pointerId, x, y, t: now, moved: s.pointer.moved + Math.abs(dx) + Math.abs(dy) };
      s.holdFocus = false;
      invalidate();
    } else if (!s.dragging) {
      const hit = hitMarker(x, y);
      if (hit !== s.cursorMarker) {
        s.cursorMarker = hit;
        e.currentTarget.style.cursor = hit >= 0 ? "pointer" : "";
      }
    }
  };

  const endDrag = (e: ReactPointerEvent<HTMLCanvasElement>, click: boolean) => {
    const s = state.current;
    if (!s.dragging) return;
    const ptr = s.pointer;
    s.dragging = false;
    s.pointer = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (ptr && ptr.moved < 4) {
      s.vel = [0, 0];
      if (click) {
        const { x, y } = localPoint(e);
        const hit = hitMarker(x, y);
        if (hit >= 0) propsRef.current.onMarkerClick?.(propsRef.current.markers[hit], hit);
      }
    } else if (ptr && performance.now() - ptr.t > 80) {
      // pointer was held still before release → no fling
      s.vel = [0, 0];
    }
    invalidate();
  };

  return (
    <div ref={containerRef} className={cn("relative h-full w-full min-h-[160px]", className)}>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-0 block h-full w-full touch-none select-none",
          interactive && "cursor-grab active:cursor-grabbing",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, true)}
        onPointerCancel={(e) => endDrag(e, false)}
        onPointerEnter={() => {
          state.current.hovered = true;
        }}
        onPointerLeave={(e) => {
          state.current.hovered = false;
          state.current.cursorMarker = -1;
          e.currentTarget.style.cursor = "";
          schedule();
        }}
      />
    </div>
  );
}

// ─── Hero preset ───────────────────────────────────────────────

/** A handful of flagship award routes, used when the hero isn't given arcs. */
export const HERO_ARCS: GlobeArc[] = [
  { from: [-73.78, 40.64], to: [-0.46, 51.47] }, // JFK → LHR
  { from: [-122.38, 37.62], to: [140.39, 35.76] }, // SFO → NRT
  { from: [-0.46, 51.47], to: [103.99, 1.36] }, // LHR → SIN
  { from: [55.36, 25.25], to: [151.18, -33.95] }, // DXB → SYD
  { from: [-87.9, 41.98], to: [8.57, 50.03] }, // ORD → FRA
  { from: [-118.41, 33.94], to: [113.91, 22.31] }, // LAX → HKG
  { from: [51.61, 25.27], to: [28.24, -26.14] }, // DOH → JNB
  { from: [-46.47, -23.43], to: [2.55, 49.01] }, // GRU → CDG
];

export const HERO_MARKERS: GlobeMarker[] = [
  { lon: -73.78, lat: 40.64, label: "JFK", pulse: true },
  { lon: 140.39, lat: 35.76, label: "NRT" },
  { lon: 103.99, lat: 1.36, label: "SIN", pulse: true },
  { lon: 55.36, lat: 25.25, label: "DXB" },
  { lon: -0.46, lat: 51.47, label: "LHR" },
];

export interface GlobeHeroProps extends GlobeProps {
  /** Content layered over the globe (headline, CTA) */
  children?: ReactNode;
  /** Where the glow sits relative to the sphere */
  glow?: "behind" | "none";
}

/**
 * Landing-hero preset: aurora atmosphere, soft tri-colour glow behind the sphere,
 * flagship arcs when none are supplied. Fill a sized container; children render on top.
 */
export function GlobeHero({ children, className, glow = "behind", arcs, markers, ...rest }: GlobeHeroProps) {
  return (
    <div className={cn("relative isolate h-full w-full overflow-hidden", className)}>
      {glow !== "none" && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(45% 45% at 50% 55%, color-mix(in srgb, var(--aurora) 26%, transparent), transparent 70%)," +
              "radial-gradient(35% 35% at 28% 30%, color-mix(in srgb, var(--violet) 22%, transparent), transparent 70%)," +
              "radial-gradient(30% 30% at 74% 72%, color-mix(in srgb, var(--signal) 20%, transparent), transparent 70%)",
          }}
        />
      )}
      <Globe
        atmosphere="aurora"
        autoRotate
        rotateSpeed={2.4}
        inset={24}
        arcs={arcs ?? HERO_ARCS}
        markers={markers ?? HERO_MARKERS}
        className="absolute inset-0"
        {...rest}
      />
      {children && <div className="relative z-10 h-full w-full">{children}</div>}
    </div>
  );
}
