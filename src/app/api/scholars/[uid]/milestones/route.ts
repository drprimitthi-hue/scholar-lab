import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { milestoneCreateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ uid: string }> };

export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const input = await parseBody(req, milestoneCreateSchema);
  const { ref, data } = await loadScholar(uid);
  const count = (await ref.collection("milestones").count().get()).data().count;
  const mRef = ref.collection("milestones").doc();
  const doc = {
    ...input,
    uid,
    mentorUids: data.mentorUids,
    order: count,
    status: "not_started",
    completedOn: null,
    scholarNote: "",
    remarks: "",
    approvedBy: null,
    evidence: [],
    updatedAt: Date.now(),
  };
  const batch = db().batch();
  batch.set(mRef, doc);
  audit(batch, ctx, "milestone.created", "milestone", `${uid}/${mRef.id}`, null, input);
  await batch.commit();
  return ok({ id: mRef.id }, 201);
});
