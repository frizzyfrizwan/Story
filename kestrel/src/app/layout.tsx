import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AppShell } from "@/components/shell/app-shell";
import { auth } from "@/auth";
import { integrationStatus } from "@/env";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: { default: "Kestrel — the award travel engine", template: "%s · Kestrel" },
  description:
    "See every award seat, spend fewer points. Live award search across 40+ programs, transfer partner intelligence, hotel awards, live flights and an AI concierge.",
  applicationName: "Kestrel",
  keywords: ["award travel", "points", "miles", "award search", "transfer partners", "business class"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Kestrel — the award travel engine",
    description: "See every award seat. Spend fewer points.",
    type: "website",
    siteName: "Kestrel",
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07090f" },
    { media: "(prefers-color-scheme: light)", color: "#f7f3ea" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `(function(){try{var t=localStorage.getItem('kestrel.theme');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t);}}catch(e){}})();`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const status = integrationStatus();
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <Providers>
          <AppShell user={session?.user ?? null} status={status}>
            {children}
          </AppShell>
        </Providers>
      </body>
    </html>
  );
}
