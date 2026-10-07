import type { TransferLink } from "@/lib/types";

/** STUB — replaced by the loyalty-data agent. Keep these exports. */
export const TRANSFER_LINKS: TransferLink[] = [];

export function transfersTo(programId: string): TransferLink[] {
  return TRANSFER_LINKS.filter((l) => l.to === programId);
}

export function transfersFrom(bankId: string): TransferLink[] {
  return TRANSFER_LINKS.filter((l) => l.from === bankId);
}

export function transferLink(from: string, to: string): TransferLink | undefined {
  return TRANSFER_LINKS.find((l) => l.from === from && l.to === to);
}
