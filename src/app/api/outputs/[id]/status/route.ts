import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertOutputEditor, loadOutput, syncOutput } from "@/lib/server/outputs";
import { outputStatusSchema } from "@/lib/schemas";
import { canMove, stepOf } from "@/lib/domain/outputs";
import type { OutputDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Move an output along its pipeline. Submission/acceptance/grant etc. are confirmed by the supervisor only. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { id } = await params;
  const { status, note, date } = await parseBody(req, outputStatusSchema);
  const user = await db().doc(`users/${ctx.uid}`).get();
  const result = await db().runTransaction(async (tx) => {
    const { ref } = await loadOutput(id);
    const snap = await tx.get(ref);
    const o = snap.data() as OutputDoc;
    assertOutputEditor(ctx, o);
    if (!stepOf(o.kind, status)) throw new HttpError(400, "Unknown status for this kind of output");
    if (!canMove(ctx.role, o.kind, o.status, status)) throw new HttpError(403, `Only the supervisor can set “${stepOf(o.kind, status)!.label}”`);
    const h = { at: Date.now(), from: o.status, to: status, by: ctx.uid, byName: String(user.get("name") ?? ""), note };
    const next: OutputDoc = { ...o, status, date: date || o.date, history: [...o.history, h].slice(-200), updatedAt: Date.now() };
    tx.update(ref, { status, date: next.date, history: next.history, updatedAt: next.updatedAt });
    audit(tx, ctx, "output.status", "output", id, { status: o.status }, { status, note });
    return { next, from: o.status };
  });
  await syncOutput(result.next, result.from);
  return ok();
});
