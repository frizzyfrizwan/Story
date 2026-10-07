"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Balance, Deal, TransferLink } from "@/lib/types";
import { apiDelete, apiGet, apiPut } from "@/lib/client/api";
import { toast } from "@/components/ui/toast";

export const WALLET_KEY = ["wallet"] as const;
export const TRANSFERS_KEY = ["programs", "transfers"] as const;

export interface UpsertBalanceInput {
  programId: string;
  amount: number;
  status?: string;
  expiresAt?: string;
}

function mergeBalance(list: Balance[] | undefined, next: Balance): Balance[] {
  const rest = (list ?? []).filter((b) => b.programId !== next.programId);
  return [...rest, next].sort((a, b) => b.amount - a.amount);
}

/** Balances, hydrated from the server render and refreshed from /api/wallet. */
export function useBalances(initial: Balance[]) {
  return useQuery({
    queryKey: WALLET_KEY,
    queryFn: async () => (await apiGet<{ balances: Balance[] }>("/api/wallet")).balances,
    initialData: initial,
    staleTime: 60_000,
  });
}

/** Transfer links with DB-merged bonuses; falls back to the static matrix passed by the caller. */
export function useTransferLinks(fallback: TransferLink[]) {
  const q = useQuery({
    queryKey: TRANSFERS_KEY,
    queryFn: () => apiGet<{ transfers: TransferLink[] }>("/api/programs"),
    staleTime: 10 * 60_000,
  });
  return { ...q, links: q.data?.transfers ?? fallback };
}

export function useDeals(origin: string) {
  return useQuery({
    queryKey: ["deals", origin],
    queryFn: async () => (await apiGet<{ deals: Deal[] }>("/api/awards/deals", { origin, limit: 60 })).deals,
    staleTime: 5 * 60_000,
  });
}

export function useUpsertBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertBalanceInput) => apiPut<{ balance: Balance }>("/api/wallet", input),
    onSuccess: ({ balance }) => {
      qc.setQueryData<Balance[]>(WALLET_KEY, (old) => mergeBalance(old, balance));
    },
    onError: (err) => toast.error("Could not save balance", { description: err instanceof Error ? err.message : undefined }),
  });
}

export function useDeleteBalance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (programId: string) => apiDelete<{ deleted: boolean }>("/api/wallet", { programId }),
    onMutate: async (programId) => {
      await qc.cancelQueries({ queryKey: WALLET_KEY });
      const previous = qc.getQueryData<Balance[]>(WALLET_KEY);
      qc.setQueryData<Balance[]>(WALLET_KEY, (old) => (old ?? []).filter((b) => b.programId !== programId));
      return { previous };
    },
    onError: (err, _id, ctx) => {
      if (ctx?.previous) qc.setQueryData(WALLET_KEY, ctx.previous);
      toast.error("Could not remove balance", { description: err instanceof Error ? err.message : undefined });
    },
  });
}

export function useImportCsv() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (csv: string) => apiPut<{ imported: number; balances: Balance[] }>("/api/wallet", { csv }),
    onSuccess: ({ imported, balances }) => {
      qc.setQueryData<Balance[]>(WALLET_KEY, balances);
      toast.success(`Imported ${imported} ${imported === 1 ? "balance" : "balances"}`);
    },
    onError: (err) => toast.error("Import failed", { description: err instanceof Error ? err.message : undefined }),
  });
}
