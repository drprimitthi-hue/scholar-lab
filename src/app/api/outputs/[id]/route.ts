import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertOutputEditor, loadOutput, members, projectTitle, syncOutput } from "@/lib/server/outputs";
import { outputPatchSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";
import { isLocked } from "@/lib/domain/outputs";
import type { OutputDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { id } = await params;
  const { ref, data } = await loadOutput(id);
  assertOutputEditor(ctx, data);
  const input = await parseBody(req, outputPatchSchema);
  const sup = ctx.role === "supervisor";
  if (!sup && isLocked(data.kind, data.status)) throw new HttpError(409, "This record is confirmed; only the supervisor can change it");
  if (!sup && (input.public !== undefined || input.archived !== undefined || (input.trl !== undefined && input.trl !== data.trl)))
    throw new HttpError(403, "Only the supervisor can change website visibility, archive status or TRL");
  const patch: Partial<OutputDoc> = { ...input } as Partial<OutputDoc>;
  if (input.memberUids) {
    if (ctx.role === "scholar") {
      if (!input.memberUids.includes(ctx.uid)) throw new HttpError(400, "You cannot remove yourself");
      if (input.memberUids.some((u) => !data.memberUids.includes(u))) throw new HttpError(403, "Your supervisor or mentor adds lab members");
    }
    if (!sup && !input.memberUids.length) throw new HttpError(400, "Add at least one lab member");
    const m = await members(input.memberUids);
    if (ctx.role === "mentor") {
      const mentees = await db().collection("scholars").where("mentorUids", "array-contains", ctx.uid).select().get();
      const added = m.memberUids.filter((u) => !data.memberUids.includes(u));
      if (added.some((u) => !mentees.docs.some((d) => d.id === u))) throw new HttpError(403, "You can only add your mentees");
    }
    Object.assign(patch, m);
  }
  if (input.projectId !== undefined && input.projectId !== data.projectId) patch.projectTitle = await projectTitle(input.projectId, ctx);
  const changes = shallowDiff(data as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  if (!Object.keys(changes.after).length) return ok();
  const b = db().batch();
  b.update(ref, { ...patch, updatedAt: Date.now() });
  audit(b, ctx, "output.updated", "output", id, changes.before, changes.after);
  await b.commit();
  const next = { ...data, ...patch } as OutputDoc;
  await syncOutput(next, input.public === true && !data.public ? "" : undefined);
  return ok();
});

/** Delete only a mistaken entry: supervisor, never shown publicly, no status history. Otherwise archive it. */
export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"], recentAuthSeconds: 900 });
  const { id } = await params;
  const { ref, data } = await loadOutput(id);
  if (data.public || data.history.length || data.files.length) throw new HttpError(409, "This output has a history; archive it instead of deleting");
  const b = db().batch();
  b.delete(ref);
  audit(b, ctx, "output.deleted", "output", id, { kind: data.kind, title: data.title }, null);
  await b.commit();
  await db().doc(`publicPublications/out_${id}`).delete();
  return ok();
});
