import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";

/** Clears the "must change password" flag after the user has set their own password in the browser. */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor", "mentor", "scholar", "alumni"], skipMfa: true, recentAuthSeconds: 10 * 60 });
  const batch = db().batch();
  batch.update(db().doc(`users/${ctx.uid}`), { mustChangePassword: false });
  audit(batch, ctx, "user.password_changed", "user", ctx.uid);
  await batch.commit();
  return ok();
});
