import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertUpload } from "@/lib/server/scholars";
import { loadNote } from "@/lib/server/concepts";
import { noteSchema } from "@/lib/schemas";
import { wordCount } from "@/lib/domain/literature";

type Ctx = { params: Promise<{ id: string }> };

/** Scholar submits (or resubmits) their Concept Note. Accepted notes are locked. */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { id } = await params;
  const input = await parseBody(req, noteSchema);
  const { ref, note } = await loadNote(id);
  if (note.uid !== ctx.uid) throw new HttpError(403, "Not permitted");
  if (note.status === "accepted") throw new HttpError(409, "This note has been accepted and is locked");
  if (note.status === "submitted") throw new HttpError(409, "Already submitted; wait for the review");
  if (wordCount(input.definition) < 5 || wordCount(input.explanation) < 30) throw new HttpError(400, "Definition needs 5+ words and explanation 30+ words");
  for (const f of input.figures) await assertUpload(ctx.uid, f.path);
  const project = (await db().doc(`projects/${note.projectId}`).get()).data();
  if (!project || project.status !== "active") throw new HttpError(409, "This project is not active");
  const now = Date.now();
  const b = db().batch();
  b.update(ref, { ...input, status: "submitted", updatedAt: now, history: [...note.history, { at: now, status: "submitted", by: ctx.uid }].slice(-30) });
  audit(b, ctx, note.status === "revise" ? "concept_note.resubmitted" : "concept_note.submitted", "conceptNote", id, Object.fromEntries(["definition", "explanation", "equations", "example", "usedIn"].map((k) => [k, (note as unknown as Record<string, unknown>)[k] ?? null])), input);
  await b.commit();
  return ok();
});
