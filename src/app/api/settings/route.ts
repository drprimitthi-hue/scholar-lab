import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { settingsSchema } from "@/lib/schemas";
import { shallowDiff } from "@/lib/domain/diff";
import { syncInfo } from "@/lib/server/publicSync";

export const PUT = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, settingsSchema);
  const uniq = (xs: string[]) => new Set(xs).size === xs.length;
  if (!uniq(input.programmes.map((p) => p.id))) throw new HttpError(400, "Programme ids must be unique");
  if (!uniq(input.leaveTypes.map((t) => t.id))) throw new HttpError(400, "Leave type ids must be unique");
  const current = await getSettings();
  const diff = shallowDiff(current as unknown as Record<string, unknown>, input as unknown as Record<string, unknown>);
  const batch = db().batch();
  batch.set(db().doc("settings/lab"), input);
  audit(batch, ctx, "settings.updated", "settings", "lab", diff.before, diff.after);
  await batch.commit();
  await syncInfo();
  return ok();
});
