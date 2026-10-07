"use client";

/**
 * Shared plumbing for the canvas / SVG visualisations:
 * element sizing (ResizeObserver), reduced-motion, theme colours read from CSS variables,
 * and a few colour helpers for canvas work (canvas can't read `var(--x)` on its own).
 */

import { useEffect, useRef, useState, type RefObject } from "react";

export interface Size {
  width: number;
  height: number;
}

/** Tracks the rendered size of an element. SSR-safe: returns 0×0 until mounted. */
export function useElementSize<T extends HTMLElement>(ref: RefObject<T | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      setSize((s) => (s.width === width && s.height === height ? s : { width, height }));
    };
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

/** `prefers-reduced-motion: reduce`, live. False during SSR. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

export interface ThemeColors {
  bg: string;
  bgElev1: string;
  bgElev2: string;
  bgElev3: string;
  panelBorder: string;
  panelBorderStrong: string;
  fg: string;
  fgMuted: string;
  fgSubtle: string;
  fgFaint: string;
  signal: string;
  aurora: string;
  rose: string;
  violet: string;
  gold: string;
  sky: string;
  fontMono: string;
  fontSans: string;
  fontDisplay: string;
}

const VAR_MAP: Record<keyof ThemeColors, string> = {
  bg: "--bg",
  bgElev1: "--bg-elev-1",
  bgElev2: "--bg-elev-2",
  bgElev3: "--bg-elev-3",
  panelBorder: "--panel-border",
  panelBorderStrong: "--panel-border-strong",
  fg: "--fg",
  fgMuted: "--fg-muted",
  fgSubtle: "--fg-subtle",
  fgFaint: "--fg-faint",
  signal: "--signal",
  aurora: "--aurora",
  rose: "--rose",
  violet: "--violet",
  gold: "--gold",
  sky: "--sky",
  fontMono: "--font-mono",
  fontSans: "--font-sans",
  fontDisplay: "--font-display",
};

/** Mirrors the dark palette in globals.css — used before mount / on the server. */
export const DARK_THEME: ThemeColors = {
  bg: "#07090f",
  bgElev1: "#0c1018",
  bgElev2: "#121826",
  bgElev3: "#1a2234",
  panelBorder: "rgba(255,255,255,0.08)",
  panelBorderStrong: "rgba(255,255,255,0.16)",
  fg: "#eef2ff",
  fgMuted: "#a9b2c8",
  fgSubtle: "#6b7590",
  fgFaint: "#3d4660",
  signal: "#ff8a3d",
  aurora: "#5eead4",
  rose: "#fb7185",
  violet: "#a78bfa",
  gold: "#f5c76a",
  sky: "#7dd3fc",
  fontMono: "ui-monospace, Menlo, monospace",
  fontSans: "ui-sans-serif, system-ui, sans-serif",
  fontDisplay: "Georgia, serif",
};

/** Read the design tokens as resolved by the browser (works for both themes). */
export function readThemeColors(el?: Element | null): ThemeColors {
  if (typeof window === "undefined") return DARK_THEME;
  const target = el ?? document.documentElement;
  const cs = getComputedStyle(target);
  const out = { ...DARK_THEME };
  (Object.keys(VAR_MAP) as (keyof ThemeColors)[]).forEach((key) => {
    const v = cs.getPropertyValue(VAR_MAP[key]).trim();
    if (v) out[key] = v;
  });
  return out;
}

/**
 * Theme colours as React state. Re-reads when `data-theme` flips on <html> or the
 * OS colour scheme changes, so canvases repaint in the right palette.
 */
export function useThemeColors(ref?: RefObject<HTMLElement | null>): ThemeColors {
  const [colors, setColors] = useState<ThemeColors>(DARK_THEME);
  const refObj = useRef(ref);
  useEffect(() => {
    const read = () => setColors(readThemeColors(refObj.current?.current ?? null));
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "class", "style"] });
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    mq?.addEventListener("change", read);
    return () => {
      mo.disconnect();
      mq?.removeEventListener("change", read);
    };
  }, []);
  return colors;
}

/** Parse `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()` / `rgba()` into channels. */
export function parseColor(input: string): [number, number, number, number] | null {
  const s = input.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex[0] + hex[0], 16);
      const g = parseInt(hex[1] + hex[1], 16);
      const b = parseInt(hex[2] + hex[2], 16);
      const a = hex.length === 4 ? parseInt(hex[3] + hex[3], 16) / 255 : 1;
      return [r, g, b, a];
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
      return [r, g, b, a];
    }
    return null;
  }
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/i.exec(s);
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? parseFloat(m[4]) / 100 : parseFloat(m[4]);
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), a];
  }
  return null;
}

/** `withAlpha("#5eead4", 0.3)` → `rgba(94,234,212,0.3)`. Unknown formats fall back to the input. */
export function withAlpha(color: string, alpha: number): string {
  const c = parseColor(color);
  if (!c) return color;
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, alpha * c[3])).toFixed(3)})`;
}

/** Device pixel ratio capped at 2 — retina crispness without 3× fill cost on phones. */
export function getDpr(): number {
  if (typeof window === "undefined") return 1;
  return Math.min(window.devicePixelRatio || 1, 2);
}

/** Size a canvas's backing store for the DPR and reset its transform to CSS pixels. */
export function prepareCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D | null {
  const dpr = getDpr();
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

export const TAU = Math.PI * 2;
export const HALF_PI = Math.PI / 2;

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeInOutSine(t: number): number {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
