import { ArrowRight, Heart } from "lucide-react";
import type { Find } from "@/lib/types";
import { fmtCompact, fmtCpp, fmtInt } from "@/lib/utils";
import { getProgram } from "@/data/programs";
import { Avatar } from "@/components/ui/avatar";
import { CabinBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/panel";
import { Accent, HomeSection } from "./home-section";
import { Reveal } from "./reveal";

function FindCard({ find }: { find: Find }) {
  const program = find.programId ? getProgram(find.programId) : undefined;
  return (
    <Card href="/finds" padding="md" className="flex h-full flex-col">
      <div className="flex items-center gap-3">
        <Avatar
          seed={find.author.avatarSeed}
          name={find.author.name}
          size="sm"
          status={find.author.plan === "pro" ? "pro" : undefined}
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-fg">{find.author.name}</p>
          <p className="truncate font-mono text-[11px] text-fg-subtle">@{find.author.handle}</p>
        </div>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1 font-mono text-xs text-fg-muted tnum">
          <Heart className="size-3.5" aria-hidden="true" />
          {fmtInt(find.likes)}
          <span className="sr-only"> likes</span>
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 font-display text-lg leading-snug tracking-tight text-fg">{find.title}</h3>

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
        {find.origin && find.destination && (
          <span className="font-mono text-sm font-semibold tracking-wide text-fg">
            {find.origin}
            <span className="text-fg-subtle"> → </span>
            {find.destination}
          </span>
        )}
        {find.cabin && <CabinBadge cabin={find.cabin} short size="sm" />}
        {find.miles != null && (
          <span className="ml-auto font-mono text-sm text-gold tnum">{fmtCompact(find.miles)} mi</span>
        )}
      </div>
      {(program || find.cpp != null) && (
        <p className="mt-2 text-xs text-fg-subtle">
          {[program?.shortName, find.cpp != null ? `${fmtCpp(find.cpp)} per point` : null].filter(Boolean).join(" · ")}
        </p>
      )}
    </Card>
  );
}

export function Community({ finds }: { finds: Find[] }) {
  return (
    <HomeSection
      id="finds"
      eyebrow="Community"
      title={
        <>
          Finds from people who <Accent className="text-aurora">actually book this stuff.</Accent>
        </>
      }
      description="Members post the seats they found, the program that priced them and what they paid. Upvotes float the best to the top; the feed is public."
      actions={
        <Button href="/finds" variant="secondary" trailing={<ArrowRight />}>
          Open the feed
        </Button>
      }
    >
      {finds.length ? (
        <ul className="grid gap-4 md:grid-cols-3">
          {finds.map((f, i) => (
            <Reveal key={f.id} as="li" delay={i * 0.07} className="flex">
              <FindCard find={f} />
            </Reveal>
          ))}
        </ul>
      ) : (
        <Reveal>
          <EmptyState
            title="The feed is warming up"
            description="Be the first to post a find — a route, the program that priced it and what it cost."
            action={
              <Button href="/finds" variant="secondary">
                Post a find
              </Button>
            }
          />
        </Reveal>
      )}
    </HomeSection>
  );
}
