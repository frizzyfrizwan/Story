import type { MetadataRoute } from "next";
import { PROGRAMS } from "@/data/programs";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const now = new Date();
  const statics = ["", "/search", "/explore", "/hotels", "/live", "/finds", "/concierge", "/transfers", "/programs", "/pricing", "/login"].map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: p === "" ? 1 : 0.8,
  }));
  const programs = PROGRAMS.map((p) => ({
    url: `${base}/programs/${p.id}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.6,
  }));
  return [...statics, ...programs];
}
