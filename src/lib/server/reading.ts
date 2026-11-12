import "server-only";
import { db } from "./admin";
import { HttpError } from "./http";
import type { AuthContext } from "./policy";
import { acceptedItemIds, loadPlan, loadProject } from "./projects";
import { getSettings } from "./settings";
import { releasedBatches } from "../domain/literature";
import { todayInTz } from "../domain/dates";
import type { LitItem } from "../types";

/** A scholar may work on an item only if it is in one of their released batches. */
export async function assertReleased(ctx: AuthContext, pid: string, itemId: string) {
  const { ref, data: project } = await loadProject(pid);
  if (!project.scholarUids.includes(ctx.uid)) throw new HttpError(403, "Not part of this project");
  if (project.status !== "active") throw new HttpError(409, "This project is not active");
  const plan = await loadPlan(pid, ctx.uid);
  if (!plan) throw new HttpError(409, "Your reading plan has not been set yet");
  const settings = await getSettings();
  const released = releasedBatches(plan.batches, todayInTz(settings.timezone), project.releaseMode, project.gateThreshold, await acceptedItemIds(pid, ctx.uid));
  const batch = plan.batches.find((b) => b.itemIds.includes(itemId));
  if (!batch || !released.has(batch.no)) throw new HttpError(403, "This paper is not released to you yet");
  const item = await ref.collection("literature").doc(itemId).get();
  if (!item.exists) throw new HttpError(404, "Paper not found");
  const scholar = await db().doc(`scholars/${ctx.uid}`).get();
  return { project, item: item.data() as LitItem, scholar: { name: String(scholar.get("name") ?? ""), mentorUids: (scholar.get("mentorUids") as string[]) ?? [] } };
}
