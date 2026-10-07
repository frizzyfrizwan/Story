"use client";

import Link from "next/link";
import { ArrowUpRight, ExternalLink } from "lucide-react";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Assistant-message markdown. GFM (tables, task lists, strikethrough), no raw
 * HTML, in-app routes become Next links, numeric table columns are set in
 * mono and right-aligned, and a streaming caret rides the end of the text.
 */

/** Private-use character appended to the source while streaming; rendered as the caret. */
const CARET = "";

// ─── remark plugin: in-app links + caret ────────────────────────

interface MdNode {
  type: string;
  value?: string;
  url?: string;
  title?: string | null;
  children?: MdNode[];
  data?: Record<string, unknown>;
}

const IN_APP_ROUTES = "search|hotels|programs|transfers|wallet|alerts|explore|live|finds|trips|settings|pricing|concierge|cards";
const IN_APP_PATH = new RegExp(`(?<![\\w/])(/(?:${IN_APP_ROUTES})\\b(?:/[\\w-]+)*(?:\\?[^\\s)\\]<>"'\`]*)?)`, "g");

const text = (value: string): MdNode => ({ type: "text", value });
const caretNode = (): MdNode => ({ type: "text", value: "", data: { hName: "span", hProperties: { className: ["md-caret"] } } });

function splitCaret(value: string): MdNode[] {
  const idx = value.indexOf(CARET);
  if (idx === -1) return [text(value)];
  const out: MdNode[] = [];
  if (idx > 0) out.push(text(value.slice(0, idx)));
  out.push(caretNode());
  const rest = value.slice(idx + 1).replace(CARET, "");
  if (rest) out.push(text(rest));
  return out;
}

function splitText(value: string, linkify: boolean): MdNode[] {
  const out: MdNode[] = [];
  let last = 0;
  if (linkify) {
    for (const m of value.matchAll(IN_APP_PATH)) {
      const start = m.index ?? 0;
      let url = m[1];
      const trail = /[.,;:!?]+$/.exec(url);
      if (trail) url = url.slice(0, -trail[0].length);
      if (!url || url.includes(CARET)) continue;
      if (start > last) out.push(...splitCaret(value.slice(last, start)));
      out.push({ type: "link", url, title: null, children: [text(url)] });
      last = start + url.length;
    }
  }
  if (last < value.length) out.push(...splitCaret(value.slice(last)));
  return out;
}

function walk(node: MdNode, inLink: boolean): void {
  if (!node.children) return;
  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type === "text" && typeof child.value === "string") {
      next.push(...splitText(child.value, !inLink));
    } else {
      walk(child, inLink || child.type === "link" || child.type === "linkReference");
      next.push(child);
    }
  }
  node.children = next;
}

/** Turns bare `/search?…` style paths into links and the caret marker into a `span.md-caret`. */
function remarkKestrel() {
  return (tree: unknown) => {
    walk(tree as MdNode, false);
  };
}

// ─── hast helpers (tables, link labels) ────────────────────────

type HastElement = NonNullable<ExtraProps["node"]>;
interface HNode {
  type: string;
  tagName?: string;
  value?: string;
  children?: HNode[];
}

function textOf(node: HNode | undefined): string {
  if (!node) return "";
  if (node.type === "text") return node.value ?? "";
  return (node.children ?? []).map(textOf).join("");
}

const NUMERIC_CELL = /^\s*[$€£]?[+\-–−]?\d[\d,.]*\s*(?:¢|%|k|K|M|×|x)?\s*$|^\s*[—–\-?]\s*$/;

interface CellMeta {
  numeric: boolean;
}

/** Column-level analysis so numeric columns (miles, taxes, ¢/pt) align right in mono. */
function analyzeTable(node: HastElement | undefined): Map<HNode, CellMeta> {
  const map = new Map<HNode, CellMeta>();
  if (!node) return map;
  const root = node as unknown as HNode;
  const rows: HNode[] = [];
  for (const section of root.children ?? []) {
    if (section.tagName === "tr") rows.push(section);
    else for (const r of section.children ?? []) if (r.tagName === "tr") rows.push(r);
  }
  const bodyText: string[][] = [];
  const cells: { node: HNode; col: number }[] = [];
  for (const row of rows) {
    let col = 0;
    for (const cell of row.children ?? []) {
      if (cell.tagName !== "th" && cell.tagName !== "td") continue;
      cells.push({ node: cell, col });
      if (cell.tagName === "td") (bodyText[col] ??= []).push(textOf(cell).trim());
      col += 1;
    }
  }
  const numericCols = bodyText.map((texts) => {
    const filled = texts.filter(Boolean);
    return filled.length > 0 && filled.every((t) => NUMERIC_CELL.test(t));
  });
  for (const c of cells) map.set(c.node, { numeric: Boolean(numericCols[c.col]) });
  return map;
}

const TableContext = createContext<Map<HNode, CellMeta> | null>(null);
const PreContext = createContext(false);

/** Human label for an auto-linked in-app path (`/search?from=JFK&to=TYO…` → "Open search · JFK → TYO"). */
function routeLabel(href: string): string {
  let url: URL;
  try {
    url = new URL(href, "https://kestrel.local");
  } catch {
    return href;
  }
  const p = url.searchParams;
  const seg = url.pathname.split("/").filter(Boolean);
  switch (seg[0]) {
    case "search": {
      const from = p.get("from")?.replace(/,/g, "/");
      const to = p.get("to")?.replace(/,/g, "/");
      return from && to ? `Open search · ${from} → ${to}` : "Open search";
    }
    case "hotels": {
      const city = p.get("city");
      return city ? `Open hotels · ${city}` : "Open hotels";
    }
    case "programs":
      return seg[1] ? `Program page · ${seg[1]}` : "Programs";
    case "wallet":
      return "Open wallet";
    case "alerts":
      return "Set an alert";
    case "live":
      return "Live flights";
    case "transfers":
      return "Transfer partners";
    case "explore":
      return "Explore";
    default:
      return href;
  }
}

function stripCaret(children: ReactNode): ReactNode {
  if (typeof children === "string") return children.replace(CARET, "");
  if (Array.isArray(children)) return children.map((c) => (typeof c === "string" ? c.replace(CARET, "") : c));
  return children;
}

// ─── Components ─────────────────────────────────────────────────

type Props<K extends keyof React.JSX.IntrinsicElements> = React.JSX.IntrinsicElements[K] & ExtraProps;

const LINK =
  "inline-flex max-w-full items-center gap-1 rounded-[4px] text-sky underline decoration-sky/35 underline-offset-[3px] transition-colors hover:decoration-sky focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal [&_svg]:size-3.5 [&_svg]:shrink-0";
const ACTION_LINK =
  "my-0.5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-sky/25 bg-sky-soft px-2.5 py-0.5 text-[13px] font-medium text-sky no-underline transition-colors hover:border-sky/50 hover:bg-sky/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal [&_svg]:size-3.5 [&_svg]:shrink-0";

function MdLink({ href = "", title, children, node }: Props<"a">) {
  const internal = href.startsWith("/") && !href.startsWith("//");
  const label = textOf(node as unknown as HNode);
  const auto = internal && label === href;
  if (internal) {
    return (
      <Link href={href} title={title ?? (auto ? href : undefined)} className={auto ? ACTION_LINK : LINK}>
        {auto ? routeLabel(href) : children}
        <ArrowUpRight aria-hidden="true" />
      </Link>
    );
  }
  return (
    <a href={href} title={title} target="_blank" rel="noopener noreferrer" className={LINK}>
      {children}
      <ExternalLink aria-hidden="true" />
    </a>
  );
}

function MdTable({ node, children }: Props<"table">) {
  const meta = useMemo(() => analyzeTable(node), [node]);
  return (
    <TableContext.Provider value={meta}>
      <div className="my-4 overflow-x-auto rounded-[var(--radius)] border border-panel-border bg-bg-elev-1/60 scrollbar-thin">
        <table className="w-full border-collapse text-[13px] leading-snug">{children}</table>
      </div>
    </TableContext.Provider>
  );
}

function alignClass(align: string | undefined, numeric: boolean): string {
  if (align === "center") return "text-center";
  if (align === "right" || (numeric && align !== "left")) return "text-right";
  return "text-left";
}

function MdTh({ node, children, align }: Props<"th">) {
  const meta = useContext(TableContext)?.get(node as unknown as HNode);
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap border-b border-panel-border-strong px-3 py-2 font-mono text-[10.5px] font-medium uppercase tracking-[0.14em] text-fg-subtle",
        alignClass(align, meta?.numeric ?? false),
      )}
    >
      {children}
    </th>
  );
}

function MdTd({ node, children, align }: Props<"td">) {
  const meta = useContext(TableContext)?.get(node as unknown as HNode);
  const numeric = meta?.numeric ?? false;
  return (
    <td
      className={cn(
        "border-b border-panel-border px-3 py-2 align-top text-fg",
        numeric ? "whitespace-nowrap font-mono tnum" : "min-w-[9rem]",
        alignClass(align, numeric),
      )}
    >
      {children}
    </td>
  );
}

function MdTr({ children }: Props<"tr">) {
  return <tr className="transition-colors last:[&>td]:border-b-0 hover:bg-fg/3">{children}</tr>;
}

function MdPre({ children }: Props<"pre">) {
  return (
    <PreContext.Provider value={true}>
      <pre className="my-4 overflow-x-auto rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 px-4 py-3.5 font-mono text-[12.5px] leading-relaxed text-fg scrollbar-thin">
        {children}
      </pre>
    </PreContext.Provider>
  );
}

function MdCode({ children, className }: Props<"code">) {
  const inPre = useContext(PreContext);
  const content = stripCaret(children);
  if (inPre) return <code className={cn("block", className)}>{content}</code>;
  return <code className="rounded-[5px] border border-panel-border bg-fg/6 px-1.5 py-[1px] font-mono text-[0.86em] text-fg">{content}</code>;
}

function MdSpan({ className, children }: Props<"span">) {
  if (typeof className === "string" && className.includes("md-caret")) {
    return (
      <span
        aria-hidden="true"
        className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[0.18em] rounded-sm bg-signal align-baseline motion-safe:animate-pulse-soft"
      />
    );
  }
  return <span className={className}>{children}</span>;
}

const components: Components = {
  a: MdLink,
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-fg-subtle first:mt-0 last:mb-0">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-[0.9em] marker:text-fg-subtle first:mt-0 last:mb-0">{children}</ol>,
  li: ({ children }) => <li className="pl-1 [&>p]:my-1">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-fg-subtle line-through">{children}</del>,
  h1: ({ children }) => <h2 className="mb-2 mt-5 font-display text-xl leading-tight tracking-tight text-fg first:mt-0">{children}</h2>,
  h2: ({ children }) => <h2 className="mb-2 mt-5 font-display text-xl leading-tight tracking-tight text-fg first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-4 font-display text-lg leading-tight tracking-tight text-fg first:mt-0">{children}</h3>,
  h4: ({ children }) => <h4 className="mb-1 mt-4 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-fg-subtle first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-1 mt-3 text-sm font-semibold text-fg first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-1 mt-3 text-sm font-semibold text-fg-muted first:mt-0">{children}</h6>,
  blockquote: ({ children }) => <blockquote className="my-3 border-l-2 border-violet/50 pl-4 text-fg-muted [&>p]:my-1">{children}</blockquote>,
  hr: () => <hr className="hairline my-5 border-0" />,
  table: MdTable,
  thead: ({ children }) => <thead className="bg-bg-elev-2/60">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: MdTr,
  th: MdTh,
  td: MdTd,
  pre: MdPre,
  code: MdCode,
  span: MdSpan,
  input: ({ checked }) => (
    <span
      aria-hidden="true"
      className={cn(
        "mr-1.5 inline-grid size-3.5 translate-y-[2px] place-items-center rounded-[4px] border text-[9px]",
        checked ? "border-aurora/50 bg-aurora-soft text-aurora" : "border-panel-border-strong",
      )}
    >
      {checked ? "✓" : ""}
    </span>
  ),
};

const DISALLOWED = ["img", "script", "iframe", "style", "object", "embed", "video", "audio"];

export interface ConciergeMarkdownProps {
  content: string;
  /** Append a blinking caret to the end of the text (streaming). */
  caret?: boolean;
  className?: string;
}

export function ConciergeMarkdown({ content, caret = false, className }: ConciergeMarkdownProps) {
  const source = caret ? content + CARET : content;
  return (
    <div className={cn("min-w-0 text-[15px] leading-[1.65] text-fg [overflow-wrap:anywhere]", className)}>
      <Markdown remarkPlugins={[remarkGfm, remarkKestrel]} components={components} skipHtml disallowedElements={DISALLOWED} unwrapDisallowed>
        {source}
      </Markdown>
    </div>
  );
}
