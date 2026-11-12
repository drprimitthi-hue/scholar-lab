import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadProject, loadPlan, loadScholars, scholarCalendar } from "@/lib/server/projects";
import { getSettings } from "@/lib/server/settings";
import { planMoveSchema, planSchema } from "@/lib/schemas";
import { makeBatches, readingOrder } from "@/lib/domain/literature";
import { todayInTz } from "@/lib/domain/dates";
import type { LitItem, PlanDoc } from "@/lib/types";

type Ctx = { params: Promise<{ pid: string; uid: string }> };

/**
 * Create or re-plan a scholar's reading schedule. Past batches are kept as they are (history);
 * every item that is not in a past batch and not yet submitted/accepted is scheduled from today
 * (or the start date, if later) within the daily reading budget, skipping offs, holidays and leave.
 */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, uid } = await params;
  const input = await parseBody(req, planSchema);
  const { ref, data: project } = await loadProject(pid);
  if (!project.scholarUids.includes(uid)) throw new HttpError(400, "Scholar is not in this project");
  const [scholar] = await loadScholars([uid]);
  const settings = await getSettings();
  const today = todayInTz(settings.timezone);
  const prev = await loadPlan(pid, uid);

  const kept = (prev?.batches ?? []).filter((b) => b.date < today && b.itemIds.length);
  const inKept = new Set(kept.flatMap((b) => b.itemIds));
  const started = await db().collection("readingCards").where("projectId", "==", pid).where("uid", "==", uid).where("status", "in", ["submitted", "accepted"]).select("itemId").get();
  const done = new Set(started.docs.map((d) => d.get("itemId") as string));
  const items = (await ref.collection("literature").get()).docs.map((d) => d.data() as LitItem).filter((i) => !inKept.has(i.id) && !done.has(i.id));
  const start = prev && input.startDate < today ? today : input.startDate;
  const firstNo = kept.length ? Math.max(...kept.map((b) => b.no)) + 1 : 1;
  const fresh = makeBatches(readingOrder(items), input.dailyMinutes, start, await scholarCalendar(uid, settings), firstNo);

  const plan: PlanDoc = { uid, projectId: pid, mentorUids: scholar!.mentorUids, dailyMinutes: input.dailyMinutes, startDate: input.startDate, batches: [...kept, ...fresh], updatedAt: Date.now() };
  const b = db().batch();
  b.set(ref.collection("plans").doc(uid), plan);
  audit(b, ctx, prev ? "plan.rescheduled" : "plan.created", "plan", `${pid}/${uid}`, prev ? { batches: prev.batches.length } : null, { dailyMinutes: input.dailyMinutes, startDate: input.startDate, batches: plan.batches.length });
  await b.commit();
  return ok({ batches: plan.batches.length, scheduled: items.length });
});

/** Move one item to another batch. */
export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { pid, uid } = await params;
  const { itemId, toBatch } = await parseBody(req, planMoveSchema);
  await loadProject(pid);
  const ref = db().doc(`projects/${pid}/plans/${uid}`);
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, "No plan yet");
    const plan = snap.data() as PlanDoc;
    const from = plan.batches.find((x) => x.itemIds.includes(itemId));
    const to = plan.batches.find((x) => x.no === toBatch);
    if (!from || !to) throw new HttpError(400, "Item or batch not found");
    if (from.no === to.no) return;
    const batches = plan.batches.map((x) =>
      x.no === from.no ? { ...x, itemIds: x.itemIds.filter((i) => i !== itemId) } : x.no === to.no ? { ...x, itemIds: [...x.itemIds, itemId] } : x,
    );
    tx.update(ref, { batches, updatedAt: Date.now() });
    audit(tx, ctx, "plan.item_moved", "plan", `${pid}/${uid}`, { itemId, batch: from.no }, { itemId, batch: to.no });
  });
  return ok();
});
