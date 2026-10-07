"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { LiveAircraft } from "@/lib/types";
import type { MapBBox } from "@/components/viz";
import { apiGet } from "@/lib/client/api";
import { roundBBox, sampleAircraft } from "./live-utils";

/**
 * useLiveAircraft — polls GET /api/live/aircraft for the current viewport.
 *
 *  - bbox changes are debounced (400 ms) and rounded outward to ½° so the query key — and the
 *    server cache — is reused across small pans;
 *  - a key change drops the previous observer, which aborts the in-flight fetch (we hand
 *    TanStack's `signal` to fetch) while `keepPreviousData` keeps the last frame on screen;
 *  - polling pauses while the tab is hidden (`document.visibilityState`) and resumes on return;
 *  - rendering is capped: above `maxAircraft` an evenly-strided sample is returned.
 */

export interface LiveAircraftResponse {
  aircraft: LiveAircraft[];
  time: number;
  source: "live" | "simulated";
}

export interface UseLiveAircraftOptions {
  /** Visible box from <WorldMap onViewportChange>; null until the map reports one. */
  bbox: MapBBox | null;
  /** Master switch (default true). */
  enabled?: boolean;
  /** Poll period in ms (default 10 000). */
  intervalMs?: number;
  /** Viewport debounce in ms (default 400). */
  debounceMs?: number;
  /** Rendering cap (default 1 500). */
  maxAircraft?: number;
}

export interface LiveAircraftState {
  /** Aircraft to render (sampled when `total` exceeds the cap). */
  aircraft: LiveAircraft[];
  /** Count the API returned before sampling. */
  total: number;
  source: "live" | "simulated" | null;
  /** Provider timestamp (epoch seconds). */
  time: number | null;
  /** Local wall clock (ms) when the last successful frame landed. */
  fetchedAt: number | null;
  /** A request is in flight (initial or background refetch). */
  isFetching: boolean;
  /** No frame yet. */
  isLoading: boolean;
  error: Error | null;
  /** Polling is suspended because the tab is hidden or `enabled` is false. */
  paused: boolean;
  /** The rounded box actually being polled. */
  queryBBox: MapBBox | null;
  refetch: () => void;
}

const EMPTY: LiveAircraft[] = [];

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

/** True while the document is visible; true on the server so SSR markup matches the common case. */
export function useDocumentVisible(): boolean {
  return useSyncExternalStore(
    subscribeVisibility,
    () => document.visibilityState !== "hidden",
    () => true,
  );
}

export function liveAircraftQueryKey(bbox: MapBBox) {
  return ["live-aircraft", bbox.lamin, bbox.lomin, bbox.lamax, bbox.lomax] as const;
}

export function useLiveAircraft({
  bbox,
  enabled = true,
  intervalMs = 10_000,
  debounceMs = 400,
  maxAircraft = 1_500,
}: UseLiveAircraftOptions): LiveAircraftState {
  const visible = useDocumentVisible();

  // Debounce + round the viewport. The first box is applied immediately so the map fills fast.
  const [queryBBox, setQueryBBox] = useState<MapBBox | null>(null);
  useEffect(() => {
    if (!bbox) return;
    const next = roundBBox(bbox);
    const same =
      queryBBox &&
      queryBBox.lamin === next.lamin &&
      queryBBox.lomin === next.lomin &&
      queryBBox.lamax === next.lamax &&
      queryBBox.lomax === next.lomax;
    if (same) return;
    if (!queryBBox) {
      setQueryBBox(next);
      return;
    }
    const t = window.setTimeout(() => setQueryBBox(next), debounceMs);
    return () => window.clearTimeout(t);
    // queryBBox is intentionally read, not depended on: a pending debounce must not restart when it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bbox, debounceMs]);

  const active = enabled && visible && queryBBox != null;

  const query = useQuery({
    queryKey: queryBBox ? liveAircraftQueryKey(queryBBox) : ["live-aircraft", "idle"],
    enabled: active,
    queryFn: async ({ signal }) => {
      const b = queryBBox as MapBBox;
      const data = await apiGet<LiveAircraftResponse>(
        "/api/live/aircraft",
        { lamin: b.lamin, lomin: b.lomin, lamax: b.lamax, lomax: b.lomax },
        { signal },
      );
      return { ...data, fetchedAt: Date.now() };
    },
    refetchInterval: active ? intervalMs : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    placeholderData: keepPreviousData,
    staleTime: intervalMs,
    gcTime: 5 * 60_000,
    retry: 1,
    retryDelay: 2_000,
    // Keep the structure stable between identical frames so memoised map props don't churn.
    structuralSharing: true,
  });

  const data = query.data;
  const aircraft = useMemo(() => (data ? sampleAircraft(data.aircraft, maxAircraft) : EMPTY), [data, maxAircraft]);
  const { refetch: queryRefetch } = query;
  const refetch = useCallback(() => {
    void queryRefetch();
  }, [queryRefetch]);

  return {
    aircraft,
    total: data?.aircraft.length ?? 0,
    source: data?.source ?? null,
    time: data?.time ?? null,
    fetchedAt: data?.fetchedAt ?? null,
    isFetching: query.isFetching,
    isLoading: !data && (query.isPending || !queryBBox),
    error: query.error ?? null,
    paused: !active,
    queryBBox,
    refetch,
  };
}
