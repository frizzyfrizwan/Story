import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FaqItem {
  q: string;
  a: React.ReactNode;
}

/** Accordion built on native <details>: keyboard-accessible with zero JS, animates the chevron. */
export function Faq({ items, className }: { items: FaqItem[]; className?: string }) {
  return (
    <div className={cn("panel divide-y divide-panel-border overflow-hidden", className)}>
      {items.map((item, i) => (
        <details key={item.q} className="group" open={i === 0}>
          <summary
            className={cn(
              "flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-medium text-fg transition-colors hover:bg-fg/4 sm:px-6",
              "[&::-webkit-details-marker]:hidden focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-signal",
            )}
          >
            <span>{item.q}</span>
            <ChevronDown
              className="size-4 shrink-0 text-fg-subtle transition-transform duration-200 group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <div className="px-5 pb-5 text-sm leading-relaxed text-fg-muted pretty-text sm:px-6 [&_a]:text-sky [&_a]:underline-offset-2 hover:[&_a]:underline [&_code]:text-fg">
            {item.a}
          </div>
        </details>
      ))}
    </div>
  );
}
