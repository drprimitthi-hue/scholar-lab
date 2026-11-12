import { describe, expect, it } from "vitest";
import { personIsPublic } from "@/lib/server/publicSync";
import { publicationSchema, siteSchema } from "@/lib/schemas";
import { DEFAULT_SITE } from "@/lib/domain/defaults";
import { initials } from "@/components/site/bits";
import type { ScholarDoc, UserDoc } from "@/lib/types";

const s = (o: Partial<ScholarDoc>) => ({ deletion: null, ...o }) as ScholarDoc;
const u = (o: Partial<UserDoc>) => ({ status: "active", ...o }) as UserDoc;

describe("who appears on the public website", () => {
  it("only with the scholar's own consent", () => {
    expect(personIsPublic(s({}), u({}))).toBe(false);
    expect(personIsPublic(s({ publicConsent: true }), u({}))).toBe(true);
  });
  it("supervisor can hide; deletion or disabled account hides", () => {
    expect(personIsPublic(s({ publicConsent: true, publicHidden: true }), u({}))).toBe(false);
    expect(personIsPublic(s({ publicConsent: true, deletion: { scheduledAt: 1, purgeAfter: 2, keepMinimal: false } }), u({}))).toBe(false);
    expect(personIsPublic(s({ publicConsent: true }), u({ status: "disabled" }))).toBe(false);
    expect(personIsPublic(undefined, u({}))).toBe(false);
  });
});

describe("website input validation", () => {
  it("accepts defaults; rejects script links", () => {
    expect(siteSchema.safeParse(DEFAULT_SITE).success).toBe(true);
    expect(siteSchema.safeParse({ ...DEFAULT_SITE, links: { ...DEFAULT_SITE.links, website: "javascript:alert(1)" } }).success).toBe(false);
    expect(publicationSchema.safeParse({ authors: "A B", title: "Title", venue: "", year: "2026", type: "journal", url: "data:text/html,x" }).success).toBe(false);
    expect(publicationSchema.safeParse({ authors: "A B", title: "Title", venue: "", year: "26", type: "journal", url: "" }).success).toBe(false);
  });
});

describe("avatars", () => {
  it("initials skip titles and use first + last name", () => {
    expect(initials("Dr. A. Kumar")).toBe("AK");
    expect(initials("Asha Devi Rao")).toBe("AR");
    expect(initials("Prof Neha")).toBe("N");
  });
});
