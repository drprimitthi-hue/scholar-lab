import "server-only";
import { db } from "./admin";
import { HttpError } from "./http";
import type { Concept, ConceptNote, ProjectDoc, ScholarDoc } from "../types";
import { createsCycle } from "../domain/concepts";

export const noteIdOf = (pid: string, uid: string, cid: string) => `${pid}_${uid}_${cid}`;

export async function projectConcepts(pid: string): Promise<Concept[]> {
  return (await db().collection(`projects/${pid}/concepts`).get()).docs.map((d) => d.data() as Concept);
}

/** Create the scholar's note for a concept in "claimed" (= heard) state if it does not exist. */
export async function ensureNote(project: ProjectDoc, concept: Concept, scholar: ScholarDoc, by: string): Promise<boolean> {
  const ref = db().doc(`conceptNotes/${noteIdOf(project.id, scholar.uid, concept.id)}`);
  return db().runTransaction(async (tx) => {
    if ((await tx.get(ref)).exists) return false;
    const now = Date.now();
    const note: ConceptNote = {
      id: ref.id, projectId: project.id, conceptId: concept.id, conceptTitle: concept.title, uid: scholar.uid, scholarName: scholar.name,
      mentorUids: scholar.mentorUids ?? [], groupUids: [], status: "claimed", mastery: "heard", figures: [], reviewComment: "", reviewedBy: null,
      history: [{ at: now, status: "heard", by }], createdAt: now, updatedAt: now,
    };
    tx.set(ref, note);
    return true;
  });
}

export async function loadNote(id: string) {
  if (!/^[A-Za-z0-9]{1,64}_[A-Za-z0-9]{1,128}_[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, "Invalid id");
  const ref = db().doc(`conceptNotes/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Note not found");
  return { ref, note: snap.data() as ConceptNote };
}

export async function validateConcept(pid: string, id: string, input: { prerequisites: string[]; itemIds: string[] }) {
  const all = await projectConcepts(pid);
  const ids = new Set(all.map((c) => c.id));
  if (input.prerequisites.some((p) => !ids.has(p))) throw new HttpError(400, "Unknown prerequisite");
  if (createsCycle(all, id, input.prerequisites)) throw new HttpError(400, "These prerequisites would create a loop");
  if (input.itemIds.length) {
    const lit = await db().getAll(...input.itemIds.map((i) => db().doc(`projects/${pid}/literature/${i}`)));
    if (lit.some((d) => !d.exists)) throw new HttpError(400, "Unknown paper");
  }
  return all;
}
