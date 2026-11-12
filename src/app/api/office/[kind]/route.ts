import type { NextRequest } from "next/server";
import { db } from "@/lib/server/admin";
import { audit } from "@/lib/server/audit";
import { guard } from "@/lib/server/guard";
import { ok, parseBody, route } from "@/lib/server/http";
import { officeKind, prepare } from "@/lib/server/office";

type Ctx = { params: Promise<{ kind: string }> };

/** Create a diary entry / meeting / duty / office order / record / semester (supervisor only). */
export const POST = route<Ctx>(async (req: NextRequest, { params }) => {
  const ctx = await guard(req, { roles: ["supervisor"] });
  const k = officeKind((await params).kind);
  const input = await parseBody(req, k.schema as never, 64 * 1024);
  const body = await prepare(ctx, k.kind, input);
  const ref = db().collection(k.collection).doc();
  const now = Date.now();
  const b = db().batch();
  if (k.kind === "semesters" && body.active) for (const d of (await db().collection("officeSemesters").where("active", "==", true).get()).docs) b.update(d.ref, { active: false });
  b.set(ref, { id: ref.id, ...body, createdAt: now, updatedAt: now });
  // Office content is private; the audit trail records only what happened, not the content.
  audit(b, ctx, `office.${k.kind}.created`, "office", ref.id, null, null);
  await b.commit();
  return ok({ id: ref.id }, 201);
});
