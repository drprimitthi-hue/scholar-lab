import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { leaveDecisionSchema } from "@/lib/schemas";
import type { LeaveDoc } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar"] });
  const { id } = await params;
  if (!/^[A-Za-z0-9]{1,64}$/.test(id)) throw new HttpError(400, "Invalid id");
  const input = await parseBody(req, leaveDecisionSchema);
  const settings = await getSettings();
  const ref = db().doc(`leaves/${id}`);

  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "Leave not found");
    const leave = snap.data() as LeaveDoc;

    if (input.action === "cancel") {
      const own = ctx.role === "scholar" && leave.uid === ctx.uid && leave.status === "pending";
      const sup = ctx.role === "supervisor" && (leave.status === "pending" || leave.status === "approved");
      if (!own && !sup) throw new HttpError(403, "This leave cannot be cancelled");
      tx.update(ref, { status: "cancelled", decidedBy: ctx.uid, decidedAt: Date.now() });
      audit(tx, ctx, "leave.cancelled", "leave", id, { status: leave.status }, { status: "cancelled" });
      return;
    }

    const mayDecide =
      ctx.role === "supervisor" ||
      (ctx.role === "mentor" && settings.mentorCanApproveLeave && leave.mentorUids.includes(ctx.uid));
    if (!mayDecide) throw new HttpError(403, "Not permitted");
    if (leave.status !== "pending") throw new HttpError(409, "Already decided");
    const status = input.action === "approve" ? "approved" : "rejected";
    tx.update(ref, { status, decidedBy: ctx.uid, decidedAt: Date.now(), decisionRemark: input.remark });
    audit(tx, ctx, `leave.${status}`, "leave", id, { status: "pending" }, { status, remark: input.remark });
  });
  return ok();
});
