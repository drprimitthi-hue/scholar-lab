import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadScholars } from "@/lib/server/projects";
import { taskSchema } from "@/lib/schemas";
import type { TaskDoc } from "@/lib/types";

/** Supervisor (or the scholar's mentor) gives a scholar a task. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor"] });
  const input = await parseBody(req, taskSchema);
  const [s] = await loadScholars([input.uid]);
  if (ctx.role === "mentor" && !(s!.mentorUids ?? []).includes(ctx.uid)) throw new HttpError(403, "Not permitted");
  const ref = db().collection("tasks").doc();
  const t: TaskDoc = { id: ref.id, uid: s!.uid, mentorUids: s!.mentorUids ?? [], title: input.title, due: input.due, done: false, doneAt: null, source: { type: "manual", id: "", title: "" }, createdBy: ctx.uid, createdAt: Date.now() };
  const b = db().batch();
  b.set(ref, t);
  audit(b, ctx, "task.created", "task", ref.id, null, { uid: s!.uid, title: input.title });
  await b.commit();
  return ok({ id: ref.id }, 201);
});
