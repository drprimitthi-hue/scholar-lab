import "server-only";
import { db } from "./admin";
import { getSettings } from "./settings";
import { DEFAULT_SITE } from "../domain/defaults";
import type { ProjectDoc, PublicPerson, PublicProject, ScholarDoc, SiteContent, UserDoc } from "../types";

// The public website reads ONLY these mirror collections. They are rebuilt by the server from the
// private records and contain only fields that are safe to publish.

export async function getSiteContent(): Promise<SiteContent> {
  const s = await db().doc("siteContent/main").get();
  return { ...DEFAULT_SITE, ...((s.data() as Partial<SiteContent>) ?? {}) };
}

/** Is this person shown publicly? Requires their consent, not hidden by the supervisor, not being deleted. */
export function personIsPublic(s: ScholarDoc | undefined, u: UserDoc | undefined): boolean {
  if (!s || !u) return false;
  return s.publicConsent === true && s.publicHidden !== true && !s.deletion && u.status === "active";
}

export async function syncPerson(uid: string): Promise<void> {
  const [sSnap, uSnap, settings, site] = await Promise.all([db().doc(`scholars/${uid}`).get(), db().doc(`users/${uid}`).get(), getSettings(), getSiteContent()]);
  const s = sSnap.data() as ScholarDoc | undefined;
  const u = uSnap.data() as UserDoc | undefined;
  const ref = db().doc(`publicPeople/${uid}`);
  if (!personIsPublic(s, u)) {
    await ref.delete();
    return;
  }
  const prog = settings.programmes.find((p) => p.id === s!.programmeId);
  const completed = u!.role === "alumni" || site.completionStatuses.includes(s!.status);
  const person: PublicPerson = {
    uid,
    name: s!.name,
    group: completed ? "alumni" : "current",
    programme: prog?.name ?? "",
    level: prog?.level ?? "master",
    topic: s!.researchTopic,
    since: s!.joiningDate.slice(0, 4),
    until: completed ? (s!.expectedCompletion || "").slice(0, 4) : "",
  };
  await ref.set(person);
}

export async function syncProject(pid: string): Promise<void> {
  const snap = await db().doc(`projects/${pid}`).get();
  const ref = db().doc(`publicProjects/${pid}`);
  const p = snap.data() as ProjectDoc | undefined;
  if (!p || !p.publicVisible || p.status === "planned") {
    await ref.delete();
    return;
  }
  const people = await Promise.all(p.scholarUids.map((u) => db().doc(`publicPeople/${u}`).get()));
  const pub: PublicProject = {
    id: pid,
    title: p.title,
    summary: p.publicSummary ?? "",
    status: p.status,
    startDate: p.startDate,
    members: people.filter((x) => x.exists).map((x) => String(x.get("name"))),
    updatedAt: Date.now(),
  };
  await ref.set(pub);
}

/** After anything about a person changes: refresh them and every public project they appear in. */
export async function syncPersonEverywhere(uid: string): Promise<void> {
  await syncPerson(uid);
  const projects = await db().collection("projects").where("scholarUids", "array-contains", uid).get();
  for (const p of projects.docs) await syncProject(p.id);
}

/** Write the public "info" doc (identity + about + themes + PI + contact). */
export async function syncInfo(): Promise<void> {
  const [settings, site] = await Promise.all([getSettings(), getSiteContent()]);
  await db().doc("publicSite/info").set({
    labName: settings.labName,
    institution: settings.institution,
    department: settings.department,
    supervisorName: settings.supervisorName,
    tagline: settings.tagline,
    accent: settings.accent,
    about: site.about,
    themes: site.themes,
    piTitle: site.piTitle,
    piBio: site.piBio,
    links: site.links,
    contactEmail: site.contactEmail,
    contactPhone: site.contactPhone,
    address: site.address,
    updatedAt: Date.now(),
  });
}

/** Automatic news (e.g. a degree completed). Published directly or held as a draft, per the site setting. */
export async function autoNews(title: string, body: string): Promise<void> {
  const site = await getSiteContent();
  const ref = db().collection("siteNews").doc();
  const date = new Date().toISOString().slice(0, 10);
  const item = { id: ref.id, title, body, date, link: "", published: site.autoPublishNews, auto: true, createdAt: Date.now() };
  await ref.set(item);
  if (item.published) await db().doc(`publicNews/${ref.id}`).set(item);
}
