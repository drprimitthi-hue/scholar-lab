import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadNote } from "@/lib/server/concepts";
import { noteReviewSchema } from "@/lib/schemas";
import { masteryRank } from "@/lib/domain/concepts";
import type { ProjectDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Accept (→ explained), ask for revision, or confirm it was applied in the prototype (→ applied). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor"] });
  const { id } = await params;
  const { action, comment } = await parseBody(req, noteReviewSchema);
  const { ref, note } = await loadNote(id);
  if (ctx.role === "mentor" && !note.mentorUids.includes(ctx.uid)) throw new HttpError(403, "Not permitted");
  const now = Date.now();
  let update: Record<string, unknown>;
  if (action === "applied") {
    if (note.status !== "accepted") throw new HttpError(409, "Accept the note first");
    update = { mastery: masteryRank(note.mastery) >= masteryRank("applied") ? note.mastery : "applied", history: [...note.history, { at: now, status: "applied", by: ctx.uid, comment }].slice(-30) };
  } else {
    if (note.status !== "submitted") throw new HttpError(409, "Only submitted notes can be reviewed");
    if (action === "revise" && comment.trim().length < 3) throw new HttpError(400, "Please say what needs revising");
    const project = (await db().doc(`projects/${note.projectId}`).get()).data() as ProjectDoc | undefined;
    const accepted = action === "accept";
    update = {
      status: accepted ? "accepted" : "revise",
      mastery: accepted && masteryRank(note.mastery) < masteryRank("explained") ? "explained" : note.mastery,
      reviewComment: comment,
      reviewedBy: ctx.uid,
      groupUids: accepted && project?.cardsVisibleToGroup ? project.scholarUids : [],
      history: [...note.history, { at: now, status: accepted ? "accepted" : "revise", by: ctx.uid, comment }].slice(-30),
    };
  }
  const b = db().batch();
  b.update(ref, { ...update, updatedAt: now });
  audit(b, ctx, `concept_note.${action}`, "conceptNote", id, { status: note.status, mastery: note.mastery }, { action, comment });
  await b.commit();
  return ok();
});
