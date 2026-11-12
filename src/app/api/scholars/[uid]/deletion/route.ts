import type { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { deletionSchema } from "@/lib/schemas";
import { syncPersonEverywhere } from "@/lib/server/publicSync";

type Ctx = { params: Promise<{ uid: string }> };
const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** Schedule permanent deletion (supervisor only, fresh sign-in, typed-name confirmation, 7-day grace). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"], recentAuthSeconds: 5 * 60 });
  const { uid } = await params;
  const input = await parseBody(req, deletionSchema);
  const { ref, data } = await loadScholar(uid);
  if (data.deletion) throw new HttpError(409, "Already scheduled");
  if (input.confirmName.trim().toLowerCase() !== data.name.trim().toLowerCase())
    throw new HttpError(400, "The typed name does not match");
  const now = Date.now();
  const deletion = { scheduledAt: now, purgeAfter: now + GRACE_MS, keepMinimal: input.keepMinimal };
  await adminAuth().updateUser(uid, { disabled: true });
  await adminAuth().setCustomUserClaims(uid, { role: "scholar", active: false });
  await adminAuth().revokeRefreshTokens(uid);
  const batch = db().batch();
  batch.update(ref, { deletion });
  batch.update(db().doc(`users/${uid}`), { status: "pending_deletion" });
  audit(batch, ctx, "scholar.deletion.scheduled", "scholar", uid, null, deletion);
  await batch.commit();
  await syncPersonEverywhere(uid);
  return ok({ purgeAfter: deletion.purgeAfter });
});

/** Cancel a scheduled deletion and restore access. */
export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const { ref, data } = await loadScholar(uid);
  if (!data.deletion) throw new HttpError(409, "No deletion scheduled");
  const userSnap = await db().doc(`users/${uid}`).get();
  const role = (userSnap.get("role") as string) ?? "scholar";
  await adminAuth().updateUser(uid, { disabled: false });
  await adminAuth().setCustomUserClaims(uid, { role, active: true });
  const batch = db().batch();
  batch.update(ref, { deletion: null });
  batch.update(db().doc(`users/${uid}`), { status: "active" });
  audit(batch, ctx, "scholar.deletion.cancelled", "scholar", uid, data.deletion, null);
  await batch.commit();
  await syncPersonEverywhere(uid);
  return ok();
});
