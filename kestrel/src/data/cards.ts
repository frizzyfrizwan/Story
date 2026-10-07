import type { CreditCard } from "@/lib/types";

/** STUB — replaced by the loyalty-data agent. Keep these exports. */
export const CARDS: CreditCard[] = [];

export function getCard(id: string): CreditCard | undefined {
  return CARDS.find((c) => c.id === id);
}
