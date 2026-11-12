import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { milestoneUpdateSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";
import { todayInTz } from "@/lib/domain/dates";

type Ctx = { params: Promise<{ uid: string; mid: string }> };

async function load(uid: string, mid: string) {
  if (!/^[A-Za-z0-9]{1,64}$/.test(mid)) throw new HttpError(400, "Invalid id");
  const ref = db().doc(`scholars/${uid}/milestones/${mid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "Milestone not found");
  return { ref, data: snap.data() as Record<string, unknown> };
}

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid, mid } = await params;
  const patch = await parseBody(req, milestoneUpdateSchema);
  const { ref, data } = await load(uid, mid);
  const update: Record<string, unknown> = { ...patch };
  if (patch.status === "approved") {
    update.approvedBy = ctx.uid;
    if (!patch.completedOn && !data.completedOn) update.completedOn = todayInTz((await getSettings()).timezone);
  }
  if (patch.completedOn === "") update.completedOn = null;
  const diff = shallowDiff(data, update);
  if (!Object.keys(diff.after).length) return ok({ ok: true, changed: 0 });
  const batch = db().batch();
  batch.update(ref, { ...diff.after, updatedAt: Date.now() });
  audit(batch, ctx, "milestone.updated", "milestone", `${uid}/${mid}`, diff.before, diff.after);
  await batch.commit();
  return ok();
});

export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"], recentAuthSeconds: 15 * 60 });
  const { uid, mid } = await params;
  const { ref, data } = await load(uid, mid);
  const batch = db().batch();
  batch.delete(ref);
  audit(batch, ctx, "milestone.deleted", "milestone", `${uid}/${mid}`, data, null);
  await batch.commit();
  return ok();
});
