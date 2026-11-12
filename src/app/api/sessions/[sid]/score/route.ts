import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadSession } from "@/lib/server/sessions";
import { loadScholars } from "@/lib/server/projects";
import { scoreSchema } from "@/lib/schemas";
import type { ScoreDoc } from "@/lib/types";

type Ctx = { params: Promise<{ sid: string }> };

/** Rubric score for one speaker. One score per rater per speaker (re-scoring replaces it). Peer raters stay anonymous. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { sid } = await params;
  const input = await parseBody(req, scoreSchema);
  const { session } = await loadSession(sid);
  if (!session.speakerUids.includes(input.speakerUid)) throw new HttpError(400, "Not a speaker in this session");
  if (session.status === "cancelled") throw new HttpError(409, "This session was cancelled");
  if (ctx.role === "scholar") {
    if (!session.peerScoring) throw new HttpError(403, "Peer scoring is off for this session");
    if (ctx.uid === input.speakerUid) throw new HttpError(403, "You cannot score your own talk");
    if (session.attendance[ctx.uid] !== "present") throw new HttpError(403, "Only those marked present can score");
  }
  const [speaker] = await loadScholars([input.speakerUid]);
  const raterName = ctx.role === "scholar" ? "" : String((await db().doc(`users/${ctx.uid}`).get()).get("name") ?? "");
  const raterKey = createHash("sha256").update(`${sid}:${ctx.uid}`).digest("hex").slice(0, 16);
  const ref = db().doc(`sessionScores/${sid}_${input.speakerUid}_${raterKey}`);
  const doc: ScoreDoc = {
    id: ref.id, sessionId: sid, sessionDate: session.date, sessionTitle: session.title, uid: input.speakerUid, mentorUids: speaker!.mentorUids ?? [],
    raterRole: ctx.role === "scholar" ? "peer" : (ctx.role as "supervisor" | "mentor"), raterName, scores: input.scores, comment: input.comment, at: Date.now(),
  };
  const b = db().batch();
  b.set(ref, doc);
  audit(b, ctx, "session.scored", "session", sid, null, { speaker: input.speakerUid, scores: input.scores });
  await b.commit();
  return ok();
});
