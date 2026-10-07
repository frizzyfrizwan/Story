import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Cell = boolean | string;

interface FeatureRow {
  label: string;
  free: Cell;
  pro: Cell;
  note?: string;
}

interface Group {
  title: string;
  rows: FeatureRow[];
}

/** Built from PLANS in `lib/billing/stripe.ts` and the free alert cap. */
export function buildComparison(freeAlertLimit: number): Group[] {
  return [
    {
      title: "Search",
      rows: [
        { label: "Award search across 40+ programs", free: true, pro: true },
        { label: "Transfer-partner intelligence", free: true, pro: true },
        { label: "Hotel award search", free: true, pro: true },
        { label: "Availability calendars", free: "Standard window", pro: "Full 330-day" },
        { label: "Live data refresh", free: "Standard", pro: "Priority" },
      ],
    },
    {
      title: "Alerts",
      rows: [
        { label: "Active availability alerts", free: `${freeAlertLimit}`, pro: "Unlimited" },
        { label: "Alert channels", free: "In-app", pro: "In-app, email and push" },
      ],
    },
    {
      title: "Tools",
      rows: [
        { label: "AI concierge", free: "Search & explain", pro: "With live tools", note: "Needs an Anthropic key on the deployment" },
        { label: "Wallet sync & expiry tracking", free: false, pro: true },
        { label: "Community Finds", free: true, pro: true },
        { label: "Live flight map", free: true, pro: true },
        { label: "Early access to new programs", free: false, pro: true },
      ],
    },
  ];
}

function CellValue({ value, pro }: { value: Cell; pro?: boolean }) {
  if (value === true) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        <Check className={cn("size-4", pro ? "text-gold" : "text-aurora")} aria-hidden="true" />
        <span className="sr-only">Included</span>
      </span>
    );
  }
  if (value === false) {
    return (
      <span className="inline-flex items-center text-fg-faint">
        <Minus className="size-4" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </span>
    );
  }
  return <span className={cn("text-sm", pro ? "font-medium text-fg" : "text-fg-muted")}>{value}</span>;
}

export function ComparisonTable({ groups, freeName, proName }: { groups: Group[]; freeName: string; proName: string }) {
  return (
    <div className="panel overflow-hidden">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">Feature comparison between the {freeName} and {proName} plans</caption>
        <thead>
          <tr className="border-b border-panel-border">
            <th scope="col" className="px-4 py-3.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle sm:px-6">
              Feature
            </th>
            <th scope="col" className="w-[26%] px-3 py-3.5 font-display text-base tracking-tight text-fg sm:px-4">
              {freeName}
            </th>
            <th scope="col" className="w-[26%] px-3 py-3.5 font-display text-base tracking-tight text-gold sm:px-4">
              {proName}
            </th>
          </tr>
        </thead>
        {groups.map((g) => (
          <tbody key={g.title}>
            <tr>
              <th
                scope="rowgroup"
                colSpan={3}
                className="bg-bg-elev-1/60 px-4 py-2 text-left font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle sm:px-6"
              >
                {g.title}
              </th>
            </tr>
            {g.rows.map((r) => (
              <tr key={r.label} className="border-t border-panel-border">
                <th scope="row" className="px-4 py-3 text-sm font-normal text-fg sm:px-6">
                  {r.label}
                  {r.note && <span className="mt-0.5 block text-[12px] text-fg-subtle">{r.note}</span>}
                </th>
                <td className="px-3 py-3 align-top sm:px-4">
                  <CellValue value={r.free} />
                </td>
                <td className="px-3 py-3 align-top sm:px-4">
                  <CellValue value={r.pro} pro />
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
