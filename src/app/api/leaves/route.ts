import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { assertUpload, loadScholar } from "@/lib/server/scholars";
import { getSettings } from "@/lib/server/settings";
import { leaveApplySchema } from "@/lib/schemas";
import { daysBetween, workingDays } from "@/lib/domain/dates";
import type { LeaveDoc } from "@/lib/types";

/** Scholar applies for leave. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["scholar"] });
  const input = await parseBody(req, leaveApplySchema);
  const settings = await getSettings();
  const type = settings.leaveTypes.find((t) => t.id === input.type);
  if (!type) throw new HttpError(400, "Unknown leave type");
  if (daysBetween(input.from, input.to) < 0) throw new HttpError(400, "End date is before start date");
  if (daysBetween(input.from, input.to) > 180) throw new HttpError(400, "Leave longer than 180 days needs the supervisor");
  const days = workingDays(input.from, input.to, settings.weekendDays, settings.holidays);
  if (days === 0) throw new HttpError(400, "The selected dates contain no working days");
  if (input.documentPath) await assertUpload(ctx.uid, input.documentPath);
  const { data: scholar } = await loadScholar(ctx.uid);

  const mine = (await db().collection("leaves").where("uid", "==", ctx.uid).get()).docs.map((d) => d.data() as LeaveDoc);
  const active = mine.filter((l) => l.status === "pending" || l.status === "approved");
  if (active.some((l) => !(input.to < l.from || input.from > l.to))) throw new HttpError(409, "Overlaps an existing leave");
  if (type.yearlyQuota > 0) {
    const year = input.from.slice(0, 4);
    const used = active.filter((l) => l.type === type.id && l.from.startsWith(year)).reduce((s, l) => s + l.days, 0);
    if (used + days > type.yearlyQuota)
      throw new HttpError(400, `Exceeds ${type.name} balance (${Math.max(0, type.yearlyQuota - used)} day(s) left this year)`);
  }

  const ref = db().collection("leaves").doc();
  const doc: LeaveDoc = {
    id: ref.id, uid: ctx.uid, mentorUids: scholar.mentorUids, scholarName: scholar.name, type: type.id,
    from: input.from, to: input.to, days, reason: input.reason, documentPath: input.documentPath ?? null,
    status: "pending", decidedBy: null, decidedAt: null, decisionRemark: "", createdAt: Date.now(),
  };
  const batch = db().batch();
  batch.set(ref, doc);
  audit(batch, ctx, "leave.applied", "leave", ref.id, null, { type: type.id, from: input.from, to: input.to, days });
  await batch.commit();
  return ok({ id: ref.id, days }, 201);
});
