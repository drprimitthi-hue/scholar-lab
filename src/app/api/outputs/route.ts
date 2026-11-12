import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { members, projectTitle } from "@/lib/server/outputs";
import { outputCreateSchema } from "@/lib/schemas";
import { initialStatus } from "@/lib/domain/outputs";
import type { OutputDoc } from "@/lib/types";

/** Register a new output (paper, patent, product...). Scholars register their own; it starts at the first step. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const input = await parseBody(req, outputCreateSchema);
  // A scholar registers an output for themselves; the supervisor or a mentor adds other lab members.
  if (ctx.role === "scholar" && (input.memberUids.length !== 1 || input.memberUids[0] !== ctx.uid)) throw new HttpError(400, "Register the output with yourself as the lab member; your supervisor can add others");
  if (ctx.role !== "supervisor" && !input.memberUids.length) throw new HttpError(400, "Add at least one lab member");
  const m = await members(input.memberUids);
  if (ctx.role === "mentor") {
    const mentees = await db().collection("scholars").where("mentorUids", "array-contains", ctx.uid).select().get();
    if (m.memberUids.some((u) => !mentees.docs.some((d) => d.id === u))) throw new HttpError(403, "Members must be your mentees");
  }
  const pt = await projectTitle(input.projectId, ctx);
  const ref = db().collection("outputs").doc();
  const now = Date.now();
  const o: OutputDoc = {
    id: ref.id, ...input, ...m, projectTitle: pt, status: initialStatus(input.kind), public: false, archived: false,
    files: [], filePaths: [], history: [], createdBy: ctx.uid, createdAt: now, updatedAt: now,
  };
  const b = db().batch();
  b.set(ref, o);
  audit(b, ctx, "output.created", "output", ref.id, null, { kind: o.kind, title: o.title });
  await b.commit();
  return ok({ id: ref.id }, 201);
});
