import type { Airline, Alliance } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AirlineTail } from "@/components/art/program-logo";
import { ALLIANCE_META, ALLIANCE_ORDER } from "./program-meta";

/**
 * Bookable carriers grouped by alliance. Carriers Kestrel does not model are listed as
 * plain IATA chips so the count stays honest.
 */
export function CarrierGrid({
  codes,
  resolve,
  ownCarrier,
  className,
}: {
  codes: string[];
  resolve: (iata: string) => Airline | undefined;
  /** The program's own airline, highlighted first. */
  ownCarrier?: string;
  className?: string;
}) {
  const groups = new Map<Alliance, Airline[]>();
  const unknown: string[] = [];
  for (const code of codes) {
    const a = resolve(code);
    if (!a) {
      unknown.push(code);
      continue;
    }
    (groups.get(a.alliance) ?? groups.set(a.alliance, []).get(a.alliance)!).push(a);
  }
  const ordered = ALLIANCE_ORDER.filter((al) => groups.has(al));

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {ordered.map((al) => {
        const list = [...groups.get(al)!].sort((a, b) =>
          a.iata === ownCarrier ? -1 : b.iata === ownCarrier ? 1 : a.name.localeCompare(b.name),
        );
        return (
          <section key={al} aria-label={ALLIANCE_META[al].label}>
            <div className="mb-3 flex items-center gap-3">
              <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">{ALLIANCE_META[al].label}</h3>
              <span className="font-mono text-[10.5px] tnum text-fg-faint">{list.length}</span>
              <span className="hairline flex-1" aria-hidden="true" />
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {list.map((a) => (
                <li
                  key={a.iata}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-sm)] border px-2.5 py-2",
                    a.iata === ownCarrier ? "border-signal/40 bg-signal-soft" : "border-panel-border bg-bg-elev-1",
                  )}
                >
                  <AirlineTail code={a.iata} color={a.color} size={26} showCode={false} />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
                    <div className="font-mono text-[10.5px] tracking-[0.1em] text-fg-subtle">
                      {a.iata} · {a.hubs.slice(0, 2).join(" ")}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {unknown.length > 0 && (
        <section aria-label="Other partners">
          <div className="mb-3 flex items-center gap-3">
            <h3 className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">Other partners</h3>
            <span className="font-mono text-[10.5px] tnum text-fg-faint">{unknown.length}</span>
            <span className="hairline flex-1" aria-hidden="true" />
          </div>
          <ul className="flex flex-wrap gap-1.5">
            {unknown.map((c) => (
              <li key={c} className="rounded-full border border-panel-border bg-bg-elev-1 px-2.5 py-1 font-mono text-xs tracking-wider text-fg-muted">
                {c}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
