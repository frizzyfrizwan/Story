import { z } from "zod";
import { clientKey, fail, handler, ok, parseBody, rateLimit } from "@/lib/api";
import { explainRedemption } from "@/lib/ai/explain";
import { getProgram } from "@/data/programs";
import type { AwardFare, Itinerary } from "@/lib/types";

export const runtime = "nodejs";

const Cabin = z.enum(["economy", "premium", "business", "first"]);

const TransferOption = z.object({
  bankProgramId: z.string().min(1),
  ratio: z.tuple([z.number().positive(), z.number().positive()]),
  bankPointsNeeded: z.number().min(0),
  bonusPercent: z.number().optional(),
  transferTime: z.enum(["instant", "hours", "1-2 days", "3-7 days", "1-2 weeks"]),
});

const Fare = z.object({
  programId: z.string().min(1).max(60),
  cabin: Cabin,
  miles: z.number().min(0),
  taxesUsd: z.number().min(0),
  seats: z.number().nullable().default(null),
  mixedCabin: z.boolean().optional(),
  bookUrl: z.string().max(500).optional(),
  transferOptions: z.array(TransferOption).max(20).default([]),
  cpp: z.number().optional(),
  valueScore: z.number().min(0).max(100).default(50),
  badges: z.array(z.string().max(40)).max(10).default([]),
  source: z.enum(["live", "cached", "simulated"]).default("simulated"),
  fetchedAt: z.string().default(() => new Date().toISOString()),
});

const Segment = z.object({
  carrier: z.string().min(2).max(3),
  flightNumber: z.string().max(10).default(""),
  origin: z.string().length(3),
  destination: z.string().length(3),
  departure: z.string().max(25).default(""),
  arrival: z.string().max(25).default(""),
  aircraft: z.string().max(40).optional(),
  durationMin: z.number().min(0).default(0),
  operatedBy: z.string().max(3).optional(),
  cabin: Cabin,
});

const ItinerarySchema = z.object({
  id: z.string().max(80).default("itinerary"),
  segments: z.array(Segment).min(1).max(6),
  totalDurationMin: z.number().min(0).default(0),
  stops: z.number().int().min(0).default(0),
  distanceMiles: z.number().min(0).default(0),
});

const Body = z.object({
  fare: Fare,
  itinerary: ItinerarySchema,
  cashPriceUsd: z.number().positive().optional(),
});

/** POST /api/ai/explain { fare, itinerary, cashPriceUsd? } → { text } */
export const POST = handler(async (req: Request) => {
  const rl = rateLimit(`ai:explain:${clientKey(req)}`, { limit: 20, windowMs: 60_000 });
  if (!rl.allowed) return fail("Too many requests — try again in a minute", 429);

  const body = await parseBody(req, Body);
  const fare: AwardFare = body.fare;
  const itinerary: Itinerary = body.itinerary;
  const text = await explainRedemption(fare, { itinerary, cashPriceUsd: body.cashPriceUsd, program: getProgram(fare.programId) }, { signal: req.signal });
  return ok({ text });
});
