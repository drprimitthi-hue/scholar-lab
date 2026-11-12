import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertPrototypeWorker, loadOutput, loadPrototype, ownersOf } from "@/lib/server/outputs";
import { prototypePatchSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";
import type { PrototypeDoc } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string; id: string }> };

/** Edit details, BOM, links. TRL, status and owners are set by the supervisor or a project mentor. No deletion: official record. */
export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { pid, id } = await params;
  const { ref, data, project } = await loadPrototype(pid, id);
  assertPrototypeWorker(ctx, data, project);
  const input = await parseBody(req, prototypePatchSchema);
  if (ctx.role === "scholar" && (input.trl !== undefined || input.status !== undefined || input.ownerUids !== undefined))
    throw new HttpError(403, "TRL, status and owners are set by the supervisor or a mentor");
  const patch: Partial<PrototypeDoc> = { ...input };
  if (input.ownerUids) Object.assign(patch, await ownersOf(input.ownerUids, project));
  if (input.bom && new Set(input.bom.map((x) => x.id)).size !== input.bom.length) throw new HttpError(400, "Duplicate BOM line");
  if (input.outputId) {
    const { data: o } = await loadOutput(input.outputId);
    if (o.kind !== "product" && o.kind !== "software") throw new HttpError(400, "Link a product or software output");
  }
  const changes = shallowDiff(data as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  if (!Object.keys(changes.after).length) return ok();
  const b = db().batch();
  b.update(ref, { ...patch, updatedAt: Date.now() });
  // BOM edits can be long; the audit keeps which fields changed, and the full values except the BOM.
  const after = { ...changes.after };
  const before = { ...changes.before };
  if ("bom" in after) { after.bom = `${input.bom!.length} lines`; before.bom = `${data.bom.length} lines`; }
  audit(b, ctx, "prototype.updated", "prototype", `${pid}/${id}`, before, after);
  await b.commit();
  return ok();
});
