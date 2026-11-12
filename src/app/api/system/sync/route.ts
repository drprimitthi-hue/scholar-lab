import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { guard } from "@/lib/server/guard";
import { ok, route } from "@/lib/server/http";
import { checkStorage, deployIndexes, deployRules } from "@/lib/server/provision";

/** Re-apply the security rules and indexes shipped with this version (after an update). */
export const POST = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"], recentAuthSeconds: 15 * 60 });
  const results = [await deployRules(), await deployIndexes(), await checkStorage()];
  await db().collection("auditLog").add({ actorUid: ctx.uid, actorRole: ctx.role, action: "system.rules_synced", targetType: "system", targetId: "rules", before: null, after: { results }, at: Date.now() });
  return ok({ results });
});
