"use client";

/**
 * <ComposeForm> — share a redemption. The title is parsed as you type so the structured fields can
 * be filled with one click; the ticket strip previews live so the post looks right before it ships.
 */

import { useRouter } from "next/navigation";
import { useMemo, useState, type FormEvent, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus, Sparkles, X } from "lucide-react";
import { cn, fmtCpp, fmtInt } from "@/lib/utils";
import { CABIN_LABEL, CABIN_SHORT, type Cabin, type Find } from "@/lib/types";
import { AIRLINES, getAirline } from "@/data/airlines";
import { getAirport } from "@/data/airports";
import { AIRLINE_PROGRAMS, HOTEL_LOYALTY_PROGRAMS, getProgram } from "@/data/programs";
import { parseIntentHeuristic } from "@/lib/ai/intent-heuristics";
import { ApiError, apiPost, loginHref } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { CabinPicker } from "@/components/ui/segmented";
import { Select, type SelectOptionGroup } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/tokens";
import { ProgramLogo } from "@/components/art/program-logo";
import { RedemptionStrip } from "./find-card";
import { MAX_TAGS, computeCpp, slugTag } from "./format";

// ─── Types & limits ───────────────────────────────────────────

interface FormState {
  title: string;
  body: string;
  origin: string;
  destination: string;
  carrier: string;
  cabin: Cabin | null;
  programId: string;
  miles: string;
  taxes: string;
  cash: string;
  travelDate: string | null;
  tags: string[];
}

type Errors = Partial<Record<keyof FormState | "form", string>>;

const TITLE_MIN = 8;
const TITLE_MAX = 140;
const BODY_MIN = 20;
const BODY_MAX = 4000;

const EMPTY: FormState = {
  title: "",
  body: "",
  origin: "",
  destination: "",
  carrier: "",
  cabin: null,
  programId: "",
  miles: "",
  taxes: "",
  cash: "",
  travelDate: null,
  tags: [],
};

/** API payload field → form field, for mapping server validation issues back onto inputs. */
const API_FIELD: Record<string, keyof FormState | undefined> = {
  title: "title",
  body: "body",
  origin: "origin",
  destination: "destination",
  carrier: "carrier",
  cabin: "cabin",
  programId: "programId",
  miles: "miles",
  taxesUsd: "taxes",
  cpp: "cash",
  travelDate: "travelDate",
  tags: "tags",
};

const PROGRAM_OPTIONS: SelectOptionGroup[] = [
  {
    label: "Airline programs",
    options: AIRLINE_PROGRAMS.map((p) => ({
      value: p.id,
      label: p.shortName,
      description: p.name,
      icon: <ProgramLogo id={p.id} name={p.name} color={p.color} size={16} />,
    })),
  },
  {
    label: "Hotel programs",
    options: HOTEL_LOYALTY_PROGRAMS.map((p) => ({
      value: p.id,
      label: p.shortName,
      description: p.name,
      icon: <ProgramLogo id={p.id} name={p.name} color={p.color} size={16} />,
    })),
  },
];

// ─── Title parsing ────────────────────────────────────────────

interface Suggestion {
  origin?: string;
  destination?: string;
  cabin?: Cabin;
  programId?: string;
  carrier?: string;
}

const CABIN_RE: [RegExp, Cabin][] = [
  [/\b(?:premium[- ]economy|prem(?:ium)?[- ]econ|\bW\b)/i, "premium"],
  [/\bfirst\b|\bsuites?\b|(?<![A-Za-z0-9])F(?![A-Za-z0-9])/, "first"],
  [/\b(?:business|biz|lie[- ]?flat|qsuites?|polaris|club world|upper class)\b|(?<![A-Za-z0-9])J(?![A-Za-z0-9])/i, "business"],
  [/\b(?:economy|coach|main cabin)\b|(?<![A-Za-z0-9])Y(?![A-Za-z0-9])/i, "economy"],
];

const CARRIER_ALIASES: Record<string, string> = {
  ana: "NH",
  jal: "JL",
  "british airways": "BA",
  ba: "BA",
  lufthansa: "LH",
  "singapore airlines": "SQ",
  "singapore air": "SQ",
  qatar: "QR",
  qsuite: "QR",
  qsuites: "QR",
  emirates: "EK",
  etihad: "EY",
  cathay: "CX",
  "cathay pacific": "CX",
  united: "UA",
  polaris: "UA",
  american: "AA",
  delta: "DL",
  "air france": "AF",
  klm: "KL",
  "air canada": "AC",
  "virgin atlantic": "VS",
  "swiss": "LX",
  eva: "BR",
  "eva air": "BR",
  "starlux": "JX",
  "korean air": "KE",
  asiana: "OZ",
  "turkish": "TK",
  "thai": "TG",
  qantas: "QF",
  iberia: "IB",
  finnair: "AY",
  "aer lingus": "EI",
  "avianca": "AV",
  "copa": "CM",
  latam: "LA",
  "air new zealand": "NZ",
  jetblue: "B6",
  alaska: "AS",
  "air india": "AI",
  "saudia": "SV",
};

function detectCarrier(title: string): string | undefined {
  const lower = title.toLowerCase();
  for (const [alias, code] of Object.entries(CARRIER_ALIASES)) {
    if (new RegExp(`(?<![a-z])${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z])`, "i").test(lower)) return code;
  }
  for (const a of AIRLINES) {
    if (a.name.length >= 6 && lower.includes(a.name.toLowerCase())) return a.iata;
  }
  return undefined;
}

function suggestFromTitle(title: string): Suggestion {
  if (title.trim().length < 4) return {};
  const intent = parseIntentHeuristic(title);
  const s: Suggestion = {};
  const o = intent.origin[0];
  const d = intent.destination[0];
  if (o && o.length === 3 && getAirport(o)) s.origin = o;
  if (d && d.length === 3 && getAirport(d)) s.destination = d;
  for (const [re, cabin] of CABIN_RE) {
    if (re.test(title)) {
      s.cabin = cabin;
      break;
    }
  }
  const program = intent.programs.map((id) => getProgram(id)).find((p) => p && p.kind !== "bank");
  if (program) s.programId = program.id;
  const carrier = detectCarrier(title) ?? program?.airline;
  if (carrier) s.carrier = carrier;
  return s;
}

// ─── Component ────────────────────────────────────────────────

export function ComposeForm({ suggestedTags = [] }: { suggestedTags?: string[] }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [tagDraft, setTagDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const suggestion = useMemo(() => suggestFromTitle(form.title), [form.title]);
  const pendingSuggestions = useMemo(() => {
    const out: { key: keyof Suggestion; label: string; apply: () => void }[] = [];
    if (suggestion.origin && suggestion.destination && (form.origin !== suggestion.origin || form.destination !== suggestion.destination)) {
      out.push({
        key: "origin",
        label: `${suggestion.origin}→${suggestion.destination}`,
        apply: () => {
          set("origin", suggestion.origin!);
          set("destination", suggestion.destination!);
        },
      });
    } else if (suggestion.destination && !suggestion.origin && form.destination !== suggestion.destination) {
      out.push({ key: "destination", label: `→ ${suggestion.destination}`, apply: () => set("destination", suggestion.destination!) });
    }
    if (suggestion.cabin && form.cabin !== suggestion.cabin) {
      const cabin = suggestion.cabin;
      out.push({ key: "cabin", label: CABIN_LABEL[cabin], apply: () => set("cabin", cabin) });
    }
    if (suggestion.programId && form.programId !== suggestion.programId) {
      const id = suggestion.programId;
      out.push({ key: "programId", label: getProgram(id)?.shortName ?? id, apply: () => set("programId", id) });
    }
    if (suggestion.carrier && form.carrier !== suggestion.carrier) {
      const code = suggestion.carrier;
      out.push({ key: "carrier", label: getAirline(code)?.name ?? code, apply: () => set("carrier", code) });
    }
    return out;
  }, [suggestion, form.origin, form.destination, form.cabin, form.programId, form.carrier]);

  const applyAll = () => {
    pendingSuggestions.forEach((s) => s.apply());
    setDetailsOpen(true);
  };

  // Derived numbers
  const miles = parseNumber(form.miles);
  const taxes = parseNumber(form.taxes);
  const cash = parseNumber(form.cash);
  const cpp = miles != null && cash != null ? computeCpp(cash, miles, taxes ?? 0) : null;

  const originAirport = form.origin.length === 3 ? getAirport(form.origin) : undefined;
  const destinationAirport = form.destination.length === 3 ? getAirport(form.destination) : undefined;
  const carrierAirline = form.carrier.length === 2 ? getAirline(form.carrier) : undefined;
  const program = form.programId ? getProgram(form.programId) : undefined;

  const preview: Find | null = useMemo(() => {
    const hasAny = (form.origin && form.destination) || form.cabin || form.programId || miles != null || taxes != null;
    if (!hasAny) return null;
    return {
      id: "preview",
      author: { id: "me", handle: "you", name: "You", avatarSeed: "you", plan: "free" },
      title: form.title,
      body: form.body,
      origin: form.origin.length === 3 ? form.origin.toUpperCase() : undefined,
      destination: form.destination.length === 3 ? form.destination.toUpperCase() : undefined,
      carrier: form.carrier.length === 2 ? form.carrier.toUpperCase() : undefined,
      cabin: form.cabin ?? undefined,
      programId: form.programId || undefined,
      miles: miles ?? undefined,
      taxesUsd: taxes ?? undefined,
      cpp: cpp ?? undefined,
      travelDate: form.travelDate ?? undefined,
      tags: form.tags,
      likes: 0,
      comments: 0,
      createdAt: new Date().toISOString(),
    };
  }, [form, miles, taxes, cpp]);

  // Tags
  const addTag = (raw: string) => {
    const tag = slugTag(raw);
    if (!tag) return;
    setForm((f) => {
      if (f.tags.includes(tag) || f.tags.length >= MAX_TAGS) return f;
      return { ...f, tags: [...f.tags, tag] };
    });
    setTagDraft("");
  };
  const removeTag = (tag: string) => setForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }));
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagDraft);
    } else if (e.key === "Backspace" && !tagDraft && form.tags.length) {
      removeTag(form.tags[form.tags.length - 1]);
    }
  };

  // Validation
  const validate = (): Errors => {
    const e: Errors = {};
    const title = form.title.trim();
    const body = form.body.trim();
    if (title.length < TITLE_MIN) e.title = `Give it a title of at least ${TITLE_MIN} characters.`;
    else if (title.length > TITLE_MAX) e.title = `Keep the title under ${TITLE_MAX} characters.`;
    if (body.length < BODY_MIN) e.body = `Tell the story — at least ${BODY_MIN} characters.`;
    else if (body.length > BODY_MAX) e.body = `Keep the body under ${fmtInt(BODY_MAX)} characters.`;
    if (form.origin && form.origin.length !== 3) e.origin = "Use a 3-letter IATA code, like JFK.";
    if (form.destination && form.destination.length !== 3) e.destination = "Use a 3-letter IATA code, like HND.";
    if ((form.origin && !form.destination) || (!form.origin && form.destination)) {
      e[form.origin ? "destination" : "origin"] = "Add both ends of the route.";
    }
    if (form.carrier && form.carrier.length !== 2) e.carrier = "Use the 2-letter airline code, like NH.";
    if (form.miles && miles == null) e.miles = "Enter a whole number of miles or points.";
    if (miles != null && miles > 5_000_000) e.miles = "That's more than 5,000,000 — double-check.";
    if (form.taxes && taxes == null) e.taxes = "Enter a dollar amount.";
    if (taxes != null && taxes > 20_000) e.taxes = "Taxes over $20,000? Double-check.";
    if (form.cash && cash == null) e.cash = "Enter a dollar amount.";
    return e;
  };

  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      const firstKey = Object.keys(e)[0];
      document.getElementById(`compose-${firstKey}`)?.focus();
      return;
    }
    setSubmitting(true);
    setRateLimited(false);
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        origin: form.origin || undefined,
        destination: form.destination || undefined,
        carrier: form.carrier || undefined,
        cabin: form.cabin ?? undefined,
        programId: form.programId || undefined,
        miles: miles ?? undefined,
        taxesUsd: taxes ?? undefined,
        cpp: cpp ?? undefined,
        travelDate: form.travelDate ?? undefined,
        tags: form.tags,
      };
      const { find } = await apiPost<{ find: Find }>("/api/finds", payload);
      toast.success("Find shared", { description: "Thanks for feeding the flock." });
      router.push(`/finds/${find.id}`);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError) {
        if (err.unauthenticated) {
          toast.info("Sign in to share a find");
          router.push(loginHref("/finds/new"));
          return;
        }
        if (err.status === 429) {
          setRateLimited(true);
          toast.warning("Easy there", { description: err.message });
          return;
        }
        if (err.status === 400 && Array.isArray(err.extra.issues)) {
          const fieldErrors: Errors = {};
          for (const issue of err.extra.issues as { path?: (string | number)[]; message?: string }[]) {
            const key = API_FIELD[String(issue.path?.[0] ?? "")];
            if (key) fieldErrors[key] = issue.message ?? "Check this field.";
          }
          setErrors(Object.keys(fieldErrors).length ? fieldErrors : { form: err.message });
          return;
        }
        setErrors({ form: err.message });
        toast.error("Couldn't publish", { description: err.message });
        return;
      }
      setErrors({ form: "Something went wrong. Try again." });
    }
  };

  const titleLen = form.title.trim().length;
  const bodyLen = form.body.trim().length;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {/* ── Title ───────────────────────────────────────── */}
      <Field
        label="Title"
        required
        id="compose-title"
        error={errors.title}
        hint={!errors.title ? "Say what you booked, how, and for how much. Route and cabin go a long way." : undefined}
        labelAction={
          <span className={cn("font-mono tnum", titleLen > TITLE_MAX && "text-rose")}>
            {titleLen}/{TITLE_MAX}
          </span>
        }
      >
        <Input
          size="lg"
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="ANA First JFK→HND for 72.5k Virgin points"
          maxLength={TITLE_MAX + 20}
          autoFocus
          className="font-display text-lg"
        />
      </Field>

      {pendingSuggestions.length > 0 && (
        <div className="-mt-2 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-violet/25 bg-violet-soft px-3.5 py-2.5 animate-rise" role="status">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-violet">
            <Sparkles className="size-3.5" aria-hidden="true" />
            Looks like:
          </span>
          {pendingSuggestions.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => {
                s.apply();
                setDetailsOpen(true);
              }}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-full border border-violet/30 bg-bg-elev-1 px-2.5 font-mono text-xs text-fg transition-colors hover:border-violet hover:bg-violet-soft",
                focusRing,
              )}
              title="Use this value"
            >
              <Plus className="size-3 text-violet" aria-hidden="true" />
              {s.label}
            </button>
          ))}
          {pendingSuggestions.length > 1 && (
            <Button type="button" variant="ghost" size="sm" onClick={applyAll} className="ml-auto h-7 px-2.5 text-xs text-violet hover:bg-violet-soft">
              Use all
            </Button>
          )}
        </div>
      )}

      {/* ── Body ────────────────────────────────────────── */}
      <Field
        label="The story"
        required
        id="compose-body"
        error={errors.body}
        hint={
          !errors.body ? (
            <>
              How you found it, what it cost, what you&apos;d do differently. Markdown works: <code className="font-mono">**bold**</code>, lists, links.
            </>
          ) : undefined
        }
        labelAction={
          <span className={cn("font-mono tnum", bodyLen > BODY_MAX && "text-rose")}>
            {fmtInt(bodyLen)}/{fmtInt(BODY_MAX)}
          </span>
        }
      >
        <Textarea
          value={form.body}
          onChange={(e) => set("body", e.target.value)}
          rows={7}
          autoResize
          placeholder="Set an alert for November and it fired at 2:14am. Transferred Amex → Virgin instantly (30% bonus running), booked by 2:30…"
          className="min-h-44 text-[15px]"
        />
      </Field>

      {/* ── Redemption details ──────────────────────────── */}
      <Panel padding="none" grain>
        <button
          type="button"
          onClick={() => setDetailsOpen((o) => !o)}
          aria-expanded={detailsOpen}
          aria-controls="compose-details"
          className={cn("flex w-full items-center justify-between gap-4 px-5 py-4 text-left sm:px-6", focusRing)}
        >
          <span>
            <span className="block font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">Optional</span>
            <span className="mt-1 block font-display text-lg tracking-tight text-fg sm:text-xl">Redemption details</span>
            <span className="mt-0.5 block text-sm text-fg-muted">Turns your post into a ticket other people can search.</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-fg-subtle transition-transform duration-200", detailsOpen && "rotate-180")} aria-hidden="true" />
        </button>

        {detailsOpen && (
          <div id="compose-details" className="border-t border-panel-border px-5 pb-6 pt-5 sm:px-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="From"
                id="compose-origin"
                error={errors.origin}
                hint={
                  originAirport ? (
                    <span className="inline-flex items-center gap-1 text-aurora">
                      <Check className="size-3.5" aria-hidden="true" />
                      {originAirport.city} · {originAirport.name}
                    </span>
                  ) : form.origin.length === 3 ? (
                    <span className="text-gold">Not in our airport list — double-check the code.</span>
                  ) : (
                    "IATA code"
                  )
                }
              >
                <Input
                  mono
                  value={form.origin}
                  onChange={(e) => set("origin", e.target.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3))}
                  placeholder="JFK"
                  maxLength={3}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>
              <Field
                label="To"
                id="compose-destination"
                error={errors.destination}
                hint={
                  destinationAirport ? (
                    <span className="inline-flex items-center gap-1 text-aurora">
                      <Check className="size-3.5" aria-hidden="true" />
                      {destinationAirport.city} · {destinationAirport.name}
                    </span>
                  ) : form.destination.length === 3 ? (
                    <span className="text-gold">Not in our airport list — double-check the code.</span>
                  ) : (
                    "IATA code"
                  )
                }
              >
                <Input
                  mono
                  value={form.destination}
                  onChange={(e) => set("destination", e.target.value.replace(/[^a-z]/gi, "").toUpperCase().slice(0, 3))}
                  placeholder="HND"
                  maxLength={3}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>

              <Field
                label="Carrier"
                id="compose-carrier"
                error={errors.carrier}
                hint={carrierAirline ? <span className="text-aurora">{carrierAirline.name}</span> : "2-letter airline code"}
              >
                <Input
                  mono
                  value={form.carrier}
                  onChange={(e) => set("carrier", e.target.value.replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 2))}
                  placeholder="NH"
                  maxLength={2}
                  autoComplete="off"
                  spellCheck={false}
                />
              </Field>

              <Field label="Program" id="compose-programId" hint={program ? program.name : "Whose miles paid for it"}>
                <Select
                  value={form.programId || "none"}
                  onValueChange={(v) => set("programId", v === "none" ? "" : v)}
                  placeholder="Choose a program"
                  options={[{ value: "none", label: "No program" }, ...PROGRAM_OPTIONS]}
                />
              </Field>

              <div className="sm:col-span-2">
                <Field label="Cabin" hint={form.cabin ? undefined : "Which cabin you flew"}>
                  <div className="flex flex-wrap items-center gap-2">
                    <CabinPicker value={form.cabin ?? ("" as Cabin)} onChange={(c) => set("cabin", c)} size="md" />
                    {form.cabin && (
                      <>
                        <span className="font-mono text-xs text-fg-subtle">
                          {CABIN_SHORT[form.cabin]} · {CABIN_LABEL[form.cabin]}
                        </span>
                        <button
                          type="button"
                          onClick={() => set("cabin", null)}
                          className={cn(
                            "inline-flex h-8 items-center gap-1 rounded-full px-2.5 font-mono text-xs text-fg-subtle transition-colors hover:bg-fg/6 hover:text-fg",
                            focusRing,
                          )}
                        >
                          <X className="size-3" aria-hidden="true" />
                          Clear
                        </button>
                      </>
                    )}
                  </div>
                </Field>
              </div>

              <Field label="Miles or points" id="compose-miles" error={errors.miles} hint={program ? program.currency : undefined}>
                <Input
                  inputMode="numeric"
                  value={form.miles}
                  onChange={(e) => set("miles", e.target.value.replace(/[^\d,]/g, ""))}
                  placeholder="72,500"
                  className="font-mono tnum"
                  autoComplete="off"
                />
              </Field>
              <Field label="Taxes & fees" id="compose-taxes" error={errors.taxes} hint="USD, per person">
                <Input
                  inputMode="decimal"
                  leading={<span className="font-mono text-sm">$</span>}
                  value={form.taxes}
                  onChange={(e) => set("taxes", e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="168"
                  className="font-mono tnum"
                  autoComplete="off"
                />
              </Field>

              <Field label="Cash price" id="compose-cash" optional error={errors.cash} hint="What the same seat cost in cash — we'll work out the value.">
                <Input
                  inputMode="decimal"
                  leading={<span className="font-mono text-sm">$</span>}
                  value={form.cash}
                  onChange={(e) => set("cash", e.target.value.replace(/[^\d.,]/g, ""))}
                  placeholder="9,800"
                  className="font-mono tnum"
                  autoComplete="off"
                />
              </Field>
              <Field label="Value" hint={cpp != null ? "(cash − taxes) ÷ miles" : "Needs miles and a cash price"}>
                <div className="flex h-11 items-center gap-2 rounded-[var(--radius)] border border-dashed border-panel-border bg-bg-elev-1/50 px-3.5 font-mono text-sm tnum">
                  {cpp != null ? (
                    <>
                      <span className={cn("text-lg font-semibold", cpp >= 4 ? "text-gold" : cpp >= 2 ? "text-aurora" : "text-fg")}>{fmtCpp(cpp)}</span>
                      <span className="text-fg-subtle">per point</span>
                    </>
                  ) : (
                    <span className="text-fg-subtle">—</span>
                  )}
                </div>
              </Field>

              <div className="sm:col-span-2">
                <Field label="Travel date" optional hint="When you flew, or will.">
                  <DatePicker value={form.travelDate} onChange={(iso) => set("travelDate", iso)} allowPast placeholder="Pick a date" className="sm:max-w-xs" />
                </Field>
              </div>
            </div>

            {preview && (
              <div className="mt-6">
                <p className="mb-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle">Preview</p>
                <RedemptionStrip find={preview} />
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* ── Tags ────────────────────────────────────────── */}
      <Field
        label="Tags"
        id="compose-tags"
        hint={`Enter or comma to add · up to ${MAX_TAGS}`}
        labelAction={
          <span className="font-mono tnum">
            {form.tags.length}/{MAX_TAGS}
          </span>
        }
      >
        <div
          className={cn(
            "flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 px-2.5 py-1.5 transition-[border-color,box-shadow] focus-within:border-signal/60 focus-within:ring-[3px] focus-within:ring-signal/20 hover:border-panel-border-strong",
          )}
          onClick={(e) => (e.currentTarget.querySelector("input") as HTMLInputElement | null)?.focus()}
        >
          {form.tags.map((t) => (
            <span key={t} className="inline-flex h-7 items-center gap-1 rounded-full border border-signal/30 bg-signal-soft pl-2.5 pr-1 font-mono text-xs text-signal">
              #{t}
              <button
                type="button"
                onClick={() => removeTag(t)}
                aria-label={`Remove tag ${t}`}
                className={cn("grid size-5 place-items-center rounded-full hover:bg-signal/20", focusRing)}
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
          <input
            id="compose-tags"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={onTagKey}
            onBlur={() => tagDraft && addTag(tagDraft)}
            disabled={form.tags.length >= MAX_TAGS}
            placeholder={form.tags.length ? "" : "sweet-spot, aeroplan, japan"}
            className="h-7 min-w-32 flex-1 bg-transparent font-mono text-sm text-fg outline-none placeholder:font-sans placeholder:text-fg-subtle disabled:cursor-not-allowed"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </Field>
      {suggestedTags.length > 0 && form.tags.length < MAX_TAGS && (
        <div className="-mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-fg-subtle">Popular:</span>
          {suggestedTags
            .filter((t) => !form.tags.includes(t))
            .slice(0, 8)
            .map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => addTag(t)}
                className={cn(
                  "inline-flex h-6 items-center gap-0.5 rounded-full border border-panel-border bg-bg-elev-1 px-2 font-mono text-[11px] text-fg-muted transition-colors hover:border-panel-border-strong hover:text-fg",
                  focusRing,
                )}
              >
                <Plus className="size-3 opacity-60" aria-hidden="true" />
                {t}
              </button>
            ))}
        </div>
      )}

      {/* ── Errors & submit ─────────────────────────────── */}
      {(errors.form || rateLimited) && (
        <p role="alert" className="rounded-[var(--radius)] border border-rose/30 bg-rose-soft px-4 py-3 text-sm text-rose">
          {rateLimited ? "You've shared a lot in the last hour. Take a breather and try again a little later." : errors.form}
        </p>
      )}

      <div className="flex flex-col-reverse items-stretch gap-3 border-t border-panel-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-fg-subtle">No referral links, no selling miles. Be the finder you&apos;d want to follow.</p>
        <div className="flex items-center gap-2 sm:justify-end">
          <Button variant="ghost" href="/finds">
            Cancel
          </Button>
          <Button type="submit" loading={submitting} disabled={rateLimited}>
            Share find
          </Button>
        </div>
      </div>
    </form>
  );
}

function parseNumber(raw: string): number | null {
  const s = raw.replace(/[,\s]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}
