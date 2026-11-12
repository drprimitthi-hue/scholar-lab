import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { buildSpeakers, speakerFields } from "@/lib/server/sessions";
import { rotaSchema } from "@/lib/schemas";
import { buildRota } from "@/lib/domain/concepts";
import type { SessionDoc } from "@/lib/types";

/** Create a series of sessions with speakers taking turns. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, rotaSchema);
  const plan = buildRota(input.uids, input.perSession, input.count, input.startDate, input.everyDays);
  const b = db().batch();
  const now = Date.now();
  for (const [i, p] of plan.entries()) {
    const ref = db().collection("sessions").doc();
    const speakers = await buildSpeakers(p.uids.map((u) => ({ uid: u, topic: "", conceptId: "", projectId: "" })));
    const s: SessionDoc = {
      id: ref.id, title: `${input.title} ${i + 1}`, type: input.type, date: p.date, time: input.time, venue: input.venue, peerScoring: input.peerScoring,
      ...speakerFields(speakers), status: "scheduled", attendance: {}, questions: [], actionItems: [], notes: "", createdAt: now, updatedAt: now,
    };
    b.set(ref, s);
  }
  audit(b, ctx, "session.rota_created", "session", "rota", null, { title: input.title, count: plan.length });
  await b.commit();
  return ok({ created: plan.length }, 201);
});
