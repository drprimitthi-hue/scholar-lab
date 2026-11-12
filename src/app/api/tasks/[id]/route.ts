import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { canAccessScholar } from "@/lib/server/policy";
import { taskDoneSchema } from "@/lib/schemas";
import type { TaskDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { id } = await params;
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, "Invalid id");
  const { done } = await parseBody(req, taskDoneSchema);
  const ref = db().doc(`tasks/${id}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Task not found");
  const t = snap.data() as TaskDoc;
  if (!canAccessScholar(ctx, t.uid, t.mentorUids)) throw new HttpError(403, "Not permitted");
  const b = db().batch();
  b.update(ref, { done, doneAt: done ? Date.now() : null });
  audit(b, ctx, done ? "task.done" : "task.reopened", "task", id);
  await b.commit();
  return ok();
});
