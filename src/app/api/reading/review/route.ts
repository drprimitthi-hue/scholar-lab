import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { reviewSchema } from "@/lib/schemas";
import type { ProjectDoc, ReadingCard } from "@/lib/types";

/** Supervisor, or the scholar's mentor, accepts a card or asks for revision. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor"] });
  const { cardId, action, comment } = await parseBody(req, reviewSchema);
  if (action === "revise" && comment.trim().length < 3) throw new HttpError(400, "Please say what needs revising");
  const ref = db().doc(`readingCards/${cardId}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Card not found");
    const card = snap.data() as ReadingCard;
    if (ctx.role === "mentor" && !card.mentorUids.includes(ctx.uid)) throw new HttpError(403, "Not permitted");
    if (card.status !== "submitted") throw new HttpError(409, "Only submitted cards can be reviewed");
    const project = (await tx.get(db().doc(`projects/${card.projectId}`))).data() as ProjectDoc | undefined;
    const status = action === "accept" ? "accepted" : "revise";
    const now = Date.now();
    tx.update(ref, {
      status,
      reviewedAt: now,
      reviewedBy: ctx.uid,
      reviewComment: comment,
      groupUids: status === "accepted" && project?.cardsVisibleToGroup ? project.scholarUids : [],
      history: [...card.history, { at: now, status, by: ctx.uid, comment }].slice(-30),
    });
    audit(tx, ctx, `reading.${status}`, "readingCard", cardId, { status: "submitted" }, { status, comment });
  });
  return ok();
});
