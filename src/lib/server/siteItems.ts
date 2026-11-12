import "server-only";
import { newsSchema, openingSchema, publicationSchema } from "../schemas";
import { HttpError } from "./http";

/** News, openings and publications: the private source collection, its public mirror, and when an item is public. */
export const KINDS = {
  news: { source: "siteNews", mirror: "publicNews", schema: newsSchema, isPublic: (d: { published?: boolean }) => d.published === true },
  openings: { source: "siteOpenings", mirror: "publicOpenings", schema: openingSchema, isPublic: (d: { open?: boolean }) => d.open === true },
  publications: { source: "sitePublications", mirror: "publicPublications", schema: publicationSchema, isPublic: () => true },
} as const;
export type Kind = keyof typeof KINDS;

export function kindOf(k: string) {
  if (!(k in KINDS)) throw new HttpError(404, "Unknown section");
  return KINDS[k as Kind];
}
