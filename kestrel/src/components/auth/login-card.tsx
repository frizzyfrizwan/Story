"use client";

import { useEffect, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { ArrowRight, ChevronDown, CircleAlert, Mail, MailCheck, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Divider } from "@/components/ui/divider";
import { Field, Input } from "@/components/ui/input";
import { Panel } from "@/components/ui/panel";
import { Spinner } from "@/components/ui/spinner";
import { focusRing } from "@/components/ui/tokens";

/** Server-known provider status — the first render uses this, then /api/auth/providers confirms. */
export interface LoginStatus {
  googleAuth: boolean;
  email: boolean;
  demoMode: boolean;
}

export interface LoginCardProps {
  /** Where to land after sign-in (already validated as a relative path). */
  next: string;
  /** Auth.js error code from `?error=`. */
  error?: string;
  status: LoginStatus;
  className?: string;
}

/** Auth.js error codes → sentences a person can act on. */
const ERROR_TEXT: Record<string, string> = {
  OAuthSignin: "We couldn't start the Google sign-in. Please try again.",
  OAuthCallback: "Google didn't finish the sign-in. Please try again.",
  OAuthCreateAccount: "We couldn't create an account from that Google profile. Try the email link instead.",
  EmailCreateAccount: "We couldn't create your account. Please try again.",
  Callback: "Sign-in was interrupted before it finished. Please try again.",
  OAuthAccountNotLinked:
    "That email already has a Kestrel account with a different sign-in method. Use the method you first signed up with.",
  EmailSignin: "We couldn't send the sign-in email. Check the address and try again.",
  CredentialsSignin: "That demo account isn't available right now. Pick another persona or try again.",
  SessionRequired: "Please sign in to open that page.",
  AccessDenied: "This account isn't allowed to sign in.",
  Verification: "That sign-in link has expired or was already used. Request a fresh one below.",
  Configuration: "Sign-in isn't configured correctly on this deployment. Check the server logs.",
  Default: "Something went wrong while signing in. Please try again.",
};

export function describeAuthError(code?: string | null): string | null {
  if (!code) return null;
  return ERROR_TEXT[code] ?? ERROR_TEXT.Default;
}

interface Persona {
  id: string;
  name: string;
  handle: string;
  blurb: string;
  plan: "free" | "pro";
}

/** The three personas on the card; the rest are a click away. Mirrors `SEED_PERSONAS`. */
const FEATURED: Persona[] = [
  { id: "explorer", name: "Demo Explorer", handle: "explorer", blurb: "Pro · NYC · seeded wallet & alerts", plan: "pro" },
  { id: "pointsdad", name: "Marcus T.", handle: "pointsdad", blurb: "Family of four on points", plan: "free" },
  { id: "suitelife", name: "Lena K.", handle: "suitelife", blurb: "First-class hunter", plan: "pro" },
];

const MORE: Persona[] = [
  { id: "mileage_maven", name: "Priya N.", handle: "mileage_maven", blurb: "Aeroplan + Avios tactician", plan: "pro" },
  { id: "jetsetjules", name: "Jules A.", handle: "jetsetjules", blurb: "Hotels first", plan: "pro" },
  { id: "avgeek_anna", name: "Anna R.", handle: "avgeek_anna", blurb: "Books for the aircraft", plan: "free" },
  { id: "theredeye", name: "Dev P.", handle: "theredeye", blurb: "Last-minute hunter", plan: "free" },
];

type Providers = { google: boolean; resend: boolean; demo: boolean };

function GoogleGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.46a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.58-5.17 3.58-8.66z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.09A12 12 0 0 0 12 24z"
      />
      <path fill="#FBBC05" d="M5.29 14.29A7.2 7.2 0 0 1 4.91 12c0-.8.14-1.57.38-2.29V6.62H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.38l4.01-3.09z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.23 0 12 0A12 12 0 0 0 1.28 6.62l4.01 3.09C6.23 6.86 8.88 4.75 12 4.75z"
      />
    </svg>
  );
}

/**
 * The sign-in panel. Renders only the methods this deployment actually has:
 * Google (OAuth), a Resend magic link, and demo personas when demo mode is on.
 */
export function LoginCard({ next, error, status, className }: LoginCardProps) {
  const [providers, setProviders] = useState<Providers>({
    google: status.googleAuth,
    resend: status.email,
    demo: status.demoMode,
  });
  const [providersChecked, setProvidersChecked] = useState(false);
  const [banner, setBanner] = useState<string | null>(describeAuthError(error));

  const [email, setEmail] = useState("");
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState<string | null>(null);

  const [busyPersona, setBusyPersona] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showMore, setShowMore] = useState(false);

  // Confirm the provider list against Auth.js so the card never offers a dead button.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers", { headers: { accept: "application/json" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: Record<string, unknown> | null) => {
        if (cancelled || !json || typeof json !== "object") return;
        setProviders({ google: "google" in json, resend: "resend" in json, demo: "demo" in json });
        setProvidersChecked(true);
      })
      .catch(() => {
        /* keep the server's answer */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const anyMethod = providers.google || providers.resend || providers.demo;

  async function startGoogle() {
    setBanner(null);
    setGoogleBusy(true);
    try {
      await signIn("google", { redirectTo: next });
    } catch {
      setGoogleBusy(false);
      setBanner(ERROR_TEXT.OAuthSignin);
    }
  }

  async function sendMagicLink(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const address = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setEmailError("Enter a valid email address.");
      return;
    }
    setEmailError(null);
    setBanner(null);
    setEmailState("sending");
    try {
      const res = await signIn("resend", { email: address, redirectTo: next, redirect: false });
      if (!res || res.error) {
        setEmailState("idle");
        setEmailError(describeAuthError(res?.error ?? "EmailSignin"));
        return;
      }
      setEmailState("sent");
    } catch {
      setEmailState("idle");
      setEmailError(ERROR_TEXT.EmailSignin);
    }
  }

  async function startDemo(persona: string) {
    setBanner(null);
    setBusyPersona(persona);
    try {
      const res = await signIn("demo", { persona, redirectTo: next, redirect: false });
      if (!res || res.error) {
        setBusyPersona(null);
        setBanner(describeAuthError(res?.error ?? "CredentialsSignin"));
        return;
      }
      // Hard navigation so the server-rendered shell picks up the new session cookie.
      window.location.assign(res.url ?? next);
    } catch {
      setBusyPersona(null);
      setBanner(ERROR_TEXT.Default);
    }
  }

  return (
    <Panel
      as="div"
      strong
      grain
      padding="lg"
      rise
      className={cn("w-full", className)}
      bodyClassName="flex flex-col gap-6"
      aria-labelledby="login-title"
    >
      <div>
        <p className="font-mono text-[10.5px] uppercase tracking-[0.2em] text-signal">Sign in</p>
        <h2 id="login-title" className="mt-1.5 font-display text-2xl leading-tight tracking-tight text-fg sm:text-[1.75rem]">
          Welcome aboard
        </h2>
        <p className="mt-1.5 text-sm text-fg-muted">
          No passwords. Pick a method below and you&apos;re in.
        </p>
      </div>

      {banner && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-[var(--radius-sm)] border border-rose/30 bg-rose-soft px-3.5 py-3 text-[13px] leading-relaxed text-fg"
        >
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-rose" aria-hidden="true" />
          <span>{banner}</span>
        </div>
      )}

      {providers.google && (
        <Button
          type="button"
          variant="secondary"
          size="lg"
          onClick={startGoogle}
          loading={googleBusy}
          leading={<GoogleGlyph />}
          className="w-full"
        >
          Continue with Google
        </Button>
      )}

      {providers.resend && (
        <>
          {providers.google && <Divider label="or" />}
          {emailState === "sent" ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-[var(--radius)] border border-aurora/30 bg-aurora-soft px-4 py-3.5"
            >
              <MailCheck className="mt-0.5 size-5 shrink-0 text-aurora" aria-hidden="true" />
              <div className="min-w-0 text-sm">
                <p className="font-medium text-fg">Check your inbox</p>
                <p className="mt-0.5 text-fg-muted">
                  We sent a sign-in link to <span className="font-medium text-fg">{email.trim()}</span>. It expires in
                  24 hours and works once.
                </p>
                <button
                  type="button"
                  onClick={() => setEmailState("idle")}
                  className={cn("mt-2 rounded-[4px] text-[13px] font-medium text-signal underline-offset-4 hover:underline", focusRing)}
                >
                  Use a different address
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={sendMagicLink} className="flex flex-col gap-3" noValidate>
              <Field label="Email" error={emailError} hint={emailError ? undefined : "We'll email you a one-time sign-in link."}>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  inputMode="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leading={<Mail aria-hidden="true" />}
                  required
                />
              </Field>
              <Button type="submit" size="lg" loading={emailState === "sending"} trailing={<ArrowRight />} className="w-full">
                Email me a sign-in link
              </Button>
            </form>
          )}
        </>
      )}

      {providers.demo && (
        <>
          {(providers.google || providers.resend) && <Divider label="or try the demo" />}
          <section aria-labelledby="demo-title" className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h3 id="demo-title" className="flex items-center gap-2 text-sm font-medium text-fg">
                <Sparkles className="size-4 text-gold" aria-hidden="true" />
                Try the demo
              </h3>
              <Badge variant="gold" size="sm" dot caps>
                Demo data
              </Badge>
            </div>
            <p className="-mt-1 text-[13px] text-fg-muted">
              Sign in as a seeded traveler. Wallets, alerts and finds are simulated — nothing here is a real account.
            </p>
            <ul className="grid gap-2">
              {FEATURED.map((p) => (
                <li key={p.id}>
                  <PersonaButton persona={p} busy={busyPersona === p.id} disabled={busyPersona !== null} onPick={startDemo} />
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowMore((v) => !v)}
              aria-expanded={showMore}
              className={cn(
                "inline-flex items-center gap-1.5 self-start rounded-[6px] text-[13px] font-medium text-fg-muted transition-colors hover:text-fg",
                focusRing,
              )}
            >
              More personas
              <ChevronDown className={cn("size-3.5 transition-transform", showMore && "rotate-180")} aria-hidden="true" />
            </button>
            {showMore && (
              <ul className="flex flex-wrap gap-2 animate-rise">
                {MORE.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={busyPersona !== null}
                      onClick={() => startDemo(p.id)}
                      className={cn(
                        "inline-flex h-9 items-center gap-2 rounded-full border border-panel-border bg-bg-elev-1 pl-1 pr-3 text-[13px] text-fg transition-colors hover:border-panel-border-strong hover:bg-bg-elev-2 disabled:opacity-50",
                        focusRing,
                      )}
                      title={p.blurb}
                    >
                      {busyPersona === p.id ? (
                        <Spinner size="sm" className="mx-1 text-fg-subtle" />
                      ) : (
                        <Avatar seed={p.handle} name={p.name} size="xs" />
                      )}
                      <span className="font-mono">@{p.handle}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {!anyMethod && (
        <div
          role="status"
          className="rounded-[var(--radius)] border border-gold/30 bg-gold-soft px-4 py-3.5 text-[13px] leading-relaxed text-fg"
        >
          <p className="font-medium">Sign-in isn&apos;t configured on this deployment.</p>
          <p className="mt-1 text-fg-muted">
            Set <code className="text-fg">AUTH_GOOGLE_ID</code> + <code className="text-fg">AUTH_GOOGLE_SECRET</code>,{" "}
            <code className="text-fg">AUTH_RESEND_KEY</code>, or <code className="text-fg">DEMO_MODE=true</code> and restart.
          </p>
        </div>
      )}

      <p className="text-[12px] leading-relaxed text-fg-subtle">
        By continuing you agree to Kestrel&apos;s{" "}
        <Link href="/terms" className={cn("underline underline-offset-2 hover:text-fg", focusRing)}>
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className={cn("underline underline-offset-2 hover:text-fg", focusRing)}>
          Privacy Policy
        </Link>
        . We only ever email you links you asked for.
        {providersChecked ? null : <span className="sr-only">Checking available sign-in methods.</span>}
      </p>
    </Panel>
  );
}

function PersonaButton({
  persona,
  busy,
  disabled,
  onPick,
}: {
  persona: Persona;
  busy: boolean;
  disabled: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-busy={busy || undefined}
      onClick={() => onPick(persona.id)}
      className={cn(
        "group flex min-h-14 w-full items-center gap-3 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 px-3 py-2 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-px hover:border-panel-border-strong hover:bg-bg-elev-2 disabled:pointer-events-none disabled:opacity-60",
        focusRing,
      )}
    >
      <Avatar seed={persona.handle} name={persona.name} size="md" status={persona.plan === "pro" ? "pro" : undefined} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-center gap-2 text-sm font-medium text-fg">
          {persona.name}
          <span className="font-mono text-[11px] font-normal text-fg-subtle">@{persona.handle}</span>
        </span>
        <span className="truncate text-[13px] text-fg-muted">{persona.blurb}</span>
      </span>
      {busy ? (
        <Spinner size="sm" className="text-fg-subtle" label="Signing in" />
      ) : (
        <ArrowRight className="size-4 shrink-0 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      )}
    </button>
  );
}
