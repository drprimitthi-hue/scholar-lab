import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { getSiteContent, syncInfo, syncPersonEverywhere } from "@/lib/server/publicSync";
import { siteSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";

/** Website content (about, research themes, PI profile, contact, publishing options). */
export const PUT = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, siteSchema);
  const before = await getSiteContent();
  const diff = shallowDiff(before as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>);
  const b = db().batch();
  b.set(db().doc("siteContent/main"), input);
  audit(b, ctx, "site.content_updated", "site", "main", diff.before, diff.after);
  await b.commit();
  await syncInfo();
  if ("completionStatuses" in diff.after) for (const d of (await db().collection("scholars").select().get()).docs) await syncPersonEverywhere(d.id);
  return ok();
});
