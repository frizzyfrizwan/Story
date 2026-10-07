import type { LoyaltyProgram } from "@/lib/types";

/**
 * STUB — replaced by the loyalty-data agent. Keep these exports.
 * Canonical program ids are listed in docs/ARCHITECTURE.md → "Program ids".
 */
export const PROGRAMS: LoyaltyProgram[] = [];

export const PROGRAM_BY_ID: Record<string, LoyaltyProgram> = Object.fromEntries(PROGRAMS.map((p) => [p.id, p]));

export function getProgram(id: string): LoyaltyProgram | undefined {
  return PROGRAM_BY_ID[id];
}

export const AIRLINE_PROGRAMS = PROGRAMS.filter((p) => p.kind === "airline");
export const BANK_PROGRAMS = PROGRAMS.filter((p) => p.kind === "bank");
export const HOTEL_LOYALTY_PROGRAMS = PROGRAMS.filter((p) => p.kind === "hotel");

/** Programs that can book a given operating carrier (IATA). */
export function programsForCarrier(carrier: string): LoyaltyProgram[] {
  return AIRLINE_PROGRAMS.filter((p) => p.bookableCarriers.includes(carrier));
}
