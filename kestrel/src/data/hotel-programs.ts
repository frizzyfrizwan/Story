import type { HotelProgram } from "@/lib/types";

/** STUB — replaced by the hotels agent. Keep these exports. */
export const HOTEL_PROGRAMS: HotelProgram[] = [];

export function getHotelProgram(id: string): HotelProgram | undefined {
  return HOTEL_PROGRAMS.find((p) => p.id === id);
}
