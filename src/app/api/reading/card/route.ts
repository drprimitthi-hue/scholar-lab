import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { cardIdOf } from "@/lib/server/projects";
import { assertReleased } from "@/lib/server/reading";
import { cardSchema } from "@/lib/schemas";
import { cardProblems } from "@/lib/domain/literature";
import type { ReadingCard } from "@/lib/types";

/** Scholar submits (or resubmits after "revise") a Reading Card. Accepted cards are locked. */
export const PUT = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { projectId, itemId, ...fields } = await parseBody(req, cardSchema);
  const { project, item, scholar } = await assertReleased(ctx, projectId, itemId);
  const problems = cardProblems(fields, project.minWords);
  if (problems.length) throw new HttpError(400, problems.join("; "));
  const ref = db().doc(`readingCards/${cardIdOf(projectId, ctx.uid, itemId)}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.data() as ReadingCard | undefined;
    if (cur?.status === "accepted") throw new HttpError(409, "This card has been accepted and is locked");
    if (cur?.status === "submitted") throw new HttpError(409, "Already submitted; wait for the review");
    const now = Date.now();
    const history = [...(cur?.history ?? []), { at: now, status: "submitted" as const, by: ctx.uid }].slice(-30);
    const card: ReadingCard = {
      id: ref.id, projectId, itemId, itemTitle: item.title, uid: ctx.uid, scholarName: scholar.name, mentorUids: scholar.mentorUids,
      groupUids: [], status: "submitted", openedAt: cur?.openedAt ?? now, submittedAt: now, reviewedAt: cur?.reviewedAt ?? null,
      reviewedBy: cur?.reviewedBy ?? null, reviewComment: cur?.reviewComment ?? "", history, ...fields,
    };
    tx.set(ref, card);
    // Previous version stays in the audit log, so every revision is preserved.
    audit(tx, ctx, cur?.status === "revise" ? "reading.resubmitted" : "reading.submitted", "readingCard", ref.id, cur ? Object.fromEntries(Object.entries(cur).filter(([k]) => k !== "history")) : null, fields);
  });
  return ok();
});
