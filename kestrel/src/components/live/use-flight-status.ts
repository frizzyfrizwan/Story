"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { FlightStatus } from "@/lib/types";
import { ApiError, apiGet } from "@/lib/client/api";

/**
 * GET /api/live/status?flight=SQ22&date=YYYY-MM-DD — one lookup per (flight, date).
 * A 404 ("Flight not found") is a final answer, so it is never retried; an active flight
 * refreshes every minute while the tab is visible.
 */

export const flightStatusKey = (flight: string | null, date: string) => ["flight-status", flight ?? "", date] as const;

export type FlightStatusQuery = UseQueryResult<FlightStatus, Error>;

export function useFlightStatus(flight: string | null, date: string): FlightStatusQuery {
  return useQuery<FlightStatus, Error>({
    queryKey: flightStatusKey(flight, date),
    enabled: Boolean(flight),
    queryFn: ({ signal }) => apiGet<FlightStatus>("/api/live/status", { flight, date }, { signal }),
    retry: (count, err) => !(err instanceof ApiError && err.status < 500) && count < 1,
    staleTime: 30_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchInterval: (q) => (q.state.data?.status === "active" ? 60_000 : false),
  });
}

export function isNotFound(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404;
}
