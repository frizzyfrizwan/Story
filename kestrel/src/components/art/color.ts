/**
 * Tiny colour maths for procedural artwork. Inputs are the hex strings stored in data
 * (`art.from`, `art.to`, carrier colours); outputs are hex. Unknown formats pass through.
 */

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb | null {
  const s = hex.trim().replace(/^#/, "");
  if (s.length === 3 || s.length === 4) {
    return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
  }
  if (s.length === 6 || s.length === 8) {
    return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
  }
  return null;
}

export function rgbToHex([r, g, b]: Rgb): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(255, v)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Linear mix in sRGB: t = 0 → a, t = 1 → b. */
export function mix(a: string, b: string, t: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  if (!ca || !cb) return a;
  return rgbToHex([ca[0] + (cb[0] - ca[0]) * t, ca[1] + (cb[1] - ca[1]) * t, ca[2] + (cb[2] - ca[2]) * t]);
}

export const shade = (hex: string, t: number) => mix(hex, "#000000", t);
export const tint = (hex: string, t: number) => mix(hex, "#ffffff", t);

/** WCAG relative luminance, 0–1. Unparsable → 0.5. */
export function luminance(hex: string): number {
  const c = hexToRgb(hex);
  if (!c) return 0.5;
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
}

/** Pick light or dark "ink" that stays readable over the given colours. */
export function inkFor(...hexes: string[]): { ink: string; muted: string; isDark: boolean } {
  const avg = hexes.length ? hexes.reduce((s, h) => s + luminance(h), 0) / hexes.length : 0;
  const light = avg < 0.45;
  return light
    ? { ink: "rgba(255,255,255,0.94)", muted: "rgba(255,255,255,0.62)", isDark: true }
    : { ink: "rgba(12,14,24,0.92)", muted: "rgba(12,14,24,0.58)", isDark: false };
}

export function withAlphaHex(hex: string, alpha: number): string {
  const c = hexToRgb(hex);
  if (!c) return hex;
  return `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, alpha))})`;
}
