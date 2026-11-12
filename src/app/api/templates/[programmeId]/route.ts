import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { HttpError, ok, parseBody, route } from "@/lib/server/http";
import { getSettings } from "@/lib/server/settings";
import { templateSchema } from "@/lib/schemas";

type Ctx = { params: Promise<{ programmeId: string }> };

export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const { programmeId } = await params;
  const settings = await getSettings();
  if (!settings.programmes.some((p) => p.id === programmeId)) throw new HttpError(404, "Unknown programme");
  const input = await parseBody(req, templateSchema);
  if (new Set(input.items.map((i) => i.key)).size !== input.items.length) throw new HttpError(400, "Milestone keys must be unique");
  const ref = db().doc(`milestoneTemplates/${programmeId}`);
  const before = (await ref.get()).data() ?? null;
  const batch = db().batch();
  batch.set(ref, { programmeId, items: input.items });
  audit(batch, ctx, "template.updated", "milestoneTemplate", programmeId, before, input);
  await batch.commit();
  return ok();
});
