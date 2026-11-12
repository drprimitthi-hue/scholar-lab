import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { getSettings } from "@/lib/server/settings";
import { enrolmentPatchSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";
import { autoNews, getSiteContent, syncPersonEverywhere } from "@/lib/server/publicSync";

type Ctx = { params: Promise<{ uid: string }> };

/** Update the enrolment record (supervisor only). */
export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const patch = await parseBody(req, enrolmentPatchSchema);
  const { ref, data } = await loadScholar(uid);
  if (data.deletion) throw new HttpError(409, "Scheduled for deletion; cancel the deletion first");

  const settings = await getSettings();
  if (patch.programmeId && !settings.programmes.some((p) => p.id === patch.programmeId))
    throw new HttpError(400, "Unknown programme");
  if (patch.status && !settings.statuses.includes(patch.status)) throw new HttpError(400, "Unknown status");

  const diff = shallowDiff(data as unknown as Record<string, unknown>, patch as Record<string, unknown>);
  if (Object.keys(diff.after).length === 0) return ok({ ok: true, changed: 0 });

  const batch = db().batch();
  batch.update(ref, { ...diff.after, updatedAt: Date.now() });
  if (typeof diff.after.name === "string") batch.update(db().doc(`users/${uid}`), { name: diff.after.name });
  audit(batch, ctx, "scholar.enrolment.updated", "scholar", uid, diff.before, diff.after);
  await batch.commit();
  await syncPersonEverywhere(uid);
  if (typeof diff.after.status === "string" && data.publicConsent && !data.publicHidden) {
    const site = await getSiteContent();
    if (site.completionStatuses.includes(diff.after.status)) {
      const prog = settings.programmes.find((p) => p.id === (patch.programmeId ?? data.programmeId))?.name ?? "degree";
      await autoNews(`Congratulations, ${patch.name ?? data.name}!`, `${patch.name ?? data.name} has completed the ${prog}${data.researchTopic ? ` with work on "${data.researchTopic}"` : ""}.`);
    }
  }
  return ok({ ok: true, changed: Object.keys(diff.after).length });
});
