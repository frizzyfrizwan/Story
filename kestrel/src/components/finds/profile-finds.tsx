"use client";

/**
 * A finder's posts on their profile — the same feed machinery filtered by author, with its own
 * empty state and "Load more".
 */

import { ChevronDown, PenLine } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Panel } from "@/components/ui/panel";
import { FeedSkeleton } from "./feed";
import { FindCard } from "./find-card";
import { FEED_PAGE_SIZE } from "./format";
import { flattenFeed, useFeed, type FeedPage } from "./use-finds";

export function ProfileFinds({ userId, handle, isMe, initial }: { userId: string; handle: string; isMe: boolean; initial: FeedPage }) {
  const query = useFeed({ userId, limit: FEED_PAGE_SIZE }, initial);
  const items = useMemo(() => flattenFeed(query.data), [query.data]);

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-5">
        {query.isPending ? (
          <FeedSkeleton count={2} />
        ) : items.length === 0 ? (
          <Panel padding="none">
            <EmptyState
              title={isMe ? "You haven't shared a find yet" : `@${handle} hasn't shared a find yet`}
              description={isMe ? "Booked something good? Tell the flock what you got and how." : "Check back soon — great redemptions take a minute to write up."}
              action={
                isMe ? (
                  <Button href="/finds/new" leading={<PenLine />}>
                    Share a find
                  </Button>
                ) : (
                  <Button href="/finds" variant="secondary">
                    Browse all finds
                  </Button>
                )
              }
            />
          </Panel>
        ) : (
          items.map((f, i) => <FindCard key={f.id} find={f} still={i >= FEED_PAGE_SIZE} />)
        )}
      </div>
      {query.hasNextPage && (
        <div className="mt-8 flex justify-center">
          <Button variant="secondary" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} trailing={<ChevronDown />}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
