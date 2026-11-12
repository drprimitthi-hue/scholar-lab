import "server-only";
import { createHash } from "node:crypto";
import type { DocumentReference, Transaction, WriteBatch } from "firebase-admin/firestore";
import { db } from "./admin";
import { HttpError } from "./http";
import type { AuthContext } from "./policy";
import { assertUpload } from "./scholars";
import { loadProject, loadScholars, unionMentors } from "./projects";
import { autoNews } from "./publicSync";
import { KIND_LABEL, isPublishable, publicationType } from "../domain/outputs";
import type { FileRef, OutputDoc, ProjectDoc, PrototypeDoc } from "../types";

const ID = /^[A-Za-z0-9]{1,64}$/;

export async function loadOutput(id: string): Promise<{ ref: DocumentReference; data: OutputDoc }> {
  if (!ID.test(id)) throw new HttpError(400, "Invalid id");
  const ref = db().doc(`outputs/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Output not found");
  return { ref, data: snap.data() as OutputDoc };
}

export function canSeeOutput(ctx: AuthContext, o: Pick<OutputDoc, "memberUids" | "mentorUids">): boolean {
  if (ctx.role === "supervisor") return true;
  if (ctx.role === "mentor") return o.mentorUids.includes(ctx.uid);
  return o.memberUids.includes(ctx.uid);
}

/** Who may edit: supervisor always; mentor/scholar members only (alumni never). */
export function assertOutputEditor(ctx: AuthContext, o: Pick<OutputDoc, "memberUids" | "mentorUids">): void {
  if (ctx.role === "alumni" || !canSeeOutput(ctx, o)) throw new HttpError(403, "Not permitted");
}

/** Resolve lab members: names and the union of their mentors. */
export async function members(uids: string[]) {
  const list = await loadScholars(uids);
  return { memberUids: list.map((s) => s.uid), memberNames: list.map((s) => s.name), mentorUids: unionMentors(list) };
}

export async function projectTitle(pid: string, ctx: AuthContext): Promise<string> {
  if (!pid) return "";
  const { data } = await loadProject(pid);
  if (ctx.role === "mentor" && !data.mentorUids.includes(ctx.uid)) throw new HttpError(403, "Not permitted for that project");
  if (ctx.role === "scholar" && !data.scholarUids.includes(ctx.uid)) throw new HttpError(403, "Not permitted for that project");
  return data.title;
}

/** Files must be uploaded by the caller into their own private folder. */
export async function checkFiles(ctx: AuthContext, files: { path: string; name: string }[]): Promise<FileRef[]> {
  const out: FileRef[] = [];
  for (const f of files) {
    const meta = await assertUpload(ctx.uid, f.path);
    if (meta.contentType !== "application/pdf" && !meta.contentType.startsWith("image/")) throw new HttpError(400, "Only PDF or image files");
    out.push({ path: f.path, name: f.name, at: Date.now(), by: ctx.uid });
  }
  return out;
}

/** Server-only index from a file path to the record that owns it (used by /api/files for access checks). */
export const fileKey = (path: string) => createHash("sha256").update(path).digest("hex").slice(0, 40);
export function indexFiles(w: WriteBatch | Transaction, files: FileRef[], owner: { type: "output"; id: string } | { type: "prototype"; projectId: string; id: string }) {
  for (const f of files) (w as WriteBatch).set(db().doc(`fileIndex/${fileKey(f.path)}`), { path: f.path, ...owner });
}

/** Mirror an output to the public Publications list when publishable; remove it otherwise. */
export async function syncOutput(o: OutputDoc, announceFrom?: string): Promise<void> {
  const ref = db().doc(`publicPublications/out_${o.id}`);
  const type = publicationType(o.kind, o.subtype);
  const show = !!type && !o.archived && isPublishable(o.kind, o.status, o.public);
  if (show) {
    await ref.set({ id: `out_${o.id}`, authors: o.authors, title: o.title, venue: o.venue, year: o.year, type, url: o.url, createdAt: o.createdAt });
  } else await ref.delete();
  // Announce once, when an output first becomes publishable (any kind, e.g. a granted patent or released product).
  const now = !o.archived && isPublishable(o.kind, o.status, o.public);
  if (now && announceFrom !== undefined && !isPublishable(o.kind, announceFrom, o.public) && !(o as OutputDoc & { announced?: boolean }).announced) {
    await db().doc(`outputs/${o.id}`).update({ announced: true });
    await autoNews(`${KIND_LABEL[o.kind]}: ${o.title}`, [o.publicSummary, [o.venue, o.year].filter(Boolean).join(", ")].filter(Boolean).join("\n"));
  }
}

/** After a scholar's mentors change: refresh mentorUids on their outputs. */
export async function syncOutputsOfScholar(uid: string): Promise<void> {
  for (const d of (await db().collection("outputs").where("memberUids", "array-contains", uid).get()).docs) {
    const o = d.data() as OutputDoc;
    const m = await members(o.memberUids).catch(() => null);
    if (m) await d.ref.update({ mentorUids: m.mentorUids });
  }
}

/** Purge: remove the person from outputs and prototypes, keeping the lab record (author strings are bibliographic). */
export async function removeScholarFromOutputs(uid: string, alias: string): Promise<void> {
  for (const d of (await db().collection("outputs").where("memberUids", "array-contains", uid).get()).docs) {
    const o = d.data() as OutputDoc;
    const keep = o.memberUids.map((u, i) => [u, o.memberNames[i] ?? ""] as const).filter(([u]) => u !== uid);
    const m = await members(keep.map(([u]) => u)).catch(() => ({ mentorUids: [] as string[] }));
    await d.ref.update({
      memberUids: keep.map(([u]) => u), memberNames: keep.map(([, n]) => n), mentorUids: m.mentorUids,
      history: o.history.map((h) => (h.by === uid ? { ...h, by: alias, byName: "Former member" } : h)),
      files: o.files.filter((f) => !f.path.startsWith(`scholars/${uid}/`)),
      filePaths: o.filePaths.filter((p) => !p.startsWith(`scholars/${uid}/`)),
    });
  }
  for (const d of (await db().collectionGroup("prototypes").where("ownerUids", "array-contains", uid).get()).docs) {
    const p = d.data() as PrototypeDoc;
    await d.ref.update({
      ownerUids: p.ownerUids.map((u) => (u === uid ? alias : u)),
      ownerNames: p.ownerUids.map((u, i) => (u === uid ? "Former member" : p.ownerNames[i] ?? "")),
    });
    for (const e of (await d.ref.collection("log").where("uid", "==", uid).get()).docs) await e.ref.update({ uid: alias, name: "Former member", files: [] });
  }
}

// ---------- Prototypes ----------
export async function loadPrototype(pid: string, id: string): Promise<{ ref: DocumentReference; data: PrototypeDoc; project: ProjectDoc }> {
  if (!ID.test(id)) throw new HttpError(400, "Invalid id");
  const { data: project } = await loadProject(pid);
  const ref = db().doc(`projects/${pid}/prototypes/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Prototype not found");
  return { ref, data: snap.data() as PrototypeDoc, project };
}

/** Owners, the supervisor and the project's mentors may work on a prototype. Other project scholars may only read. */
export function assertPrototypeWorker(ctx: AuthContext, p: PrototypeDoc, project: ProjectDoc): void {
  const ok = ctx.role === "supervisor" || (ctx.role === "mentor" && project.mentorUids.includes(ctx.uid)) || (ctx.role === "scholar" && p.ownerUids.includes(ctx.uid));
  if (!ok) throw new HttpError(403, "Only the prototype's owners, their mentors or the supervisor can do this");
}

export async function ownersOf(uids: string[], project: ProjectDoc) {
  if (uids.some((u) => !project.scholarUids.includes(u))) throw new HttpError(400, "Owners must be scholars on this project");
  const list = await loadScholars(uids);
  return { ownerUids: list.map((s) => s.uid), ownerNames: list.map((s) => s.name) };
}
