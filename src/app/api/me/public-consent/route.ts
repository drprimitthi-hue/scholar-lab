import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { syncPersonEverywhere } from "@/lib/server/publicSync";
import { consentSchema } from "@/lib/schemas";

/** A scholar decides whether their name, programme and topic may appear on the public lab website. */
export const PUT = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["scholar", "alumni"] });
  const { consent } = await parseBody(req, consentSchema);
  const b = db().batch();
  b.update(db().doc(`scholars/${ctx.uid}`), { publicConsent: consent });
  audit(b, ctx, consent ? "public.consent_given" : "public.consent_withdrawn", "scholar", ctx.uid);
  await b.commit();
  await syncPersonEverywhere(ctx.uid);
  return ok();
});
