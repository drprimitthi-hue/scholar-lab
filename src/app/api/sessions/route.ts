import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { buildSpeakers, speakerFields } from "@/lib/server/sessions";
import { sessionSchema } from "@/lib/schemas";
import type { SessionDoc } from "@/lib/types";

export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, sessionSchema);
  const ref = db().collection("sessions").doc();
  const now = Date.now();
  const s: SessionDoc = {
    id: ref.id, title: input.title, type: input.type, date: input.date, time: input.time, venue: input.venue, peerScoring: input.peerScoring,
    ...speakerFields(await buildSpeakers(input.speakers)), status: "scheduled", attendance: {}, questions: [], actionItems: [], notes: input.notes, createdAt: now, updatedAt: now,
  };
  const b = db().batch();
  b.set(ref, s);
  audit(b, ctx, "session.created", "session", ref.id, null, { title: s.title, date: s.date });
  await b.commit();
  return ok({ id: ref.id }, 201);
});
