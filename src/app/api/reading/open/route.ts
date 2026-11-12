import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { cardIdOf } from "@/lib/server/projects";
import { assertReleased } from "@/lib/server/reading";
import { readingOpenSchema } from "@/lib/schemas";
import type { ReadingCard } from "@/lib/types";

/** Logs that the scholar opened a paper's link (first time only). */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { projectId, itemId } = await parseBody(req, readingOpenSchema);
  const { item, scholar } = await assertReleased(ctx, projectId, itemId);
  const ref = db().doc(`readingCards/${cardIdOf(projectId, ctx.uid, itemId)}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return;
    const now = Date.now();
    const card: ReadingCard = {
      id: ref.id, projectId, itemId, itemTitle: item.title, uid: ctx.uid, scholarName: scholar.name, mentorUids: scholar.mentorUids,
      groupUids: [], status: "opened", openedAt: now, submittedAt: null, reviewedAt: null, reviewedBy: null, reviewComment: "",
      history: [{ at: now, status: "opened", by: ctx.uid }],
    };
    tx.set(ref, card);
    audit(tx, ctx, "reading.opened", "readingCard", ref.id);
  });
  return ok({ url: item.url });
});
