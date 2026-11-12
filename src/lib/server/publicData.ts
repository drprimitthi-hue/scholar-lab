import "server-only";
import { db } from "./admin";
import { DEFAULT_SETTINGS, DEFAULT_SITE } from "../domain/defaults";
import type { NewsItem, Opening, Publication, PublicPerson, PublicProject, SiteContent } from "../types";

// Server-side reads of the PUBLIC mirror collections only (never private data), cached briefly per server instance.

export interface PublicInfo extends Omit<SiteContent, "autoPublishNews" | "completionStatuses"> {
  labName: string;
  institution: string;
  department: string;
  supervisorName: string;
  tagline: string;
  accent: string;
}

const TTL = 30_000;
const cache = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, load: () => Promise<T>, fallback: T): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.v as T;
  try {
    const v = await load();
    cache.set(key, { at: Date.now(), v });
    return v;
  } catch (e) {
    console.error("[public]", key, (e as Error).message);
    return (hit?.v as T) ?? fallback;
  }
}

const list = async <T>(c: string) => (await db().collection(c).get()).docs.map((d) => d.data() as T);

const FALLBACK_INFO: PublicInfo = {
  labName: DEFAULT_SETTINGS.labName, institution: "", department: "", supervisorName: "", tagline: "", accent: DEFAULT_SETTINGS.accent,
  about: DEFAULT_SITE.about, themes: [], piTitle: "", piBio: "", links: DEFAULT_SITE.links, contactEmail: "", contactPhone: "", address: "",
};

export const getInfo = () =>
  cached("info", async () => {
    const d = (await db().doc("publicSite/info").get()).data() as Partial<PublicInfo> | undefined;
    const info = { ...FALLBACK_INFO, ...(d ?? {}) };
    if (!/^#[0-9a-fA-F]{6}$/.test(info.accent)) info.accent = FALLBACK_INFO.accent;
    return info;
  }, FALLBACK_INFO);
export const getPeople = () => cached("people", () => list<PublicPerson>("publicPeople"), [] as PublicPerson[]);
export const getProjects = () => cached("projects", () => list<PublicProject>("publicProjects"), [] as PublicProject[]);
export const getNews = () => cached("news", async () => (await list<NewsItem>("publicNews")).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt), [] as NewsItem[]);
export const getOpenings = () => cached("openings", () => list<Opening>("publicOpenings"), [] as Opening[]);
export const getPublications = () =>
  cached("pubs", async () => (await list<Publication>("publicPublications")).sort((a, b) => b.year.localeCompare(a.year) || a.title.localeCompare(b.title)), [] as Publication[]);

export function siteUrl(): string {
  const u = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");
  return u.replace(/\/$/, "");
}
