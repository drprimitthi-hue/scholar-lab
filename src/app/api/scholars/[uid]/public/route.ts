import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { loadScholar } from "@/lib/server/scholars";
import { syncPersonEverywhere } from "@/lib/server/publicSync";
import { publicHiddenSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ uid: string }> };

/** Supervisor can hide a scholar from the website even if they consented (never the reverse). */
export const PATCH = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { uid } = await params;
  const { hidden } = await parseBody(req, publicHiddenSchema);
  const { ref } = await loadScholar(uid);
  const b = db().batch();
  b.update(ref, { publicHidden: hidden });
  audit(b, ctx, hidden ? "public.hidden" : "public.unhidden", "scholar", uid);
  await b.commit();
  await syncPersonEverywhere(uid);
  return ok();
});
