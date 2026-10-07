"use client";

/**
 * TanStack Query hooks for the Finds feed.
 *
 * Every cached shape that holds a `Find` lives under the ["finds", …] prefix so a like or a new
 * comment can be patched everywhere it is visible (feed pages, profile lists, the detail view)
 * in one pass — that is what makes optimistic interactions feel instant and consistent.
 */

import { useRouter } from "next/navigation";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import { ApiError, apiDelete, apiGet, apiPost, loginHref } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";
import type { Cabin, Find, FindComment } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────

export type FeedSort = "new" | "top";

export interface FeedParams {
  sort?: FeedSort;
  tag?: string;
  cabin?: Cabin;
  programId?: string;
  userId?: string;
  limit?: number;
}

export interface TrendingTag {
  tag: string;
  count: number;
}

/** One page of GET /api/finds. */
export interface FeedPage {
  items: Find[];
  nextCursor: string | null;
  tags: TrendingTag[];
}

/** GET /api/finds/[id]. */
export interface FindDetail {
  find: Find;
  comments: FindComment[];
}

export type FeedData = InfiniteData<FeedPage, string | undefined>;

// ─── Keys ─────────────────────────────────────────────────────

/** Drop empty values so `{tag: ""}` and `{}` hash to the same key. */
export function normalizeFeedParams(p: FeedParams): FeedParams {
  const out: FeedParams = {};
  if (p.sort && p.sort !== "new") out.sort = p.sort;
  if (p.tag) out.tag = p.tag;
  if (p.cabin) out.cabin = p.cabin;
  if (p.programId) out.programId = p.programId;
  if (p.userId) out.userId = p.userId;
  if (p.limit) out.limit = p.limit;
  return out;
}

export const findsKeys = {
  all: ["finds"] as const,
  feed: (p: FeedParams) => ["finds", "feed", normalizeFeedParams(p)] as const,
  detail: (id: string) => ["finds", "detail", id] as const,
};

// ─── Feed ─────────────────────────────────────────────────────

/**
 * Cursor-paginated feed. Pass the server-rendered first page as `initial` so the first paint
 * needs no client fetch; "Load more" appends pages with `nextCursor`.
 */
export function useFeed(params: FeedParams, initial?: FeedPage) {
  const normalized = normalizeFeedParams(params);
  return useInfiniteQuery<FeedPage, ApiError, FeedData, ReturnType<typeof findsKeys.feed>, string | undefined>({
    queryKey: findsKeys.feed(normalized),
    queryFn: ({ pageParam }) => apiGet<FeedPage>("/api/finds", { ...normalized, cursor: pageParam }),
    initialPageParam: undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: initial ? { pages: [initial], pageParams: [undefined] } : undefined,
    staleTime: 60_000,
  });
}

/** Flatten pages into one list, de-duplicated by id (a "top" feed can repeat across refetches). */
export function flattenFeed(data: FeedData | undefined): Find[] {
  if (!data) return [];
  const seen = new Set<string>();
  const out: Find[] = [];
  for (const page of data.pages) {
    for (const f of page.items) {
      if (seen.has(f.id)) continue;
      seen.add(f.id);
      out.push(f);
    }
  }
  return out;
}

// ─── Detail ───────────────────────────────────────────────────

export function useFindDetail(id: string, initial?: FindDetail) {
  return useQuery<FindDetail, ApiError>({
    queryKey: findsKeys.detail(id),
    queryFn: () => apiGet<FindDetail>(`/api/finds/${id}`),
    initialData: initial,
    staleTime: 60_000,
  });
}

// ─── Cache patching ───────────────────────────────────────────

type Patch = (f: Find) => Find;

function isFeedData(d: unknown): d is FeedData {
  return Boolean(d && typeof d === "object" && Array.isArray((d as FeedData).pages));
}
function isDetail(d: unknown): d is FindDetail {
  return Boolean(d && typeof d === "object" && (d as FindDetail).find && Array.isArray((d as FindDetail).comments));
}

/** Apply `patch` to every cached copy of find `id` (feeds, profile lists, detail). */
export function patchFindEverywhere(qc: QueryClient, id: string, patch: Patch) {
  qc.setQueriesData<unknown>({ queryKey: findsKeys.all }, (old) => {
    if (isFeedData(old)) {
      let touched = false;
      const pages = old.pages.map((p) => {
        if (!p.items.some((f) => f.id === id)) return p;
        touched = true;
        return { ...p, items: p.items.map((f) => (f.id === id ? patch(f) : f)) };
      });
      return touched ? { ...old, pages } : old;
    }
    if (isDetail(old) && old.find.id === id) return { ...old, find: patch(old.find) };
    return old;
  });
}

// ─── Like ─────────────────────────────────────────────────────

export interface LikeResult {
  liked: boolean;
  likes: number;
}

/**
 * Optimistic like toggle. The cache flips immediately; the server's count wins on success and a
 * failure restores the snapshot. A 401 sends the viewer to sign in and back.
 */
export function useLike(findId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation<LikeResult, ApiError, void, { snapshot: [readonly unknown[], unknown][] }>({
    mutationFn: () => apiPost<LikeResult>(`/api/finds/${findId}`, { action: "like" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: findsKeys.all });
      const snapshot = qc.getQueriesData<unknown>({ queryKey: findsKeys.all });
      patchFindEverywhere(qc, findId, (f) => ({
        ...f,
        likedByMe: !f.likedByMe,
        likes: Math.max(0, f.likes + (f.likedByMe ? -1 : 1)),
      }));
      return { snapshot };
    },
    onError: (err, _vars, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data));
      if (err.unauthenticated) {
        toast.info("Sign in to like finds");
        router.push(loginHref());
        return;
      }
      toast.error("Couldn't save your like", { description: err.message });
    },
    onSuccess: (data) => {
      patchFindEverywhere(qc, findId, (f) => ({ ...f, likedByMe: data.liked, likes: data.likes }));
    },
  });
}

// ─── Comments ─────────────────────────────────────────────────

export function useAddComment(findId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation<{ comment: FindComment }, ApiError, string>({
    mutationFn: (body) => apiPost<{ comment: FindComment }>(`/api/finds/${findId}`, { action: "comment", body }),
    onSuccess: ({ comment }) => {
      qc.setQueryData<FindDetail>(findsKeys.detail(findId), (old) =>
        old ? { ...old, comments: [...old.comments, comment] } : old,
      );
      patchFindEverywhere(qc, findId, (f) => ({ ...f, comments: f.comments + 1 }));
    },
    onError: (err) => {
      if (err.unauthenticated) {
        toast.info("Sign in to join the conversation");
        router.push(loginHref());
        return;
      }
      toast.error("Couldn't post your comment", { description: err.message });
    },
  });
}

// ─── Delete ───────────────────────────────────────────────────

export function useDeleteFind(findId: string) {
  const qc = useQueryClient();
  const router = useRouter();
  return useMutation<{ deleted: boolean }, ApiError, void>({
    mutationFn: () => apiDelete<{ deleted: boolean }>(`/api/finds/${findId}`),
    onSuccess: () => {
      qc.removeQueries({ queryKey: findsKeys.detail(findId) });
      qc.invalidateQueries({ queryKey: findsKeys.all });
      toast.success("Find deleted");
      router.push("/finds");
    },
    onError: (err) => {
      if (err.unauthenticated) {
        router.push(loginHref());
        return;
      }
      toast.error("Couldn't delete this find", { description: err.message });
    },
  });
}
