import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { integrationStatus } from "@/env";
import { LoginCard } from "@/components/auth/login-card";
import { LoginShowcase } from "@/components/auth/login-showcase";
import { safeNext } from "@/components/auth/safe-next";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Kestrel with Google, a magic link, or a demo persona.",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = safeNext(params.next ?? params.callbackUrl);
  const session = await auth();
  if (session?.user) redirect(next);

  const error = typeof params.error === "string" ? params.error : undefined;
  const status = integrationStatus();

  return (
    <section className="aurora-bg relative overflow-hidden">
      <div className="dot-grid pointer-events-none absolute inset-0 opacity-40" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:min-h-[calc(100dvh-4rem)] lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,440px)] lg:items-center lg:gap-16 lg:py-16">
        <LoginShowcase />
        <LoginCard
          next={next}
          error={error}
          status={{ googleAuth: status.googleAuth, email: status.email, demoMode: status.demoMode }}
        />
      </div>
    </section>
  );
}
