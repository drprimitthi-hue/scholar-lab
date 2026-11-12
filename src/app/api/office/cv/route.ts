import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { cvSchema } from "@/lib/schemas";

export const PUT = route(async (req: NextRequest) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const input = await parseBody(req, cvSchema, 64 * 1024);
  const b = db().batch();
  b.set(db().doc("officeCv/main"), { ...input, updatedAt: Date.now() });
  audit(b, ctx, "office.cv.updated", "office", "cv", null, null);
  await b.commit();
  return ok();
});
