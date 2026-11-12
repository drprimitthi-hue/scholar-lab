import type { NextRequest } from "next/server";
import { adminAuth, db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { randomPassword } from "@/lib/server/settings";
import { userAdminSchema } from "@/lib/schemas";
import type { UserDoc } from "@/lib/types";
import { syncPersonEverywhere } from "@/lib/server/publicSync";

type Ctx = { params: Promise<{ uid: string }> };

export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const { action } = await parseBody(req, userAdminSchema);
  if (uid === ctx.uid) throw new HttpError(400, "You cannot change your own account here");

  const ref = db().doc(`users/${uid}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpError(404, "User not found");
  const user = snap.data() as UserDoc;
  if (user.role === "supervisor") throw new HttpError(403, "Not permitted");
  if (user.status === "pending_deletion") throw new HttpError(409, "This account is scheduled for deletion");

  const batch = db().batch();
  let result: Record<string, unknown> = { ok: true };

  switch (action) {
    case "disable":
      await adminAuth().updateUser(uid, { disabled: true });
      await adminAuth().setCustomUserClaims(uid, { role: user.role, active: false });
      await adminAuth().revokeRefreshTokens(uid);
      batch.update(ref, { status: "disabled" });
      break;
    case "enable":
      await adminAuth().updateUser(uid, { disabled: false });
      await adminAuth().setCustomUserClaims(uid, { role: user.role, active: true });
      batch.update(ref, { status: "active" });
      break;
    case "reset_password": {
      const tempPassword = randomPassword();
      await adminAuth().updateUser(uid, { password: tempPassword });
      await adminAuth().revokeRefreshTokens(uid);
      batch.update(ref, { mustChangePassword: true });
      result = { ok: true, tempPassword };
      break;
    }
    case "reset_2fa": {
      // For a mentor/scholar who lost their authenticator. Sensitive: needs a fresh sign-in by the supervisor.
      if (Date.now() / 1000 - ctx.authTime > 15 * 60) throw new HttpError(401, "Please sign in again to confirm this action");
      await adminAuth().updateUser(uid, { multiFactor: { enrolledFactors: null } });
      await adminAuth().revokeRefreshTokens(uid);
      break;
    }
    case "archive":
      if (user.role !== "scholar") throw new HttpError(400, "Only scholars can be archived");
      await adminAuth().setCustomUserClaims(uid, { role: "alumni", active: true });
      await adminAuth().revokeRefreshTokens(uid);
      batch.update(ref, { role: "alumni" });
      break;
    case "unarchive":
      if (user.role !== "alumni") throw new HttpError(400, "Account is not archived");
      await adminAuth().setCustomUserClaims(uid, { role: "scholar", active: true });
      await adminAuth().revokeRefreshTokens(uid);
      batch.update(ref, { role: "scholar" });
      break;
  }
  audit(batch, ctx, `user.${action}`, "user", uid, { status: user.status, role: user.role }, null);
  await batch.commit();
  if (user.role === "scholar" || user.role === "alumni") await syncPersonEverywhere(uid);
  return ok(result);
});
