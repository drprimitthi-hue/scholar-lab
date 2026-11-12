import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { buildSpeakers, loadSession, speakerFields } from "@/lib/server/sessions";
import { sessionSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ sid: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { sid } = await params;
  const input = await parseBody(req, sessionSchema);
  const { ref, session } = await loadSession(sid);
  const speakers = await buildSpeakers(input.speakers, session.speakers);
  const b = db().batch();
  b.update(ref, { title: input.title, type: input.type, date: input.date, time: input.time, venue: input.venue, peerScoring: input.peerScoring, notes: input.notes, ...speakerFields(speakers), updatedAt: Date.now() });
  audit(b, ctx, "session.updated", "session", sid, { title: session.title, date: session.date }, { title: input.title, date: input.date });
  await b.commit();
  return ok();
});

export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { sid } = await params;
  const { ref, session } = await loadSession(sid);
  if (session.status === "completed") throw new HttpError(409, "Completed sessions are part of the record; cancel instead");
  const scored = await db().collection("sessionScores").where("sessionId", "==", sid).limit(1).get();
  if (!scored.empty) throw new HttpError(409, "This session has scores; cancel it instead");
  const b = db().batch();
  b.delete(ref);
  audit(b, ctx, "session.deleted", "session", sid, { title: session.title, date: session.date }, null);
  await b.commit();
  return ok();
});
