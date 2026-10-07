/**
 * Geography data + small drawing helpers shared by <Globe> and <WorldMap>.
 * Land comes from world-atlas (Natural Earth 110m, ~55 KB TopoJSON) — no tile server, no images.
 */

import { feature, mesh } from "topojson-client";
import land110 from "world-atlas/land-110m.json";
import type { FeatureCollection, Geometry, MultiLineString } from "geojson";

type Topology = Parameters<typeof feature>[0];
type GeometryObject = NonNullable<Parameters<typeof mesh>[1]>;

let landCache: FeatureCollection<Geometry> | null = null;

/** Land polygons as a GeoJSON FeatureCollection (memoised). */
export function getLand(): FeatureCollection<Geometry> {
  if (!landCache) {
    const topo = land110 as unknown as Topology;
    landCache = feature(topo, "land") as unknown as FeatureCollection<Geometry>;
  }
  return landCache;
}

let bordersPromise: Promise<MultiLineString> | null = null;

/** Country borders (interior mesh) — loaded lazily because countries-110m is ~110 KB. */
export function loadBorders(): Promise<MultiLineString> {
  if (!bordersPromise) {
    bordersPromise = import("world-atlas/countries-110m.json").then((mod) => {
      const topo = mod.default as unknown as Topology;
      const countries = topo.objects.countries as GeometryObject;
      return mesh(topo, countries, (a, b) => a !== b);
    });
  }
  return bordersPromise;
}

export const SPHERE = { type: "Sphere" } as const;

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

/**
 * Destination point `distanceDeg` degrees along `headingDeg` (clockwise from north) from [lon, lat].
 * Used to turn a compass heading into an on-screen rotation under any projection.
 */
export function destinationPoint(lon: number, lat: number, headingDeg: number, distanceDeg = 0.5): [number, number] {
  const φ1 = lat * RAD;
  const λ1 = lon * RAD;
  const θ = headingDeg * RAD;
  const δ = distanceDeg * RAD;
  const sinφ1 = Math.sin(φ1);
  const cosφ1 = Math.cos(φ1);
  const sinδ = Math.sin(δ);
  const cosδ = Math.cos(δ);
  const φ2 = Math.asin(sinφ1 * cosδ + cosφ1 * sinδ * Math.cos(θ));
  const λ2 = λ1 + Math.atan2(Math.sin(θ) * sinδ * cosφ1, cosδ - sinφ1 * Math.sin(φ2));
  return [(((λ2 * DEG + 540) % 360) - 180), φ2 * DEG];
}

/** Top-down airliner silhouette, nose pointing up (−y), roughly 12 units tall, centred on 0,0. */
export const PLANE_PATH =
  "M0 -6 L1 -4.6 L1.2 -1.6 L6 1.2 L6 2 L1.2 1.2 L1 3.6 L2.6 4.8 L2.6 5.4 L0 4.9 L-2.6 5.4 L-2.6 4.8 L-1 3.6 L-1.2 1.2 L-6 2 L-6 1.2 L-1.2 -1.6 L-1 -4.6 Z";

let planeCache: Path2D | null = null;
export function planePath2D(): Path2D {
  if (!planeCache) planeCache = new Path2D(PLANE_PATH);
  return planeCache;
}

/** Draw the plane glyph at (x, y) rotated by `angleRad` (0 = nose up), scaled so it is `size` px tall. */
export function drawPlane(ctx: CanvasRenderingContext2D, x: number, y: number, angleRad: number, size: number, fill: string, alpha = 1) {
  const s = size / 12;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.scale(s, s);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.fill(planePath2D());
  ctx.restore();
}

/** Screen-space rotation (radians, 0 = nose up) for a heading at a point under `project`. */
export function screenHeading(
  project: (p: [number, number]) => [number, number] | null,
  lon: number,
  lat: number,
  headingDeg: number,
): number | null {
  const a = project([lon, lat]);
  const b = project(destinationPoint(lon, lat, headingDeg, 0.4));
  if (!a || !b) return null;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return 0;
  return Math.atan2(dy, dx) + Math.PI / 2;
}

export function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

/** Draw a mono label with a translucent pill behind it. */
export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: { font: string; fg: string; bg: string; align?: "left" | "center" },
) {
  ctx.font = opts.font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  const padX = 5;
  const w = ctx.measureText(text).width + padX * 2;
  const h = 16;
  const left = opts.align === "center" ? x - w / 2 : x;
  roundRectPath(ctx, left, y - h / 2, w, h, 4);
  ctx.fillStyle = opts.bg;
  ctx.fill();
  ctx.fillStyle = opts.fg;
  ctx.fillText(text, left + padX, y + 0.5);
}
