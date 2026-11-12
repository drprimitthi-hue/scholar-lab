import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject } from "@/lib/server/projects";
import { validateConcept } from "@/lib/server/concepts";
import { conceptSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ pid: string; cid: string }> };

async function load(pid: string, cid: string) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(cid)) throw new HttpError(400, "Invalid id");
  await loadProject(pid);
  const ref = db().doc(`projects/${pid}/concepts/${cid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Concept not found");
  return { ref, data: snap.data()! };
}

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, cid } = await params;
  const input = await parseBody(req, conceptSchema);
  const { ref, data } = await load(pid, cid);
  await validateConcept(pid, cid, input);
  const b = db().batch();
  b.update(ref, input);
  audit(b, ctx, "concept.updated", "project", pid, { title: data.title }, { title: input.title });
  await b.commit();
  // keep the title on notes in step
  if (input.title !== data.title) {
    const notes = await db().collection("conceptNotes").where("projectId", "==", pid).where("conceptId", "==", cid).get();
    for (const n of notes.docs) await n.ref.update({ conceptTitle: input.title });
  }
  return ok();
});

export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, cid } = await params;
  const { ref, data } = await load(pid, cid);
  const used = await db().collection("conceptNotes").where("projectId", "==", pid).where("conceptId", "==", cid).limit(1).get();
  if (!used.empty) throw new HttpError(409, "Scholars have notes on this concept; it cannot be removed");
  const dependants = await db().collection(`projects/${pid}/concepts`).where("prerequisites", "array-contains", cid).limit(1).get();
  if (!dependants.empty) throw new HttpError(409, "Another concept depends on this one; remove that link first");
  const b = db().batch();
  b.delete(ref);
  audit(b, ctx, "concept.deleted", "project", pid, data, null);
  await b.commit();
  return ok();
});
