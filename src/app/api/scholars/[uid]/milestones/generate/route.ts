import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { generateMilestones } from "@/lib/domain/milestones";
import { DEFAULT_TEMPLATES } from "@/lib/domain/defaults";
import type { MilestoneTemplate } from "@/lib/types";

type Ctx = { params: Promise<{ uid: string }> };

/** Create milestones from the programme template — only when the scholar has none (never overwrites records). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const { ref, data } = await loadScholar(uid);
  const existing = (await ref.collection("milestones").count().get()).data().count;
  if (existing > 0) throw new HttpError(409, "Milestones already exist; add or edit them individually");
  const t = await db().doc(`milestoneTemplates/${data.programmeId}`).get();
  const template = (t.data() as MilestoneTemplate | undefined) ?? DEFAULT_TEMPLATES.find((x) => x.programmeId === data.programmeId);
  const items = generateMilestones(template?.items ?? [], data.joiningDate);
  if (items.length === 0) throw new HttpError(400, "The programme template has no milestones");
  const batch = db().batch();
  const now = Date.now();
  for (const m of items)
    batch.set(ref.collection("milestones").doc(), {
      ...m, uid, mentorUids: data.mentorUids, status: "not_started", completedOn: null,
      scholarNote: "", remarks: "", approvedBy: null, evidence: [], updatedAt: now,
    });
  audit(batch, ctx, "milestones.generated", "scholar", uid, null, { count: items.length });
  await batch.commit();
  return ok({ created: items.length }, 201);
});
