import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/server/publicData";

const PRIVATE = ["/api/", "/login", "/setup", "/dashboard", "/scholars", "/projects", "/reading", "/review", "/accounts", "/presence", "/leave", "/settings", "/audit", "/account", "/me", "/site"];

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: PRIVATE }], sitemap: `${siteUrl()}/sitemap.xml` };
}
