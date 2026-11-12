import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject, loadScholars } from "@/lib/server/projects";
import { ensureNote, noteIdOf } from "@/lib/server/concepts";
import { prerequisitesMet } from "@/lib/domain/concepts";
import { z } from "zod";
import type { Concept, ConceptNote } from "@/lib/types";

const schema = z.strictObject({ projectId: z.string().regex(/^[A-Za-z0-9]{1,64}$/), conceptId: z.string().regex(/^[A-Za-z0-9]{1,64}$/) });

/** A scholar takes up a concept — allowed once its prerequisites are at least "explained". */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { projectId, conceptId } = await parseBody(req, schema);
  const { data: project } = await loadProject(projectId);
  if (!project.scholarUids.includes(ctx.uid)) throw new HttpError(403, "Not part of this project");
  if (project.status !== "active") throw new HttpError(409, "This project is not active");
  const cSnap = await db().doc(`projects/${projectId}/concepts/${conceptId}`).get();
  if (!cSnap.exists) throw new HttpError(404, "Concept not found");
  const concept = cSnap.data() as Concept;
  const notes = concept.prerequisites.length ? await db().getAll(...concept.prerequisites.map((p) => db().doc(`conceptNotes/${noteIdOf(projectId, ctx.uid, p)}`))) : [];
  const mastery = new Map(notes.filter((n) => n.exists).map((n) => [n.get("conceptId") as string, (n.data() as ConceptNote).mastery]));
  if (!prerequisitesMet(concept, mastery)) throw new HttpError(409, "Finish the prerequisite concepts first");
  const [me] = await loadScholars([ctx.uid]);
  await ensureNote(project, concept, me!, ctx.uid);
  return ok({ id: noteIdOf(projectId, ctx.uid, conceptId) });
});
