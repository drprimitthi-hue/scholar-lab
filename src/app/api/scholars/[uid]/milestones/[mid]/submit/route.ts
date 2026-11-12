import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertUpload } from "@/lib/server/scholars";
import { milestoneSubmitSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ uid: string; mid: string }> };

/** Scholar submits a milestone with a note and evidence files for the supervisor's approval. */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const { uid, mid } = await params;
  if (ctx.uid !== uid) throw new HttpError(403, "Not permitted");
  if (!/^[A-Za-z0-9]{1,64}$/.test(mid)) throw new HttpError(400, "Invalid id");
  const input = await parseBody(req, milestoneSubmitSchema);
  const ref = db().doc(`scholars/${uid}/milestones/${mid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Milestone not found");
  const status = snap.get("status");
  if (status === "approved" || status === "waived") throw new HttpError(409, "This milestone is already closed");
  for (const e of input.evidence) await assertUpload(uid, e.path);
  const prevEvidence = (snap.get("evidence") as { path: string; name: string }[]) ?? [];
  const evidence = [...prevEvidence, ...input.evidence.filter((e) => !prevEvidence.some((p) => p.path === e.path))].slice(0, 20);
  const batch = db().batch();
  batch.update(ref, { status: "submitted", scholarNote: input.scholarNote, evidence, updatedAt: Date.now() });
  audit(batch, ctx, "milestone.submitted", "milestone", `${uid}/${mid}`, { status }, { status: "submitted", scholarNote: input.scholarNote, evidence });
  await batch.commit();
  return ok();
});
