import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertPrototypeWorker, checkFiles, indexFiles, loadPrototype } from "@/lib/server/outputs";
import { stageReviewSchema, stageSubmitSchema } from "@/lib/schemas";
import { canSubmitStage } from "@/lib/domain/outputs";
import type { PrototypeDoc } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string; id: string }> };

/** An owner submits a stage with evidence (earlier stages must be approved). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["scholar", "supervisor"] });
  const { pid, id } = await params;
  const input = await parseBody(req, stageSubmitSchema);
  const { ref, data, project } = await loadPrototype(pid, id);
  assertPrototypeWorker(ctx, data, project);
  const files = await checkFiles(ctx, input.files);
  await db().runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data() as PrototypeDoc;
    if (!canSubmitStage(p.stages, input.index)) throw new HttpError(409, "Earlier stages must be approved first, or this stage is already submitted/approved");
    const stages = p.stages.map((s, i) => (i === input.index ? { ...s, status: "submitted" as const, evidence: input.evidence, files: [...s.files, ...files], submittedAt: Date.now() } : s));
    tx.update(ref, { stages, filePaths: [...p.filePaths, ...files.map((f) => f.path)], updatedAt: Date.now() });
    indexFiles(tx, files, { type: "prototype", projectId: pid, id });
    audit(tx, ctx, "prototype.stage_submitted", "prototype", `${pid}/${id}`, null, { stage: p.stages[input.index]!.name });
  });
  return ok();
});

/** Supervisor or a project mentor approves / returns a submitted stage, or re-opens an approved one. */
export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor"] });
  const { pid, id } = await params;
  const input = await parseBody(req, stageReviewSchema);
  const { ref, data, project } = await loadPrototype(pid, id);
  assertPrototypeWorker(ctx, data, project);
  if (input.decision === "reopen" && ctx.role !== "supervisor") throw new HttpError(403, "Only the supervisor can re-open an approved stage");
  await db().runTransaction(async (tx) => {
    const p = (await tx.get(ref)).data() as PrototypeDoc;
    const st = p.stages[input.index];
    if (!st) throw new HttpError(400, "No such stage");
    if (input.decision === "reopen" ? st.status !== "approved" : st.status !== "submitted") throw new HttpError(409, "Stage is not in a state for this decision");
    if (input.decision === "reopen" && p.stages.slice(input.index + 1).some((s) => s.status !== "open" && s.status !== "revise"))
      throw new HttpError(409, "Later stages have progressed; re-open those first");
    if (input.decision === "revise" && input.comment.length < 5) throw new HttpError(400, "Say what needs to change");
    const status = input.decision === "reopen" ? "revise" as const : input.decision;
    const stages = p.stages.map((s, i) => (i === input.index ? { ...s, status, comment: input.comment, reviewedAt: Date.now(), reviewedBy: ctx.uid } : s));
    tx.update(ref, { stages, updatedAt: Date.now() });
    audit(tx, ctx, `prototype.stage_${input.decision}`, "prototype", `${pid}/${id}`, { stage: st.name, status: st.status }, { status, comment: input.comment });
  });
  return ok();
});
