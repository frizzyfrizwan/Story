"use client";

import { useCallback, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Check, MapPin, X } from "lucide-react";
import type { Airport, Cabin } from "@/lib/types";
import { CABINS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ApiError, apiGet, apiPatch } from "@/lib/client/api";
import { AirportCombobox } from "@/components/ui/airport-combobox";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { CabinPicker } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { focusRing } from "@/components/ui/tokens";
import { useTheme, type Theme } from "@/components/ui/use-theme";

export interface ProfilePreferences {
  theme?: "dark" | "light";
  defaultCabin?: string;
  currency?: string;
  emailDigest?: boolean;
  pushAlerts?: boolean;
}

export interface ProfileFormData {
  displayName: string;
  handle: string;
  bio: string;
  homeAirport: string | null;
  preferences: ProfilePreferences;
}

export interface ProfileFormProps {
  profile: ProfileFormData;
  /** Whether this deployment can actually send email (Resend configured). */
  emailConfigured: boolean;
}

const CURRENCIES = [
  { value: "USD", label: "USD", description: "US dollar" },
  { value: "EUR", label: "EUR", description: "Euro" },
  { value: "GBP", label: "GBP", description: "British pound" },
  { value: "CAD", label: "CAD", description: "Canadian dollar" },
  { value: "AUD", label: "AUD", description: "Australian dollar" },
];

const THEMES = [
  { value: "dark", label: "Flight deck", description: "Dark — the default" },
  { value: "light", label: "Paper", description: "Light, warm" },
];

const BIO_MAX = 280;

function isCabin(v: unknown): v is Cabin {
  return typeof v === "string" && (CABINS as readonly string[]).includes(v);
}

const fetchAirports = (q: string) => apiGet<Airport[]>("/api/airports", { q, limit: 8 });

function normalise(p: ProfileFormData): ProfileFormData {
  return {
    displayName: p.displayName.trim(),
    handle: p.handle.trim().toLowerCase(),
    bio: p.bio.trim(),
    homeAirport: p.homeAirport ? p.homeAirport.toUpperCase() : null,
    preferences: {
      theme: p.preferences.theme,
      defaultCabin: p.preferences.defaultCabin,
      currency: p.preferences.currency,
      emailDigest: p.preferences.emailDigest,
      pushAlerts: p.preferences.pushAlerts,
    },
  };
}

/**
 * Profile + preferences. One explicit "Save changes" for everything so nothing
 * is silently persisted; the theme preview applies instantly because it is
 * harmless and local.
 */
export function ProfileForm({ profile, emailConfigured }: ProfileFormProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [saved, setSaved] = useState<ProfileFormData>(() => normalise(profile));
  const [form, setForm] = useState<ProfileFormData>(() => normalise(profile));
  const [handleError, setHandleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = useMemo(() => JSON.stringify(normalise(form)) !== JSON.stringify(saved), [form, saved]);

  const patch = useCallback(<K extends keyof ProfileFormData>(key: K, value: ProfileFormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
  }, []);
  const patchPref = useCallback(<K extends keyof ProfilePreferences>(key: K, value: ProfilePreferences[K]) => {
    setForm((f) => ({ ...f, preferences: { ...f.preferences, [key]: value } }));
  }, []);

  // The shell's theme is the live value when the profile hasn't chosen one yet.
  const themeValue: Theme = form.preferences.theme ?? theme;
  const cabinValue: Cabin = isCabin(form.preferences.defaultCabin) ? form.preferences.defaultCabin : "business";

  function discard() {
    setForm(saved);
    setHandleError(null);
    if (saved.preferences.theme && saved.preferences.theme !== theme) setTheme(saved.preferences.theme);
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || saving) return;
    const next = normalise(form);

    if (next.displayName.length < 2) {
      toast.error("Display name needs at least 2 characters.");
      return;
    }
    if (!/^[a-z0-9_]{3,24}$/.test(next.handle)) {
      setHandleError("3–24 characters: lowercase letters, numbers and underscores.");
      return;
    }

    // Send only what changed so an untouched handle never trips the availability check.
    const body: Record<string, unknown> = {};
    if (next.displayName !== saved.displayName) body.displayName = next.displayName;
    if (next.handle !== saved.handle) body.handle = next.handle;
    if (next.bio !== saved.bio) body.bio = next.bio;
    if (next.homeAirport !== saved.homeAirport) body.homeAirport = next.homeAirport;
    if (JSON.stringify(next.preferences) !== JSON.stringify(saved.preferences)) body.preferences = next.preferences;

    setSaving(true);
    setHandleError(null);
    try {
      await apiPatch<{ profile: unknown }>("/api/profile", body);
      setSaved(next);
      setForm(next);
      toast.success("Profile saved", { description: "Your changes are live across Kestrel." });
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.unauthenticated) {
        window.location.assign("/login?next=/settings");
        return;
      }
      const message = err instanceof Error ? err.message : "Could not save your profile.";
      if (/handle/i.test(message)) setHandleError(message);
      else toast.error("Couldn't save", { description: message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6" aria-describedby="profile-form-status">
      <Panel as="div" eyebrow="Profile" title="How you appear on Kestrel" description="Your name and handle show on Finds you post.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Display name" required>
            <Input
              value={form.displayName}
              onChange={(e) => patch("displayName", e.target.value)}
              autoComplete="name"
              maxLength={60}
              placeholder="Your name"
            />
          </Field>
          <Field
            label="Handle"
            required
            error={handleError}
            hint={handleError ? undefined : "Lowercase letters, numbers and underscores."}
          >
            <Input
              value={form.handle}
              onChange={(e) => {
                setHandleError(null);
                patch("handle", e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 24));
              }}
              leading={<AtSign aria-hidden="true" />}
              autoComplete="username"
              spellCheck={false}
              placeholder="handle"
              className="font-mono"
            />
          </Field>
          <Field
            label="Bio"
            className="sm:col-span-2"
            labelAction={
              <span className={cn("font-mono tnum", form.bio.length > BIO_MAX ? "text-rose" : undefined)}>
                {form.bio.length}/{BIO_MAX}
              </span>
            }
            error={form.bio.length > BIO_MAX ? `Keep it under ${BIO_MAX} characters.` : undefined}
          >
            <Textarea
              value={form.bio}
              onChange={(e) => patch("bio", e.target.value)}
              rows={3}
              autoResize
              placeholder="What do you fly for? Favourite sweet spot?"
            />
          </Field>
          <Field
            label="Home airport"
            hint="Pre-fills search and tells alerts where you start from."
            className="sm:col-span-2"
          >
            <div className="flex items-center gap-2">
              <AirportCombobox
                value={form.homeAirport ? [form.homeAirport] : []}
                onChange={(codes) => patch("homeAirport", codes[0] ?? null)}
                fetcher={fetchAirports}
                placeholder="Pick your home airport"
                label="Home airport"
                className="flex-1"
              />
              {form.homeAirport && (
                <button
                  type="button"
                  onClick={() => patch("homeAirport", null)}
                  aria-label="Clear home airport"
                  className={cn(
                    "grid size-11 shrink-0 place-items-center rounded-full border border-panel-border bg-bg-elev-1 text-fg-subtle transition-colors hover:border-panel-border-strong hover:text-fg",
                    focusRing,
                  )}
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              )}
            </div>
          </Field>
        </div>
      </Panel>

      <Panel as="div" eyebrow="Preferences" title="Defaults" description="Applied to every search and alert you create.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Theme" hint="Previewed instantly; saved with the rest.">
            <Select
              value={themeValue}
              onValueChange={(v) => {
                const t = v === "light" ? "light" : "dark";
                patchPref("theme", t);
                setTheme(t);
              }}
              options={THEMES}
              aria-label="Theme"
            />
          </Field>
          <Field label="Currency" hint="For taxes, fees and cash comparisons.">
            <Select
              value={form.preferences.currency ?? "USD"}
              onValueChange={(v) => patchPref("currency", v)}
              options={CURRENCIES}
              aria-label="Currency"
            />
          </Field>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[13px] font-medium text-fg-muted">Default cabin</span>
            <CabinPicker value={cabinValue} onChange={(c) => patchPref("defaultCabin", c)} fullWidth />
          </div>
        </div>

        <div className="mt-6 divide-y divide-panel-border border-t border-panel-border">
          <Switch
            className="py-3"
            label="Email digest"
            description={
              emailConfigured
                ? "One email per alert scan that finds seats, grouped by alert. Nothing else is scheduled."
                : "Saved for later — this deployment has no email provider configured, so nothing will send yet."
            }
            checked={Boolean(form.preferences.emailDigest)}
            onCheckedChange={(v) => patchPref("emailDigest", v)}
          />
          <Switch
            className="py-3"
            label="Push alerts"
            description="Alert hits show in your notifications bell. Browser push follows when it ships."
            checked={Boolean(form.preferences.pushAlerts)}
            onCheckedChange={(v) => patchPref("pushAlerts", v)}
          />
        </div>
      </Panel>

      <div className="sticky bottom-20 z-20 lg:bottom-4">
        <div
          className={cn(
            "panel panel-strong flex flex-col gap-3 px-4 py-3 transition-opacity sm:flex-row sm:items-center sm:justify-between",
            !dirty && "opacity-80",
          )}
        >
          <p id="profile-form-status" className="flex items-center gap-2 text-[13px] text-fg-muted" aria-live="polite">
            {dirty ? (
              <>
                <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />
                Unsaved changes
              </>
            ) : (
              <>
                <Check className="size-3.5 text-aurora" aria-hidden="true" />
                Everything is saved
              </>
            )}
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={discard} disabled={!dirty || saving}>
              Discard
            </Button>
            <Button type="submit" size="sm" loading={saving} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        </div>
      </div>

      <p className="flex items-center gap-1.5 text-[12px] text-fg-subtle">
        <MapPin className="size-3.5" aria-hidden="true" />
        Airport search runs on Kestrel&apos;s curated list of ~450 airports; metro codes like NYC are accepted too.
      </p>
    </form>
  );
}
