import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, Calendar, MapPin, Plane } from "lucide-react";
import { auth } from "@/auth";
import { getFind, listComments, listFinds } from "@/lib/repo/finds";
import { cn, fmtCpp, fmtDate, fmtInt, fmtUsd } from "@/lib/utils";
import { CABIN_LABEL, type Find } from "@/lib/types";
import { getProgram } from "@/data/programs";
import { getAirline } from "@/data/airlines";
import { getAirport } from "@/data/airports";
import { Avatar } from "@/components/ui/avatar";
import { Badge, CabinBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { focusRing } from "@/components/ui/tokens";
import { AirlineTail, ProgramLogo } from "@/components/art/program-logo";
import { FindBody } from "@/components/finds/find-body";
import { FindRow } from "@/components/finds/find-card";
import { FindDetail } from "@/components/finds/find-detail";
import { cppTone, hasRoute, plainText } from "@/components/finds/format";
import { ShareButtons } from "@/components/finds/share-buttons";
import { ViewerProvider } from "@/components/finds/viewer";

type Params = Promise<{ id: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const find = await getFind(id);
  if (!find) return { title: "Find not found" };
  const description = plainText(find.body, 160);
  return {
    title: find.title,
    description,
    openGraph: { title: find.title, description, type: "article", authors: [`@${find.author.handle}`] },
    twitter: { card: "summary", title: find.title, description },
  };
}

export default async function FindPage({ params }: { params: Params }) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const viewerId = session?.user?.id ?? null;
  const find = await getFind(id, viewerId);
  if (!find) notFound();

  const [comments, more] = await Promise.all([
    listComments(id),
    listFinds({ userId: find.author.id, limit: 4, viewerId }),
  ]);
  const moreFrom = more.items.filter((f) => f.id !== find.id).slice(0, 3);

  return (
    <ViewerProvider viewerId={viewerId}>
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6 lg:pt-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-14">
          <FindDetail initial={{ find, comments }}>
            <FindBody body={find.body} />
          </FindDetail>

          <aside className="flex flex-col gap-5 lg:pt-11">
            <RedemptionDetails find={find} />

            <Panel eyebrow="Share" title="Pass it on" padding="sm">
              <ShareButtons path={`/finds/${find.id}`} title={find.title} className="-mx-1" />
            </Panel>

            <Panel eyebrow="Posted by" padding="sm">
              <div className="flex items-start gap-3">
                <Link href={`/u/${find.author.handle}`} className={cn("shrink-0 rounded-full", focusRing)} aria-label={`${find.author.name}'s profile`}>
                  <Avatar seed={find.author.avatarSeed} name={find.author.name} size="md" status={find.author.plan === "pro" ? "pro" : undefined} />
                </Link>
                <div className="min-w-0 flex-1 leading-tight">
                  <Link href={`/u/${find.author.handle}`} className={cn("rounded-[4px] text-sm font-medium text-fg hover:underline underline-offset-4", focusRing)}>
                    {find.author.name}
                  </Link>
                  <p className="mt-0.5 font-mono text-xs text-fg-subtle">@{find.author.handle}</p>
                </div>
                {find.author.plan === "pro" && (
                  <Badge variant="gold" size="sm" caps>
                    Pro
                  </Badge>
                )}
              </div>
              {moreFrom.length > 0 && (
                <>
                  <p className="mt-4 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">More from @{find.author.handle}</p>
                  <ul className="-mx-3 mt-1.5 flex flex-col">
                    {moreFrom.map((f) => (
                      <li key={f.id}>
                        <FindRow find={f} />
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <Button href={`/u/${find.author.handle}`} variant="ghost" size="sm" className="mt-3 w-full" trailing={<ArrowUpRight />}>
                View profile
              </Button>
            </Panel>
          </aside>
        </div>
      </div>
    </ViewerProvider>
  );
}

// ─── Redemption details (server) ──────────────────────────────

function RedemptionDetails({ find }: { find: Find }) {
  const program = find.programId ? getProgram(find.programId) : undefined;
  const airline = find.carrier ? getAirline(find.carrier) : undefined;
  const origin = find.origin ? getAirport(find.origin) : undefined;
  const destination = find.destination ? getAirport(find.destination) : undefined;
  const rows: { label: string; value: React.ReactNode }[] = [];

  if (hasRoute(find)) {
    rows.push({
      label: "Route",
      value: (
        <div className="flex flex-col gap-1">
          <RouteCity code={find.origin} city={origin?.city} name={origin?.name} />
          <RouteCity code={find.destination} city={destination?.city} name={destination?.name} />
        </div>
      ),
    });
  }
  if (find.carrier) {
    rows.push({
      label: "Carrier",
      value: (
        <span className="inline-flex items-center gap-2">
          <AirlineTail code={find.carrier} color={airline?.color} size={22} showCode={false} />
          <span>{airline?.name ?? find.carrier}</span>
        </span>
      ),
    });
  }
  if (find.cabin) rows.push({ label: "Cabin", value: <CabinBadge cabin={find.cabin} size="sm" /> });
  if (program) {
    rows.push({
      label: "Program",
      value: (
        <div className="flex flex-col gap-1.5">
          <span className="inline-flex items-center gap-2">
            <ProgramLogo id={program.id} name={program.name} color={program.color} size={22} />
            <span>{program.name}</span>
          </span>
          <Link
            href={`/programs/${program.id}`}
            className={cn("inline-flex w-fit items-center gap-1 rounded-[4px] text-xs font-medium text-sky hover:underline underline-offset-4", focusRing)}
          >
            How to book with {program.shortName}
            <ArrowUpRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
      ),
    });
  } else if (find.programId) {
    rows.push({ label: "Program", value: find.programId });
  }
  if (find.miles != null) {
    rows.push({
      label: program ? program.currency : "Miles",
      value: <span className="font-mono text-base font-semibold text-fg tnum">{fmtInt(find.miles)}</span>,
    });
  }
  if (find.taxesUsd != null) {
    rows.push({ label: "Taxes & fees", value: <span className="font-mono tnum">{fmtUsd(find.taxesUsd, { cents: find.taxesUsd % 1 !== 0 })}</span> });
  }
  if (find.cpp != null) {
    rows.push({
      label: "Value",
      value: (
        <Badge variant={cppTone(find.cpp)} className="font-mono tnum">
          {fmtCpp(find.cpp)} per point
        </Badge>
      ),
    });
  }
  if (find.travelDate) {
    rows.push({
      label: "Travel date",
      value: (
        <span className="inline-flex items-center gap-1.5 font-mono tnum">
          <Calendar className="size-3.5 text-fg-subtle" aria-hidden="true" />
          {fmtDate(find.travelDate, { year: "numeric" })}
        </span>
      ),
    });
  }

  if (rows.length === 0) {
    return (
      <Panel eyebrow="Redemption" title="No booking details" padding="sm" grain>
        <p className="text-sm text-fg-muted">This find is a story without a ticket attached.</p>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Redemption" title={find.cabin ? `${CABIN_LABEL[find.cabin]} award` : "The booking"} padding="sm" grain>
      <dl className="flex flex-col divide-y divide-panel-border">
        {rows.map((r) => (
          <div key={r.label} className="flex items-start justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
            <dt className="shrink-0 pt-0.5 font-mono text-[10.5px] uppercase tracking-[0.16em] text-fg-subtle">{r.label}</dt>
            <dd className="min-w-0 text-right text-sm text-fg">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

function RouteCity({ code, city, name }: { code: string; city?: string; name?: string }) {
  return (
    <span className="inline-flex items-center justify-end gap-2">
      <span className="truncate text-xs text-fg-muted" title={name}>
        {city ?? name ?? ""}
      </span>
      <span className="inline-flex items-center gap-1 font-mono font-semibold tracking-wider text-fg">
        {city ? <MapPin className="size-3 text-fg-subtle" aria-hidden="true" /> : <Plane className="size-3 text-fg-subtle" aria-hidden="true" />}
        {code}
      </span>
    </span>
  );
}
