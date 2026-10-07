import { fmtCompact, fmtCpp, fmtInt, fmtUsd } from "@/lib/utils";

/**
 * Serialisable number formats shared by server and client components.
 * Server components must use a key (functions cannot cross the server → client boundary);
 * client components may pass a function.
 */
export type NumberFormatKey = "int" | "compact" | "usd" | "cpp" | "percent";
export type NumberFormat = NumberFormatKey | ((n: number) => string);

const FORMATS: Record<NumberFormatKey, (n: number) => string> = {
  int: fmtInt,
  compact: fmtCompact,
  usd: fmtUsd,
  cpp: fmtCpp,
  percent: (n) => `${n.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
};

export function resolveNumberFormat(format: NumberFormat | undefined, decimals = 0): (n: number) => string {
  if (typeof format === "function") return format;
  if (format && FORMATS[format]) return FORMATS[format];
  return (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
