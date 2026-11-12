import type { MetadataRoute } from "next";
import { getProjects, siteUrl } from "@/lib/server/publicData";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages = ["", "/research", "/people", "/publications", "/news", "/join", "/contact"].map((p) => ({ url: `${base}${p}`, changeFrequency: "weekly" as const }));
  const projects = (await getProjects()).map((p) => ({ url: `${base}/research/${p.id}`, lastModified: new Date(p.updatedAt) }));
  return [...pages, ...projects];
}
