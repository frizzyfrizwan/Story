"use client";

/**
 * <WorldMap> — Natural Earth projection with pan/zoom (wheel, drag, pinch — no library).
 *
 * Land / graticule / borders render once to SVG (theme-aware via CSS tokens) and are moved with a
 * single <g transform>. Routes, markers and aircraft are drawn on a canvas layer so a thousand
 * planes stay smooth. The visible lon/lat box is reported through `onViewportChange` (OpenSky-style
 * keys) so the Live page can query only what's on screen.
 */

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";
import { geoGraticule10, geoInterpolate, geoNaturalEarth1, geoPath } from "d3-geo";
import type { LineString, MultiLineString } from "geojson";
import { Minus, Plus, LocateFixed } from "lucide-react";
import { cn, clamp } from "@/lib/utils";
import { getLand, loadBorders, SPHERE, drawPlane, screenHeading, drawLabel } from "./geo";
import {
  TAU,
  easeInOutSine,
  easeOutCubic,
  prepareCanvas,
  useElementSize,
  usePrefersReducedMotion,
  useThemeColors,
  withAlpha,
} from "./use-viz";

// ─── Public types ──────────────────────────────────────────────

export interface MapAircraft {
  id: string;
  lon: number;
  lat: number;
  /** Degrees clockwise from north */
  heading: number;
  color?: string;
  label?: string;
}

export interface MapMarker {
  id?: string;
  lon: number;
  lat: number;
  label?: string;
  color?: string;
  size?: number;
}

export interface MapRoute {
  id?: string;
  from: [number, number];
  to: [number, number];
  color?: string;
  /** 0–1 flown portion; omit for a looping flight animation */
  progress?: number;
}

/** Visible area — key names match OpenSky's `/states/all` query parameters. */
export interface MapBBox {
  lamin: number;
  lomin: number;
  lamax: number;
  lomax: number;
}

export type MapHit =
  | { kind: "aircraft"; index: number; item: MapAircraft }
  | { kind: "marker"; index: number; item: MapMarker };

export interface MapView {
  zoom: number;
  center: [number, number];
}

export interface WorldMapHandle {
  flyTo: (center: [number, number], zoom?: number) => void;
  reset: () => void;
  getView: () => MapView;
}

export interface WorldMapProps {
  aircraft?: MapAircraft[];
  markers?: MapMarker[];
  routes?: MapRoute[];
  /** Highlighted aircraft / marker id */
  selectedId?: string | null;
  /** Fly to this view whenever it changes */
  focus?: { center: [number, number]; zoom?: number } | null;
  minZoom?: number;
  maxZoom?: number;
  borders?: boolean;
  graticule?: boolean;
  /** Show the +/−/reset control cluster (default true) */
  controls?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Debounced (~200 ms) after pan/zoom settles, and once after mount */
  onViewportChange?: (bbox: MapBBox, view: MapView) => void;
  onHover?: (hit: MapHit | null, position: { x: number; y: number } | null) => void;
  onClick?: (hit: MapHit | null, lonlat: [number, number] | null) => void;
  /** Render a tooltip for the hovered item; positioned by the map */
  renderTooltip?: (hit: MapHit) => ReactNode;
  ref?: Ref<WorldMapHandle>;
}

const WORLD: MapBBox = { lamin: -90, lomin: -180, lamax: 90, lomax: 180 };
const GRATICULE = geoGraticule10();
const PAD = 8;

interface View {
  k: number;
  x: number;
  y: number;
}

interface PointerRec {
  x: number;
  y: number;
}

function makeLine(a: [number, number], b: [number, number]): LineString {
  return { type: "LineString", coordinates: [a, b] };
}

export function WorldMap({
  aircraft,
  markers,
  routes,
  selectedId,
  focus,
  minZoom = 1,
  maxZoom = 24,
  borders = true,
  graticule = true,
  controls = true,
  className,
  ariaLabel = "World map",
  onViewportChange,
  onHover,
  onClick,
  renderTooltip,
  ref,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const size = useElementSize(containerRef);
  const colors = useThemeColors(containerRef);
  const reduced = usePrefersReducedMotion();
  const [borderMesh, setBorderMesh] = useState<MultiLineString | null>(null);
  const [hover, setHover] = useState<{ hit: MapHit; x: number; y: number } | null>(null);

  // Base projection fitted to the container; `proj` = base × view transform (screen space).
  const base = useMemo(() => geoNaturalEarth1().precision(0.5), []);
  const proj = useMemo(() => geoNaturalEarth1().precision(0.5), []);
  const basePath = useMemo(() => geoPath(base), [base]);
  const canvasPath = useMemo(() => geoPath(proj), [proj]);

  const view = useRef<View>({ k: 1, x: 0, y: 0 });
  const fit = useRef({ scale: 1, tx: 0, ty: 0, bounds: [[0, 0], [1, 1]] as [[number, number], [number, number]] });
  const pointers = useRef(new Map<number, PointerRec>());
  const drag = useRef<{ x: number; y: number; moved: number } | null>(null);
  const pinch = useRef<{ dist: number; cx: number; cy: number } | null>(null);
  const raf = useRef(0);
  const dirty = useRef(true);
  const viewportTimer = useRef(0);
  const positions = useRef<Float32Array>(new Float32Array(0));
  const markerPositions = useRef<Float32Array>(new Float32Array(0));
  const hoverRef = useRef<MapHit | null>(null);
  const tween = useRef<{ from: View; to: View; start: number; dur: number } | null>(null);

  const propsRef = useRef({
    aircraft: aircraft ?? [],
    markers: markers ?? [],
    routes: routes ?? [],
    selectedId: selectedId ?? null,
    colors,
    reduced,
    size,
    minZoom,
    maxZoom,
    onViewportChange,
    onHover,
    onClick,
  });

  // ─── Static SVG paths (recomputed only on resize) ──────────

  const paths = useMemo(() => {
    const { width: w, height: h } = size;
    if (w < 2 || h < 2) return null;
    base.fitExtent(
      [
        [PAD, PAD],
        [w - PAD, h - PAD],
      ],
      SPHERE,
    );
    const b = basePath.bounds(SPHERE);
    const t = base.translate();
    fit.current = { scale: base.scale(), tx: t[0], ty: t[1], bounds: [[b[0][0], b[0][1]], [b[1][0], b[1][1]]] };
    return {
      sphere: basePath(SPHERE) ?? "",
      land: basePath(getLand()) ?? "",
      graticule: basePath(GRATICULE) ?? "",
      borders: borderMesh ? (basePath(borderMesh) ?? "") : "",
    };
  }, [size, base, basePath, borderMesh]);

  useEffect(() => {
    if (!borders) return;
    let alive = true;
    loadBorders().then((m) => alive && setBorderMesh(m));
    return () => {
      alive = false;
    };
  }, [borders]);

  // ─── View maths ────────────────────────────────────────────

  const clampView = useCallback((v: View): View => {
    const { width: w, height: h } = propsRef.current.size;
    const [[x0, y0], [x1, y1]] = fit.current.bounds;
    const k = clamp(v.k, propsRef.current.minZoom, propsRef.current.maxZoom);
    const xLo = w * 0.75 - x1 * k;
    const xHi = w * 0.25 - x0 * k;
    const yLo = h * 0.75 - y1 * k;
    const yHi = h * 0.25 - y0 * k;
    return {
      k,
      x: xLo > xHi ? (xLo + xHi) / 2 : clamp(v.x, xLo, xHi),
      y: yLo > yHi ? (yLo + yHi) / 2 : clamp(v.y, yLo, yHi),
    };
  }, []);

  const syncProjection = useCallback(() => {
    const v = view.current;
    const f = fit.current;
    proj.scale(f.scale * v.k).translate([f.tx * v.k + v.x, f.ty * v.k + v.y]);
    gRef.current?.setAttribute("transform", `translate(${v.x} ${v.y}) scale(${v.k})`);
  }, [proj]);

  const currentView = useCallback((): MapView => {
    const { width: w, height: h } = propsRef.current.size;
    const c = proj.invert?.([w / 2, h / 2]);
    return {
      zoom: view.current.k,
      center: c && Number.isFinite(c[0]) && Number.isFinite(c[1]) ? [c[0], c[1]] : [0, 0],
    };
  }, [proj]);

  const computeBBox = useCallback((): MapBBox => {
    const { width: w, height: h } = propsRef.current.size;
    if (w < 2 || h < 2) return WORLD;
    const cols = 9;
    const rows = 7;
    let lomin = Infinity;
    let lomax = -Infinity;
    let lamin = Infinity;
    let lamax = -Infinity;
    let left = false;
    let right = false;
    let top = false;
    let bottom = false;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const sx = (i / (cols - 1)) * w;
        const sy = (j / (rows - 1)) * h;
        const ll = proj.invert?.([sx, sy]);
        let ok = !!ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1]) && Math.abs(ll[0]) <= 180.01 && Math.abs(ll[1]) <= 90.01;
        if (ok && ll) {
          const back = proj([ll[0], ll[1]]);
          ok = !!back && Math.abs(back[0] - sx) < 1.5 && Math.abs(back[1] - sy) < 1.5;
        }
        if (!ok || !ll) {
          if (i === 0) left = true;
          if (i === cols - 1) right = true;
          if (j === 0) top = true;
          if (j === rows - 1) bottom = true;
          continue;
        }
        lomin = Math.min(lomin, ll[0]);
        lomax = Math.max(lomax, ll[0]);
        lamin = Math.min(lamin, ll[1]);
        lamax = Math.max(lamax, ll[1]);
      }
    }
    if (!Number.isFinite(lomin)) return WORLD;
    return {
      lomin: left ? -180 : Math.max(-180, Math.floor(lomin * 100) / 100),
      lomax: right ? 180 : Math.min(180, Math.ceil(lomax * 100) / 100),
      lamin: bottom ? -90 : Math.max(-90, Math.floor(lamin * 100) / 100),
      lamax: top ? 90 : Math.min(90, Math.ceil(lamax * 100) / 100),
    };
  }, [proj]);

  const emitViewport = useCallback(() => {
    window.clearTimeout(viewportTimer.current);
    viewportTimer.current = window.setTimeout(() => {
      propsRef.current.onViewportChange?.(computeBBox(), currentView());
    }, 200);
  }, [computeBBox, currentView]);

  // ─── Canvas layer ──────────────────────────────────────────

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    const p = propsRef.current;
    const { width: w, height: h } = p.size;
    if (!canvas || w < 2 || h < 2) return;
    const ctx = prepareCanvas(canvas, w, h);
    if (!ctx) return;
    const c = p.colors;
    const rm = p.reduced;
    const k = view.current.k;
    ctx.clearRect(0, 0, w, h);
    const path = canvasPath;
    path.context(ctx);
    const project = (pt: [number, number]) => proj(pt) as [number, number] | null;

    // Routes
    for (let i = 0; i < p.routes.length; i++) {
      const r = p.routes[i];
      const color = r.color ?? c.signal;
      const interp = geoInterpolate(r.from, r.to);
      const full = makeLine(r.from, r.to);
      ctx.setLineDash([]);
      ctx.beginPath();
      path(full);
      ctx.strokeStyle = withAlpha(color, 0.22);
      ctx.lineWidth = 4;
      ctx.stroke();
      let dot: [number, number];
      if (typeof r.progress === "number") {
        const pr = clamp(r.progress, 0, 1);
        if (pr > 0.001) {
          ctx.beginPath();
          path(makeLine(r.from, interp(pr)));
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        dot = interp(pr);
      } else {
        ctx.beginPath();
        path(full);
        ctx.strokeStyle = withAlpha(color, 0.9);
        ctx.lineWidth = 1.4;
        if (!rm) {
          ctx.setLineDash([3, 8]);
          ctx.lineDashOffset = -((t / 28) % 11);
        }
        ctx.stroke();
        ctx.setLineDash([]);
        dot = interp(easeInOutSine(rm ? 0.5 : (t / 4200 + i * 0.29) % 1));
      }
      const pt = proj(dot);
      if (pt) {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 2.6, 0, TAU);
        ctx.fillStyle = c.fg;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Markers
    const mk = p.markers;
    if (markerPositions.current.length !== mk.length * 2) markerPositions.current = new Float32Array(mk.length * 2);
    const mpos = markerPositions.current;
    const labelFont = `500 11px ${c.fontMono}`;
    for (let i = 0; i < mk.length; i++) {
      const m = mk[i];
      const pt = proj([m.lon, m.lat]);
      if (!pt) {
        mpos[i * 2] = -9999;
        mpos[i * 2 + 1] = -9999;
        continue;
      }
      const [x, y] = pt;
      mpos[i * 2] = x;
      mpos[i * 2 + 1] = y;
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      const color = m.color ?? c.signal;
      const radius = m.size ?? 3.5;
      const sel = !!m.id && m.id === p.selectedId;
      ctx.beginPath();
      ctx.arc(x, y, radius + (sel ? 5 : 3), 0, TAU);
      ctx.fillStyle = withAlpha(color, sel ? 0.4 : 0.25);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, TAU);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = c.bg;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (m.label && (k >= 2.5 || sel)) {
        drawLabel(ctx, m.label, x + radius + 5, y, { font: labelFont, fg: c.fg, bg: withAlpha(c.bg, 0.72) });
      }
    }

    // Aircraft
    const ac = p.aircraft;
    if (positions.current.length !== ac.length * 2) positions.current = new Float32Array(ac.length * 2);
    const pos = positions.current;
    const glyph = clamp(7 + Math.log2(k) * 1.6, 7, 15);
    const hovered = hoverRef.current;
    for (let i = 0; i < ac.length; i++) {
      const a = ac[i];
      const pt = proj([a.lon, a.lat]);
      if (!pt || pt[0] < -20 || pt[1] < -20 || pt[0] > w + 20 || pt[1] > h + 20) {
        pos[i * 2] = -9999;
        pos[i * 2 + 1] = -9999;
        continue;
      }
      pos[i * 2] = pt[0];
      pos[i * 2 + 1] = pt[1];
      const ang = screenHeading(project, a.lon, a.lat, a.heading);
      if (ang == null) continue;
      const sel = a.id === p.selectedId || (hovered?.kind === "aircraft" && hovered.index === i);
      if (sel) {
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], glyph + 4, 0, TAU);
        ctx.fillStyle = withAlpha(a.color ?? c.sky, 0.25);
        ctx.fill();
        ctx.strokeStyle = a.color ?? c.sky;
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      drawPlane(ctx, pt[0], pt[1], ang, sel ? glyph * 1.35 : glyph, a.color ?? c.sky, sel ? 1 : 0.9);
      if (a.label && (sel || k >= 8)) {
        drawLabel(ctx, a.label, pt[0] + glyph, pt[1], { font: labelFont, fg: c.fg, bg: withAlpha(c.bg, 0.72) });
      }
    }
  }, [proj, canvasPath]);

  const animating = useCallback(() => {
    const p = propsRef.current;
    return (!p.reduced && p.routes.length > 0) || !!tween.current;
  }, []);

  const schedule = useCallback(() => {
    if (raf.current) return;
    const tick = (t: number) => {
      raf.current = 0;
      if (tween.current) {
        const tw = tween.current;
        const e = easeOutCubic(Math.min(1, (t - tw.start) / tw.dur));
        const k = Math.exp(Math.log(tw.from.k) + (Math.log(tw.to.k) - Math.log(tw.from.k)) * e);
        view.current = { k, x: tw.from.x + (tw.to.x - tw.from.x) * e, y: tw.from.y + (tw.to.y - tw.from.y) * e };
        if (e >= 1) {
          tween.current = null;
          view.current = clampView(tw.to);
          emitViewport();
        }
        syncProjection();
      }
      draw(t);
      dirty.current = false;
      if (animating()) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [animating, clampView, draw, emitViewport, syncProjection]);

  const invalidate = useCallback(() => {
    dirty.current = true;
    schedule();
  }, [schedule]);

  const applyView = useCallback(
    (next: View) => {
      view.current = clampView(next);
      syncProjection();
      invalidate();
      emitViewport();
    },
    [clampView, syncProjection, invalidate, emitViewport],
  );

  const zoomAt = useCallback(
    (px: number, py: number, factor: number) => {
      const v = view.current;
      const k2 = clamp(v.k * factor, propsRef.current.minZoom, propsRef.current.maxZoom);
      const f = k2 / v.k;
      applyView({ k: k2, x: px - (px - v.x) * f, y: py - (py - v.y) * f });
    },
    [applyView],
  );

  const flyTo = useCallback(
    (center: [number, number], zoom?: number) => {
      const { width: w, height: h } = propsRef.current.size;
      const f = fit.current;
      const k = clamp(zoom ?? view.current.k, propsRef.current.minZoom, propsRef.current.maxZoom);
      // Base projection with the fitted scale/translate gives the k=1 screen position.
      base.scale(f.scale).translate([f.tx, f.ty]);
      const p0 = base(center);
      if (!p0) return;
      const target = clampView({ k, x: w / 2 - p0[0] * k, y: h / 2 - p0[1] * k });
      if (propsRef.current.reduced) {
        applyView(target);
        return;
      }
      tween.current = { from: { ...view.current }, to: target, start: performance.now(), dur: 650 };
      schedule();
    },
    [applyView, base, clampView, schedule],
  );

  const reset = useCallback(() => {
    tween.current = null;
    applyView({ k: 1, x: 0, y: 0 });
  }, [applyView]);

  useImperativeHandle(ref, () => ({ flyTo, reset, getView: currentView }), [flyTo, reset, currentView]);

  // ─── Effects ───────────────────────────────────────────────

  useEffect(() => {
    propsRef.current = {
      aircraft: aircraft ?? [],
      markers: markers ?? [],
      routes: routes ?? [],
      selectedId: selectedId ?? null,
      colors,
      reduced,
      size,
      minZoom,
      maxZoom,
      onViewportChange,
      onHover,
      onClick,
    };
    invalidate();
  }, [aircraft, markers, routes, selectedId, colors, reduced, size, minZoom, maxZoom, onViewportChange, onHover, onClick, invalidate]);

  // Re-fit on resize: keep the current zoom/centre proportionally.
  useEffect(() => {
    if (!paths) return;
    view.current = clampView(view.current);
    syncProjection();
    invalidate();
    emitViewport();
  }, [paths, clampView, syncProjection, invalidate, emitViewport]);

  const lastFocus = useRef<typeof focus>(null);
  useEffect(() => {
    if (!focus || !paths || lastFocus.current === focus) return;
    lastFocus.current = focus;
    flyTo(focus.center, focus.zoom);
  }, [focus, paths, flyTo]);

  // Wheel zoom must be non-passive to stop the page scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0022));
      tween.current = null;
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      window.clearTimeout(viewportTimer.current);
    };
  }, []);

  // ─── Hit testing & pointer handling ────────────────────────

  const hitTest = (x: number, y: number): MapHit | null => {
    const p = propsRef.current;
    const pos = positions.current;
    let best = -1;
    let bestD = 121;
    for (let i = 0; i < p.aircraft.length; i++) {
      const dx = pos[i * 2] - x;
      const dy = pos[i * 2 + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) return { kind: "aircraft", index: best, item: p.aircraft[best] };
    const mpos = markerPositions.current;
    bestD = 121;
    for (let i = 0; i < p.markers.length; i++) {
      const dx = mpos[i * 2] - x;
      const dy = mpos[i * 2 + 1] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best >= 0) return { kind: "marker", index: best, item: p.markers[best] };
    return null;
  };

  const sameHit = (a: MapHit | null, b: MapHit | null) => a?.kind === b?.kind && a?.index === b?.index;

  const setHovered = (hit: MapHit | null, x: number, y: number) => {
    if (sameHit(hoverRef.current, hit)) {
      if (hit) setHover((h) => (h ? { ...h, x, y } : h));
      return;
    }
    hoverRef.current = hit;
    setHover(hit ? { hit, x, y } : null);
    propsRef.current.onHover?.(hit, hit ? { x, y } : null);
    if (canvasRef.current) canvasRef.current.style.cursor = hit ? "pointer" : "";
    invalidate();
  };

  const local = (e: ReactPointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    return { x: e.clientX - (rect?.left ?? 0), y: e.clientY - (rect?.top ?? 0) };
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    const pt = local(e);
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, pt);
    tween.current = null;
    if (pointers.current.size === 1) {
      drag.current = { x: pt.x, y: pt.y, moved: 0 };
    } else if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
      drag.current = null;
      setHovered(null, 0, 0);
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pt = local(e);
    if (!pointers.current.has(e.pointerId)) {
      if (e.pointerType === "mouse" || e.pointerType === "pen") setHovered(hitTest(pt.x, pt.y), pt.x, pt.y);
      return;
    }
    pointers.current.set(e.pointerId, pt);
    if (pointers.current.size >= 2 && pinch.current) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const v = view.current;
      const factor = pinch.current.dist > 0 ? dist / pinch.current.dist : 1;
      const k2 = clamp(v.k * factor, propsRef.current.minZoom, propsRef.current.maxZoom);
      const f = k2 / v.k;
      applyView({
        k: k2,
        x: cx - (pinch.current.cx - v.x) * f,
        y: cy - (pinch.current.cy - v.y) * f,
      });
      pinch.current = { dist, cx, cy };
    } else if (drag.current) {
      const dx = pt.x - drag.current.x;
      const dy = pt.y - drag.current.y;
      drag.current = { x: pt.x, y: pt.y, moved: drag.current.moved + Math.abs(dx) + Math.abs(dy) };
      const v = view.current;
      applyView({ k: v.k, x: v.x + dx, y: v.y + dy });
    }
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const pt = local(e);
    const wasDrag = drag.current;
    pointers.current.delete(e.pointerId);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const [rest] = Array.from(pointers.current.values());
      drag.current = { x: rest.x, y: rest.y, moved: 10 };
      return;
    }
    drag.current = null;
    if (wasDrag && wasDrag.moved < 4 && e.type === "pointerup") {
      const hit = hitTest(pt.x, pt.y);
      const ll = proj.invert?.([pt.x, pt.y]);
      const lonlat: [number, number] | null = ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1]) ? [ll[0], ll[1]] : null;
      propsRef.current.onClick?.(hit, lonlat);
    }
  };

  const onKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const { width: w, height: h } = propsRef.current.size;
    const v = view.current;
    const step = 48;
    switch (e.key) {
      case "+":
      case "=":
        zoomAt(w / 2, h / 2, 1.5);
        break;
      case "-":
      case "_":
        zoomAt(w / 2, h / 2, 1 / 1.5);
        break;
      case "0":
        reset();
        break;
      case "ArrowLeft":
        applyView({ ...v, x: v.x + step });
        break;
      case "ArrowRight":
        applyView({ ...v, x: v.x - step });
        break;
      case "ArrowUp":
        applyView({ ...v, y: v.y + step });
        break;
      case "ArrowDown":
        applyView({ ...v, y: v.y - step });
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  const tooltipStyle = useMemo(() => {
    if (!hover) return undefined;
    const { width: w, height: h } = size;
    const flipX = hover.x > w - 200;
    const flipY = hover.y > h - 120;
    return {
      left: flipX ? undefined : hover.x + 14,
      right: flipX ? w - hover.x + 14 : undefined,
      top: flipY ? undefined : hover.y + 14,
      bottom: flipY ? h - hover.y + 14 : undefined,
    } as const;
  }, [hover, size]);

  const btn =
    "flex h-9 w-9 items-center justify-center rounded-lg border border-panel-border bg-bg-elev-2/90 text-fg-muted backdrop-blur transition-colors hover:bg-bg-elev-3 hover:text-fg";

  return (
    <div
      ref={containerRef}
      role="application"
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn("relative h-full w-full min-h-[200px] touch-none select-none overflow-hidden bg-bg-elev-1 dot-grid", className)}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={(e) => {
        if (!pointers.current.has(e.pointerId)) setHovered(null, 0, 0);
      }}
      onDoubleClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        zoomAt(e.clientX - rect.left, e.clientY - rect.top, 2);
      }}
      onKeyDown={onKeyDown}
    >
      <svg className="absolute inset-0 h-full w-full" width={size.width || undefined} height={size.height || undefined} aria-hidden>
        <g ref={gRef}>
          {paths && (
            <>
              <path d={paths.sphere} className="fill-bg-elev-2 stroke-panel-border-strong" vectorEffect="non-scaling-stroke" />
              {graticule && <path d={paths.graticule} className="fill-none stroke-fg/[0.06]" vectorEffect="non-scaling-stroke" />}
              <path d={paths.land} className="fill-fg-faint stroke-fg-subtle/50" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
              {borders && paths.borders && (
                <path d={paths.borders} className="fill-none stroke-bg-elev-1/70" strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
              )}
            </>
          )}
        </g>
      </svg>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden />

      {hover && renderTooltip && (
        <div
          className="pointer-events-none absolute z-20 max-w-[220px] rounded-lg border border-panel-border bg-bg-elev-2/95 px-2.5 py-1.5 text-xs text-fg shadow-panel backdrop-blur"
          style={tooltipStyle}
          role="tooltip"
        >
          {renderTooltip(hover.hit)}
        </div>
      )}

      {controls && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className={btn} aria-label="Zoom in" onClick={() => zoomAt(size.width / 2, size.height / 2, 1.6)}>
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" className={btn} aria-label="Zoom out" onClick={() => zoomAt(size.width / 2, size.height / 2, 1 / 1.6)}>
            <Minus className="h-4 w-4" />
          </button>
          <button type="button" className={btn} aria-label="Reset view" onClick={reset}>
            <LocateFixed className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}
