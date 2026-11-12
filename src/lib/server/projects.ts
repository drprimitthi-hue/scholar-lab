import "server-only";
import { FieldValue, type DocumentReference } from "firebase-admin/firestore";
import { db } from "./admin";
import { HttpError } from "./http";
import type { AuthContext } from "./policy";
import type { LeaveDoc, PlanDoc, ProjectDoc, ReadingCard, ScholarDoc } from "../types";
import { dateRange } from "../domain/dates";
import type { Calendar } from "../domain/literature";
import type { LabSettings } from "../types";
import { syncProject } from "./publicSync";

export const cardIdOf = (pid: string, uid: string, itemId: string) => `${pid}_${uid}_${itemId}`;

export async function loadProject(pid: string): Promise<{ ref: DocumentReference; data: ProjectDoc }> {
  if (!/^[A-Za-z0-9]{1,64}$/.test(pid)) throw new HttpError(400, "Invalid project id");
  const ref = db().doc(`projects/${pid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Project not found");
  return { ref, data: snap.data() as ProjectDoc };
}

export function assertProjectAccess(ctx: AuthContext, p: ProjectDoc): void {
  const ok =
    ctx.role === "supervisor" ||
    (ctx.role === "mentor" && p.mentorUids.includes(ctx.uid)) ||
    ((ctx.role === "scholar" || ctx.role === "alumni") && p.scholarUids.includes(ctx.uid));
  if (!ok) throw new HttpError(403, "Not permitted");
}

/** Load scholars by uid; throws if any is missing. */
export async function loadScholars(uids: string[]): Promise<ScholarDoc[]> {
  const out: ScholarDoc[] = [];
  for (const u of [...new Set(uids)]) {
    const s = await db().doc(`scholars/${u}`).get();
    if (!s.exists) throw new HttpError(400, "Scholar not found");
    out.push(s.data() as ScholarDoc);
  }
  return out;
}

export const unionMentors = (scholars: ScholarDoc[]) => [...new Set(scholars.flatMap((s) => s.mentorUids ?? []))];

/** Re-sync derived access lists for a project: project.mentorUids, plans' mentorUids, cards' groupUids. */
export async function syncProjectAccess(pid: string): Promise<void> {
  const { ref, data } = await loadProject(pid);
  const scholars = await loadScholars(data.scholarUids).catch(() => [] as ScholarDoc[]);
  const mentorUids = unionMentors(scholars);
  const byUid = new Map(scholars.map((s) => [s.uid, s.mentorUids ?? []]));
  const writes: [DocumentReference, Record<string, unknown>][] = [[ref, { mentorUids }]];
  for (const p of (await ref.collection("plans").get()).docs)
    writes.push([p.ref, { mentorUids: byUid.get(p.id) ?? [] }]);
  const groupUids = data.cardsVisibleToGroup ? data.scholarUids : [];
  for (const c of (await db().collection("readingCards").where("projectId", "==", pid).get()).docs) {
    const card = c.data() as ReadingCard;
    writes.push([c.ref, { groupUids: card.status === "accepted" ? groupUids : [] }]);
  }
  for (const c of (await db().collection("conceptNotes").where("projectId", "==", pid).get()).docs) {
    writes.push([c.ref, { groupUids: c.get("status") === "accepted" ? groupUids : [] }]);
  }
  for (let i = 0; i < writes.length; i += 400) {
    const b = db().batch();
    writes.slice(i, i + 400).forEach(([r, d]) => b.update(r, d));
    await b.commit();
  }
}

/** After a scholar's mentors change: refresh every project that includes the scholar. */
export async function syncProjectsOfScholar(uid: string): Promise<void> {
  const snap = await db().collection("projects").where("scholarUids", "array-contains", uid).get();
  for (const d of snap.docs) await syncProjectAccess(d.id);
}

/** Remove a purged scholar from all projects and delete their plans/suggestions. */
export async function removeScholarFromProjects(uid: string): Promise<number> {
  let n = 0;
  const projects = await db().collection("projects").where("scholarUids", "array-contains", uid).get();
  for (const p of projects.docs) {
    await p.ref.update({ scholarUids: FieldValue.arrayRemove(uid) });
    const plan = p.ref.collection("plans").doc(uid);
    if ((await plan.get()).exists) {
      await plan.delete();
      n++;
    }
    const sugg = await p.ref.collection("suggestions").where("uid", "==", uid).get();
    for (const s of sugg.docs) {
      await s.ref.delete();
      n++;
    }
    await syncProjectAccess(p.id);
    await syncProject(p.id);
  }
  return n;
}

/** The scholar's working calendar: weekly offs, holidays and approved leave. */
export async function scholarCalendar(uid: string, settings: LabSettings): Promise<Calendar> {
  const leaves = (await db().collection("leaves").where("uid", "==", uid).where("status", "==", "approved").get()).docs.map((d) => d.data() as LeaveDoc);
  return {
    weekendDays: settings.weekendDays,
    holidays: settings.holidays,
    leaveDays: leaves.flatMap((l) => dateRange(l.from, l.to)),
  };
}

export async function loadPlan(pid: string, uid: string): Promise<PlanDoc | null> {
  const s = await db().doc(`projects/${pid}/plans/${uid}`).get();
  return s.exists ? (s.data() as PlanDoc) : null;
}

export async function acceptedItemIds(pid: string, uid: string): Promise<Set<string>> {
  const snap = await db().collection("readingCards").where("projectId", "==", pid).where("uid", "==", uid).where("status", "==", "accepted").select("itemId").get();
  return new Set(snap.docs.map((d) => d.get("itemId") as string));
}
