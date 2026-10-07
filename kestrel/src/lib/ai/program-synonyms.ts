/**
 * Natural-language → canonical program id mapping. Pure data, client-safe.
 * Canonical ids are listed in docs/ARCHITECTURE.md → "Program ids".
 */

export interface ProgramSynonym {
  id: string;
  /** Lower-case phrases; matched on word boundaries, case-insensitively. */
  phrases: string[];
  /**
   * Phrases that are also places or common words ("alaska", "united",
   * "singapore"). These only count when followed by a points word
   * ("miles", "points", "mileage", "plan") or preceded by a holding word
   * ("with", "using", "via", "my", "have", "through", "on").
   */
  ambiguous?: string[];
}

export const PROGRAM_SYNONYMS: ProgramSynonym[] = [
  // Bank currencies
  { id: "amex-mr", phrases: ["amex", "american express", "membership rewards", "mr points", "mr"] },
  { id: "chase-ur", phrases: ["chase", "ultimate rewards", "sapphire", "ur points", "ur"] },
  { id: "citi-ty", phrases: ["citi", "thankyou", "thank you points", "ty points"] },
  { id: "capital-one", phrases: ["capital one", "cap one", "c1 miles", "venture x", "venture"] },
  { id: "bilt", phrases: ["bilt"] },
  { id: "wells-fargo", phrases: ["wells fargo", "wells"] },
  // Airline programs
  { id: "aeroplan", phrases: ["aeroplan", "air canada"] },
  { id: "united-mileageplus", phrases: ["mileageplus", "mileage plus"], ambiguous: ["united"] },
  { id: "ana-mileage-club", phrases: ["ana mileage club", "mileage club", "all nippon"], ambiguous: ["ana"] },
  { id: "singapore-krisflyer", phrases: ["krisflyer", "singapore airlines", "singapore air"], ambiguous: ["singapore"] },
  { id: "avianca-lifemiles", phrases: ["lifemiles", "life miles", "avianca"] },
  { id: "turkish-miles-smiles", phrases: ["miles&smiles", "miles & smiles", "miles and smiles", "turkish airlines"], ambiguous: ["turkish"] },
  { id: "eva-infinity", phrases: ["eva air", "infinity mileagelands"], ambiguous: ["eva"] },
  { id: "thai-royal-orchid", phrases: ["royal orchid", "thai airways"] },
  { id: "asiana-club", phrases: ["asiana"] },
  { id: "lufthansa-miles-more", phrases: ["lufthansa", "miles & more", "miles and more", "miles&more"] },
  { id: "american-aadvantage", phrases: ["aadvantage", "american airlines", "aa miles", "aa points"] },
  { id: "british-airways-club", phrases: ["avios", "british airways", "ba miles", "ba club", "executive club", "ba avios"] },
  { id: "qatar-privilege-club", phrases: ["privilege club", "qmiles", "qatar airways"], ambiguous: ["qatar"] },
  { id: "cathay-asia-miles", phrases: ["asia miles", "cathay", "cathay pacific"] },
  { id: "jal-mileage-bank", phrases: ["jal", "japan airlines", "mileage bank"] },
  { id: "alaska-mileage-plan", phrases: ["mileage plan", "alaska airlines", "alaska air"], ambiguous: ["alaska"] },
  { id: "qantas-frequent-flyer", phrases: ["qantas"] },
  { id: "iberia-plus", phrases: ["iberia"] },
  { id: "finnair-plus", phrases: ["finnair"] },
  { id: "aer-lingus-aerclub", phrases: ["aer lingus", "aerclub"] },
  { id: "delta-skymiles", phrases: ["skymiles", "delta"] },
  { id: "flying-blue", phrases: ["flying blue", "air france", "klm"] },
  { id: "virgin-atlantic-flying-club", phrases: ["virgin atlantic", "flying club", "virgin points", "virgin red"], ambiguous: ["virgin"] },
  { id: "korean-air-skypass", phrases: ["korean air", "skypass"] },
  { id: "aeromexico-rewards", phrases: ["aeromexico"] },
  { id: "etihad-guest", phrases: ["etihad", "etihad guest"] },
  { id: "emirates-skywards", phrases: ["skywards"], ambiguous: ["emirates"] },
  { id: "jetblue-trueblue", phrases: ["jetblue", "trueblue"] },
  { id: "southwest-rapid-rewards", phrases: ["southwest", "rapid rewards"] },
  { id: "virgin-australia-velocity", phrases: ["velocity", "virgin australia"] },
  { id: "copa-connectmiles", phrases: ["connectmiles", "copa"] },
  { id: "latam-pass", phrases: ["latam"] },
  { id: "air-india-maharaja", phrases: ["maharaja club", "air india"] },
  { id: "air-new-zealand-airpoints", phrases: ["airpoints", "air new zealand"] },
  { id: "sas-eurobonus", phrases: ["eurobonus"], ambiguous: ["sas"] },
  { id: "tap-miles-go", phrases: ["miles&go", "miles & go", "tap portugal", "tap air"] },
  // Hotel programs
  { id: "world-of-hyatt", phrases: ["hyatt", "world of hyatt"] },
  { id: "marriott-bonvoy", phrases: ["marriott", "bonvoy"] },
  { id: "hilton-honors", phrases: ["hilton", "hilton honors"] },
  { id: "ihg-one-rewards", phrases: ["ihg"] },
  { id: "accor-all", phrases: ["accor"] },
  { id: "choice-privileges", phrases: ["choice privileges"] },
  { id: "wyndham-rewards", phrases: ["wyndham"] },
];

export const CANONICAL_PROGRAM_IDS: ReadonlySet<string> = new Set(PROGRAM_SYNONYMS.map((s) => s.id));

export const BANK_PROGRAM_IDS = ["amex-mr", "chase-ur", "citi-ty", "capital-one", "bilt", "wells-fargo"] as const;

const POINTS_WORDS = "(?:miles|points|pts|mileage|plan|rewards|balance|account)";
const HOLDING_WORDS = "(?:with|using|via|through|my|have|got|in|on|from|book(?:ing)? with|transfer(?:ring)? to)";

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
}

export interface ProgramMention {
  id: string;
  /** Character span in the original text (end exclusive). */
  start: number;
  end: number;
  /** True when the mention is an exclusion ("avoid BA"). */
  excluded: boolean;
}

/**
 * Find every program mention in free text with its span. Mentions after
 * "avoid"/"not"/"no"/"except" are flagged `excluded`.
 */
export function findProgramMentions(text: string): ProgramMention[] {
  const lower = text.toLowerCase();
  const out: ProgramMention[] = [];
  const isExcluded = (index: number) => {
    const before = lower.slice(Math.max(0, index - 16), index);
    return /\b(?:avoid|avoiding|not|no|except|without|skip|hate|never)\s+(?:on\s+|the\s+|flying\s+)?$/.test(before);
  };
  const overlaps = (s: number, e: number) => out.some((o) => s < o.end && e > o.start);

  for (const syn of PROGRAM_SYNONYMS) {
    for (const phrase of syn.phrases) {
      const re = new RegExp(`(?<![a-z0-9&])${escapeRe(phrase)}(?![a-z0-9&])(?:\\s+${POINTS_WORDS})?`, "g");
      let m: RegExpExecArray | null;
      while ((m = re.exec(lower))) {
        const start = m.index;
        const end = start + m[0].length;
        if (overlaps(start, end)) continue;
        out.push({ id: syn.id, start, end, excluded: isExcluded(start) });
      }
    }
    for (const phrase of syn.ambiguous ?? []) {
      const re = new RegExp(
        `(?:${HOLDING_WORDS}\\s+${escapeRe(phrase)}(?![a-z])(?!\\s+(?:states|kingdom|arab|airlines?\\s+to))|(?<![a-z])${escapeRe(phrase)}\\s+${POINTS_WORDS})`,
        "g",
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(lower))) {
        const start = m.index;
        const end = start + m[0].length;
        if (overlaps(start, end)) continue;
        out.push({ id: syn.id, start, end, excluded: isExcluded(start) });
      }
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** Program ids mentioned (excluding "avoid X" mentions), in order of appearance. */
export function detectPrograms(text: string): string[] {
  const ids: string[] = [];
  for (const m of findProgramMentions(text)) {
    if (!m.excluded && !ids.includes(m.id)) ids.push(m.id);
  }
  return ids;
}

/** Map a free-form program reference ("Amex", "ba avios", or an id) to a canonical id. */
export function resolveProgramId(ref: string): string | undefined {
  const r = ref.trim().toLowerCase();
  if (!r) return undefined;
  if (CANONICAL_PROGRAM_IDS.has(r)) return r;
  const hits = detectPrograms(r);
  if (hits.length) return hits[0];
  // Last resort: a slug-ish prefix match ("aeroplan-points" → aeroplan)
  const slug = r.replace(/[^a-z0-9]+/g, "-");
  return PROGRAM_SYNONYMS.find((s) => slug.startsWith(s.id) || s.id.startsWith(slug))?.id;
}
