import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertProjectAccess, loadProject } from "@/lib/server/projects";
import { ownersOf } from "@/lib/server/outputs";
import { prototypeCreateSchema } from "@/lib/schemas";
import type { PrototypeDoc } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string }> };

export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { pid } = await params;
  const { data: project } = await loadProject(pid);
  assertProjectAccess(ctx, project);
  const input = await parseBody(req, prototypeCreateSchema);
  if (ctx.role === "scholar" && (input.ownerUids.length !== 1 || input.ownerUids[0] !== ctx.uid)) throw new HttpError(400, "Create it with yourself as owner; your supervisor or mentor can add co-owners");
  if (new Set(input.stages.map((x) => x.toLowerCase())).size !== input.stages.length) throw new HttpError(400, "Stage names must be different");
  const owners = await ownersOf(input.ownerUids, project);
  const ref = db().collection(`projects/${pid}/prototypes`).doc();
  const now = Date.now();
  const p: PrototypeDoc = {
    id: ref.id, projectId: pid, title: input.title, goal: input.goal, ...owners,
    stages: input.stages.map((name) => ({ name, status: "open", evidence: "", files: [], comment: "", submittedAt: null, reviewedAt: null, reviewedBy: "" })),
    trl: 0, bom: [], currency: input.currency, demoUrl: "", repoUrl: "", filePaths: [], outputId: "", status: "active", createdAt: now, updatedAt: now,
  };
  const b = db().batch();
  b.set(ref, p);
  audit(b, ctx, "prototype.created", "prototype", `${pid}/${ref.id}`, null, { title: p.title });
  await b.commit();
  return ok({ id: ref.id }, 201);
});
