/**
 * <FindBody> — a post body rendered from light Markdown (GFM). Raw HTML is skipped, dangerous URL
 * schemes are stripped by react-markdown's default transform, and every element maps to a token
 * style so posts read like the rest of the deck. No hooks — renders on the server.
 */

import Link from "next/link";
import Markdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

const ALLOWED = [
  "p",
  "a",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "br",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "input",
];

function isInternal(href: string | undefined): href is string {
  return Boolean(href && href.startsWith("/") && !href.startsWith("//"));
}

const components: Components = {
  p: ({ children }) => <p className="my-3 first:mt-0 last:mb-0">{children}</p>,
  a: ({ href, children }) => {
    if (isInternal(href)) {
      return (
        <Link href={href} className="font-medium text-sky underline decoration-sky/40 underline-offset-4 hover:decoration-sky">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow ugc"
        className="font-medium text-sky underline decoration-sky/40 underline-offset-4 hover:decoration-sky"
      >
        {children}
      </a>
    );
  },
  strong: ({ children }) => <strong className="font-semibold text-fg">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  del: ({ children }) => <del className="text-fg-subtle">{children}</del>,
  code: ({ children, className }) => {
    const block = typeof className === "string" && className.includes("language-");
    return (
      <code
        className={cn(
          "rounded-[6px] bg-bg-elev-2 px-1.5 py-0.5 font-mono text-[0.9em] text-fg",
          block && "block overflow-x-auto bg-transparent p-0",
        )}
      >
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 p-4 font-mono text-[13px] leading-relaxed text-fg scrollbar-thin">
      {children}
    </pre>
  ),
  ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-signal">{children}</ul>,
  ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:font-mono marker:text-signal">{children}</ol>,
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="my-4 border-l-2 border-signal/60 pl-4 text-fg-muted italic">{children}</blockquote>
  ),
  h1: ({ children }) => <h3 className="mb-2 mt-6 font-display text-xl tracking-tight text-fg first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mb-2 mt-6 font-display text-xl tracking-tight text-fg first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mb-2 mt-5 font-display text-lg tracking-tight text-fg first:mt-0">{children}</h4>,
  h4: ({ children }) => <h4 className="mb-1.5 mt-4 text-base font-semibold text-fg first:mt-0">{children}</h4>,
  h5: ({ children }) => <h5 className="mb-1.5 mt-4 text-sm font-semibold text-fg first:mt-0">{children}</h5>,
  h6: ({ children }) => <h6 className="mb-1.5 mt-4 font-mono text-xs uppercase tracking-[0.16em] text-fg-subtle first:mt-0">{children}</h6>,
  hr: () => <hr className="my-6 hairline border-0" />,
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto rounded-[var(--radius)] border border-panel-border scrollbar-thin">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-bg-elev-1 text-left font-mono text-[11px] uppercase tracking-[0.12em] text-fg-subtle">{children}</thead>,
  th: ({ children }) => <th className="border-b border-panel-border px-3 py-2 font-medium">{children}</th>,
  td: ({ children }) => <td className="border-b border-panel-border px-3 py-2 align-top tnum last:border-b-0">{children}</td>,
  input: ({ checked }) => (
    <span
      aria-hidden="true"
      className={cn(
        "mr-2 inline-grid size-3.5 -translate-y-px place-items-center rounded-[4px] border align-middle",
        checked ? "border-aurora bg-aurora-soft text-aurora" : "border-panel-border-strong",
      )}
    >
      {checked && "✓"}
    </span>
  ),
};

export function FindBody({ body, className }: { body: string; className?: string }) {
  return (
    <div className={cn("text-[15.5px] leading-[1.7] text-fg/90 pretty-text", className)}>
      <Markdown remarkPlugins={[remarkGfm]} components={components} skipHtml allowedElements={ALLOWED} unwrapDisallowed>
        {body}
      </Markdown>
    </div>
  );
}
